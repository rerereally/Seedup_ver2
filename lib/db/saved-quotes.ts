// Sentences a user saved from the browser extension. The extension sends the user's MCP token, not a Supabase
// session, so saving runs with the service key for the user the token names; reading goes through their own session.
import type { SupabaseClient } from '@supabase/supabase-js';
import { consumeUsageFor, userForToken } from '@/lib/mcp/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/** The user an MCP token belongs to; `undefined` when the server is not configured, null for a bad token. */
export async function tokenUser(authorization: string | null) {
  const service = createAdminClient();
  return service ? userForToken(service, authorization) : undefined;
}

export async function consumeForTokenUser(userId: string, feature: string, dailyLimit: number) {
  const service = createAdminClient();
  return service ? consumeUsageFor(service, userId, feature, dailyLimit) : false;
}

export async function saveQuoteFor(userId: string, row: { url: string; quote: string; platform: string; page_title: string | null }) {
  const service = createAdminClient();
  if (!service) return { error: { message: 'server not configured' } };
  return service.from('saved_quotes').upsert({ user_id: userId, ...row }, { onConflict: 'user_id,url,quote', ignoreDuplicates: true });
}

export function savedQuotes(supabase: SupabaseClient) {
  return supabase.from('saved_quotes').select('url,quote,platform,created_at').order('created_at', { ascending: false }).limit(50);
}
