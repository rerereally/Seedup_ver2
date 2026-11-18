import assert from 'node:assert/strict';
import test from 'node:test';
import { usageFunnel } from '../lib/metrics';
import { missingSchema } from '../lib/schema-check';

test('the usage funnel counts people per step inside the window, and a second active day as returning', () => {
  const since = '2026-11-10T00:00:00.000Z';
  const funnel = usageFunnel({
    onboarding: [{ user_id: 'a', created_at: '2026-11-11T01:00:00Z' }, { user_id: 'old', created_at: '2026-10-01T01:00:00Z' }],
    scraps: [{ user_id: 'a', created_at: '2026-11-11T02:00:00Z' }, { user_id: 'a', created_at: '2026-11-11T03:00:00Z' }],
    prdRuns: [
      { user_id: 'a', created_at: '2026-11-12T01:00:00Z', ok: true, kind: 'prd', duration_ms: 30_000 },
      { user_id: 'b', created_at: '2026-11-12T01:00:00Z', ok: false, kind: 'prd', duration_ms: 90_000 },
      { user_id: 'b', created_at: '2026-11-12T02:00:00Z', ok: true, kind: 'revise', duration_ms: 5_000 },
    ],
    dossiers: [{ user_id: 'a', created_at: '2026-11-12T01:05:00Z' }],
    tokens: [{ user_id: 'a', created_at: '2026-11-01T00:00:00Z', last_used_at: '2026-11-13T00:00:00Z' }, { user_id: 'c', created_at: '2026-11-01T00:00:00Z', last_used_at: null }],
    usage: [],
  }, since);
  assert.equal(funnel.signedUp, 1);
  assert.equal(funnel.kept, 1);
  // Two scraps count one person; only full PRD runs count toward PRD made and the success rate.
  assert.equal(funnel.prdMade, 1);
  assert.equal(funnel.prdRuns, 2);
  assert.equal(funnel.prdSuccessRate, 50);
  assert.equal(funnel.prdMedianSeconds, 30);
  assert.equal(funnel.prdSaved, 1);
  assert.equal(funnel.agentUsed, 1);
  assert.equal(funnel.agentConnected, 2);
  // a: active on the 11th, 12th and 13th; b: only the 12th.
  assert.equal(funnel.active, 2);
  assert.equal(funnel.returning, 1);
});

test('the schema check names the SQL file for each missing table, column or function', () => {
  const spec = { paths: { '/mcp_tokens': {}, '/evidence_dossiers': {}, '/rpc/release_ai_usage': {} }, definitions: { evidence_dossiers: { properties: { id: {} } } } };
  const gaps = missingSchema(spec, [
    { file: 'a.sql', tables: ['mcp_tokens'] },
    { file: 'b.sql', tables: ['prd_runs'], functions: ['release_ai_usage', 'consume_ai_usage'] },
    { file: 'c.sql', columns: [['evidence_dossiers', 'shared']] },
  ]);
  assert.deepEqual(gaps, [{ file: 'b.sql', missing: ['prd_runs', 'consume_ai_usage()'] }, { file: 'c.sql', missing: ['evidence_dossiers.shared'] }]);
});
