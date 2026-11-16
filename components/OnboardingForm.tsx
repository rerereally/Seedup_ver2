'use client';

import { onboardingQuestions, type OnboardingAnswers } from '@/lib/onboarding';
import { createClient } from '@/lib/supabase/client';
import { Check } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

export default function OnboardingForm({
  userId,
  email,
  onCompleted,
  initialAnswers,
  initialNewsletterSubscribed = true,
}: {
  userId: string;
  email: string | null;
  onCompleted?: () => void;
  initialAnswers?: OnboardingAnswers;
  initialNewsletterSubscribed?: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState<OnboardingAnswers>(initialAnswers ?? {});
  const [newsletterSubscribed, setNewsletterSubscribed] = useState(initialNewsletterSubscribed);
  const [status, setStatus] = useState<'idle' | 'saving' | 'error'>('idle');
  const [step, setStep] = useState(0);
  const totalSteps = onboardingQuestions.length + 1;
  const isNewsletterStep = step === onboardingQuestions.length;
  const currentQuestion = onboardingQuestions[step];

  const isComplete = useMemo(
    () =>
      onboardingQuestions.every((question) => {
        const value = answers[question.id];
        return Array.isArray(value) ? value.length > 0 : Boolean(value);
      }),
    [answers],
  );

  const setSingle = (id: string, value: string) => {
    setAnswers((current) => ({ ...current, [id]: value }));
  };

  const toggleMulti = (id: string, value: string) => {
    setAnswers((current) => {
      const previous = Array.isArray(current[id]) ? current[id] as string[] : [];
      const next = previous.includes(value) ? previous.filter((item) => item !== value) : [...previous, value];
      return { ...current, [id]: next };
    });
  };

  const currentAnswered = useMemo(() => {
    if (isNewsletterStep) return true;
    const value = answers[currentQuestion.id];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  }, [answers, currentQuestion, isNewsletterStep]);

  const handleSubmit = async () => {
    if (!isComplete) return;
    setStatus('saving');

    const supabase = createClient();
    if (!supabase) {
      setStatus('error');
      return;
    }

    const { error } = await supabase.from('user_onboarding').upsert(
      {
        user_id: userId,
        email,
        answers,
        newsletter_subscribed: newsletterSubscribed,
        completed_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' },
    );

    if (error) {
      setStatus('error');
      return;
    }

    if (onCompleted) {
      onCompleted();
      router.refresh();
      return;
    }

    router.push('/');
    router.refresh();
  };

  const tile = (selected: boolean) => `flex min-h-14 items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] text-ink transition-colors ${selected ? 'border-seed bg-seed-soft' : 'border-outline-strong bg-white hover:bg-surface-low'}`;
  // Drawn, not a real input: the tile button itself carries the pressed state.
  const box = (selected: boolean) => (
    <span aria-hidden="true" className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] border ${selected ? 'border-seed bg-seed text-white' : 'border-outline-strong bg-white'}`}>
      {selected && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
  );

  return (
    <div>
      <p className="text-sm text-muted">처음 설정 · {step + 1} / {totalSteps}</p>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-high" role="progressbar" aria-valuemin={1} aria-valuemax={totalSteps} aria-valuenow={step + 1} aria-label="설정 진행">
        <div className="h-full rounded-full bg-seed transition-all" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
      </div>

      {!isNewsletterStep && currentQuestion && (
        <section className="mt-10">
          <h1 className="text-[clamp(24px,3.4vw,32px)] font-bold leading-snug tracking-[-0.03em] text-ink">{currentQuestion.title}</h1>
          <p className="mt-3 text-[15px] leading-7 text-muted">오늘의 신호와 주간 메일을 고르는 기준이 됩니다. {currentQuestion.type === 'multi' ? '여러 개 고를 수 있습니다.' : '하나만 골라 주세요.'}</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {currentQuestion.options.map((option) => {
              const value = answers[currentQuestion.id];
              const selected = Array.isArray(value) ? value.includes(option) : value === option;

              return (
                <button
                  key={option}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => currentQuestion.type === 'single' ? setSingle(currentQuestion.id, option) : toggleMulti(currentQuestion.id, option)}
                  className={tile(selected)}
                >
                  {box(selected)}
                  {option}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {isNewsletterStep && (
        <section className="mt-10">
          <h1 className="text-[clamp(24px,3.4vw,32px)] font-bold leading-snug tracking-[-0.03em] text-ink">주간 신호를 메일로 받아볼까요?</h1>
          <p className="mt-3 text-[15px] leading-7 text-muted">지켜보는 문제의 변화와 관심 분야에 맞는 읽을거리를 매주 월요일에 보내 드립니다.</p>
          <div className="mt-8 grid gap-3">
            {[
              { value: true, label: '네, 받아볼게요', desc: '관심 분야에 맞춘 신호와 기회를 이메일로 받습니다.' },
              { value: false, label: '아니요, 앱에서만 볼게요', desc: '이메일 없이 서비스 안에서만 확인합니다.' },
            ].map((option) => (
              <button key={option.label} type="button" aria-pressed={newsletterSubscribed === option.value} onClick={() => setNewsletterSubscribed(option.value)} className={tile(newsletterSubscribed === option.value)}>
                {box(newsletterSubscribed === option.value)}
                <span>
                  <span className="block font-medium">{option.label}</span>
                  <span className="mt-0.5 block text-sm leading-6 text-muted">{option.desc}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      {status === 'error' && <p role="alert" className="mt-6 rounded-[10px] border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700">저장에 실패했습니다. Supabase 테이블과 권한을 확인해주세요.</p>}

      <div className="mt-10 flex items-center justify-between gap-3">
        {step === 0 ? (
          <Link href="/" className="inline-flex min-h-11 items-center text-[15px] text-muted hover:text-ink">나중에 하기</Link>
        ) : (
          <button type="button" onClick={() => setStep((current) => Math.max(0, current - 1))} disabled={status === 'saving'} className="inline-flex min-h-11 items-center text-[15px] text-muted hover:text-ink disabled:opacity-40">‹ 이전</button>
        )}

        {step < totalSteps - 1 ? (
          <button type="button" onClick={() => setStep((current) => Math.min(totalSteps - 1, current + 1))} disabled={!currentAnswered} className="btn h-12 px-6 text-base disabled:cursor-not-allowed">다음</button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={!isComplete || status === 'saving'} className="btn h-12 px-6 text-base disabled:cursor-not-allowed">{status === 'saving' ? '저장 중' : '완료'}</button>
        )}
      </div>
    </div>
  );
}
