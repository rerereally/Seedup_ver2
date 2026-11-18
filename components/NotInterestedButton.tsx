'use client';

import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/** "관심 없음" on a desk pick: a dislike drops it from the person's picks, and the feedback row feeds the admin numbers. */
export default function NotInterestedButton({ itemType, itemId }: { itemType: string; itemId: string }) {
  const router = useRouter();
  const t = translator(useLang());
  const [state, setState] = useState<'idle' | 'pending' | 'done' | 'failed'>('idle');

  const send = async () => {
    setState('pending');
    const body = (extra: object) => ({ method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ itemType, itemId, ...extra }) });
    const [reaction] = await Promise.all([
      fetch('/api/engagement/reaction', body({ reaction: 'dislike' })).catch(() => null),
      fetch('/api/recommendations/feedback', body({ feedback: 'not_relevant', surface: 'desk_for_you' })).catch(() => null),
    ]);
    if (!reaction?.ok) return setState('failed');
    setState('done');
    router.refresh();
  };

  if (state === 'done') return <span className="text-[12.5px] text-muted">{t('다음부터 빼고 추천합니다', 'Won’t show this again')}</span>;
  return (
    <button type="button" onClick={() => void send()} disabled={state === 'pending'} className="text-[12.5px] text-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50">
      {state === 'failed' ? t('다시 시도', 'Try again') : t('관심 없음', 'Not interested')}
    </button>
  );
}
