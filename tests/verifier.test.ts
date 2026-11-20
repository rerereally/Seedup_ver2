import { test } from 'node:test';
import assert from 'node:assert/strict';
import { callJsonModel } from '../lib/llm';
import type { VerificationRecord, VerificationStore } from '../lib/db/verifications';
import { readVerificationToken, signVerificationToken } from '../lib/supervisor/verify-token';
import { verifyCitation } from '../lib/verifier/citations';
import { collectGitHubEvidence, MAX_FILE_ATTEMPTS, type GitHubEvidence } from '../lib/verifier/github';
import { getVerification, NO_COMPLIANT_PROVIDER_ERROR, startVerification, verifierModels, type StartVerificationInput, type VerifierDependencies } from '../lib/verifier/run';

const sha = 'a'.repeat(40);
const input: StartVerificationInput = {
  userId: 'user-1', projectKey: 'project', featureId: 'F-1', repo: 'owner/repo', sha,
  criteria: [{ id: 'AC-1', text: 'Return the answer', paths: ['src/answer.ts'] }],
};
const diff = 'diff --git a/src/answer.ts b/src/answer.ts\n--- a/src/answer.ts\n+++ b/src/answer.ts\n@@ -1 +1 @@\n+export const answer = 42;\n';
const evidence = (): GitHubEvidence => ({ sha, diff, files: { 'src/answer.ts': 'export const answer = 42;\n' }, checks: [{ name: 'test', conclusion: 'success' }], unseen: [] });
const response = (quote = 'export const answer = 42;') => ({ verdicts: [{ criterion: 'AC-1', verdict: 'met', reason: 'The implementation returns the answer.', citations: [{ path: 'src/answer.ts', line: 1, quote, verified: true }] }] });

function harness(overrides: { evidence?: GitHubEvidence; response?: unknown; failSave?: boolean; allowed?: boolean } = {}) {
  const saved = new Map<string, VerificationRecord>();
  let calls = 0;
  let collected = 0;
  let charged = 0;
  let refunded = 0;
  let saves = 0;
  const store: VerificationStore = {
    authorize: async () => {},
    find: async (scope) => [...saved.values()].find((row) => row.userId === scope.userId && row.projectKey === scope.projectKey && row.featureId === scope.featureId && row.repo === scope.repo && row.sha === scope.sha) ?? null,
    claim: async (row) => {
      const existing = [...saved.values()].find((item) => item.userId === row.userId && item.projectKey === row.projectKey && item.featureId === row.featureId && item.repo === row.repo && item.sha === row.sha);
      if (existing) return structuredClone(existing);
      saved.set(row.id, structuredClone(row));
      return row;
    },
    save: async (row) => { if (overrides.failSave && saves++ === 0) throw new Error('DB write failed'); saved.set(row.id, structuredClone(row)); },
    get: async (userId, id) => { const row = saved.get(id); return row?.userId === userId ? structuredClone(row) : null; },
    consume: async () => { charged++; return overrides.allowed ?? true; },
    refund: async () => { refunded++; },
  };
  const dependencies: VerifierDependencies = {
    store,
    github: async () => { collected++; return overrides.evidence ?? evidence(); },
    model: async <T>(_prompt: string, options?: Parameters<typeof callJsonModel>[1]) => {
      calls++;
      assert.equal(options?.noDataCollection, true);
      assert.equal(options?.reasoning, 'high');
      assert.ok(options?.deadline && options.deadline <= Date.now() + 110_000);
      assert.equal(options?.attempts, 1);
      assert.equal(options?.models?.length, 1);
      options?.onUsage?.({ model: options.models[0], promptTokens: 10, completionTokens: 20 });
      return (overrides.response === undefined ? response() : overrides.response) as T | null;
    },
    sign: (payload) => signVerificationToken(payload, 'test-signing-key'),
  };
  return { dependencies, saved, stats: () => ({ calls, collected, charged, refunded }) };
}

