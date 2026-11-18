'use client';

import { useLang } from '@/components/LangProvider';
import { translator } from '@/lib/i18n';
import { useState } from 'react';

/** Starts a weekly watch on one idea: Seedup searches again each week and mails new quotes or rival tools. */
export default function WatchIdeaButton({ idea, className = 'btn-quiet h-10 px-4 text-sm' }: { idea: string; className?: string }) {
  const t = translator(useLang());
  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle');
  const [error, setError] = useState('');

  const watch = async () => {
    setState('pending');
    setError('');
    const response = await fetch('/api/opportunities/watch', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idea }) }).catch(() => null);
    const body = await response?.json().catch(() => null) as { error?: string } | null;
    if (response?.ok) return setState('done');
    setState('idle');
    setError(body?.error ?? t('지켜보기를 시작하지 못했습니다.', 'Could not start watching.'));
  };

  if (state === 'done') return <p className="text-sm text-muted">{t('지켜보는 중입니다. 매주 새 원문과 경쟁 도구를 메일로 보냅니다. 프로필에서 그만둘 수 있습니다.', 'Watching. New quotes and rival tools arrive by mail each week; stop it from your profile.')}</p>;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" className={className} onClick={() => void watch()} disabled={state === 'pending' || idea.trim().length < 4}>
        {state === 'pending' ? t('시작하는 중', 'Starting') : t('이 아이디어 지켜보기', 'Watch this idea')}
      </button>
      {error && <p role="alert" className="text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}
