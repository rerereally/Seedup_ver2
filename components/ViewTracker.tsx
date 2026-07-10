'use client';

import type { ContentTarget } from '@/lib/content-targets';
import { useEffect } from 'react';

export default function ViewTracker({ itemType, itemId }: { itemType: ContentTarget; itemId: string }) {
  useEffect(() => {
    const key = `seedup:view:${itemType}:${itemId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    void fetch('/api/engagement/view', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ itemType, itemId }),
    });
  }, [itemId, itemType]);
  return null;
}
