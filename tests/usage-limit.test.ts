import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeDailyUsage, releaseDailyUsage } from '../lib/usage-limit';

function fakeClient(result: { data?: unknown; error?: { message: string } | null }) {
  const calls: Array<{ name: string; args: unknown }> = [];
  const client = { rpc: async (name: string, args: unknown) => { calls.push({ name, args }); return { data: result.data ?? null, error: result.error ?? null }; } };
  return { client: client as unknown as SupabaseClient, calls };
}

test('a failed model call gives the use back for the same feature', async () => {
  const { client, calls } = fakeClient({});
  await releaseDailyUsage(client, 'prd');
  assert.deepEqual(calls, [{ name: 'release_ai_usage', args: { p_feature: 'prd' } }]);
});

test('a refund error is logged, never thrown, so the user still gets the 503 message', async () => {
  const { client } = fakeClient({ error: { message: 'function does not exist' } });
  const original = console.error;
  console.error = () => {};
  try {
    await assert.doesNotReject(releaseDailyUsage(client, 'article_ask'));
  } finally {
    console.error = original;
  }
});

test('the limit is only reported as used up when the database says so', async () => {
  assert.equal(await consumeDailyUsage(fakeClient({ data: true }).client, 'prd', 5), true);
  assert.equal(await consumeDailyUsage(fakeClient({ data: false }).client, 'prd', 5), false);
});
