import type { Metadata } from 'next';
import Logo from '@/components/Logo';
import OnboardingForm from '@/components/OnboardingForm';
import type { OnboardingAnswers } from '@/lib/onboarding';
import { onboardingRow } from '@/lib/db/onboarding';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: '처음 설정',
};

export default async function OnboardingPage() {
  const supabase = await createClient();

  if (!supabase) {
    redirect('/login');
  }

  const { data } = await supabase.auth.getUser();
  const user = data.user;

  if (!user) {
    redirect('/login');
  }

  const onboarding = await onboardingRow<{ answers?: unknown; newsletter_subscribed?: boolean | null }>(supabase, user.id, 'answers,newsletter_subscribed');

  return (
    <main id="main-content" className="min-h-dvh bg-surface px-5 py-8 sm:px-10 md:py-12">
      <div className="mx-auto max-w-[720px]">
        <Link href="/" className="mb-10 inline-flex min-h-11 items-center gap-2 text-[19px] font-bold tracking-tight text-ink">
          <Logo />
          Seedup
        </Link>
        <OnboardingForm
          userId={user.id}
          email={user.email ?? null}
          initialAnswers={(onboarding?.answers ?? {}) as OnboardingAnswers}
          initialNewsletterSubscribed={onboarding?.newsletter_subscribed ?? true}
        />
      </div>
    </main>
  );
}
