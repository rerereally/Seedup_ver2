'use client';

import OnboardingForm from '@/components/OnboardingForm';
import { X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export default function OnboardingModal({ userId, email }: { userId: string; email: string | null }) {
  const [isOpen, setIsOpen] = useState(true);
  const isHydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  if (!isHydrated || !isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/35 px-4 py-6 backdrop-blur-[2px]">
      <button
        type="button"
        aria-label="설문 닫기"
        onClick={() => setIsOpen(false)}
        className="absolute inset-0 cursor-default"
      />

      <section className="relative z-10 flex max-h-[min(720px,calc(100dvh-40px))] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-outline-soft bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-outline-soft bg-white p-5">
          <div>
            <div className="mb-2 inline-flex rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">Onboarding</div>
            <h1 className="text-xl font-bold text-ink">맞춤 추천 설정</h1>
            <p className="mt-1 text-sm leading-6 text-muted">5문항으로 관심 분야와 목표에 맞는 콘텐츠 흐름을 맞춰드릴게요.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="설문 닫기"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-outline-soft bg-surface text-muted transition-colors hover:border-brand-primary hover:text-brand-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <OnboardingForm userId={userId} email={email} onCompleted={() => setIsOpen(false)} />
        </div>
      </section>
    </div>,
    document.body,
  );
}
