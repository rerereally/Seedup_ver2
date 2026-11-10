'use client';

import type { ContentTarget } from '@/lib/content-targets';
import { Eye, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useState } from 'react';

export default function ContentEngagement({
  itemType,
  itemId,
  returnTo: _returnTo,
  views,
  likes,
  dislikes,
}: {
  itemType: ContentTarget;
  itemId: string;
  returnTo: string;
  views: number | null | undefined;
  likes: number | null | undefined;
  dislikes: number | null | undefined;
}) {
  const [counts, setCounts] = useState({ views: Number(views ?? 0), likes: Number(likes ?? 0), dislikes: Number(dislikes ?? 0) });
  const [pending, setPending] = useState(false);

  const react = async (reaction: 'like' | 'dislike') => {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch('/api/engagement/reaction', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemType, itemId, reaction }),
      });
      if (response.ok) {
        const next = await response.json();
        setCounts({ views: Number(next.views ?? counts.views), likes: Number(next.likes ?? 0), dislikes: Number(next.dislikes ?? 0) });
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-1 text-sm text-muted">
      <span className="num inline-flex h-10 items-center gap-1.5 pr-3">
        <Eye aria-hidden="true" className="h-4 w-4" />
        <span className="sr-only">조회 </span>{counts.views}
      </span>
      <button type="button" disabled={pending} onClick={() => void react('like')} aria-label={`도움이 됐어요 ${counts.likes}`} className="num inline-flex h-10 items-center gap-1.5 rounded-full px-3 transition-colors hover:bg-surface-high hover:text-ink disabled:opacity-50">
        <ThumbsUp aria-hidden="true" className="h-4 w-4" />
        {counts.likes}
      </button>
      <button type="button" disabled={pending} onClick={() => void react('dislike')} aria-label={`별로예요 ${counts.dislikes}`} className="num inline-flex h-10 items-center gap-1.5 rounded-full px-3 transition-colors hover:bg-surface-high hover:text-ink disabled:opacity-50">
        <ThumbsDown aria-hidden="true" className="h-4 w-4" />
        {counts.dislikes}
      </button>
    </div>
  );
}
