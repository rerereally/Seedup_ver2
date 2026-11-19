import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeDailyUsage, releaseDailyUsage, usageLimitFailsOpen } from '../lib/usage-limit';
import { consumeUsageFor, releaseUsageFor } from '../lib/mcp/auth';

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

test('a failed limit check blocks the call in production and lets it through locally', () => {
  assert.equal(usageLimitFailsOpen({ NODE_ENV: 'production' }), false);
  assert.equal(usageLimitFailsOpen({ NODE_ENV: 'development' }), true);
  assert.equal(usageLimitFailsOpen({}), true);
  assert.equal(usageLimitFailsOpen({ NODE_ENV: 'production', USAGE_LIMIT_FAIL_OPEN: 'true' }), true);
  assert.equal(usageLimitFailsOpen({ NODE_ENV: 'development', USAGE_LIMIT_FAIL_OPEN: 'false' }), false);
});

test('a database error in the limit check follows usageLimitFailsOpen', async () => {
  const original = console.error;
  const previous = process.env.USAGE_LIMIT_FAIL_OPEN;
  console.error = () => {};
  try {
    process.env.USAGE_LIMIT_FAIL_OPEN = 'false';
    assert.equal(await consumeDailyUsage(fakeClient({ error: { message: 'function does not exist' } }).client, 'prd', 5), false);
    process.env.USAGE_LIMIT_FAIL_OPEN = 'true';
    assert.equal(await consumeDailyUsage(fakeClient({ error: { message: 'function does not exist' } }).client, 'prd', 5), true);
  } finally {
    console.error = original;
    if (previous === undefined) delete process.env.USAGE_LIMIT_FAIL_OPEN;
    else process.env.USAGE_LIMIT_FAIL_OPEN = previous;
  }
});

test('MCP usage is counted by the atomic function with the token owner as the user', async () => {
  const { client, calls } = fakeClient({ data: false });
  assert.equal(await consumeUsageFor(client, 'user-1', 'mcp_prd', 10), false);
  assert.deepEqual(calls, [{ name: 'consume_ai_usage_for', args: { p_user: 'user-1', p_feature: 'mcp_prd', p_daily_limit: 10 } }]);
});

test('MCP usage fallback follows usageLimitFailsOpen when the database fails', async () => {
  const failingClient = (opts: { readError?: string; upsertError?: string }) => ({
    rpc: async () => ({ data: null, error: { message: 'missing rpc' } }),
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.readError ? null : { count: 1 }, error: opts.readError ? { message: opts.readError } : null }) }) }) }) }),
      upsert: async () => ({ error: opts.upsertError ? { message: opts.upsertError } : null }),
    }),
  }) as unknown as SupabaseClient;

  const original = console.error;
  const previous = process.env.USAGE_LIMIT_FAIL_OPEN;
  console.error = () => {};
  try {
    process.env.USAGE_LIMIT_FAIL_OPEN = 'false';
    assert.equal(await consumeUsageFor(failingClient({ readError: 'db down' }), 'user-1', 'mcp_prd', 10), false);
    assert.equal(await consumeUsageFor(failingClient({ upsertError: 'write failed' }), 'user-1', 'mcp_prd', 10), false);
    process.env.USAGE_LIMIT_FAIL_OPEN = 'true';
    assert.equal(await consumeUsageFor(failingClient({ readError: 'db down' }), 'user-1', 'mcp_prd', 10), true);
    assert.equal(await consumeUsageFor(failingClient({ upsertError: 'write failed' }), 'user-1', 'mcp_prd', 10), true);
  } finally {
    console.error = original;
    if (previous === undefined) delete process.env.USAGE_LIMIT_FAIL_OPEN;
    else process.env.USAGE_LIMIT_FAIL_OPEN = previous;
  }
});

test('releaseUsageFor decrements with optimistic CAS and retries on concurrent change', async () => {
  let stored = 3;
  let updateAttempts = 0;
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { count: stored }, error: null }),
            }),
          }),
        }),
      }),
      update: (patch: { count: number }) => ({
        eq: () => ({
          eq: () => ({
            eq: () => ({
              eq: (_col: string, expected: number) => ({
                select: () => ({
                  maybeSingle: async () => {
                    updateAttempts += 1;
                    // Simulate another request decrementing between read and update on the first attempt.
                    if (updateAttempts === 1) {
                      stored = 2;
                      return { data: null, error: null };
                    }
                    if (stored !== expected) return { data: null, error: null };
                    stored = patch.count;
                    return { data: { count: stored }, error: null };
                  },
                }),
              }),
            }),
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;

  await releaseUsageFor(client, 'user-1', 'mcp_prd');
  assert.equal(updateAttempts, 2);
  assert.equal(stored, 1);

  // Never decrements below zero.
  stored = 0;
  updateAttempts = 0;
  await releaseUsageFor(client, 'user-1', 'mcp_prd');
  assert.equal(updateAttempts, 0);
  assert.equal(stored, 0);
});
