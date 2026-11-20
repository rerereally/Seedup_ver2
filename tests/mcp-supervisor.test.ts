import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { VerificationRecord, VerificationStore } from '../lib/db/verifications';
import { handleMcpRequest } from '../lib/mcp/endpoint';
import { handleRpc, type McpDeps } from '../lib/mcp/server';
import { backfillVerificationLevel, readBuildProgress, writeBuildProgress, type BuildProgress } from '../lib/opportunities/build-progress';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeSpec } from '../lib/opportunities/spec';
import type { Opportunity } from '../lib/opportunities/types';
import type { ProjectGoal, SupervisorProject } from '../lib/supervisor/types';
import { readVerificationToken, signVerificationToken } from '../lib/supervisor/verify-token';
import { startVerification, type StartVerificationInput, type VerifierDependencies } from '../lib/verifier/run';

const USER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PROJECT = 'notes';
const SHA = 'abcd1234'.repeat(5);
const SIGNING_KEY = 'test-signing-key';
const VERIFICATION = '11111111-1111-1111-1111-111111111111';
const AT = '2026-11-20T01:00:00Z';
const SITE = 'https://seedup.test';
const opportunity: Opportunity = {
  slug: PROJECT, name: 'Notes', problem: 'Retain notes', gap: '', keywords: [], status: 'open', qualified: false,
  platforms: [], evidence: [], supply: [], directCount: 0, firstSeenAt: null, followersAfterSignal: 0,
};
const input = { title: 'Notes', problem: opportunity.problem, gap: '', evidence: [], competitors: [] };
const spec = normalizeSpec({
  summary: 'Retain notes',
  requirements: [{ title: 'Save notes', evidence: [1], acceptance: ['Saving returns an ID', 'Notes test passes in CI'] }],
  features: [{ title: 'Save notes', requirements: [1] }, { title: 'Open notes', requirements: [1] }],
}, 1);
const goal: ProjectGoal = {
  projectKey: PROJECT, version: 1, track: 'personal', statement: 'Retain notes for future use', lockedAt: AT,
  criteria: [
    { id: 'G-1', text: 'Save notes', measure: 'Return the saved ID', status: 'open' },
    { id: 'G-2', text: 'Read notes', measure: 'Retrieve every stored note', status: 'partial' },
  ], inScope: ['notes'], outOfScope: ['paid plans'], changeReason: null,
};
const project: SupervisorProject = { userId: USER, projectKey: PROJECT, repo: 'owner/notes', track: 'personal', strict: true, goalVersion: 1 };
const proof = signVerificationToken({ userId: USER, projectKey: PROJECT, featureId: 'F-01', sha: SHA }, SIGNING_KEY);
const record: VerificationRecord = {
  id: VERIFICATION, userId: USER, projectKey: PROJECT, featureId: 'F-01', repo: 'owner/notes', sha: SHA,
  status: 'running', token: null, createdAt: AT, finishedAt: null, verdicts: [], findings: [], drift: [], checks: [], unseen: [],
  model: null, inputTokens: 0, outputTokens: 0, costUsd: 0,
};

function dependencies(over: Partial<McpDeps> = {}) {
  const progress: BuildProgress = {};
  const unexpected = async (): Promise<never> => { throw new Error('Unexpected dependency'); };
  const deps: McpDeps = {
    opportunities: async () => [opportunity], cachedSpec: async () => ({ input, spec }),
    generate: unexpected, consume: unexpected, release: unexpected, related: unexpected,
    supervisorProject: async () => project, projectGoal: async () => goal,
    startVerification: unexpected, getVerification: unexpected,
    matchesVerificationToken: (token, projectKey, featureId, sha) =>
      Boolean(readVerificationToken(token, { userId: USER, projectKey, featureId, sha }, SIGNING_KEY)),
    progress: async () => progress, linkCommit: async () => {}, featureFiles: async () => ({}),
    flagRecheck: async () => false, unlinkedCommitCount: async () => 0,
    setProgress: async (_key, feature, status, note, verificationLevel) => {
      progress[feature.id] = {
        title: feature.title,
        status,
        note,
        verificationLevel: verificationLevel ?? feature.verificationLevel ?? 'self_reported',
        updatedAt: AT,
        doneAt: status === 'done' ? AT : null,
      };
      return false;
    },
    notifyBlocked: unexpected, kept: unexpected, validate: unexpected, watch: unexpected,
    ...over,
  };
  return { deps, progress };
}

