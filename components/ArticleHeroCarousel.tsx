'use client';

import type { ArticleFeedItem } from '@/lib/data';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

function formatDate(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));
}

function itemHref(item: ArticleFeedItem) {
  return item.type === 'paper' ? `/papers/${item.id}` : `/news/${item.id}`;
}

export default function ArticleHeroCarousel({ items, label = '추천 글' }: { items: ArticleFeedItem[]; label?: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = items[activeIndex];

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [items.length]);

  if (!active) return null;

  const kind = active.type === 'paper' ? '논문 리뷰' : active.source === 'Seedup' ? 'Seedup 편집' : '원문 브리핑';

  return (
    <section className="card flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1 p-6 md:p-8">
        <p className="label">{label}</p>
        <Link href={itemHref(active)} className="mt-4 block">
          <h2 className="line-clamp-3 text-2xl font-extrabold leading-[1.2] tracking-tight text-ink sm:text-3xl md:text-[34px]" style={{ textWrap: 'balance' }}>{active.title}</h2>
          {(active.summary ?? active.beginner_summary) && (
            <p className="mt-4 line-clamp-4 max-w-[40em] text-base leading-7 text-muted">{active.summary ?? active.beginner_summary}</p>
          )}
        </Link>
        <p className="mt-5 text-[13px] text-muted">{[active.source ?? 'Seedup', formatDate(active.published_at), kind].filter(Boolean).join(' · ')}</p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-outline-soft px-6 py-4 md:px-8">
        <div className="flex items-center gap-1.5">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              aria-label={`추천 글 ${index + 1}`}
              aria-current={index === activeIndex}
              className="flex h-6 min-h-0 min-w-0 items-center"
            >
              <span className={`block h-1.5 rounded-full transition-all ${index === activeIndex ? 'w-7 bg-ink' : 'w-1.5 bg-surface-high'}`} />
            </button>
          ))}
        </div>
        <Link href={itemHref(active)} className="btn">
          읽기
          <ArrowRight aria-hidden="true" className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