test('verifier: immutable evidence, gates, accounting and cache', async (t) => {
  const previous = process.env.VERIFIER_MODELS;
  process.env.VERIFIER_MODELS = 'vendor/paid-one,vendor/paid-two';
  try {
    await t.test('blocker stops before the model or usage charge', async () => {
      const h = harness({ evidence: { ...evidence(), diff: diff.replace('export const answer = 42;', 'throw new Error("not implemented");') } });
      const result = await startVerification(input, h.dependencies);
      assert.equal(result.status, 'blocked');
      assert.equal(result.token, null);
      assert.deepEqual(h.stats(), { calls: 0, collected: 1, charged: 0, refunded: 0 });
    });
    await t.test('invented citation is unverified and unclear despite the model claiming met', async () => {
      const h = harness({ response: response('invented implementation') });
      const result = await startVerification(input, h.dependencies);
      assert.equal(result.status, 'failed');
      assert.equal(result.verdicts[0].verdict, 'unclear');
      assert.equal(result.verdicts[0].citations[0].verified, false);
      assert.equal(result.token, null);
    });
    await t.test('missing required file or missing criterion cannot produce a verified token', async () => {
      const h = harness();
      const result = await startVerification({ ...input, criteria: [{ ...input.criteria[0], paths: ['unread.ts'] }] }, h.dependencies);
      assert.equal(result.verdicts[0].verdict, 'unclear');
      assert.equal(result.token, null);
      const missing = harness({ response: { verdicts: [] } });
      assert.equal((await startVerification(input, missing.dependencies)).status, 'error');
      assert.equal(missing.stats().calls, 2);
    });
    await t.test('concurrent requests reuse the running ID without double charging', async () => {
      const h = harness();
      let release!: () => void;
      const paused = new Promise<void>((resolve) => { release = resolve; });
      const collect = h.dependencies.github!;
      h.dependencies.github = async (...args) => { await paused; return collect(...args); };
      const first = startVerification(input, h.dependencies);
      // Let both find/claim boundaries run; no sleeps or real network.
      const second = startVerification(input, h.dependencies);
      const pending = await second;
      assert.equal(pending.status, 'running');
      assert.equal(h.stats().calls, 0);
      release();
      const finished = await first;
      assert.equal(finished.id, pending.id);
      assert.equal(h.stats().calls, 1);
      assert.equal(h.stats().charged, 1);
    });
    await t.test('failed CI forces a test criterion to not_met', async () => {
      const h = harness({ evidence: { ...evidence(), checks: [{ name: 'tests', conclusion: 'failure' }] } });
      const result = await startVerification({ ...input, criteria: [{ id: 'AC-1', text: '테스트 통과' }] }, h.dependencies);
      assert.equal(result.verdicts[0].verdict, 'not_met');
      assert.equal(result.token, null);
    });
    await t.test('missing, pending, skipped or neutral CI cannot pass a test criterion', async () => {
      for (const conclusion of [undefined, null, 'skipped', 'neutral']) {
        const h = harness({ evidence: { ...evidence(), checks: conclusion === undefined ? [] : [{ name: 'tests', conclusion }] } });
        const result = await startVerification({ ...input, criteria: [{ id: 'AC-1', text: 'All checks pass', kind: 'test' }] }, h.dependencies);
        assert.equal(result.verdicts[0].verdict, 'unclear');
        assert.equal(result.token, null);
      }
    });
    await t.test('green CI from a commit that rewrote CI config cannot pass a test criterion and is reported as drift', async () => {
      const ciDiff = `${diff}diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml\n--- a/.github/workflows/ci.yml\n+++ b/.github/workflows/ci.yml\n@@ -1 +1 @@\n-    - run: npm test\n+    - run: echo ok\n`;
      const files = { 'src/answer.ts': 'export const answer = 42;\n', 'tests/answer.test.ts': 'assert.equal(answer, 42);\n' };
      const testResponse = { verdicts: [{ criterion: 'AC-1', verdict: 'met', reason: 'Tested.', citations: [{ path: 'tests/answer.test.ts', line: 1, quote: 'assert.equal(answer, 42);' }] }] };
      const h = harness({ evidence: { ...evidence(), diff: ciDiff, files }, response: testResponse });
      const result = await startVerification({ ...input, criteria: [{ id: 'AC-1', text: 'Tests pass', kind: 'test' }] }, h.dependencies);
      assert.equal(result.verdicts[0].verdict, 'unclear');
      assert.match(result.verdicts[0].reason, /\.github\/workflows\/ci\.yml/);
      assert.equal(result.token, null);
      assert.deepEqual(result.drift.map(({ kind, files: paths }) => ({ kind, paths })), [{ kind: 'out_of_spec', paths: ['.github/workflows/ci.yml'] }]);

      const failing = harness({ evidence: { ...evidence(), diff: ciDiff, files, checks: [{ name: 'tests', conclusion: 'failure' }] }, response: testResponse });
      assert.equal((await startVerification({ ...input, criteria: [{ id: 'AC-1', text: 'Tests pass', kind: 'test' }] }, failing.dependencies)).verdicts[0].verdict, 'not_met');

      const plain = harness({ evidence: { ...evidence(), diff: ciDiff } });
      const code = await startVerification(input, plain.dependencies);
      assert.equal(code.verdicts[0].verdict, 'met', 'a code criterion is not judged by CI');
    });
    await t.test('green CI does not confirm a test criterion without a verified test citation', async () => {
      const h = harness();
      const result = await startVerification({ ...input, criteria: [{ id: 'AC-1', text: 'Tests pass', kind: 'test' }] }, h.dependencies);
      assert.equal(result.verdicts[0].verdict, 'unclear');
      assert.deepEqual(result.verdicts[0].testEvidence, { criterionText: 'Tests pass', files: [], checks: [] });
      assert.equal(result.token, null);
    });
    await t.test('all met issues a token bound to user, project, feature and SHA and counts usage', async () => {
      const h = harness();
      const result = await startVerification(input, h.dependencies);
      assert.equal(result.status, 'passed');
      assert.ok(result.token);
      assert.ok(readVerificationToken(result.token, input, 'test-signing-key'));
      assert.equal(result.inputTokens, 10);
      assert.equal(result.outputTokens, 20);
      assert.deepEqual(h.stats(), { calls: 1, collected: 1, charged: 1, refunded: 0 });
      assert.equal((await startVerification({ ...input, sha: sha.toUpperCase() }, h.dependencies)).id, result.id);
      assert.equal(h.stats().calls, 1);
      assert.equal(h.stats().collected, 1);
      assert.equal(h.stats().charged, 1);
      assert.equal((await getVerification(input.userId, result.id, h.dependencies))?.status, 'passed');
      assert.equal(await getVerification('other-user', result.id, h.dependencies), null);
      await startVerification({ ...input, userId: 'other-user' }, h.dependencies);
      assert.equal(h.stats().calls, 2);
    });
    await t.test('malformed replies stop after two paid calls and refund the reservation', async () => {
      const h = harness({ response: { verdicts: [] } });
      const result = await startVerification(input, h.dependencies);
      assert.equal(result.status, 'error');
      assert.deepEqual(h.stats(), { calls: 2, collected: 1, charged: 1, refunded: 1 });
    });
    await t.test('downstream persistence failure refunds once and clears a minted token', async () => {
      const h = harness({ failSave: true });
      const result = await startVerification(input, h.dependencies);
      assert.equal(result.status, 'error');
      assert.equal(result.token, null);
      assert.equal(h.stats().refunded, 1);
    });
    await t.test('usage limit prevents all model calls', async () => {
      const h = harness({ allowed: false });
      assert.equal((await startVerification(input, h.dependencies)).status, 'error');
      assert.equal(h.stats().calls, 0);
      assert.equal(h.stats().refunded, 0);
    });
    await t.test('secrets in unchanged files are masked before the model and never stored verbatim', async () => {
      const secret = `ghp_${'AbC123xy'.repeat(5)}`;
      const h = harness({ evidence: { ...evidence(), files: { ...evidence().files, 'old.ts': `const value = '${secret}';` } }, response: { ...response(), outOfScope: [{ files: ['old.ts'], message: secret }] } });
      const original = h.dependencies.model!;
      h.dependencies.model = async <T>(prompt: string, options?: Parameters<typeof callJsonModel>[1]) => {
        assert.equal(prompt.includes(secret), false);
        return original<T>(prompt, options);
      };
      const result = await startVerification(input, h.dependencies);
      assert.equal(JSON.stringify(result).includes(secret), false);
      assert.equal(JSON.stringify([...h.saved.values()]).includes(secret), false);
    });
    await t.test('model configuration rejects free and automatic routing, and separates model families', () => {
      for (const model of ['vendor/model:free', 'openrouter/free', 'exaone', 'openrouter/auto', ',']) {
        process.env.VERIFIER_MODELS = model;
        assert.throws(() => verifierModels());
      }
      delete process.env.VERIFIER_MODELS;
      assert.deepEqual(verifierModels(), ['openai/gpt-6.2-sol', 'anthropic/claude-haiku-5.5']);
      assert.deepEqual(verifierModels('openai/gpt-6.2-sol'), ['anthropic/claude-haiku-5.5']);
      process.env.VERIFIER_MODELS = ' ';
      assert.deepEqual(verifierModels('anthropic/claude-haiku-5.5'), ['openai/gpt-6.2-sol']);
      process.env.VERIFIER_MODELS = 'vendor/claude-one,vendor/gpt-two';
      assert.deepEqual(verifierModels('other/claude-dev'), ['vendor/gpt-two']);
    });
  } finally {
    if (previous === undefined) delete process.env.VERIFIER_MODELS; else process.env.VERIFIER_MODELS = previous;
  }
});

