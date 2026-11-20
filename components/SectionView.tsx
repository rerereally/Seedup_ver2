'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { sectionOf } from '@/lib/sections';

export default function SectionView() {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    if (previous.current === pathname) return;
    previous.current = pathname;
    if (!sectionOf(pathname)) return;
    void fetch('/api/engagement/section-view', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pathname }),
      referrerPolicy: 'no-referrer',
      keepalive: true,
    }).catch(() => {});
  }, [pathname]);

  return null;
}
