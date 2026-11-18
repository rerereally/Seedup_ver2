import { createHash, createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/**
 * The token for one user and issue time, derived with the server secret instead of stored, so connecting a second
 * tool can hand out the same token again instead of replacing it (which would cut off the first tool). Only the
 * hash is kept; rotating the secret makes old tokens underivable, and the next connect then issues a new one.
 */
export function derivedToken(userId: string, issuedAtMs: number, key: string) {
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
 * consume_ai_usage_for (supabase/mcp_usage_2026_11.sql) counts in one statement, so two calls in the same instant
 * cannot both pass at the limit. Until that file is applied, it falls back to a read-then-write count, which still
 * limits but can let a burst through.
 */
export async function consumeUsageFor(service: SupabaseClient, userId: string, feature: string, dailyLimit: number) {
  const { data: allowed, error: rpcError } = await service.rpc('consume_ai_usage_for', { p_user: userId, p_feature: feature, p_daily_limit: dailyLimit });
  if (!rpcError) return allowed === true;
  console.error('MCP atomic usage count failed, falling back to read-then-write', rpcError.message);

  const usageDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const { data } = await service.from('ai_usage').select('count').eq('user_id', userId).eq('feature', feature).eq('usage_date', usageDate).maybeSingle();
  const count = Number(data?.count ?? 0);
  if (count >= dailyLimit) return false;
  const { error } = await service.from('ai_usage').upsert({ user_id: userId, feature, usage_date: usageDate, count: count + 1 }, { onConflict: 'user_id,feature,usage_date' });
  if (error) console.error('MCP usage count failed', error.message);
  return true;
}
