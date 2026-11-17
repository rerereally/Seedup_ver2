import assert from 'node:assert/strict';
import test from 'node:test';
import { DEMO_PRD } from '../lib/opportunities/demo-prd';
import { mapPoints } from '../lib/opportunities/map';
import type { Opportunity } from '../lib/opportunities/types';

test('the landing demo PRD only links to things it contains', () => {
  const requirementIds = new Set(DEMO_PRD.requirements.map((row) => row.id));
  const featureIds = new Set(DEMO_PRD.features.map((row) => row.id));
  for (const row of DEMO_PRD.requirements) {
    assert.ok(row.evidence.length > 0, `${row.id} cites a quote`);
    for (const n of row.evidence) assert.ok(n >= 1 && n <= DEMO_PRD.evidence.length, `${row.id} cites E${n}`);
  }
  for (const row of DEMO_PRD.features) for (const id of row.requirementIds) assert.ok(requirementIds.has(id), `${row.id} -> ${id}`);
  for (const row of DEMO_PRD.screens) for (const id of row.featureIds) assert.ok(featureIds.has(id), `${row.id} -> ${id}`);
  for (const row of DEMO_PRD.evidence) assert.match(row.url, /^https:\/\//);
});

const base = { slug: 'a', name: '이름', nameEn: 'Name', problem: '문제', problemEn: 'Problem', gap: '', keywords: [], status: 'open', qualified: true, platforms: ['hn'], directCount: 0, firstSeenAt: null, followersAfterSignal: 0, evidence: [{ id: 'e1', platform: 'hn', quote: 'q', quoteKo: '', url: 'u', score: 0, postedAt: null }] } as unknown as Opportunity;
const tool = (relation: 'direct' | 'partial') => ({ kind: 'github' as const, name: 't', description: '', popularity: 0, url: 'u', createdAt: null, relation });

test('the map spreads problems with no direct rival by how much is half-built', () => {
  const empty = { ...base, slug: 'empty', supply: [] };
  const halfBuilt = { ...base, slug: 'half', supply: [tool('partial'), tool('partial'), tool('partial'), tool('partial')] };
  const [open, half] = mapPoints([empty, halfBuilt], Date.parse('2026-11-17T00:00:00Z'));
  assert.ok(open.openness > half.openness);
  assert.equal(mapPoints([empty], 0, 'en')[0].name, 'Name');
  assert.equal(mapPoints([empty], 0)[0].name, '이름');
});

test('chart labels keep the tool name and drop pitches, sentences and Han script', async () => {
  const { chartToolName } = await import('../lib/opportunities/insight');
  assert.equal(chartToolName('Hyperlane – A IDE and ADE merging agent workflows'), 'Hyperlane');
  assert.equal(chartToolName('Sensored – streaming-first PII/PHI redaction'), 'Sensored');
  assert.equal(chartToolName('YOLOW92/pagesift'), 'YOLOW92/pagesift');
  assert.equal(chartToolName('Tried some experiments with architecture for agents'), null);
  assert.equal(chartToolName('图层预览'), null);
});
