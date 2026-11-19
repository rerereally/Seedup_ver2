import assert from 'node:assert/strict';
import test from 'node:test';
import { forkHref, problemGroups } from '../lib/opportunities/public-prds';

const row = (id: string, slug: string | null, built = false) => ({ id, title: `PRD ${id}`, opportunity_slug: slug, evidence_ids: [], built_url: built ? 'https://x.test' : null, updated_at: '2026-11-20T00:00:00Z' });

test('public PRDs group by problem with built counts, most PRDs first, skipping ideas and unknown problems', () => {
  const groups = problemGroups([row('1', 'gif'), row('2', 'memo', true), row('3', 'memo'), row('4', null), row('5', 'gone')], new Map([['gif', 'GIF API'], ['memo', 'Session memory']]));
  assert.deepEqual(groups, [{ slug: 'memo', name: 'Session memory', prds: 2, built: 1 }, { slug: 'gif', name: 'GIF API', prds: 1, built: 0 }]);
});

test('starting from a public PRD reuses only its public quotes, else the idea workspace with the title', () => {
  assert.equal(forkHref({ title: 't', evidence_ids: ['ev_a', 'lv_b', 'ev_c'] }), '/prd?evidence=ev_a,ev_c');
  assert.equal(forkHref({ title: '대학생 가계부', evidence_ids: ['lv_b'] }), `/prd/new?idea=${encodeURIComponent('대학생 가계부')}`);
});
