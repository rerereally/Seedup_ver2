'use server';

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

export async function signOut() {
  const supabase = await createClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  redirect('/');
}
