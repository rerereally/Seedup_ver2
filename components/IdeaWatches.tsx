'use client';

import { useEffect, useState } from 'react';

type Watch = { id: string; idea: string; created_at: string; checked_at: string | null };

/** The ideas this person watches, each with a stop button. Watches start from MCP watch_idea or the report. */
export default function IdeaWatches() {
  const [watches, setWatches] = useState<Watch[] | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/opportunities/watch')
      .then((response) => (response.ok ? response.json() : { watches: [] }))
      .then((json: { watches?: Watch[] }) => setWatches(json.watches ?? []))
      .catch(() => setWatches([]));
  }, []);

  const stop = async (id: string) => {
    const response = await fetch(`/api/opportunities/watch?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => null);
    if (response?.ok) {
      setWatches((list) => (list ?? []).filter((row) => row.id !== id));
      setMessage('지켜보기를 그만뒀습니다.');
    } else setMessage('그만두지 못했습니다. 다시 시도해 주세요.');
  };

  if (!watches?.length) return <p className="mt-2 text-[15px] text-muted">{watches ? '지켜보는 아이디어가 없습니다. 코딩 에이전트에서 watch_idea로 시작할 수 있습니다.' : '불러오는 중입니다.'}</p>;
  return (
    <>
      <ul className="rows mt-3">
        {watches.map((row) => (
          <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-3">
            <span className="min-w-0 flex-1 text-[15px] text-ink">{row.idea}</span>
            <span className="text-[13px] text-muted">{row.checked_at ? `${new Date(row.checked_at).toLocaleDateString('ko-KR')} 확인` : '첫 확인 전'}</span>
            <button type="button" className="text-sm text-seed underline-offset-4 hover:underline" onClick={() => void stop(row.id)}>그만두기</button>
          </li>
        ))}
      </ul>
      <p role="status" className="mt-2 text-[13px] text-muted">{message}</p>
    </>
  );
}
