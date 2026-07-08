'use client';

import { onboardingQuestions, type OnboardingAnswers } from '@/lib/onboarding';
import { createClient } from '@/lib/supabase/client';
import { ArrowLeft, ArrowRight, CheckCircle2, Mail } from 'lucide-react';
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

  return (
    <div>
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between text-xs font-semibold text-muted">
          <span>{step + 1} / {totalSteps}</span>
          <span>{Math.round(((step + 1) / totalSteps) * 100)}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-high">
          <div className="h-full rounded-full bg-brand-primary transition-all" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
        </div>
      </div>

      {!isNewsletterStep && currentQuestion && (
        <section>
          <div className="mb-5">
            <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/10 text-sm font-bold text-brand-primary">{step + 1}</span>
            <h2 className="text-xl font-bold leading-snug text-ink">{currentQuestion.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{currentQuestion.type === 'multi' ? '여러 개를 선택할 수 있습니다.' : '하나만 선택해주세요.'}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {currentQuestion.options.map((option) => {
              const value = answers[currentQuestion.id];
              const selected = Array.isArray(value) ? value.includes(option) : value === option;

              return (
                <button
                  key={option}
                  type="button"
                  onClick={() => currentQuestion.type === 'single' ? setSingle(currentQuestion.id, option) : toggleMulti(currentQuestion.id, option)}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    selected ? 'border-brand-primary bg-brand-primary text-white' : 'border-outline-soft bg-surface text-muted hover:border-brand-primary hover:text-brand-primary'
                  }`}
                >
                  {selected && <CheckCircle2 className="h-4 w-4" />}
                  {option}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {isNewsletterStep && (
        <section>
          <div className="mb-5">
            <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary/10 text-brand-primary">
              <Mail className="h-4 w-4" />
            </span>
            <h2 className="text-xl font-bold leading-snug text-ink">뉴스레터를 받아볼까요?</h2>
            <p className="mt-2 text-sm leading-6 text-muted">개발 트렌드, 추천 아티클, 많이 본 논문, 오픈소스, AI 제품, 해볼 만한 프로젝트를 이메일로 보내드립니다.</p>
          </div>
          <div className="grid gap-3">
          {[
            { value: true, label: '네, 받아볼게요', desc: '개인화된 콘텐츠와 프로젝트 후보를 이메일로 받습니다.' },
            { value: false, label: '아니요, 앱에서만 볼게요', desc: '이메일 수신 없이 서비스 안에서만 추천을 확인합니다.' },
          ].map((option) => (
            <button
              key={option.label}
              type="button"
              onClick={() => setNewsletterSubscribed(option.value)}
              className={`rounded-lg border p-4 text-left transition-colors ${
                newsletterSubscribed === option.value ? 'border-brand-primary bg-brand-primary/10' : 'border-outline-soft bg-surface hover:border-brand-primary'
              }`}
            >
              <div className="font-semibold text-ink">{option.label}</div>
              <p className="mt-1 text-sm leading-6 text-muted">{option.desc}</p>
            </button>
          ))}
          </div>
        </section>
      )}

      {status === 'error' && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">저장에 실패했습니다. Supabase 테이블과 권한을 확인해주세요.</p>}

      <div className="mt-8 flex items-center justify-between gap-3 border-t border-outline-soft pt-4">
        <button
          type="button"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0 || status === 'saving'}
          className="inline-flex h-11 items-center gap-2 rounded-lg border border-outline-soft bg-white px-4 text-sm font-semibold text-muted transition-colors hover:border-brand-primary hover:text-brand-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="h-4 w-4" />
          이전
        </button>

        {step < totalSteps - 1 ? (
          <button
            type="button"
            onClick={() => setStep((current) => Math.min(totalSteps - 1, current + 1))}
            disabled={!currentAnswered}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            다음
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isComplete || status === 'saving'}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand-primary px-5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {status === 'saving' ? '저장 중' : '완료'}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
