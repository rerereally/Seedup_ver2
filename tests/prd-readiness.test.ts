import assert from 'node:assert/strict';
import test from 'node:test';
import { completePrd } from '../lib/opportunities/prd';
import { preExportGaps } from '../lib/opportunities/prd-audit';
import { normalizeSpec, SLOT_KEYS, withPrdReadiness } from '../lib/opportunities/spec';

const input = { title: 'Document tool', problem: 'Teams lose notes', gap: '', evidence: [], competitors: [] };
const raw = {
  summary: 'Keep notes',
  requirements: [{ title: 'Save notes', evidence: [1] }, { title: 'Filter notes', evidence: [2], priority: 'P1' }],
  features: [{ title: 'Store', requirements: [1] }, { title: 'Search', requirements: [2] }],
};

test('normalizeSpec promotes exactly one row without changing its evidence status', () => {
  const spec = normalizeSpec(raw, 2);
  assert.deepEqual(spec.requirements.map((row) => [row.priority, row.evidence]), [['P0', [1]], ['P1', [2]]]);
  assert.equal(normalizeSpec(raw, 0, true, { idea: true }).hypotheses[0].priority, 'P0');
  const explicit = normalizeSpec({ ...raw, requirements: [raw.requirements[0], { ...raw.requirements[1], priority: 'P0' }] }, 2);
  assert.deepEqual(explicit.requirements.map((row) => row.priority), [undefined, 'P0']);
});

test('P0 uses existing generation budget, P1 explains missing slots, and neither invents a screen', async () => {
  const spec = normalizeSpec(raw, 2);
  const calls: string[] = [];
  const result = await completePrd(input, spec, { deadline: Date.now() + 30_000 }, {
    screens: async () => { calls.push('screens'); return null; },
    slots: async (_input, feature) => { calls.push(feature.title); throw new Error('Model unavailable'); },
  });
  assert.deepEqual(calls, ['screens', 'Store']);
  assert.ok(SLOT_KEYS.every((key) => result.features[0].slots?.[key]?.[0].startsWith('확인 필요:')));
  assert.ok(SLOT_KEYS.every((key) => result.features[1].slots?.[key]?.[0].includes('자동 보완은 P0에 우선 배정')));
  assert.deepEqual(result.screens, []);
  assert.equal(result.openQuestions?.length, 2);
  assert.deepEqual(withPrdReadiness(result), result);
  assert.ok(preExportGaps(result).some(({ kind, itemId }) => kind === 'slot' && itemId === 'F-01'));
});

test('expired budget uses cached values and does not start either completion call', async () => {
  const spec = { ...normalizeSpec(raw, 2), lang: 'en' as const };
  let calls = 0;
  const never = async () => { calls++; return null; };
  const result = await completePrd(input, spec, { deadline: Date.now() }, { screens: never, slots: never });
  assert.equal(calls, 0);
  assert.match(result.features[0].slots?.done[0] ?? '', /^Open question:/);
  assert.match(result.openQuestions?.[0] ?? '', /Which screen uses F-01/);
});

test('generated screens clear their questions and partial slots preserve already resolved fields', async () => {
  const original = withPrdReadiness(normalizeSpec(raw, 2));
  original.features[0].slots!.inputs = ['Use plain text'];
  const result = await completePrd(input, original, { deadline: Date.now() + 30_000 }, {
    screens: async () => [{ id: 'S-01', name: 'Notes', does: 'Shows notes', featureIds: ['F-01', 'F-02'] }],
    slots: async () => ({ inputs: ['Overwrite'], rules: ['Keep one copy'], errors: [], access: [], data: [], done: [] }),
  });
  assert.deepEqual(result.openQuestions, []);
  assert.deepEqual(result.features[0].slots?.inputs, ['Use plain text']);
  assert.deepEqual(result.features[0].slots?.rules, ['Keep one copy']);
  assert.match(result.features[0].slots?.done[0] ?? '', /^확인 필요:/);
});
