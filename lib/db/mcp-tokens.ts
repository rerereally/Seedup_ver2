// MCP personal tokens. Only a hash is stored; the plain token is derived from the server secret and the issue time,
// so the same token can be shown again without keeping it. Service key only: a token row is never read by a visitor.
import { derivedToken, hashToken } from '@/lib/mcp/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * The user's token: the current one again unless `rotate`, else a new one that cuts off every tool using the old.
 * Null without server settings; `{ error }` when saving failed.
 */
export async function issueMcpToken(userId: string, rotate: boolean): Promise<{ token: string; reused: boolean } | { error: string } | null> {
  const service = createAdminClient();
  const key = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!service || !key) return null;
  if (!rotate) {
    const { data: current } = await service.from('mcp_tokens').select('token_hash,created_at').eq('user_id', userId).maybeSingle();
    const again = current ? derivedToken(userId, new Date(current.created_at).getTime(), key) : null;
    // A token from before derivation (random) cannot be shown again; it falls through and is replaced.
    if (again && hashToken(again) === current?.token_hash) return { token: again, reused: true };
  }
  const issuedAt = new Date();
  const token = derivedToken(userId, issuedAt.getTime(), key);
  const { error } = await service.from('mcp_tokens').upsert({ user_id: userId, token_hash: hashToken(token), created_at: issuedAt.toISOString(), last_used_at: null });
  return error ? { error: error.message } : { token, reused: false };
}

/** Cuts off every tool using the user's token. False without server settings. */
export async function revokeMcpToken(userId: string) {
  const service = createAdminClient();
  if (!service) return false;
  await service.from('mcp_tokens').delete().eq('user_id', userId);
  return true;
}

/** The user's token row, or null when they have none: when a tool last called with it. */
export async function mcpTokenStatus(userId: string) {
  const { data } = (await createAdminClient()?.from('mcp_tokens').select('last_used_at').eq('user_id', userId).maybeSingle()) ?? { data: null };
  return data ? { lastUsedAt: (data.last_used_at as string | null) ?? null } : null;
}

export async function hasMcpToken(userId: string) {
  return Boolean(await mcpTokenStatus(userId));
}
