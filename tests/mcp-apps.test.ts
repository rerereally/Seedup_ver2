import assert from 'node:assert/strict';
import test from 'node:test';
import { APP_MIME, APP_URI } from '../lib/mcp/apps';
import { handleRpc } from '../lib/mcp/server';
import type { McpDeps } from '../lib/mcp/server';
import { normalizeSpec } from '../lib/opportunities/spec';
import type { Opportunity } from '../lib/opportunities/types';

const opportunity = { slug: 'memory', name: 'Agent memory', problem: 'Agents forget', gap: '', keywords: ['agent', 'memory'], status: 'open', qualified: true, platforms: ['hn', 'github'], supply: [], directCount: 1,
  evidence: [1, 2, 3].map((n) => ({ id: `e${n}`, platform: n === 1 ? 'hn' : 'github', quote: `quote ${n}`, quoteKo: '', url: `https://example.com/${n}`, score: 1, postedAt: null })) } as unknown as Opportunity;
const spec = normalizeSpec({ summary: 's', requirements: [{ title: 'Remember', evidence: [1, 2], acceptance: ['Notes survive restarts'] }], features: [{ title: 'Store notes', detail: 'Save notes to disk', requirements: [1] }] }, 3);
spec.features[0].slots = { inputs: ['Note text'], rules: [], errors: [], access: [], data: [], done: ['Saving returns an id'] };
const input = { title: 'T', problem: 'P', gap: '', evidence: [...opportunity.evidence].reverse(), competitors: [] };
const deps = (over: Partial<McpDeps> = {}): McpDeps => ({
  opportunities: async () => [opportunity],
  cachedSpec: async () => ({ input, spec }),
  generate: async () => spec,
  consume: async () => true,
  related: async () => [],
  progress: async () => ({}),
  linkCommit: async () => {},
  featureFiles: async () => ({}),
  flagRecheck: async () => false,
  unlinkedCommitCount: async () => 0,
  setProgress: async () => false,
  notifyBlocked: async () => undefined,
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
  assert.deepEqual(linked.sort(), ['generate_verified_prd', 'get_build_checklist', 'get_next_task', 'get_verification', 'mark_feature_done', 'search_opportunities', 'update_feature_status', 'verify_feature']);
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

test('get_next_task needs a cached PRD', async () => {
  const { result } = await call('get_next_task', { slug: 'memory' }, { cachedSpec: async () => null });
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /Call generate_verified_prd first/);
});

test('get_next_task gives numbered criteria, readiness, verified quotes, and exact status calls', async () => {
  const { result } = await call('get_next_task', { slug: 'memory' });
  const body = result.content[0].text as string;
  assert.match(body, /F-01 Store notes \[todo\]\nSave notes to disk/);
  assert.match(body, /1\. Notes survive restarts\n2\. Saving returns an id/);
  assert.match(body, /Inputs and state: Note text/);
  assert.match(body, /E-1 \[github\] "quote 3" https:\/\/example.com\/3\nE-2 \[github\] "quote 2" https:\/\/example.com\/2/);
  assert.doesNotMatch(body, /quote 1/);
  assert.match(body, /관련 파일 정보 없음/);
  // DESIGN.md 8.1: the call to make now (in_progress) is the closing Next: line; done and blocked stay in the body.
  const updates = [...body.matchAll(/^(?:Next: )?update_feature_status (.+)$/gm)].map(([, args]) => JSON.parse(args));
  // in_progress appears in the body and again as the closing Next: line.
  assert.equal(updates.length, 4);
  assert.ok(updates.every(({ slug, project, feature_id }) => (slug ?? project) === 'memory' && feature_id === 'F-01'));
  assert.deepEqual([...new Set(updates.map(({ status }) => status))].sort(), ['blocked', 'done', 'in_progress']);
  assert.match(body, /\nNext: update_feature_status .*"status":"in_progress"/);
  const byStatus = Object.fromEntries(updates.map((row) => [row.status, row]));
  assert.deepEqual(byStatus.done.checks.map(({ criterion }: { criterion: number }) => criterion), [1, 2]);
  assert.ok(byStatus.blocked.note);
  const card = result.structuredContent;
  assert.ok(card.why && body.includes(card.why));
  assert.deepEqual(card, {
    kind: 'next', id: 'F-01', title: 'Store notes', why: card.why, criteria: 2, quotes: 2, files: [],
  });
});

test('get_next_task includes only the selected feature’s related files', async () => {
  const { result } = await call('get_next_task', { slug: 'memory' }, {
    featureFiles: async (slug) => {
      assert.equal(slug, 'memory');
      return { 'F-01': ['lib/notes.ts'], 'F-02': ['lib/search.ts'] };
    },
  });
  assert.match(result.content[0].text, /lib\/notes\.ts/);
  assert.doesNotMatch(result.content[0].text, /lib\/search\.ts|관련 파일 정보 없음/);
  assert.deepEqual(result.structuredContent.files, ['lib/notes.ts']);
});
