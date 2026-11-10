import type { SupabaseClient } from '@supabase/supabase-js';

/** Counts one use of a paid-for feature. Returns false once today's limit is used up. */
export async function consumeDailyUsage(supabase: SupabaseClient, feature: string, dailyLimit: number) {
  const { data, error } = await supabase.rpc('consume_ai_usage', { p_feature: feature, p_daily_limit: dailyLimit });
  if (error) {
    // These routes already require login, so a missing migration should not take the feature down.
    console.error('Usage limit check failed', feature, error.message);
    return true;
  }
  return data === true;
}
