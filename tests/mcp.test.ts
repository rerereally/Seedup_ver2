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

test('tools/list exposes the four tools', async () => {
  const answer = await handleRpc({ jsonrpc: '2.0', id: 3, method: 'tools/list' }, deps(), '') as { result: { tools: Array<{ name: string }> } };
  assert.deepEqual(answer.result.tools.map((tool) => tool.name), ['search_opportunities', 'get_opportunity', 'generate_verified_prd', 'find_related_content']);
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
