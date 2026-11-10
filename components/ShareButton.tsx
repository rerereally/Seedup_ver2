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
      className="btn-quiet"
    >
      <Share2 aria-hidden="true" className="h-4 w-4" />
      {copied ? '복사됨' : '공유'}
    </button>
  );
}
