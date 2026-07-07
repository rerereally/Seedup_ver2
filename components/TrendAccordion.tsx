'use client';

import type { Trend } from '@/lib/data';
import { ChevronDown, Flame, Lightbulb, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function TrendAccordion({ trends }: { trends: Trend[] }) {
  const [openIndex, setOpenIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || trends.length < 2) return;

    const timer = window.setInterval(() => {
      setOpenIndex((current) => (current + 1) % trends.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, [isPaused, trends.length]);

  return (
    <section className="flex flex-col gap-4" onMouseEnter={() => setIsPaused(true)} onMouseLeave={() => setIsPaused(false)}>
      <div className="hidden items-center justify-between px-4 text-sm font-medium uppercase tracking-wider text-muted md:flex">
        <div className="flex items-center gap-6">
          <span className="w-8 text-center">순위</span>
          <span>키워드</span>
        </div>
        <div className="flex items-center gap-10">
          <span className="w-24 text-center">점수</span>
          <span className="w-24 text-center">상태</span>
          <span className="w-8" />
        </div>
      </div>

      {trends.map((trend, index) => {
        const isOpen = openIndex === index;
        const bars = trend.bars?.length ? trend.bars : [];
        const ideas = trend.project_ideas?.length ? trend.project_ideas : [];

        return (
          <article key={trend.id} className={`overflow-hidden rounded-xl border bg-white shadow-[0_4px_12px_rgba(0,0,0,0.02)] transition-all ${isOpen ? 'border-brand-primary' : 'border-gray-200 hover:border-brand-primary/60'}`}>
            <button
              type="button"
              className="flex w-full items-center justify-between px-5 py-5 text-left md:px-10"
              onClick={() => {
                setOpenIndex(index);
                setIsPaused(true);
              }}
              aria-expanded={isOpen}
            >
              <div className="flex items-center gap-6">
                <span className="w-8 text-center text-3xl font-bold text-brand-primary">{trend.rank ?? index + 1}</span>
                <h2 className="text-2xl font-semibold text-ink">{trend.keyword}</h2>
              </div>
              <div className="flex items-center gap-5 md:gap-10">
                <div className="hidden w-24 text-center md:block">
                  <span className="text-2xl font-bold text-ink">{trend.score ?? '-'}</span>
                </div>
                <div className="hidden w-24 justify-center md:flex">
                  <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                    <Flame className="h-3.5 w-3.5" />
                    {trend.status ?? 'Watch'}
                  </span>
                </div>
                <ChevronDown className={`h-5 w-5 text-muted transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            <div className={`grid transition-[grid-template-rows] duration-500 ease-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
              <div className="overflow-hidden">
                <div className="border-t border-outline-soft/30 p-5 md:p-10">
                  <div className="grid gap-8 lg:grid-cols-2">
                    <div className="dot-grid rounded-lg border border-outline-soft/40 bg-white p-5">
                      <div className="mb-5 flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-ink">트렌드 흐름</h3>
                        <div className="flex gap-2 text-xs">
                          <span className="rounded border border-outline-soft bg-surface px-2 py-1 text-muted">1W</span>
                          <span className="rounded border border-brand-primary/20 bg-brand-primary/10 px-2 py-1 font-bold text-brand-primary">1M</span>
                          <span className="rounded border border-outline-soft bg-surface px-2 py-1 text-muted">3M</span>
                        </div>
                      </div>
                      <div className="relative flex h-48 items-end justify-between border-b border-l border-outline-soft/60 px-3 pb-3">
                        {bars.map((bar, barIndex) => (
                          <div key={barIndex} className="w-[12%] rounded-t-sm border-t-2 border-brand-primary bg-brand-primary/20" style={{ height: `${bar}%` }} />
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col justify-between rounded-lg border border-outline-soft/40 bg-surface-lowest p-5">
                      <div>
                        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                          <TrendingUp className="h-3.5 w-3.5" />
                          시장 해석
                        </div>
                        <p className="leading-7 text-muted">{trend.summary}</p>
                      </div>
                      <div className="mt-6">
                        <h4 className="mb-3 text-sm font-semibold text-ink">바로 만들 수 있는 프로젝트</h4>
                        <div className="flex flex-wrap gap-2">
                          {ideas.map((idea) => (
                            <Link key={idea} href="/projects" className="inline-flex items-center gap-1 rounded-full bg-tertiary/10 px-3 py-1 text-xs font-semibold text-tertiary hover:bg-tertiary/20">
                              <Lightbulb className="h-3.5 w-3.5" />
                              {idea}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
