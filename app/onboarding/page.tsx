import OnboardingForm from '@/components/OnboardingForm';
import type { OnboardingAnswers } from '@/lib/onboarding';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

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

  const { data: onboarding } = await supabase
    .from('user_onboarding')
    .select('answers,newsletter_subscribed')
    .eq('user_id', user.id)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-surface px-4 py-10 md:px-10">
      <div className="mx-auto max-w-[960px]">
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold tracking-tight text-brand-primary">
            Seedup
          </Link>
          <span className="rounded-full border border-outline-soft bg-white px-3 py-1 text-xs font-semibold text-muted">Onboarding</span>
        </div>

        <section className="mb-8 rounded-xl border border-outline-soft bg-white p-6 md:p-8">
          <h1 className="text-3xl font-bold text-ink md:text-4xl">맞춤 추천을 위한 5문항 설정</h1>
          <p className="mt-3 max-w-2xl leading-7 text-muted">
            개발 수준, 관심 분야, 목표를 알려주시면 Seedup이 더 잘 맞는 아티클, 오픈소스, AI 제품, 프로젝트 아이디어를 추천할 수 있습니다.
          </p>
        </section>

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
