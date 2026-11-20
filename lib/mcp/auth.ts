import { createHash, createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isAdminUser } from '@/lib/auth/admin';
import { usageLimitFailsOpen } from '@/lib/usage-limit';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const todayKst = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });

/**
 * Secret key used to derive personal MCP tokens. Uses `MCP_TOKEN_SECRET` first and falls back to
 * `SUPABASE_SECRET_KEY` so existing tokens remain valid when `MCP_TOKEN_SECRET` is not set.
 */
export function mcpTokenSecret(env: Record<string, string | undefined> = process.env) {
  return env.MCP_TOKEN_SECRET?.trim() || env.SUPABASE_SECRET_KEY?.trim() || '';
}

/**
 * The token for one user and issue time, derived with the server secret instead of stored, so connecting a second
 * tool can hand out the same token again instead of replacing it (which would cut off the first tool). Only the
 * hash is kept; rotating the secret makes old tokens underivable, and the next connect then issues a new one.
 */
export function derivedToken(userId: string, issuedAtMs: number, key = mcpTokenSecret()) {
  return `sdp_${createHmac('sha256', key).update(`mcp:${userId}:${issuedAtMs}`).digest('hex').slice(0, 48)}`;
}

/** The user a bearer token belongs to, or null. Tokens are looked up by hash, never stored in plain text. */
export async function userForToken(service: SupabaseClient, authorization: string | null) {
  const token = authorization?.match(/^Bearer\s+(sdp_[a-f0-9]{48})$/i)?.[1];
  if (!token) return null;
  const { data } = await service.from('mcp_tokens').select('user_id').eq('token_hash', hashToken(token)).maybeSingle();
  if (!data) return null;
  await service.from('mcp_tokens').update({ last_used_at: new Date().toISOString() }).eq('user_id', data.user_id);
  return String(data.user_id);
}

/**
 * Daily limit for MCP calls, counted in the same ai_usage table as the website.
 * consume_ai_usage_for (supabase/migrations/20261118190338_mcp_usage.sql) counts in one statement, so two calls in the same instant
 * cannot both pass at the limit. Until that file is applied, it falls back to a read-then-write count, which still
 * limits but can let a burst through.
 */
export async function consumeUsageFor(service: SupabaseClient, userId: string, feature: string, dailyLimit: number) {
  if (await countUsageFor(service, userId, feature, dailyLimit)) return true;
  // Admins are still counted, so their spend shows in ai_usage, but the daily limit does not stop them.
  const { data } = await service.auth.admin.getUserById(userId);
  return isAdminUser(data.user);
}

async function countUsageFor(service: SupabaseClient, userId: string, feature: string, dailyLimit: number) {
  const { data: allowed, error: rpcError } = await service.rpc('consume_ai_usage_for', { p_user: userId, p_feature: feature, p_daily_limit: dailyLimit });
  if (!rpcError) return allowed === true;
  console.error('MCP atomic usage count failed, falling back to read-then-write', rpcError.message);

  const usageDate = todayKst();
  const { data, error: readError } = await service.from('ai_usage').select('count').eq('user_id', userId).eq('feature', feature).eq('usage_date', usageDate).maybeSingle();
  if (readError) {
    const open = usageLimitFailsOpen();
    console.error(`MCP usage read failed (${open ? 'allowing' : 'blocking'} the call)`, feature, readError.message);
    return open;
  }
  const count = Number(data?.count ?? 0);
  if (count >= dailyLimit) return false;
  const { error } = await service.from('ai_usage').upsert({ user_id: userId, feature, usage_date: usageDate, count: count + 1 }, { onConflict: 'user_id,feature,usage_date' });
  if (error) {
    const open = usageLimitFailsOpen();
    console.error(`MCP usage count failed (${open ? 'allowing' : 'blocking'} the call)`, feature, error.message);
    return open;
  }
  return true;
}

/**
 * Gives back one use counted by `consumeUsageFor` when the model or downstream call failed.
 * Uses optimistic compare-and-swap on `count` so concurrent refunds cannot double-decrement.
 */
export async function releaseUsageFor(service: SupabaseClient, userId: string, feature: string) {
  const usageDate = todayKst();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error: readError } = await service
      .from('ai_usage')
      .select('count')
      .eq('user_id', userId)
      .eq('feature', feature)
      .eq('usage_date', usageDate)
      .maybeSingle();
    if (readError) {
      console.error('MCP usage refund read failed', feature, readError.message);
      return;
    }
    const count = Number(data?.count ?? 0);
    if (count <= 0) return;

    const { data: updated, error: updateError } = await service
      .from('ai_usage')
      .update({ count: count - 1 })
      .eq('user_id', userId)
      .eq('feature', feature)
      .eq('usage_date', usageDate)
      .eq('count', count)
      .select('count')
      .maybeSingle();
    if (updateError) {
      console.error('MCP usage refund failed', feature, updateError.message);
      return;
    }
    if (updated) return;
  }
}
