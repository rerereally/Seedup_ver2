import assert from 'node:assert/strict';
import test from 'node:test';
import { handleRpc, searchOpportunities } from '../lib/mcp/server';
import type { McpDeps } from '../lib/mcp/server';
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
    setProgress: async () => undefined,
    kept: async () => [],
    validate: async (idea) => { calls.push('validate'); return `# report ${idea}`; },
    ...over,
  };
}

const call = (name: string, args: Record<string, unknown>) => ({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name, arguments: args } });

test('initialize answers with a supported protocol version and tool capability', async () => {
  const answer = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26' } }, deps(), 'https://x.test') as { result: { protocolVersion: string; capabilities: object } };
  assert.equal(answer.result.protocolVersion, '2025-03-26');
  assert.ok('tools' in answer.result.capabilities);
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
  assert.deepEqual(answer.result.tools.map((tool) => tool.name), ['search_opportunities', 'get_opportunity', 'generate_verified_prd', 'get_build_checklist', 'mark_feature_done', 'get_kept_items', 'find_related_content', 'validate_idea']);
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
  assert.deepEqual(d.calls, ['consume', 'generate']);
  const draft = await handleRpc(call('generate_verified_prd', { slug: 'schema' }), deps(), '') as { result: { content: Array<{ text: string }> } };
  assert.match(draft.result.content[0].text, /AGENTS\.md/);
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

import { normalizeFeatureId } from '../lib/opportunities/build-progress';
import type { BuildProgress } from '../lib/opportunities/build-progress';

test('feature ids are read the way agents type them', () => {
  assert.equal(normalizeFeatureId('F1'), 'F-01');
  assert.equal(normalizeFeatureId('f-01'), 'F-01');
  assert.equal(normalizeFeatureId('F-12'), 'F-12');
  assert.equal(normalizeFeatureId('F0'), null);
  assert.equal(normalizeFeatureId('R-01'), null);
});

test('the checklist needs a PRD, lists done criteria, and marking a feature shows it as done', async () => {
  const progress: BuildProgress = {};
  const spec = normalizeSpec({ summary: 's', requirements: [{ title: 'Remember', evidence: [1] }], features: [{ title: 'Store notes', requirements: [1] }, { title: 'Search notes', requirements: [1] }] }, 3);
  spec.features[0].slots = { inputs: [], rules: [], errors: [], access: [], data: [], done: ['saving a note returns its id'] };
  const withSpec = deps({
    cachedSpec: async () => ({ input: {} as never, spec }),
    progress: async () => progress,
    setProgress: async (_slug, feature, done, note) => { if (done) progress[feature.id] = { title: feature.title, note, doneAt: 'now' }; else delete progress[feature.id]; },
  });

  const missing = await handleRpc(call('get_build_checklist', { slug: 'memory' }), deps(), '') as { result: { isError?: boolean; content: Array<{ text: string }> } };
  assert.equal(missing.result.isError, true);

  const before = await handleRpc(call('get_build_checklist', { slug: 'memory' }), withSpec, 'https://x.test') as { result: { content: Array<{ text: string }> } };
  assert.match(before.result.content[0].text, /0\/2 done/);
  assert.match(before.result.content[0].text, /- \[ \] F-01 Store notes[\s\S]*saving a note returns its id/);

  const marked = await handleRpc(call('mark_feature_done', { slug: 'memory', feature: 'F1', note: 'tests pass' }), withSpec, '') as { result: { content: Array<{ text: string }> } };
  assert.match(marked.result.content[0].text, /1\/2 done/);
  assert.match(marked.result.content[0].text, /- \[x\] F-01/);

  const wrong = await handleRpc(call('mark_feature_done', { slug: 'memory', feature: 'F9' }), withSpec, '') as { result: { isError?: boolean } };
  assert.equal(wrong.result.isError, true);

  await handleRpc(call('mark_feature_done', { slug: 'memory', feature: 'F-01', done: false }), withSpec, '');
  assert.equal(progress['F-01'], undefined);
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
