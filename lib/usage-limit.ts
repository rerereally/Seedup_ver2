import type { SupabaseClient } from '@supabase/supabase-js';
import { isAdminUser } from '@/lib/auth/admin';
import { fixturesOn } from '@/lib/llm-fixtures';

/**
 * Whether a failed limit check lets the call through. In production it does not: a missing migration or a database
 * outage would otherwise turn every paid model call into an unlimited one. Locally (and in tests) it does, so a
 * database without the SQL files still works. USAGE_LIMIT_FAIL_OPEN=true|false overrides either default.
 */
export function usageLimitFailsOpen(env: Record<string, string | undefined> = process.env) {
  const override = env.USAGE_LIMIT_FAIL_OPEN?.trim().toLowerCase();
  if (override === 'true') return true;
  if (override === 'false') return false;
  return env.NODE_ENV !== 'production';
}

/** Counts one use of a paid-for feature. Returns false once today's limit is used up, except for admins (still counted). */
export async function consumeDailyUsage(supabase: SupabaseClient, feature: string, dailyLimit: number) {
  // Fixture runs (e2e, LLM_FIXTURES=1) call no model, so they spend nothing; counting them let a busy CI day use up the
  // test account's real limit and fail every later run.
  if (fixturesOn()) return true;
  const { data, error } = await supabase.rpc('consume_ai_usage', { p_feature: feature, p_daily_limit: dailyLimit });
  if (error) {
    const open = usageLimitFailsOpen();
    console.error(`Usage limit check failed (${open ? 'allowing' : 'blocking'} the call)`, feature, error.message);
    return open;
  }
  if (data === true) return true;
  const { data: auth } = await supabase.auth.getUser();
  return isAdminUser(auth.user);
}

/** Gives back one use when the model call behind it failed, so an outage does not eat the user's limit. */
export async function releaseDailyUsage(supabase: SupabaseClient, feature: string) {
  if (fixturesOn()) return;
  const { error } = await supabase.rpc('release_ai_usage', { p_feature: feature });
  if (error) console.error('Usage refund failed', feature, error.message);
}
