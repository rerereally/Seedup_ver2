'use client';

import type { NewsItem, ResearchPaper } from '@/lib/data';
import type { RecommendedItem } from '@/lib/recommendations';
import { ArrowRight, FileText } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

type BriefItem = {
  id: string;
  type: 'news' | 'paper';
  title: string;
  summary: string | null;
  category: string | null;
  source: string | null;
  href: string;
  score: number | null;
  reasons: string[];
};

function fromNews(item: NewsItem, reasons: string[] = []): BriefItem {
  return {
    id: item.id,
    type: 'news',
    title: item.title,
    summary: item.summary ?? item.beginner_summary ?? null,
    category: item.category ?? 'Article',
    source: item.source ?? null,
    href: `/news/${item.id}`,
    score: item.relevance_score ?? null,
    reasons,
  };
}

function fromPaper(item: ResearchPaper, reasons: string[] = []): BriefItem {
  return {
    id: item.id,
    type: 'paper',
    title: item.title,
    summary: item.beginner_summary ?? item.expert_summary ?? item.abstract,
    category: item.review_type ?? 'Paper',
    source: item.source ?? 'Research',
    href: `/papers/${item.id}`,
    score: item.relevance_score ?? null,
    reasons,
  };
}

export default function DashboardRecommendationBanner({
  recommendedNews,
  latestNews,
  latestPapers,
}: {
  recommendedNews: RecommendedItem<NewsItem>[];
  latestNews: NewsItem[];
  latestPapers: ResearchPaper[];
}) {
  const weeklyItems = recommendedNews.slice(0, 5).map(({ item, reasons }) => fromNews(item, reasons));
  const rotatingItems = weeklyItems.length ? weeklyItems : latestNews.slice(0, 5).map((item) => fromNews(item));
  const smallItems = useMemo(() => [...latestNews.slice(0, 1).map((item) => fromNews(item)), ...latestPapers.slice(0, 1).map((item) => fromPaper(item))].slice(0, 2), [latestNews, latestPapers]);
  const [activeIndex, setActiveIndex] = useState(0);
  const active = rotatingItems[activeIndex] ?? rotatingItems[0];

  useEffect(() => {
    if (rotatingItems.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % rotatingItems.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [rotatingItems.length]);

  if (!active) {
    return (
      <div className="border border-outline-soft bg-white p-5">
        <p className="text-sm font-bold text-ink">추천 아티클을 준비 중입니다.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <section className="border border-outline-soft bg-white lg:col-span-3">
        <div className="border-b border-outline-soft p-5">
          <div className="mb-4 flex items-center justify-between gap-3 text-xs font-bold uppercase text-muted">
            <span className="inline-flex items-center gap-2 border border-outline-soft bg-surface px-2 py-1 text-ink">
              <FileText className="h-4 w-4" />
              오늘의 추천글
            </span>
            <span>{active.category}</span>
          </div>
          <Link href={active.href} className="group block">
            <h2 className="line-clamp-3 text-2xl font-black leading-tight text-ink md:text-4xl group-hover:underline">{active.title}</h2>
            {active.summary && <p className="mt-4 line-clamp-3 max-w-3xl text-sm leading-7 text-muted">{active.summary}</p>}
          </Link>
          {!!active.reasons.length && (
            <div className="mt-4 flex flex-wrap gap-2">
              {active.reasons.map((reason) => (
                <span key={reason} className="border border-outline-soft bg-surface px-2 py-1 text-xs font-bold text-muted">{reason}</span>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-0 border-b border-outline-soft md:grid-cols-3">
          {[
            [active.source ?? 'Seedup', 'source'],
            [active.type === 'paper' ? '논문' : '아티클', 'type'],
            [active.score ? `${Math.round(active.score)}점` : '-', 'signal'],
          ].map(([value, label]) => (
            <div key={label} className="border-outline-soft p-4 md:border-r md:last:border-r-0">
              <p className="text-xl font-black text-ink">{value}</p>
              <p className="mt-1 text-xs font-bold uppercase text-muted">{label}</p>
            </div>
          ))}
        </div>

        <div className="p-5">
          <div className="mb-4 flex gap-1.5">
            {rotatingItems.map((item, index) => (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-2 transition-all ${activeIndex === index ? 'w-8 bg-ink' : 'w-2 bg-surface-high'}`}
                aria-label={`추천글 ${index + 1}`}
              />
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {smallItems.map((item) => (
              <Link key={`${item.type}-${item.id}`} href={item.href} className="border border-outline-soft bg-surface p-4 hover:border-ink">
                <p className="mb-2 text-xs font-bold uppercase text-muted">{item.type === 'paper' ? '최신 논문' : '최신 아티클'}</p>
                <h3 className="line-clamp-2 text-sm font-black leading-6 text-ink">{item.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <aside className="border border-outline-soft bg-white p-4 lg:col-span-2">
        <div className="mb-3 flex items-center justify-between border-b border-outline-soft pb-3">
          <h2 className="text-sm font-black uppercase text-ink">이번 주 추천 아티클</h2>
          <span className="text-xs font-bold uppercase text-muted">{weeklyItems.length}개</span>
        </div>
        <div className="grid gap-2">
          {weeklyItems.slice(0, 5).map((item, index) => (
            <Link key={item.id} href={item.href} className="group flex gap-3 border border-outline-soft bg-surface p-3 hover:border-ink">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-ink text-xs font-black text-white">{index + 1}</span>
              <span className="min-w-0">
                <span className="block line-clamp-2 text-sm font-bold leading-5 text-ink group-hover:underline">{item.title}</span>
                <span className="mt-1 block text-xs font-bold uppercase text-muted">{item.reasons[0] ?? item.category}</span>
              </span>
            </Link>
          ))}
          {!weeklyItems.length && <div className="border border-outline-soft bg-surface p-4 text-sm text-muted">추천 아티클을 준비 중입니다.</div>}
        </div>
        <Link href="/news" className="mt-4 inline-flex h-10 items-center gap-2 bg-ink px-4 text-sm font-bold text-white">
          아티클 전체 보기
          <ArrowRight className="h-4 w-4" />
        </Link>
      </aside>
    </div>
  );
}
