'use server';

import { webhookKind } from '@/lib/newsletter/webhooks';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function updateProfileSettings(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect('/login');

  const fullName = String(formData.get('full_name') ?? '').trim();

  await supabase
    .from('profiles')
    .update({
      full_name: fullName || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id);

  revalidatePath('/profile');
  redirect('/profile?status=saved');
}

export async function updateNewsletterSubscription(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect('/login');

  const subscribed = formData.get('subscribed') === 'true';
  const { data: existingOnboarding } = await supabase
    .from('user_onboarding')
    .select('answers')
    .eq('user_id', user.id)
    .maybeSingle();

  await supabase.from('user_onboarding').upsert(
    {
      user_id: user.id,
      email: user.email ?? null,
      answers: existingOnboarding?.answers ?? {},
      newsletter_subscribed: subscribed,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  );

  revalidatePath('/profile');
  redirect(`/profile?status=${subscribed ? 'subscribed' : 'unsubscribed'}`);
}

/** Saves or clears the Discord/Slack webhook that gets the weekly signals and change alerts. */
export async function updateNotifyWebhook(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect('/login');
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  const value = String(formData.get('webhook') ?? '').trim();
  if (value && !webhookKind(value)) redirect('/profile?status=webhook-invalid');
  const now = new Date().toISOString();
  const updated = await supabase.from('user_onboarding').update({ notify_webhook: value || null, updated_at: now }).eq('user_id', data.user.id).select('user_id');
  // Someone who skipped onboarding has no row yet; create it with empty answers.
  const { error } = updated.error || updated.data?.length
    ? updated
    : await supabase.from('user_onboarding').insert({ user_id: data.user.id, email: data.user.email ?? null, answers: {}, notify_webhook: value || null, updated_at: now });
  revalidatePath('/profile');
  redirect(`/profile?status=${error ? 'webhook-failed' : value ? 'webhook-saved' : 'webhook-cleared'}`);
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  redirect('/');
}
