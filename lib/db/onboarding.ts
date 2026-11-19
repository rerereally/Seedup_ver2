// The user's onboarding answers and notification settings (user_onboarding) and profile (profiles). Always the
// user's own client and row-level security; no service key, so client components can use it too.
import type { SupabaseClient } from '@supabase/supabase-js';

type User = { id: string; email?: string | null };

/** Any columns of the user's onboarding row ('*' by default), or null. */
export async function onboardingRow<T = Record<string, unknown>>(supabase: SupabaseClient, userId: string, columns = '*') {
  const { data } = await supabase.from('user_onboarding').select(columns).eq('user_id', userId).maybeSingle();
  return (data ?? null) as T | null;
}

/** The answers the user gave at onboarding, or null. */
export async function onboardingAnswers(supabase: SupabaseClient, userId: string) {
  return ((await onboardingRow<{ answers: unknown }>(supabase, userId, 'answers'))?.answers ?? null) as unknown;
}

export function saveOnboarding(supabase: SupabaseClient, row: { user_id: string; email: string | null; answers: unknown; newsletter_subscribed: boolean; completed_at: string }) {
  return supabase.from('user_onboarding').upsert(row, { onConflict: 'user_id' });
}

/** Turns the weekly mail on or off, keeping the answers already given. */
export async function setNewsletter(supabase: SupabaseClient, user: User, subscribed: boolean) {
  const answers = await onboardingAnswers(supabase, user.id);
  return supabase.from('user_onboarding').upsert({ user_id: user.id, email: user.email ?? null, answers: answers ?? {}, newsletter_subscribed: subscribed, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
}

export async function setDailyResearchMail(supabase: SupabaseClient, user: User, subscribed: boolean) {
  const change = { daily_research_subscribed: subscribed, updated_at: new Date().toISOString() };
  // A reader who skipped onboarding was never on the weekly mailing list.
  const inserted = await supabase.from('user_onboarding')
    .upsert({ user_id: user.id, email: user.email ?? null, newsletter_subscribed: false, ...change }, { onConflict: 'user_id', ignoreDuplicates: true })
    .select('user_id');
  return inserted.error || inserted.data?.length ? inserted : supabase.from('user_onboarding').update(change).eq('user_id', user.id);
}

/** Saves or clears the Discord/Slack webhook. Someone who skipped onboarding has no row yet; it is created. */
export async function setNotifyWebhook(supabase: SupabaseClient, user: User, value: string | null) {
  const now = new Date().toISOString();
  const updated = await supabase.from('user_onboarding').update({ notify_webhook: value, updated_at: now }).eq('user_id', user.id).select('user_id');
  return updated.error || updated.data?.length ? updated : supabase.from('user_onboarding').insert({ user_id: user.id, email: user.email ?? null, answers: {}, notify_webhook: value, updated_at: now });
}

export async function profileRow<T = Record<string, unknown>>(supabase: SupabaseClient, userId: string) {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return (data ?? null) as T | null;
}

export function updateProfileName(supabase: SupabaseClient, userId: string, fullName: string | null) {
  return supabase.from('profiles').update({ full_name: fullName, updated_at: new Date().toISOString() }).eq('id', userId);
}
