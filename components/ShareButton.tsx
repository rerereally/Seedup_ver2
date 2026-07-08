'use client';

import { Share2 } from 'lucide-react';
import { useState } from 'react';

type ShareButtonProps = {
  title: string;
  url?: string | null;
};

export default function ShareButton({ title, url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const shareUrl = url ?? window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({ title, url: shareUrl });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="inline-flex h-10 items-center gap-2 border border-outline-soft bg-white px-3 text-sm font-bold text-ink hover:border-ink"
    >
      <Share2 className="h-4 w-4" />
      {copied ? '복사됨' : '공유'}
    </button>
  );
}