const rpc = (name: string, args: Record<string, unknown>) => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
type Reply = { result: { isError?: boolean; content: [{ text: string }]; structuredContent?: { status?: string; verified?: boolean; id?: string } } };

async function call(name: string, args: Record<string, unknown>, deps = dependencies().deps) {
  const { result } = await handleRpc(rpc(name, { project: PROJECT, ...args }), deps, SITE) as Reply;
  return { ...result, body: result.content[0].text };
}

function setEnv(t: TestContext, name: string, value: string) {
  const previous = process.env[name];
  process.env[name] = value;
  t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
}

test('verify_feature requires a connected repo, rejects a supplied diff and requires a full SHA', async () => {
  const missing = await call('verify_feature', { feature: 'F-01', sha: SHA }, dependencies({ supervisorProject: async () => null }).deps);
  assert.equal(missing.isError, true);
  assert.match(missing.body, /^A public GitHub repository is required/);
  assert.match(missing.body, /\nNext: connect_repo \{"project":"notes"/);
  for (const args of [{ sha: SHA.slice(0, 8) }, { sha: SHA, diff: 'untrusted-file-content' }]) {
    const invalid = await call('verify_feature', { feature: 'F-01', ...args });
    assert.equal(invalid.isError, true);
    assert.match(invalid.body, /^Verification requires a full 40-character GitHub SHA/);
    assert.doesNotMatch(invalid.body, /untrusted-file-content/);
  }
});

test('MCP verifies server criteria against immutable GitHub evidence, with B1 charging and model routing', async (t) => {
  setEnv(t, 'VERIFIER_MODELS', 'openai/gpt-fixture,anthropic/claude-fixture');
  let charged = 0;
  let modelCalls = 0;
  let blocked = false;
  const source = 'export const noteId = 42;';
  const store: VerificationStore = {
    authorize: async () => {}, find: async () => null, claim: async (row) => row, save: async () => {},
    get: async () => null, consume: async () => { charged++; return true; }, refund: async () => { assert.fail('Unexpected refund'); },
  };
  const verifier: VerifierDependencies = {
    store,
    github: async (repo, sha) => {
      assert.equal(repo, project.repo);
      assert.equal(sha, SHA);
      return {
        sha, diff: `diff --git a/src/notes.ts b/src/notes.ts\n--- a/src/notes.ts\n+++ b/src/notes.ts\n@@ -1 +1 @@\n+${blocked ? 'throw new Error("not implemented");' : source}\n`,
        files: { 'src/notes.ts': source }, checks: [{ name: 'test', conclusion: 'success' }], unseen: [],
      };
    },
    model: async <T>(prompt: string, options?: Parameters<NonNullable<VerifierDependencies['model']>>[1]) => {
      modelCalls++;
      assert.deepEqual(options?.models, ['anthropic/claude-fixture']);
      assert.equal(options?.noDataCollection, true);
      assert.doesNotMatch(prompt, /agent-criterion/);
      return { verdicts: ['1', '2'].map((criterion) => ({
        criterion, verdict: 'met', reason: source, citations: [{ path: 'src/notes.ts', line: 1, quote: source }],
      })) } as T;
    },
    sign: (payload) => signVerificationToken(payload, SIGNING_KEY),
  };
  const requests: Array<Omit<StartVerificationInput, 'userId'>> = [];
  const { deps, progress } = dependencies({ startVerification: (args) => {
    requests.push(args);
    return startVerification({ ...args, userId: USER }, verifier);
  } });
  const result = await call('verify_feature', { feature: 'f1', sha: SHA.toUpperCase(), developed_with: 'codex', criteria: ['agent-criterion'] }, deps);
  assert.deepEqual(requests[0], {
    projectKey: PROJECT, featureId: 'F-01', repo: 'owner/notes', sha: SHA, developmentModel: 'openai/gpt',
    outOfScope: ['paid plans'], criteria: [
      { id: '1', text: 'Saving returns an ID', kind: 'code' }, { id: '2', text: 'Notes test passes in CI', kind: 'test' },
    ],
  });
  assert.equal(result.isError, undefined);
  assert.match(result.body, /^F-01 @ abcd1234: 🟢 supervisor verified\.\nGoal v1/);
  assert.match(result.body, /⬜ G-1 Save notes/);
  assert.match(result.body, /Criterion verdicts.*met: 1, 2/);
  assert.doesNotMatch(result.body, /export const noteId/);
  const next = result.body.split('\n').at(-1)!;
  assert.match(next, /^Next: update_feature_status /);
  const done = JSON.parse(next.slice('Next: update_feature_status '.length));
  assert.ok(readVerificationToken(done.verification_token, { userId: USER, projectKey: PROJECT, featureId: 'F-01', sha: SHA }, SIGNING_KEY));
  assert.equal(result.structuredContent?.verified, true);
  assert.doesNotMatch(JSON.stringify(result.structuredContent), /svt1\./);
  assert.deepEqual(progress, {});
  assert.deepEqual([modelCalls, charged], [1, 1]);

  blocked = true;
  const rejected = await call('verify_feature', { feature: 'F-01', sha: SHA }, deps);
  assert.match(rejected.body, /^F-01 @ abcd1234: Verification blocked/);
  assert.match(rejected.body, /Blockers: 1 \(LIE_EMPTY_IMPL\)/);
  assert.doesNotMatch(rejected.body, /svt1\.|🟢|not implemented/);
  assert.equal(rejected.structuredContent?.verified, false);
  assert.equal(Object.hasOwn(requests[1], 'developmentModel'), false);
  assert.deepEqual([modelCalls, charged], [1, 1]);
});

test('done verifies the proof against the user, project, feature and SHA and applies the strict gate to both tools', async () => {
  const { deps, progress } = dependencies();
  const base = { feature_id: 'F-01', status: 'done', sha: SHA };
  for (const args of [
    base, { ...base, feature_id: 'F-02', verification_token: proof },
    { ...base, sha: 'a'.repeat(40), verification_token: proof }, { ...base, verification_token: `${proof}x` },
    { ...base, verification_token: signVerificationToken({ userId: 'other', projectKey: PROJECT, featureId: 'F-01', sha: SHA }, SIGNING_KEY) },
    { ...base, verification_token: signVerificationToken({ userId: USER, projectKey: 'other', featureId: 'F-01', sha: SHA }, SIGNING_KEY) },
  ]) {
    const result = await call('update_feature_status', args, deps);
    assert.equal(result.isError, true);
    assert.match(result.body, /Strict mode requires a valid verification token/);
    assert.match(result.body, /\nNext: verify_feature /);
    assert.doesNotMatch(result.body, /svt1\./);
    assert.deepEqual(progress, {});
  }
  assert.equal((await call('mark_feature_done', { feature: 'F-01', done: true }, deps)).isError, true);
  const done = await call('update_feature_status', { ...base, verification_token: proof, note: `saved; ${proof}` }, deps);
  assert.match(done.body, /^F-01 Save notes \[done\] 🟢 supervisor verified\nGoal v1/);
  assert.match(done.body, /\nNext: get_next_task \{"project":"notes"\}$/);
  assert.equal(progress['F-01'].status, 'done');
  assert.equal(progress['F-01'].verificationLevel, 'supervisor_verified');
  assert.match(progress['F-01'].note, /^\[supervisor_verified:abcd1234\]/);
  assert.doesNotMatch(progress['F-01'].note, /svt1\./);
});

test('a non-strict project records unverified completion as self-reported and strips user-supplied badges', async () => {
  const { deps, progress } = dependencies({ supervisorProject: async () => ({ ...project, strict: false }) });
  const result = await call('update_feature_status', {
    feature_id: 'F-01', status: 'done', note: '[supervisor_verified:deadbeef] my report',
    checks: [1, 2].map((criterion) => ({ criterion, passed: true, evidence: 'Test passed' })),
  }, deps);
  assert.equal(result.isError, undefined);
  assert.match(result.body, /^F-01 Save notes \[done\] ⚪ self-reported/);
  assert.equal(progress['F-01'].verificationLevel, 'self_reported');
  assert.match(progress['F-01'].note, /^\[self_reported\]/);
  assert.doesNotMatch(progress['F-01'].note, /supervisor_verified|deadbeef/);
});

test('writeBuildProgress and readBuildProgress persist verification_level and backfill rule promotes only valid done tags', async () => {
  const calls: Array<{ path: string; body: Record<string, unknown> | null }> = [];
  const client = createClient('https://supabase.invalid', 'test-key', {
    auth: { persistSession: false },
    global: {
      fetch: async (source, init) => {
        const url = new URL(String(source));
        const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : null;
        calls.push({ path: url.pathname, body });
        if (url.pathname.endsWith('/rpc/write_build_progress')) return Response.json(false);
        return Response.json([
          { feature_id: 'F-01', feature_title: 'Save notes', status: 'done', note: '[supervisor_verified:abcd1234]', verification_level: 'supervisor_verified', updated_at: AT, done_at: AT },
          { feature_id: 'F-02', feature_title: 'Open notes', status: 'done', note: '[self_reported]', verification_level: 'self_reported', updated_at: AT, done_at: AT },
        ]);
      },
    },
  });

  await writeBuildProgress(client, USER, PROJECT, { id: 'F-01', title: 'Save notes', verificationLevel: 'supervisor_verified' }, 'done', '[supervisor_verified:abcd1234]');
  await writeBuildProgress(client, USER, PROJECT, { id: 'F-02', title: 'Open notes' }, 'done', '[self_reported]');
  await writeBuildProgress(client, USER, PROJECT, { id: 'F-01', title: 'Save notes', verificationLevel: 'supervisor_verified' }, 'needs_recheck', 'recheck');

  assert.equal(calls[0].body?.p_verification_level, 'supervisor_verified');
  assert.equal(calls[1].body?.p_verification_level, 'self_reported');
  assert.equal(calls[2].body?.p_verification_level, 'self_reported');

  const loaded = await readBuildProgress(client, USER, PROJECT);
  assert.equal(loaded['F-01'].verificationLevel, 'supervisor_verified');
  assert.equal(loaded['F-02'].verificationLevel, 'self_reported');

  assert.equal(backfillVerificationLevel('done', '[supervisor_verified:abcd1234] ok'), 'supervisor_verified');
  assert.equal(backfillVerificationLevel('done', '[supervisor_verified]'), 'supervisor_verified');
  assert.equal(backfillVerificationLevel('needs_recheck', '[supervisor_verified:abcd1234]'), 'self_reported');
  assert.equal(backfillVerificationLevel('done', '[self_reported] checks 1/1'), 'self_reported');
  assert.equal(backfillVerificationLevel('done', 'note mentioning [supervisor_verified:abcd1234] later'), 'self_reported');

  const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20261120170000_build_progress_verification_level.sql'), 'utf8');
  assert.match(sql, /add column if not exists verification_level/i);
  assert.match(sql, /update public\.build_progress\s+set verification_level = 'supervisor_verified'/i);
});

test('running results say exactly how to poll, and drift warnings ask the user before acting', async () => {
  const { deps } = dependencies({
    cachedSpec: async () => ({ input, spec: { ...spec, lang: 'ko' } }),
    startVerification: async () => record,
    getVerification: async (id) => id === VERIFICATION ? { ...record, status: 'failed', drift: [
      { kind: 'out_of_spec', sha: SHA, files: ['src/notes.ts'], featureIds: ['F-01'], message: 'unsafe payload omitted' },
    ] } : null,
  });
  const waiting = await call('verify_feature', { feature: 'F-01', sha: SHA }, deps);
  assert.equal(waiting.structuredContent?.id, VERIFICATION);
  assert.match(waiting.body, /^F-01 @ abcd1234: Verification running/);
  assert.deepEqual(waiting.body.match(/^Next: .*$/gm), [`Next: get_verification {"project":"notes","id":"${VERIFICATION}"}`]);
  const result = await call('get_verification', { id: VERIFICATION }, deps);
  assert.match(result.body, /ASK USER \(in the terminal, before acting\):\n> 잠긴 목표나 범위를 조정할까요\?/);
  assert.match(result.body, /\nNext: record_decision /);
  const linked = await call('link_commit', { sha: SHA, message: 'Implements F-01 paid plans', files: ['src/notes.ts'] }, deps);
  assert.match(linked.body, /^Recorded commit for F-01\./);
  assert.match(linked.body, /Scope warning: the commit may touch a locked exclusion/);
});

test('the authenticated MCP route only polls verification for the caller and selected project', async (t) => {
  setEnv(t, 'NEXT_PUBLIC_SUPABASE_URL', 'https://supabase.invalid');
  setEnv(t, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'fixture-publishable');
  setEnv(t, 'SUPABASE_SECRET_KEY', 'fixture-service');
  const dossier = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
  const key = `prd:${dossier}`;
  const ids = [VERIFICATION, '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333'];
  const polls: string[] = [];
  t.mock.method(globalThis, 'fetch', async (source: string, init?: RequestInit) => {
    const url = new URL(source);
    assert.equal(url.hostname, 'supabase.invalid');
    if (url.pathname === '/rest/v1/mcp_tokens') return init?.method === 'PATCH' ? new Response(null, { status: 204 }) : Response.json([{ user_id: USER }]);
    assert.equal(url.searchParams.get('user_id'), `eq.${USER}`);
    if (url.pathname === '/rest/v1/evidence_dossiers') return Response.json([{ id: dossier, title: 'Notes', prd_markdown: 'Saved PRD', evidence_ids: [], evidence: [], updated_at: AT }]);
    if (url.pathname === '/rest/v1/project_goals') return Response.json([]);
    assert.equal(url.pathname, '/rest/v1/verifications');
    const id = url.searchParams.get('id')!.slice(3);
    polls.push(id);
    if (id === ids[1]) return Response.json([]);
    return Response.json([{
      id, user_id: USER, project_key: id === ids[2] ? 'another-project' : key, feature_id: 'F-01', repo: 'owner/notes',
      sha: SHA, status: 'running', token: null, verdicts: [], findings: [], drift: [], checks: [], unseen: [],
    }]);
  });
  const read = async (id: string) => {
    const response = await handleMcpRequest(new Request(`${SITE}/api/mcp`, {
      method: 'POST', headers: { authorization: `Bearer sdp_${'a'.repeat(48)}` },
      body: JSON.stringify(rpc('get_verification', { project: key, id })),
    }));
    assert.equal(response.status, 200);
    return (await response.json() as Reply).result;
  };
  assert.equal((await read(ids[0])).structuredContent?.id, ids[0]);
  for (const id of ids.slice(1)) {
    const missing = await read(id);
    assert.equal(missing.isError, true);
    assert.match(missing.content[0].text, /^Verification not found for this project/);
    assert.ok(!missing.content[0].text.includes(id));
  }
  assert.deepEqual(polls, ids);
});

test('link_commit accepts optional file statuses and flags out-of-spec added screens and API routes', async () => {
  const recorded: Parameters<McpDeps['linkCommit']>[] = [];
  const { deps } = dependencies({
    linkCommit: async (...args) => { recorded.push(args); },
  });

  // 1. Per-file object entries with status: added triggers out_of_spec drift warning.
  const added = await call('link_commit', {
    sha: SHA,
    message: 'Implements F-01',
    files: [
      { path: 'app/invoices/page.tsx', status: 'added' },
      { path: 'app/api/invoices/route.ts', status: 'added' },
      { path: 'app/api/legacy/route.ts', status: 'modified' },
    ],
  }, deps);
  assert.equal(added.isError, undefined);
  assert.match(added.body, /Drift warning: added files outside the spec \(app\/invoices\/page\.tsx, app\/api\/invoices\/route\.ts\)\./);
  assert.match(added.body, /\nNext: record_decision /);
  assert.deepEqual(recorded[0][1].files, ['app/invoices/page.tsx', 'app/api/invoices/route.ts', 'app/api/legacy/route.ts']);
  assert.deepEqual(recorded[0][1].fileStatuses, {
    'app/invoices/page.tsx': 'added',
    'app/api/invoices/route.ts': 'added',
    'app/api/legacy/route.ts': 'modified',
  });

  // 2. Separate file_statuses map alongside string files also works.
  const withMap = await call('link_commit', {
    sha: SHA,
    message: 'Implements F-01',
    files: ['app/billing/page.tsx'],
    file_statuses: { 'app/billing/page.tsx': 'added' },
  }, deps);
  assert.equal(withMap.isError, undefined);
  assert.match(withMap.body, /Drift warning: added files outside the spec \(app\/billing\/page\.tsx\)\./);

  // 3. Legacy files array without statuses still works with no false out_of_spec warning.
  const legacy = await call('link_commit', {
    sha: SHA,
    message: 'Implements F-01',
    files: ['app/invoices/page.tsx'],
  }, deps);
  assert.equal(legacy.isError, undefined);
  assert.doesNotMatch(legacy.body, /Drift warning/);
  assert.equal('fileStatuses' in recorded[2][1], false);

  // 4. Invalid file status is rejected.
  const invalid = await call('link_commit', {
    sha: SHA,
    message: 'Implements F-01',
    files: [{ path: 'app/invoices/page.tsx', status: 'renamed' }],
  }, deps);
  assert.equal(invalid.isError, true);
});

test('verify_feature extracts new migration CREATE TABLE names from the server diff and flags out-of-spec tables', async () => {
  const migrationDiff = [
    'diff --git a/supabase/migrations/20261120190000_invoices.sql b/supabase/migrations/20261120190000_invoices.sql',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/supabase/migrations/20261120190000_invoices.sql',
    '@@ -0,0 +1,2 @@',
    '+create table if not exists public.notes (id uuid primary key);',
    '+create table if not exists public.invoices (id uuid primary key);',
  ].join('\n');

  const { deps } = dependencies({
    startVerification: async () => ({ ...record, status: 'passed', token: proof, verdicts: [{ criterion: '1', verdict: 'met', reason: 'ok', citations: [] }] }),
    fetchCommitDiff: async (repo, sha) => {
      assert.equal(repo, 'owner/notes');
      assert.equal(sha, SHA);
      return migrationDiff;
    },
  });

  const flagged = await call('verify_feature', { feature: 'F-01', sha: SHA }, deps);
  assert.equal(flagged.isError, undefined);
  assert.match(flagged.body, /Scope warnings: 1 \(table:invoices\)\./);
  assert.doesNotMatch(flagged.body, /table:notes/);
  assert.match(flagged.body, /\nNext: record_decision /);

  // Spec-covered migration table alone does not trigger a scope warning.
  const cleanDiff = [
    'diff --git a/supabase/migrations/20261120190000_notes.sql b/supabase/migrations/20261120190000_notes.sql',
    'new file mode 100644',
    '--- /dev/null',
    '+++ b/supabase/migrations/20261120190000_notes.sql',
    '@@ -0,0 +1 @@',
    '+create table if not exists public.notes (id uuid primary key);',
  ].join('\n');
  const clean = await call('verify_feature', { feature: 'F-01', sha: SHA }, dependencies({
    startVerification: async () => ({ ...record, status: 'passed', token: proof, verdicts: [{ criterion: '1', verdict: 'met', reason: 'ok', citations: [] }] }),
    fetchCommitDiff: async () => cleanDiff,
  }).deps);
  assert.doesNotMatch(clean.body, /Scope warnings/);
  assert.match(clean.body, /\nNext: update_feature_status /);
});
