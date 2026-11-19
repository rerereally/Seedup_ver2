import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_MIME, APP_URI } from '../lib/mcp/apps';
import { handleRpc } from '../lib/mcp/server';
import type { McpDeps } from '../lib/mcp/server';
import { normalizeSpec } from '../lib/opportunities/spec';
import type { Opportunity } from '../lib/opportunities/types';

const opportunity = { slug: 'memory', name: 'Agent memory', problem: 'Agents forget', gap: '', keywords: ['agent', 'memory'], status: 'open', qualified: true, platforms: ['hn', 'github'], supply: [], directCount: 1,
  evidence: [1, 2, 3].map((n) => ({ id: `e${n}`, platform: n === 1 ? 'hn' : 'github', quote: `quote ${n}`, quoteKo: '', url: `https://example.com/${n}`, score: 1, postedAt: null })) } as unknown as Opportunity;
const spec = normalizeSpec({ summary: 's', requirements: [{ title: 'Remember', evidence: [1, 2] }], features: [{ title: 'Store notes', requirements: [1] }] }, 3);
const deps = (over: Partial<McpDeps> = {}): McpDeps => ({
  opportunities: async () => [opportunity],
  cachedSpec: async () => ({ input: {} as never, spec }),
  generate: async () => spec,
  consume: async () => true,
  related: async () => [],
  progress: async () => ({}),
  setProgress: async () => undefined,
  kept: async () => [],
  validate: async () => null,
  watch: async () => true,
  ...over,
});
const rpc = (method: string, params: Record<string, unknown> = {}, over: Partial<McpDeps> = {}) => handleRpc({ jsonrpc: '2.0', id: 1, method, params }, deps(over), 'https://x.test') as Promise<{ result: Record<string, any>; error?: { code: number } }>;
const call = (name: string, args: Record<string, unknown>, over: Partial<McpDeps> = {}) => rpc('tools/call', { name, arguments: args }, over);

test('the card tools link the card resource, the others do not', async () => {
  const tools = (await rpc('tools/list')).result.tools as Array<{ name: string; _meta?: { ui?: { resourceUri: string } } }>;
  const linked = tools.filter((tool) => tool._meta?.ui?.resourceUri === APP_URI).map((tool) => tool.name);
  assert.deepEqual(linked.sort(), ['generate_verified_prd', 'get_build_checklist', 'mark_feature_done', 'search_opportunities']);
});

test('the card is served as an MCP App resource and unknown resources are errors', async () => {
  assert.equal((await rpc('resources/list')).result.resources[0].uri, APP_URI);
  const read = (await rpc('resources/read', { uri: APP_URI })).result.contents[0];
  assert.equal(read.mimeType, APP_MIME);
  assert.match(read.text, /ui\/initialize/);
  assert.doesNotMatch(read.text, /innerHTML/, 'server text must reach the card through textContent only');
  assert.equal((await rpc('resources/read', { uri: 'ui://other' })).error?.code, -32002);
});

test('card data rides next to the full text result', async () => {
  const found = (await call('search_opportunities', { query: 'agent' })).result;
  assert.match(found.content[0].text, /Agent memory/);
  assert.equal(found.structuredContent.kind, 'opportunities');
  assert.equal(found.structuredContent.items[0].quotes, 3);

  const prd = (await call('generate_verified_prd', { slug: 'memory' }, { cachedSpec: async () => null })).result;
  assert.equal(prd.structuredContent.kind, 'prd');
  assert.deepEqual(prd.structuredContent.features.map((f: { id: string; quotes: number }) => [f.id, f.quotes]), [['F-01', 2]]);

  const checklist = (await call('get_build_checklist', { slug: 'memory' })).result;
  assert.equal(checklist.structuredContent.kind, 'checklist');
  assert.equal(checklist.structuredContent.features[0].done, false);
});
