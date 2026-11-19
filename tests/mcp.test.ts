import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRpc, pickNextTask, searchOpportunities } from '../lib/mcp/server';
import type { McpDeps } from '../lib/mcp/server';
import { normalizeFeatureId } from '../lib/opportunities/build-progress';
import type { BuildProgress } from '../lib/opportunities/build-progress';
import { normalizeSpec } from '../lib/opportunities/spec';
import type { Opportunity } from '../lib/opportunities/types';

const opportunity = (slug: string, name: string, keywords: string[], qualified = true): Opportunity => ({
  slug, name, problem: `${name} problem`, gap: '', keywords, status: 'open', qualified, platforms: ['hn', 'github'],
  evidence: [
    { id: `${slug}-1`, platform: 'hn', quote: 'quote one', quoteKo: '', url: 'https://example.com/1', score: 1, postedAt: null },
    { id: `${slug}-2`, platform: 'github', quote: 'quote two', quoteKo: '', url: 'https://example.com/2', score: 1, postedAt: null },
    { id: `${slug}-3`, platform: 'hn', quote: 'quote three', quoteKo: '', url: 'https://example.com/3', score: 1, postedAt: null },
  ],
  supply: [], directCount: 0, firstSeenAt: null, followersAfterSignal: 0,
} as unknown as Opportunity);

const list = [opportunity('memory', 'Agent memory', ['agent', 'memory']), opportunity('schema', 'Schema normalize', ['schema'], false)];

function deps(over: Partial<McpDeps> = {}): McpDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    opportunities: async () => list,
    cachedSpec: async () => null,
    generate: async () => { calls.push('generate'); return normalizeSpec({ summary: 's', requirements: [{ title: 'Remember', evidence: [1] }], features: [{ title: 'Store notes', requirements: [1] }] }, 3); },
    consume: async () => { calls.push('consume'); return true; },
    related: async () => [],
    progress: async () => ({}),
    linkCommit: async () => {},
    featureFiles: async () => ({}),
    verifyFeature: async () => null,
    setProgress: async () => false,
    notifyBlocked: async () => {},
    kept: async () => [],
    validate: async (idea) => { calls.push('validate'); return `# report ${idea}`; },
    watch: async () => { calls.push('watch'); return true; },
    ...over,
  };
}

const call = (name: string, args: Record<string, unknown>) => ({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name, arguments: args } });

test('initialize answers with a supported protocol version and tool capability', async () => {
  const answer = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, deps(), 'https://x.test') as { result: { protocolVersion: string; capabilities: object; instructions: string } };
  assert.equal(answer.result.protocolVersion, '2025-03-26');
  assert.ok('tools' in answer.result.capabilities);
  assert.match(answer.result.instructions, /start of each build session, call get_next_task/);
  assert.match(answer.result.instructions, /update_feature_status.*in_progress.*done with checks or blocked/);
});

test('notifications get no answer, unknown methods get -32601, garbage gets a parse error', async () => {
  assert.equal(await handleRpc({ jsonrpc: '2.0', method: 'notifications/initialized' }, deps(), ''), null);
  const unknown = await handleRpc({ jsonrpc: '2.0', id: 2, method: 'nope' }, deps(), '') as { error: { code: number } };
  assert.equal(unknown.error.code, -32601);
  const garbage = await handleRpc(undefined, deps(), '') as { error: { code: number } };
  assert.equal(garbage.error.code, -32700);
});

test('tools/list exposes every tool', async () => {
  const answer = await handleRpc({ jsonrpc: '2.0', id: 3, method: 'tools/list' }, deps(), '') as { result: { tools: Array<{ name: string }> } };
  assert.deepEqual(answer.result.tools.map((tool) => tool.name), ['search_opportunities', 'get_opportunity', 'generate_verified_prd', 'get_build_checklist', 'get_next_task', 'update_feature_status', 'mark_feature_done', 'link_commit', 'verify_feature', 'get_kept_items', 'find_related_content', 'validate_idea', 'watch_idea']);
});