test('citations require literal characters at the specified line, including multiline quotes', () => {
  const files = { 'a.ts': 'const x = 1;\n  return x;\nend();' };
  assert.equal(verifyCitation({ path: 'a.ts', line: 2, quote: 'return x;\nend();' }, files).verified, true);
  for (const citation of [
    { path: 'a.ts', line: 1, quote: 'return x;' },
    { path: 'a.ts', line: 2, quote: 'RETURN x;' },
    { path: 'a.ts', line: 2, quote: 'return  x;' },
    { path: 'missing.ts', line: 1, quote: 'const x = 1;' },
    { path: 'toString', line: 1, quote: 'function' },
  ]) assert.equal(verifyCitation(citation, files).verified, false);
});

test('noDataCollection changes only opted-in OpenRouter request bodies and excludes free endpoints', async () => {
  const oldFetch = globalThis.fetch;
  const previousKey = process.env.OPENROUTER_API_KEY;
  const previousFree = process.env.OPENROUTER_FREE_ONLY;
  const previousFixture = process.env.LLM_FIXTURES;
  process.env.OPENROUTER_API_KEY = 'test-key';
  process.env.OPENROUTER_FREE_ONLY = 'true';
  delete process.env.LLM_FIXTURES;
  const bodies: Array<Record<string, unknown>> = [];
  globalThis.fetch = async (_url, options) => {
    bodies.push(JSON.parse(String(options?.body)) as Record<string, unknown>);
    return Response.json({ choices: [{ message: { content: '{"ok":true}' } }] });
  };
  try {
    assert.deepEqual(await callJsonModel('{"test":true}', { models: ['vendor/paid'], attempts: 1, noDataCollection: true }), { ok: true });
    assert.deepEqual(bodies[0].provider, { data_collection: 'deny' });
    await callJsonModel('test', { models: ['vendor/paid'], attempts: 1 });
    assert.equal(Object.hasOwn(bodies[1], 'provider'), false);
    await callJsonModel('test', { models: ['vendor/model:free', 'exaone', 'openrouter/auto'], noDataCollection: true });
    assert.equal(bodies.length, 2);
  } finally {
    globalThis.fetch = oldFetch;
    for (const [key, value] of Object.entries({ OPENROUTER_API_KEY: previousKey, OPENROUTER_FREE_ONLY: previousFree, LLM_FIXTURES: previousFixture })) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});

test('GitHub collector uses SHA-bound public REST data, paginates CI, and lists unread files', async () => {
  const paths: string[] = [];
  const request: typeof fetch = async (url, init) => {
    const path = String(url).replace('https://api.github.com/repos/owner/repo', '');
    paths.push(path);
    assert.equal((init?.headers as Record<string, string>).authorization, 'Bearer test-token');
    assert.equal(init?.redirect, 'error');
    if (!path) return Response.json({ private: false, visibility: 'public' });
    if (path.includes('/commits/') && path.includes('?per_page=')) return Response.json({ sha, commit: { tree: { sha: 'b'.repeat(40) } }, files: [{ filename: 'src/answer.ts', status: 'modified' }, { filename: 'large.ts', status: 'modified' }] });
    if (path === `/commits/${sha}`) return new Response(diff);
    if (path.startsWith('/git/trees/')) return Response.json({ truncated: false, tree: [{ path: 'src/answer.ts', type: 'blob', size: 26 }, { path: 'criterion.ts', type: 'blob', size: 16 }, { path: 'large.ts', type: 'blob', size: 200_000 }, { path: 'unrelated.ts', type: 'blob', size: 12 }] });
    if (path.startsWith('/contents/')) { assert.ok(path.endsWith(`?ref=${sha}`)); return new Response('export const answer = 42;\n'); }
    if (path.includes('/check-runs?')) {
      const second = path.endsWith('page=2');
      return Response.json({ total_count: 2, check_runs: [{ name: second ? 'lint' : 'tests', status: 'completed', conclusion: second ? 'failure' : 'success', head_sha: sha }] });
    }
    throw new Error('Unexpected test request');
  };
  const result = await collectGitHubEvidence('owner/repo', sha, ['criterion.ts'], { fetch: request, token: 'test-token' });
  assert.equal(result.diff, diff);
  assert.deepEqual(Object.keys(result.files), ['criterion.ts', 'src/answer.ts']);
  assert.ok(result.unseen.some((file) => file.path === 'large.ts'));
  assert.ok(result.unseen.some((file) => file.path === 'unrelated.ts'));
  assert.equal(result.checks.length, 2);
  assert.ok(paths.some((path) => path.endsWith('page=2')));
  assert.equal(paths.some((path) => path.startsWith('/contents/large.ts')), false);
  await assert.rejects(collectGitHubEvidence('owner/repo', sha, [], { token: 'test-token', fetch: async () => Response.json({ private: true }) }), /public/);
  await assert.rejects(collectGitHubEvidence('owner/repo', 'main', [], { token: 'test-token', fetch: request }), /SHA/);
  assert.equal(result.requestCount, paths.length);
});

test('GitHub collector caps failed and binary file request attempts and marks remaining files unseen', async () => {
  const totalFiles = MAX_FILE_ATTEMPTS + 10;
  const changed = Array.from({ length: totalFiles }, (_, i) => ({ filename: `src/f${i}.bin`, status: 'modified' }));
  const tree = changed.map((file) => ({ path: file.filename, type: 'blob', size: 128 }));
  let contentRequests = 0;
  let totalRequests = 0;
  const request: typeof fetch = async (url) => {
    totalRequests++;
    const path = String(url).replace('https://api.github.com/repos/owner/repo', '');
    if (!path) return Response.json({ private: false, visibility: 'public' });
    if (path.includes('/commits/') && path.includes('?per_page=')) return Response.json({ sha, commit: { tree: { sha: 'b'.repeat(40) } }, files: changed });
    if (path === `/commits/${sha}`) return new Response(diff);
    if (path.startsWith('/git/trees/')) return Response.json({ truncated: false, tree });
    if (path.startsWith('/contents/')) {
      contentRequests++;
      // Alternate between HTTP 500 failure and binary null-byte payload so 0 files succeed.
      return contentRequests % 2 === 0
        ? new Response('bad', { status: 500 })
        : new Response('bin\0data');
    }
    if (path.includes('/check-runs?')) return Response.json({ total_count: 0, check_runs: [] });
    throw new Error(`Unexpected path: ${path}`);
  };

  const result = await collectGitHubEvidence('owner/repo', sha, [], { fetch: request, token: 'test-token' });
  assert.equal(contentRequests, MAX_FILE_ATTEMPTS);
  assert.equal(Object.keys(result.files).length, 0);
  assert.equal(result.requestCount, totalRequests);
  const capped = result.unseen.filter((row) => row.reason === 'File request attempt limit');
  assert.equal(capped.length, 10);
});

test('startVerification records githubRequests and durationMs, and fails clearly with refund when data_collection deny has no provider', async () => {
  const previousModels = process.env.VERIFIER_MODELS;
  const previousKey = process.env.OPENROUTER_API_KEY;
  const previousFixture = process.env.LLM_FIXTURES;
  const oldFetch = globalThis.fetch;
  process.env.VERIFIER_MODELS = 'vendor/paid-one,vendor/paid-two';
  process.env.OPENROUTER_API_KEY = 'test-key';
  delete process.env.LLM_FIXTURES;
  try {
    // 1. Successful run records githubRequests and non-negative durationMs.
    const ok = harness({ evidence: { ...evidence(), requestCount: 7 } });
    const passed = await startVerification(input, ok.dependencies);
    assert.equal(passed.status, 'passed');
    assert.equal(passed.githubRequests, 7);
    assert.equal(typeof passed.durationMs, 'number');
    assert.ok((passed.durationMs ?? -1) >= 0);
    assert.equal(passed.errorMessage, null);

    // 2. OpenRouter returns 404 (no endpoint matches provider.data_collection = "deny"): never relaxes deny, sets explicit errorMessage, refunds usage.
    const seenProviders: unknown[] = [];
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as { provider?: unknown };
      seenProviders.push(body.provider);
      return new Response(JSON.stringify({ error: { message: 'No endpoints found that can handle the requested parameters' } }), { status: 404 });
    };
    const denied = harness({ evidence: { ...evidence(), requestCount: 6 } });
    denied.dependencies.model = callJsonModel;
    const failed = await startVerification(input, denied.dependencies);
    assert.equal(failed.status, 'error');
    assert.equal(failed.token, null);
    assert.equal(failed.errorMessage, NO_COMPLIANT_PROVIDER_ERROR);
    assert.equal(failed.githubRequests, 6);
    assert.equal(typeof failed.durationMs, 'number');
    assert.equal(denied.stats().charged, 1);
    assert.equal(denied.stats().refunded, 1);
    assert.equal(seenProviders.length, 2);
    for (const provider of seenProviders) {
      assert.deepEqual(provider, { data_collection: 'deny' });
    }
  } finally {
    globalThis.fetch = oldFetch;
    if (previousModels === undefined) delete process.env.VERIFIER_MODELS; else process.env.VERIFIER_MODELS = previousModels;
    if (previousKey === undefined) delete process.env.OPENROUTER_API_KEY; else process.env.OPENROUTER_API_KEY = previousKey;
    if (previousFixture === undefined) delete process.env.LLM_FIXTURES; else process.env.LLM_FIXTURES = previousFixture;
  }
});
