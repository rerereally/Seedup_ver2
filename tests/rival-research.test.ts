import assert from 'node:assert/strict';
import test from 'node:test';
import { researchRivals } from '../lib/opportunities/rival-research';

const tool = (name: string) => ({ kind: 'github' as const, name, description: `${name} tool`, url: `https://example.com/${name}`, popularity: 1, createdAt: '2026-01-01' });

test('the rival search loop adds new tools, skips known ones, and stops when the model has no new query', async () => {
  const found = new Map([[tool('memoripilot').url, tool('memoripilot')]]);
  const answers = [{ queries: ['ai coding memory mcp', 'AI CODING MEMORY MCP'] }, { queries: [] }];
  const prompts: string[] = [];
  const tried = await researchRivals('AI 코딩 세션 기억', found, {
    ask: async (prompt) => { prompts.push(prompt); return answers.shift() ?? null; },
    search: async () => [tool('cortex'), tool('memoripilot'), tool('memex')],
  });
  assert.deepEqual(tried, ['ai coding memory mcp']);
  assert.deepEqual([...found.values()].map((item) => item.name), ['memoripilot', 'cortex', 'memex']);
  assert.equal(prompts.length, 2);
  assert.match(prompts[1], /cortex/);
});

test('the rival search loop stops after a round that finds nothing new, and survives a failing model or search', async () => {
  const found = new Map([[tool('a').url, tool('a')]]);
  let asked = 0;
  await researchRivals('idea', found, { ask: async () => { asked++; return { queries: [`q${asked}`] }; }, search: async () => [tool('a')] });
  assert.equal(asked, 1);
  assert.equal(found.size, 1);
  await researchRivals('idea', found, { ask: async () => { throw new Error('down'); }, search: async () => [] });
  await researchRivals('idea', found, { ask: async () => ({ queries: ['x tool'] }), search: async () => { throw new Error('down'); } });
  assert.equal(found.size, 1);
});
