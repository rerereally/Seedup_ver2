'use client';

import { submitRecommendationFeedback } from '@/app/actions/engagement';
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
  // 미니카드: 최신 아티클 2 + 최신 논문 2 (총 4개로 빈 공간 자연스럽게 채움)
  const smallItems = useMemo(
    () =>
      [...latestNews.slice(0, 2).map((item) => fromNews(item)), ...latestPapers.slice(0, 2).map((item) => fromPaper(item))].slice(0, 4),
    [latestNews, latestPapers],
  );
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
      <div className="border border-outline-soft bg-white p-4">
        <p className="text-sm font-bold text-ink">추천 아티클을 준비 중입니다.</p>
      </div>
    );
  }

  return (
    /* 배너 전체: 그리드 셀들이 가장 긴 콘텐츠 높이에 맞춰 동일하게 늘어남 */
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">

      {/* ── 좌측: 오늘의 추천글 ── */}
      <section className="flex flex-col border border-outline-soft bg-white lg:col-span-3">

        {/* 상단 헤더 — 카테고리 + 타입 */}
        <div className="flex items-center justify-between border-b border-outline-soft px-4 py-2 text-xs font-bold uppercase text-muted">
          <span className="inline-flex items-center gap-1.5 border border-outline-soft bg-surface px-2 py-0.5 text-ink">
            <FileText className="h-3.5 w-3.5" />
            오늘의 추천글
          </span>
          <span>{active.category}</span>
        </div>

        {/* 기사 본문 — 슬라이더 내용이 적어도 이 박스의 최소 높이가 유지되어 전체 배너 크기가 흔들리지 않음 */}
        <div className="flex flex-1 flex-col px-4 pt-3 pb-2 min-h-[220px]">
          <div>
            <Link href={active.href} className="group block">
              <h2 className="line-clamp-2 text-xl font-black leading-snug text-ink group-hover:underline md:text-2xl">
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
          {/* 피드백 버튼 - 본문 길이에 상관없이 하단에 안정적으로 배치 */}
          <div className="mt-auto flex flex-wrap items-center gap-2 pt-3">
            {([['useful', '추천 좋음'], ['not_relevant', '관련 없음']] as const).map(([feedback, label]) => (
              <form key={feedback} action={submitRecommendationFeedback}>
                <input type="hidden" name="item_type" value={active.type} />
                <input type="hidden" name="item_id" value={active.id} />
                <input type="hidden" name="feedback" value={feedback} />
                <input type="hidden" name="surface" value="dashboard_banner" />
                <input type="hidden" name="return_to" value="/" />
                <button type="submit" className="border border-outline-soft bg-surface px-2.5 py-1 text-xs font-bold text-muted hover:border-ink hover:text-ink">
                  {label}
                </button>
              </form>
            ))}
          </div>
        </div>

        {/* 메타 행 — 소스 / 타입 / 점수 */}
        <div className="grid grid-cols-3 border-t border-outline-soft">
          {[
            [active.source ?? 'Seedup', 'source'],
            [active.type === 'paper' ? '논문' : '아티클', 'type'],
            [active.score ? `${Math.round(active.score)}점` : '-', 'signal'],
          ].map(([value, label]) => (
            <div key={label} className="border-r border-outline-soft px-3 py-2 last:border-r-0">
              <p className="truncate text-base font-black text-ink">{value}</p>
              <p className="mt-0.5 text-xs font-bold uppercase text-muted">{label}</p>
            </div>
          ))}
        </div>

        {/* 인디케이터 + 미니카드 */}
        <div className="px-4 pt-2 pb-3">
          {/* 인디케이터 점 */}
          <div className="mb-2 flex shrink-0 gap-1">
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
          {/* 미니카드 2열 (총 4개) */}
          <div className="grid gap-2 sm:grid-cols-2">
            {smallItems.map((item) => (
              <Link
                key={`${item.type}-${item.id}`}
                href={item.href}
                className="border border-outline-soft bg-surface p-3 hover:border-ink"
              >
                <p className="mb-1 text-xs font-bold uppercase text-muted">
                  {item.type === 'paper' ? '최신 논문' : '최신 아티클'}
                </p>
                <h3 className="line-clamp-2 text-sm font-black leading-5 text-ink">{item.title}</h3>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── 우측: 이번 주 추천 아티클 ── */}
      <aside className="flex flex-col border border-outline-soft bg-white p-4 lg:col-span-2">
        {/* 헤더 */}
        <div className="mb-3 flex items-center justify-between border-b border-outline-soft pb-3">
          <h2 className="text-sm font-black uppercase text-ink">이번 주 추천 아티클</h2>
          <span className="text-xs font-bold uppercase text-muted">{weeklyItems.length}개</span>
        </div>

        {/* 아티클 목록 — 자연스러운 높이 유지 */}
        <div className="flex-1">
          <div className="flex flex-col gap-2">
            {weeklyItems.slice(0, 5).map((item, index) => (
              <Link
                key={item.id}
                href={item.href}
                className="group flex items-start gap-3 border border-outline-soft bg-surface p-3 hover:border-ink"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center bg-ink text-xs font-black text-white">
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="line-clamp-2 block text-sm font-bold leading-5 text-ink group-hover:underline">
                    {item.title}
                  </span>
                  <span className="mt-1 block text-xs font-bold uppercase text-muted">
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
        </div>

        {/* 하단 버튼 */}
        <Link
          href="/news"
          className="mt-3 inline-flex h-10 items-center gap-2 bg-ink px-4 text-sm font-bold text-white"
        >
          아티클 전체 보기
          <ArrowRight className="h-4 w-4" />
        </Link>
      </aside>
    </div>
  );
}
