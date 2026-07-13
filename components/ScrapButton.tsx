'use client';

import { Bookmark } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

type ScrapItemType = 'news' | 'paper' | 'project' | 'idea' | 'trend' | 'ai_product' | 'github';

export default function ScrapButton({
  itemType,
  itemId,
  title,
  description,
  tag,
  initialSaved = false,
  className,
  savedLabel = '저장 해제',
  unsavedLabel = '저장',
  iconOnly = false,
}: {
  itemType: ScrapItemType;
  itemId: string;
  title: string;
  description?: string | null;
  tag?: string | null;
  initialSaved?: boolean;
  className: string;
  savedLabel?: string;
  unsavedLabel?: string;
  iconOnly?: boolean;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(initialSaved);
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    if (pending) return;
    setPending(true);
    try {
      const response = await fetch('/api/scraps/toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ itemType, itemId, title, description, tag }),
      });
      if (response.status === 401) {
        router.push(`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
        return;
      }
      if (!response.ok) return;
      const next = await response.json();
      setSaved(Boolean(next.saved));
    } finally {
      setPending(false);
    }
  };

  const label = saved ? savedLabel : unsavedLabel;
  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={pending}
      className={`${className} disabled:cursor-wait disabled:opacity-50`}
      aria-label={`${title} ${label}`}
      aria-pressed={saved}
    >
      <Bookmark className={`h-4 w-4 ${saved ? 'fill-ink text-ink' : ''}`} />
      {!iconOnly && label}
    </button>
  );
}
