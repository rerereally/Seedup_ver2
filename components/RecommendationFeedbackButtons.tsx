'use client';

import type { ContentTarget } from '@/lib/content-targets';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function RecommendationFeedbackButtons({ itemType, itemId }: { itemType: Extract<ContentTarget, 'news' | 'paper'>; itemId: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<'useful' | 'not_relevant' | null>(null);
  const [pending, setPending] = useState(false);

  const send = async (feedback: 'useful' | 'not_relevant') => {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch('/api/recommendations/feedback', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemType, itemId, feedback, surface: 'dashboard_banner' }),
      });
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
        return;
      }
      if (response.ok) setSelected(feedback);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {([['useful', '추천 좋음'], ['not_relevant', '관련 없음']] as const).map(([feedback, label]) => (
        <button
          key={feedback}
          type="button"
          disabled={pending}
          onClick={() => void send(feedback)}
          aria-pressed={selected === feedback}
          className={`inline-flex min-h-10 items-center border px-2.5 py-1 text-xs font-bold disabled:opacity-50 ${selected === feedback ? 'border-ink bg-ink text-white' : 'border-outline-soft bg-surface text-muted hover:border-ink hover:text-ink'}`}
        >
          {selected === feedback ? '반영됨' : label}
        </button>
      ))}
    </div>
  );
}
