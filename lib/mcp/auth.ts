import { createHash, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

export const newToken = () => `sdp_${randomBytes(24).toString('hex')}`;

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
 * shortcut: read-then-write through the service role (no auth.uid() for consume_ai_usage); two calls in the same
 * instant can both pass at the limit. Move to a service-role RPC with an atomic upsert if MCP traffic grows.
 */
export async function consumeUsageFor(service: SupabaseClient, userId: string, feature: string, dailyLimit: number) {
  const usageDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const { data } = await service.from('ai_usage').select('count').eq('user_id', userId).eq('feature', feature).eq('usage_date', usageDate).maybeSingle();
  const count = Number(data?.count ?? 0);
  if (count >= dailyLimit) return false;
  const { error } = await service.from('ai_usage').upsert({ user_id: userId, feature, usage_date: usageDate, count: count + 1 }, { onConflict: 'user_id,feature,usage_date' });
  if (error) console.error('MCP usage count failed', error.message);
  return true;
}
