'use client';

import RecommendationFeedbackButtons from '@/components/RecommendationFeedbackButtons';
import type { NewsItem } from '@/lib/data';
import type { RecommendedItem } from '@/lib/recommendations';
import { ArrowRight, FileText } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

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
    score: item.daily_rank_score ?? item.newsletter_priority ?? item.relevance_score ?? null,
    reasons,
  };
}

export default function DashboardRecommendationBanner({
  recommendedNews,
  latestNews,
}: {
  recommendedNews: RecommendedItem<NewsItem>[];
  latestNews: NewsItem[];
}) {
  const recommendationScores = recommendedNews.slice(0, 5).map(({ score }) => score);
  const maxRecommendationScore = Math.max(...recommendationScores, 1);
  const weeklyItems = recommendedNews.slice(0, 5).map(({ item, reasons, score }) => ({
    ...fromNews(item, reasons),
    score: Math.round(Math.min(100, (score / maxRecommendationScore) * 100)),
  }));
  const rotatingItems = weeklyItems.length ? weeklyItems : latestNews.slice(0, 5).map((item) => fromNews(item));
  const [activeIndex, setActiveIndex] = useState(0);
  const recordedImpressionKey = useRef('');
  const recordClick = (item: BriefItem) => {
    void fetch('/api/recommendations/impressions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        surface: 'dashboard_banner',
        eventType: 'click',
        items: [{ itemType: item.type, itemId: item.id, position: activeIndex, score: item.score, reasons: item.reasons }],
      }),
    }).catch(() => undefined);
  };
  const active = rotatingItems[activeIndex] ?? rotatingItems[0];

  useEffect(() => {
    if (rotatingItems.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % rotatingItems.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [rotatingItems.length]);

  useEffect(() => {
    if (!weeklyItems.length) return;
    const impressionKey = weeklyItems.map((item) => `${item.type}:${item.id}`).join('|');
    if (recordedImpressionKey.current === impressionKey) return;
    recordedImpressionKey.current = impressionKey;
    void fetch('/api/recommendations/impressions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        surface: 'dashboard_banner',
        items: weeklyItems.map((item, position) => ({
          itemType: item.type,
          itemId: item.id,
          position,
          score: item.score,
          reasons: item.reasons,
        })),
      }),
    }).catch(() => undefined);
  }, [weeklyItems]);

  if (!active) {
    return (
      <div className="border border-outline-soft bg-white p-4">
        <p className="text-sm font-bold text-ink">추천 아티클을 준비 중입니다.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:h-[520px] lg:grid-cols-5">

      {/* ── 좌측: 오늘의 추천글 ── */}
      <section className="flex min-h-0 flex-col overflow-hidden border border-outline-soft bg-white lg:col-span-3">

        {/* 상단 헤더 — 카테고리 + 타입 */}
        <div className="flex items-center justify-between border-b border-outline-soft px-4 py-2 text-xs font-bold uppercase text-muted">
          <span className="inline-flex items-center gap-1.5 border border-outline-soft bg-surface px-2 py-0.5 text-ink">
            <FileText className="h-3.5 w-3.5" />
            오늘의 추천글
          </span>
          <span>{active.category}</span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
          <div>
            <Link href={active.href} onClick={() => recordClick(active)} className="group block">
              <h2 className="line-clamp-3 text-xl font-black leading-snug text-ink group-hover:underline sm:line-clamp-2 md:text-2xl">
                {active.title}
              </h2>
              {active.summary && (
                <p className="mt-1.5 line-clamp-2 text-sm leading-6 text-muted">
                  {active.summary}
                </p>
              )}
            </Link>
            {!!active.reasons.length && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {active.reasons.slice(0, 2).map((reason) => (
                  <span key={reason} className="border border-outline-soft bg-surface px-2 py-0.5 text-xs font-bold text-muted">
                    {reason}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="mt-auto pt-3">
            <RecommendationFeedbackButtons key={`${active.type}:${active.id}`} itemType={active.type} itemId={active.id} />
          </div>
        </div>

        {/* 메타 행 — 소스 / 타입 / 점수 */}
        <div className="grid grid-cols-1 border-t border-outline-soft sm:grid-cols-3">
          {[
            [active.source ?? 'Seedup', 'source'],
            [active.type === 'paper' ? '논문' : '아티클', 'type'],
            [active.score ? `${Math.round(active.score)}점` : '-', 'signal'],
          ].map(([value, label]) => (
            <div key={label} className="min-w-0 border-b border-outline-soft px-3 py-2 last:border-b-0 sm:border-b-0 sm:border-r sm:last:border-r-0">
              <p className="truncate text-sm font-black text-ink sm:text-base">{value}</p>
              <p className="mt-0.5 text-xs font-bold uppercase text-muted">{label}</p>
            </div>
          ))}
        </div>

        <div className="flex h-11 shrink-0 items-center justify-between border-t border-outline-soft px-4">
          <div className="flex gap-1">
            {rotatingItems.map((item, index) => (
              <button
                key={`${item.type}-${item.id}`}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`h-1.5 transition-all ${activeIndex === index ? 'w-6 bg-ink' : 'w-1.5 bg-outline-soft'}`}
                aria-label={`추천글 ${index + 1}`}
              />
            ))}
          </div>
          <Link href={active.href} className="inline-flex items-center gap-1 text-xs font-black text-ink hover:underline">
            읽기
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </section>

      {/* ── 우측: 이번 주 추천 아티클 ── */}
      <aside className="flex min-h-0 flex-col overflow-hidden border border-outline-soft bg-white p-4 lg:col-span-2">
        {/* 헤더 */}
        <div className="mb-3 flex items-center justify-between border-b border-outline-soft pb-3">
          <h2 className="text-sm font-black uppercase text-ink">이번 주 추천 아티클</h2>
          <span className="text-xs font-bold uppercase text-muted">{weeklyItems.length}개</span>
        </div>

        <div className="grid min-h-0 flex-1 gap-2 sm:grid-rows-5">
            {weeklyItems.slice(0, 5).map((item, index) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => recordClick(item)}
                className="group flex min-h-0 items-start gap-2.5 overflow-hidden border border-outline-soft bg-surface p-2 hover:border-ink"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-ink text-xs font-black text-white">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-[13px] font-bold leading-5 text-ink group-hover:underline">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-bold uppercase text-muted">
                    {item.reasons[0] ?? item.category}
                  </span>
                </span>
              </Link>
            ))}
            {!weeklyItems.length && (
              <div className="border border-outline-soft bg-surface p-4 text-sm text-muted">
                추천 아티클을 준비 중입니다.
              </div>
            )}
        </div>

        {/* 하단 버튼 */}
        <Link
          href="/news"
          className="mt-3 inline-flex min-h-11 items-center gap-2 bg-ink px-4 text-sm font-bold text-white"
        >
          아티클 전체 보기
          <ArrowRight className="h-4 w-4" />
        </Link>
      </aside>
    </div>
  );
}
