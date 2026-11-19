'use server';

import { webhookKind } from '@/lib/newsletter/webhooks';
import { createClient } from '@/lib/supabase/server';
import { setNewsletter, setNotifyWebhook, updateProfileName } from '@/lib/db/onboarding';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

export async function updateProfileSettings(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect('/login');

  const fullName = String(formData.get('full_name') ?? '').trim();

  await updateProfileName(supabase, user.id, fullName || null);

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
  await setNewsletter(supabase, user, subscribed);

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
  const { error } = await setNotifyWebhook(supabase, data.user, value || null);
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