test('search ranks keyword hits first', () => {
  assert.deepEqual(searchOpportunities(list, 'agent memory').map((item) => item.slug), ['memory']);
  assert.deepEqual(searchOpportunities(list, 'zzz'), []);
});

test('an unknown slug is a tool error, not a protocol error', async () => {
  const answer = await handleRpc(call('get_opportunity', { slug: 'missing' }), deps(), '') as { result: { isError?: boolean } };
  assert.equal(answer.result.isError, true);
});

test('generate_verified_prd returns the requested export, counts usage, and labels drafts', async () => {
  const d = deps();
  const answer = await handleRpc(call('generate_verified_prd', { slug: 'memory', format: 'claude' }), d, 'https://x.test') as { result: { content: Array<{ text: string }> } };
  assert.match(answer.result.content[0].text, /Save as CLAUDE\.md/);
  assert.match(answer.result.content[0].text, /F-01\. Store notes/);
  assert.match(answer.result.content[0].text, /update_feature_status.*in_progress.*done.*blocked/);
  assert.match(answer.result.content[0].text, /Implements F-03/);
  assert.match(answer.result.content[0].text, /link_commit after each commit.*git diff --name-only HEAD~1/);
  assert.deepEqual(d.calls, ['consume', 'generate']);
  const draft = await handleRpc(call('generate_verified_prd', { slug: 'schema' }), deps(), '') as { result: { content: Array<{ text: string }> } };
  assert.match(draft.result.content[0].text, /AGENTS\.md/);
  assert.match(draft.result.content[0].text, /get_next_task \{"slug":"schema"\} at the start of each session/);
});

test('a cached PRD is returned without spending the daily limit; a used-up limit is a tool error', async () => {
  const cachedSpec = normalizeSpec({ summary: 'cached', requirements: [{ title: 'Old', evidence: [1] }] }, 3);
  const cached = deps({ cachedSpec: async () => ({ input: { title: 'T', problem: 'P', gap: '', evidence: list[0].evidence, competitors: [] }, spec: cachedSpec }) });
  await handleRpc(call('generate_verified_prd', { slug: 'memory' }), cached, '');
  assert.deepEqual(cached.calls, []);
  const limited = await handleRpc(call('generate_verified_prd', { slug: 'memory' }), deps({ consume: async () => false }), '') as { result: { isError?: boolean } };
  assert.equal(limited.result.isError, true);
});

