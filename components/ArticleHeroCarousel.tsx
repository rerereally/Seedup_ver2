'use client';

import type { ArticleFeedItem } from '@/lib/data';
import { ArrowRight, Sparkles } from 'lucide-react';
import Image from 'next/image';
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
    }, 4500);
    return () => window.clearInterval(timer);
  }, [items.length]);

  if (!active) return null;

  return (
    <section className="group relative h-full overflow-hidden rounded-2xl shadow-lg">
      {/* 배경 이미지 또는 그라데이션 */}
      <div className="absolute inset-0">
        {active.image_url ? (
          <Image
            src={active.image_url}
            alt={active.title}
            fill
            sizes="(min-width: 1024px) 70vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
            priority
          />
        ) : (
          <div className="h-full w-full bg-[radial-gradient(circle_at_20%_30%,rgba(255,70,40,0.35),transparent_50%),linear-gradient(145deg,#1b1f21,#2a3035)]" />
        )}
      </div>

      {/* 어두운 그라데이션 오버레이 — 하단 텍스트 가독성 */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

      {/* 상단 뱃지 */}
      <div className="absolute left-5 top-5 flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-primary px-3 py-1 text-xs font-bold text-white shadow-md">
          <Sparkles className="h-3 w-3" />
          인기 글
        </span>
        <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          {active.type === 'paper' ? '논문 리뷰' : (active.category ?? 'Article')}
        </span>
      </div>

      {/* 하단 콘텐츠 */}
      <Link href={itemHref(active)} className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
        <div>
          <p className="mb-2 text-xs font-semibold text-white/60">
            {active.source ?? 'Seedup'} · {formatDate(active.published_at)}
          </p>
          <h2 className="line-clamp-3 text-2xl font-black leading-tight text-white drop-shadow-sm md:text-3xl">
            {active.title}
          </h2>
          {(active.summary ?? active.beginner_summary) && (
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-white/75">
              {active.summary ?? active.beginner_summary}
            </p>
          )}
          <span className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-ink transition-all group-hover:bg-brand-primary group-hover:text-white">
            자세히 읽기
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>

        {/* 인디케이터 도트 */}
        {items.length > 1 && (
          <div className="absolute bottom-6 right-6 flex gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                onClick={(e) => { e.preventDefault(); setActiveIndex(i); }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === activeIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/40'
                }`}
                aria-label={`슬라이드 ${i + 1}`}
              />
            ))}
          </div>
        )}
      </Link>
    </section>
  );
}
