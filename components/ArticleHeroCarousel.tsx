'use client';

import type { ArticleFeedItem } from '@/lib/data';
import { ArrowRight, Newspaper } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

function formatDate(value: string | null) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));
}

function itemHref(item: ArticleFeedItem) {
  return item.type === 'paper' ? `/papers/${item.id}` : `/news/${item.id}`;
}

export default function ArticleHeroCarousel({ items }: { items: ArticleFeedItem[] }) {
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

  return (
    <section className="flex h-full flex-col overflow-hidden border border-outline-soft bg-white">
      <div className="min-h-0 flex-1 border-b border-outline-soft p-5 md:p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
            <Newspaper className="h-4 w-4" />
            Featured Brief
          </div>
          <span className="text-xs font-bold uppercase text-muted">{active.type === 'paper' ? 'PAPER' : active.category ?? 'ARTICLE'}</span>
        </div>
        <Link href={itemHref(active)} className="mt-5 block">
          <h2 className="line-clamp-3 text-3xl font-black leading-tight text-ink md:text-4xl">{active.title}</h2>
          {(active.summary ?? active.beginner_summary) && (
            <p className="mt-4 line-clamp-4 max-w-3xl text-base leading-7 text-muted">{active.summary ?? active.beginner_summary}</p>
          )}
        </Link>
      </div>

      <div className="grid shrink-0 gap-0 border-b border-outline-soft md:grid-cols-3">
        {[
          [active.source ?? 'Seedup', 'source'],
          [formatDate(active.published_at) || '-', 'collected'],
          [String(active.relevance_score ?? '-'), 'score'],
        ].map(([value, label]) => (
          <div key={label} className="border-outline-soft p-4 md:border-r md:last:border-r-0">
            <p className="text-xl font-black text-ink">{value}</p>
            <p className="mt-1 text-xs font-bold uppercase text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 p-5 md:p-6">
        <div className="flex gap-1.5">
          {items.map((item, index) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveIndex(index)}
              className={`h-2 transition-all ${index === activeIndex ? 'w-8 bg-ink' : 'w-2 bg-surface-high'}`}
              aria-label={`추천 아티클 ${index + 1}`}
            />
          ))}
        </div>
        <Link href={itemHref(active)} className="inline-flex h-10 items-center gap-2 bg-ink px-4 text-sm font-bold text-white">
          읽기
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