test('a batch answers every request and drops notifications', async () => {
  const answer = await handleRpc([{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', method: 'notifications/initialized' }], deps(), '') as unknown[];
  assert.equal(answer.length, 1);
});

test('feature ids are read the way agents type them', () => {
  assert.equal(normalizeFeatureId('F1'), 'F-01');
  assert.equal(normalizeFeatureId('f-01'), 'F-01');
  assert.equal(normalizeFeatureId('F-12'), 'F-12');
  assert.equal(normalizeFeatureId('F0'), null);
  assert.equal(normalizeFeatureId('R-01'), null);
});

function progressFixture(over: Partial<McpDeps> = {}) {
  const progress: BuildProgress = {};
  const spec = normalizeSpec({ summary: 's', requirements: [{ title: 'Remember', evidence: [1] }], features: [{ title: 'Store notes', requirements: [1] }, { title: 'Search notes', requirements: [1] }] }, 3);
  spec.features[0].slots = { inputs: [], rules: [], errors: [], access: [], data: [], done: ['saving a note returns its id'] };
  const withSpec = deps({
    cachedSpec: async () => ({ input: {} as never, spec }),
    progress: async () => progress,
    setProgress: async (_slug, feature, status, note) => {
      const previous = progress[feature.id];
      progress[feature.id] = { title: feature.title, note, status, updatedAt: 'now', doneAt: status === 'done' ? 'now' : previous?.doneAt ?? null };
      return status === 'blocked' && previous?.status !== 'blocked';
    },
    ...over,
  });
  return { withSpec, progress, spec };
}

const progressRow = (status: BuildProgress[string]['status']): BuildProgress[string] => ({
  title: '', status, note: '', updatedAt: 'now', doneAt: null,
});

test('next task prioritizes rechecks, resumed work, distinct quotes, then the feature number', () => {
  const spec = normalizeSpec({
    requirements: [[1], [1, 2, 3], [1, 2], [2, 3], [2], [3]].map((evidence, i) => ({ title: `Requirement ${i}`, evidence })),
    features: [[1], [2], [3, 4], [5], [6]].map((requirements, i) => ({ title: `Feature ${i}`, requirements })),
  }, 3);
  spec.features.reverse();
  const progress: BuildProgress = { 'F-04': progressRow('improving'), 'F-05': progressRow('needs_recheck') };
  assert.equal(pickNextTask(spec, progress).feature?.id, 'F-05');
  progress['F-05'] = progressRow('blocked');
  assert.equal(pickNextTask(spec, progress).feature?.id, 'F-04');
  progress['F-04'] = progressRow('in_progress');
  assert.equal(pickNextTask(spec, progress).feature?.id, 'F-04');
  progress['F-04'] = progressRow('done');
  assert.equal(pickNextTask(spec, progress).feature?.id, 'F-02');
  progress['F-02'] = progressRow('done');
  assert.equal(pickNextTask(spec, progress).feature?.id, 'F-03');
});

test('next task waits for an earlier feature serving the same requirement, even if blocked', () => {
  const { spec, progress } = progressFixture();
  spec.features.reverse();
  progress['F-02'] = progressRow('needs_recheck');
  assert.equal(pickNextTask(spec, progress).feature?.id, 'F-01');
  progress['F-01'] = progressRow('blocked');
  const waiting = pickNextTask(spec, progress);
  assert.equal(waiting.feature, null);
  assert.match(waiting.why, /waiting for earlier features/);
  progress['F-01'] = progressRow('done');
  assert.equal(pickNextTask(spec, progress).feature?.id, 'F-02');
});

test('next task reports when every feature is done or blocked', () => {
  const { spec, progress } = progressFixture();
  progress['F-01'] = progressRow('done');
  progress['F-02'] = progressRow('done');
  assert.deepEqual(pickNextTask(spec, progress), { feature: null, why: 'All features are done.' });
  progress['F-02'] = progressRow('blocked');
  assert.deepEqual(pickNextTask(spec, progress), { feature: null, why: 'The remaining features are blocked.' });
});

test('the checklist lists current status and done criteria, and the legacy alias still works', async () => {
  const { withSpec, progress } = progressFixture();
  const missing = await handleRpc(call('get_build_checklist', { slug: 'memory' }), deps(), '') as { result: { isError?: boolean; content: Array<{ text: string }> } };
  assert.equal(missing.result.isError, true);

  const before = await handleRpc(call('get_build_checklist', { slug: 'memory' }), withSpec, 'https://x.test') as { result: { content: Array<{ text: string }> } };
  assert.match(before.result.content[0].text, /0\/2 done/);
  assert.match(before.result.content[0].text, /- \[ \] F-01 Store notes \[todo\][\s\S]*saving a note returns its id/);

  // Saying it works is not enough: every numbered criterion needs a passing check with evidence.
  const unproven = await handleRpc(call('mark_feature_done', { slug: 'memory', feature: 'F1', note: 'tests pass' }), withSpec, '') as { result: { isError?: boolean; content: Array<{ text: string }> } };
  assert.equal(unproven.result.isError, true);
  assert.match(unproven.result.content[0].text, /1\. saving a note returns its id/);
  assert.ok(!('F-01' in progress));
  const failing = await handleRpc(call('mark_feature_done', { slug: 'memory', feature: 'F1', checks: [{ criterion: 1, passed: false, evidence: 'notes.test.ts: 1 failing' }] }), withSpec, '') as { result: { isError?: boolean } };
  assert.equal(failing.result.isError, true);

  const marked = await handleRpc(call('mark_feature_done', { slug: 'memory', feature: 'F1', done: true, note: 'tests pass', checks: [{ criterion: 1, passed: true, evidence: 'notes.test.ts: save returns id, passed' }] }), withSpec, '') as { result: { content: Array<{ text: string }> } };
  assert.match(marked.result.content[0].text, /1\/2 done/);
  assert.match(marked.result.content[0].text, /- \[x\] F-01/);
  assert.match(progress['F-01'].note, /checks 1\/1 \(1: notes\.test\.ts: save returns id, passed\)/);

  const wrong = await handleRpc(call('mark_feature_done', { slug: 'memory', feature: 'F9' }), withSpec, '') as { result: { isError?: boolean } };
  assert.equal(wrong.result.isError, true);

  await handleRpc(call('mark_feature_done', { slug: 'memory', feature: 'F-01', done: false }), withSpec, '');
  assert.equal(progress['F-01'].status, 'todo');
});

const commitArgs = { slug: 'memory', sha: 'ABc1234', message: 'Implements F-01', files: ['src/notes.ts'] };

async function toolResult(name: string, args: Record<string, unknown>, withSpec: McpDeps) {
  const response = await handleRpc(call(name, args), withSpec, '') as { result: { isError?: boolean; content: Array<{ text: string }> } };
  return { isError: response.result.isError, text: response.result.content[0].text };
}

test('link_commit parses feature ids, honors explicit overrides, and keeps commits without a feature', async () => {
  const writes: Parameters<McpDeps['linkCommit']>[] = [];
  const { withSpec } = progressFixture({ linkCommit: async (...args) => { writes.push(args); } });
  for (const [message, features, featureIds] of [
    ['Implements F-01', undefined, ['F-01']],
    ['Implements F-1', undefined, ['F-01']],
    ['Implements F-01, F-02 and f1 (R-2, E-1)', undefined, ['F-01', 'F-02']],
    ['Implements F-99', ['f-2', 'F02'], ['F-02']],
    ['Metadata update', undefined, []],
    ['Implements F-01', [], []],
  ] as const) {
    const result = await toolResult('link_commit', { ...commitArgs, message, features }, withSpec);
    assert.equal(result.isError, undefined, result.text);
    assert.deepEqual(writes.pop(), ['memory', { sha: 'abc1234', message, files: commitArgs.files, featureIds }]);
  }
});

test('link_commit rejects invalid input and lists valid features for unknown ids', async () => {
  let writes = 0;
  const { withSpec } = progressFixture({ linkCommit: async () => { writes += 1; } });
  for (const invalid of [
    { sha: '123456' }, { sha: 'abc123z' }, { sha: 'a'.repeat(41) },
    { message: 123 }, { message: 'x'.repeat(501) },
    { files: 'src/notes.ts' }, { files: [4] }, { files: Array(201).fill('file') },
    { files: ['x'.repeat(301)] }, { files: ['/etc/passwd'] }, { files: ['C:\\src\\notes.ts'] },
    { files: ['\\\\host\\notes.ts'] }, { files: ['src/../notes.ts'] }, { files: ['..\\notes.ts'] },
    { features: null }, { features: ['F-01', 2] },
  ]) {
    const result = await toolResult('link_commit', { ...commitArgs, ...invalid }, withSpec);
    assert.equal(result.isError, true, JSON.stringify(invalid));
  }
  for (const args of [{ features: ['F-01', 'F-99'] }, { message: 'Implements F-01, F-99' }]) {
    const result = await toolResult('link_commit', { ...commitArgs, ...args }, withSpec);
    assert.equal(result.isError, true);
    assert.match(result.text, /Unknown feature ids: F-99\. Valid features: F-01, F-02/);
  }
  assert.equal(writes, 0);
});

test('verify_feature compares a bounded diff to the checklist and never changes progress', async () => {
  const calls: Array<[string, number]> = [];
  const { withSpec, progress, spec } = progressFixture({
    consume: async (feature, limit) => { calls.push([feature, limit]); return true; },
    verifyFeature: async (prompt) => {
      assert.deepEqual(JSON.parse(prompt), {
        criteria: [
          { number: 1, criterion: 'saving a note returns its id' },
          { number: 2, criterion: 'empty notes are rejected' },
          { number: 3, criterion: 'saved notes can be read' },
        ],
        diff: '+'.repeat(20_000), truncated: true,
      });
      return { checks: [
        { number: 2, status: 'met', reason: 'Empty notes throw an error.' },
        { number: 1, status: 'not met', reason: 'The return\nvalue is missing.' },
      ] };
    },
  });
  spec.features[0].slots!.done.push('empty notes are rejected', 'saved notes can be read');
  const result = await toolResult('verify_feature', { slug: 'memory', feature: 'f1', diff: '+'.repeat(20_000) + 'tail' }, withSpec);
  assert.equal(result.isError, undefined, result.text);
  assert.match(result.text, /Model opinion for F-01.*status is unchanged/);
  assert.match(result.text, /1\. saving a note returns its id — not met\. The return value is missing\./);
  assert.match(result.text, /2\. empty notes are rejected — met\. Empty notes throw an error\./);
  assert.match(result.text, /3\. saved notes can be read — unclear\./);
  assert.deepEqual(calls, [['mcp_verify', 10]]);
  assert.deepEqual(progress, {});
});

test('verify_feature checks the feature and the daily limit before invoking the model', async () => {
  let modelCalls = 0;
  const { withSpec } = progressFixture({
    consume: async () => false,
    verifyFeature: async () => { modelCalls += 1; return null; },
  });
  const args = { slug: 'memory', feature: 'F-01', diff: '+code' };
  const unknown = await toolResult('verify_feature', { ...args, feature: 'F-99' }, withSpec);
  assert.match(unknown.text, /Unknown feature ids: F-99\. Valid features: F-01, F-02/);
  assert.equal(unknown.isError, true);
  const limited = await toolResult('verify_feature', args, withSpec);
  assert.match(limited.text, /Daily limit reached/);
  assert.equal(limited.isError, true);
  assert.equal(modelCalls, 0);
});

test('update_feature_status only accepts agent statuses and requires passing checks for done', async () => {
  const { withSpec, progress } = progressFixture();
  const update = async (args: Record<string, unknown>) => await handleRpc(
    call('update_feature_status', { slug: 'memory', feature_id: 'F1', ...args }), withSpec, '',
  ) as { result: { isError?: boolean; content: Array<{ text: string }> } };

  for (const status of [undefined, 'working', ['todo'], 'needs_recheck', 'done']) {
    const answer = await update({ status });
    assert.equal(answer.result.isError, true);
    assert.match(answer.result.content[0].text, status === 'done' ? /passing check/ : status === 'needs_recheck' ? /server-only/ : /Invalid status/);
  }
  const noCriteria = await update({ status: 'done', feature_id: 'F-02' });
  assert.equal(noCriteria.result.isError, true);
  assert.deepEqual(progress, {});

  for (const status of ['in_progress', 'improving', 'todo']) {
    const answer = await update({ status, note: 'working on notes' });
    assert.equal(answer.result.isError, undefined);
    assert.ok(answer.result.content[0].text.includes(`F-01 Store notes [${status}]`));
    assert.match(answer.result.content[0].text, /0\/2 done/);
    assert.equal(progress['F-01'].status, status);
  }
  const done = await update({ status: 'done', checks: [{ criterion: 1, passed: true, evidence: 'notes.test.ts passed' }] });
  assert.equal(done.result.isError, undefined);
  assert.match(done.result.content[0].text, /F-01 Store notes \[done\]/);
  assert.equal(progress['F-01'].status, 'done');
});

test('entering blocked calls the webhook once, and webhook failure leaves the tool successful', async () => {
  const notifications: string[] = [];
  const { withSpec, progress } = progressFixture({
    notifyBlocked: async (opportunity, feature) => {
      notifications.push(`${opportunity.slug}/${feature.id}`);
      throw new Error('webhook unavailable');
    },
  });
  const update = async (status: string) => await handleRpc(
    call('update_feature_status', { slug: 'memory', feature_id: 'F1', status, note: 'waiting for access' }), withSpec, '',
  ) as { result: { isError?: boolean; content: Array<{ text: string }> } };

  const blocked = await update('blocked');
  assert.equal(blocked.result.isError, undefined);
  assert.match(blocked.result.content[0].text, /F-01 Store notes \[blocked\]/);
  assert.equal(progress['F-01'].note, 'waiting for access');
  await update('blocked');
  assert.deepEqual(notifications, ['memory/F-01']);
  await update('in_progress');
  await update('blocked');
  assert.deepEqual(notifications, ['memory/F-01', 'memory/F-01']);
});

test('get_kept_items lists what the user kept, filtered by type, with links an agent can open', async () => {
  const asked: Array<[string | null, number]> = [];
  const d = deps({ kept: async (type, limit) => { asked.push([type, limit]); return [{ type: 'github', title: 'owner/repo', note: 'A fast index', url: 'https://github.com/owner/repo', page: 'https://x.test/github-trends/1', savedAt: '2026-11-17T00:00:00Z', extra: 'TypeScript, 1200 stars' }]; } });
  const answer = await handleRpc(call('get_kept_items', { type: 'github', limit: 999 }), d, 'https://x.test') as { result: { content: Array<{ text: string }> } };
  assert.deepEqual(asked, [['github', 50]]);
  assert.match(answer.result.content[0].text, /\[github\] owner\/repo \(TypeScript, 1200 stars\)/);
  assert.match(answer.result.content[0].text, /https:\/\/github.com\/owner\/repo/);
  const empty = await handleRpc(call('get_kept_items', { type: 'nonsense' }), deps(), 'https://x.test') as { result: { content: Array<{ text: string }> } };
  assert.match(empty.result.content[0].text, /Nothing kept yet/);
});

import { derivedToken, hashToken } from '../lib/mcp/auth';

test('derived MCP tokens come back the same for one issue time, so a second tool does not cut off the first', () => {
  const issued = new Date('2026-11-18T10:00:00.123Z').getTime();
  const token = derivedToken('user-1', issued, 'secret');
  assert.match(token, /^sdp_[a-f0-9]{48}$/);
  // The issue time read back from the database rounds to the same millisecond.
  assert.equal(derivedToken('user-1', new Date('2026-11-18T10:00:00.123+00:00').getTime(), 'secret'), token);
  assert.equal(hashToken(derivedToken('user-1', issued, 'secret')), hashToken(token));
  assert.notEqual(derivedToken('user-1', issued + 1, 'secret'), token);
  assert.notEqual(derivedToken('user-2', issued, 'secret'), token);
  assert.notEqual(derivedToken('user-1', issued, 'other'), token);
});

test('validate_idea checks the daily limit before making a report, and refuses a missing idea', async () => {
  const used = deps();
  const answer = await handleRpc(call('validate_idea', { idea: 'leaked api keys alert' }), used, 'https://x.test') as { result: { content: Array<{ text: string }> } };
  assert.deepEqual(used.calls, ['consume', 'validate']);
  assert.match(answer.result.content[0].text, /report leaked api keys alert/);
  const limited = deps({ consume: async () => false });
  const stopped = await handleRpc(call('validate_idea', { idea: 'leaked api keys alert' }), limited, 'https://x.test') as { result: { isError?: boolean } };
  assert.equal(stopped.result.isError, true);
  assert.deepEqual(limited.calls, []);
  const empty = await handleRpc(call('validate_idea', { idea: ' ' }), deps(), 'https://x.test') as { result: { isError?: boolean } };
  assert.equal(empty.result.isError, true);
});

import { firstUsersFrom, reportVerdict } from '../lib/opportunities/report';

test('the report verdict uses the same 3-quotes-from-2-sites bar as published problems', () => {
  assert.equal(reportVerdict(0, 0, 0).level, 'no_signal');
  assert.equal(reportVerdict(3, 1, 0).level, 'more_evidence');
  assert.equal(reportVerdict(2, 2, 0).level, 'more_evidence');
  assert.equal(reportVerdict(3, 2, 3).level, 'crowded');
  assert.equal(reportVerdict(4, 2, 2).level, 'go');
});

test('first users are one per post, in order', () => {
  const row = (url: string) => ({ id: url, platform: 'hn' as const, quote: 'q', quoteKo: '', url, score: 0, postedAt: null });
  assert.deepEqual(firstUsersFrom([row('a'), row('b'), row('a')]).map((item) => item.url), ['a', 'b']);
});

import { newFindings, watchMail } from '../lib/opportunities/watch';

test('a watch reports only quotes and tools it has not seen, and the mail lists them with a way to stop', () => {
  const quote = (url: string) => ({ id: url, platform: 'hn' as const, quote: `q ${url}`, quoteKo: '', url, score: 0, postedAt: null });
  const rival = (url: string) => ({ kind: 'github' as const, name: `tool ${url}`, description: '', popularity: 0, url, createdAt: null, relation: 'direct' as const });
  const found = newFindings({ quotes: [quote('a'), quote('b')], rivals: [rival('r1'), rival('r2')] }, ['a', 'r1']);
  assert.deepEqual(found.quotes.map((row) => row.url), ['b']);
  assert.deepEqual(found.rivals.map((row) => row.url), ['r2']);
  const mail = watchMail('키 유출 알림', found, 'https://seedup.test');
  assert.match(mail.subject, /키 유출 알림/);
  assert.match(mail.text, /q b/);
  assert.match(mail.text, /tool r2 \(같은 문제를 푸는 도구\)/);
  assert.match(mail.text, /\/profile/);
});

test('watch_idea starts a watch and refuses an empty idea', async () => {
  const used = deps();
  const answer = await handleRpc(call('watch_idea', { idea: 'leaked api keys alert' }), used, 'https://x.test') as { result: { content: Array<{ text: string }> } };
  assert.deepEqual(used.calls, ['watch']);
  assert.match(answer.result.content[0].text, /Watching/);
  const empty = await handleRpc(call('watch_idea', { idea: '' }), deps(), 'https://x.test') as { result: { isError?: boolean } };
  assert.equal(empty.result.isError, true);
});

test('a feature is done when the acceptance of every requirement it serves and its own done slot are all checked', async () => {
  const { featureCriteria, unmetCriteria } = await import('../lib/mcp/server');
  const spec = normalizeSpec({ summary: 's', requirements: [{ title: 'Remember', evidence: [1], acceptance: ['a note survives a restart', 'search finds it in 1s'] }, { title: 'Forget', evidence: [1], acceptance: ['delete removes it'] }], features: [{ title: 'Store', requirements: [1] }] }, 3);
  spec.features[0].slots = { inputs: [], rules: [], errors: [], access: [], data: [], done: ['search finds it in 1s', 'saving returns an id'] };
  assert.deepEqual(featureCriteria(spec, spec.features[0]), ['a note survives a restart', 'search finds it in 1s', 'saving returns an id']);
  const partial = unmetCriteria(featureCriteria(spec, spec.features[0]), [{ criterion: 1, passed: true, evidence: 'restart.test passed' }, { criterion: 2, passed: true, evidence: '' }, { criterion: 3, passed: true, evidence: 'id.test passed' }, 'junk']);
  assert.deepEqual(partial.unmet.map((row) => row.n), [2]);
});
