import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { draftReport, saveDraftReport } from '../lib/db/dossiers';

const ID = '11111111-1111-1111-1111-111111111111';

function client(result: { data?: unknown; error?: { message: string } | null }) {
  const writes: unknown[] = [];
  const chain = {
    select: () => chain, eq: () => chain,
    update: (value: unknown) => { writes.push(value); return chain; },
    maybeSingle: async () => ({ data: result.data ?? null, error: result.error ?? null }),
    then: (resolve: (value: unknown) => void) => resolve({ error: result.error ?? null }),
  };
  return { db: { from: () => chain } as unknown as SupabaseClient, writes };
}

test('a saved validate_idea report reads back; a missing column or a bad id is just no report', async () => {
  const report = { markdown: '# Report', level: 'no_signal', generatedAt: '2026-11-21T00:00:00Z' };
  assert.deepEqual(await draftReport(client({ data: { validation_report: report } }).db, 'u', ID), report);
  assert.equal(await draftReport(client({ data: { validation_report: null } }).db, 'u', ID), null);
  assert.equal(await draftReport(client({ error: { message: 'column evidence_dossiers.validation_report does not exist' } }).db, 'u', ID), null);
  assert.equal(await draftReport(client({ data: { validation_report: report } }).db, 'u', 'not-an-id'), null);
});

test('saving the report never throws, so the draft still saves before the migration is applied', async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const failing = client({ error: { message: 'column does not exist' } });
    await assert.doesNotReject(saveDraftReport(failing.db, 'u', ID, { markdown: 'm', level: 'go', generatedAt: '' }));
    assert.deepEqual(failing.writes, [{ validation_report: { markdown: 'm', level: 'go', generatedAt: '' } }]);
  } finally {
    console.error = original;
  }
});
