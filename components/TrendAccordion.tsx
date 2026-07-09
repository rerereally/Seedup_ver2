'use client';

import type { Trend } from '@/lib/data';
import { ArrowRight, BarChart3, Code2, FileText, PackageSearch, Radio } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

function numberValue(value: number | null | undefined) {
  return Number(value ?? 0);
}

function statusLabel(status: string | null) {
  if (!status) return 'WATCH';
  return status.toUpperCase();
}

function sourceLabel(type: string) {
  if (type === 'news') return 'NEWS';
  if (type === 'product') return 'AI PRODUCT';
  if (type === 'github') return 'GITHUB';
  return type.toUpperCase();
}

function signalHref(ref: { type: string; id: string }) {
  if (ref.type === 'news') return `/news/${ref.id}`;
  if (ref.type === 'product') return `/ai-products/${ref.id}`;
  if (ref.type === 'github') return `/github-trends/${ref.id}`;
  return '/trends';
}

function SourceIcon({ type }: { type: string }) {
  if (type === 'news') return <FileText className="h-4 w-4" />;
  if (type === 'product') return <PackageSearch className="h-4 w-4" />;
  if (type === 'github') return <Code2 className="h-4 w-4" />;
  return <Radio className="h-4 w-4" />;
}

function SignalBars({ bars }: { bars: number[] | null }) {
  const values = bars?.length ? bars : [18, 32, 28, 44, 52, 48, 68, 74];

  return (
    <div className="border border-outline-soft bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-bold uppercase text-muted">
          <BarChart3 className="h-4 w-4" />
          Signal Flow
        </div>
        <span className="text-xs font-bold uppercase text-muted">30D</span>
      </div>
      <div className="flex h-44 items-end gap-2 border-b border-l border-outline-soft px-3 pb-3">
        {values.map((bar, index) => (
          <div key={`${bar}-${index}`} className="flex min-w-0 flex-1 items-end">
            <div className="w-full bg-ink" style={{ height: `${Math.max(8, Math.min(100, bar))}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function RankingExplanation({ trend, sourcesCount }: { trend: Trend; sourcesCount: number }) {
  const diversity = [
    Number(trend.news_count ?? 0) > 0 ? '뉴스' : null,
    Number(trend.product_count ?? 0) > 0 ? 'AI 제품' : null,
    Number(trend.github_repo_count ?? 0) > 0 ? 'GitHub' : null,
  ].filter(Boolean);

  return (
    <div className="border border-outline-soft bg-surface p-4">
      <h3 className="text-sm font-black uppercase text-ink">Ranking Logic</h3>
      <div className="mt-4 grid gap-2">
        {[
          [`${trend.score ?? 0}점`, '키워드 빈도, 최신성, 출처 품질을 합산한 현재 점수'],
          [`${sourcesCount || 0}개`, '서로 다른 콘텐츠에서 반복 감지된 신호 수'],
          [diversity.join(' + ') || '단일 소스', '여러 출처에서 동시에 잡히면 순위가 더 올라갑니다'],
        ].map(([value, label]) => (
          <div key={label} className="border border-outline-soft bg-white p-3">
            <p className="text-lg font-black text-ink">{value}</p>
            <p className="mt-1 text-xs font-bold leading-5 text-muted">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TrendAccordion({ trends }: { trends: Trend[] }) {
  const [selectedId, setSelectedId] = useState(trends[0]?.id);
  const selectedTrend = useMemo(() => trends.find((trend) => trend.id === selectedId) ?? trends[0], [selectedId, trends]);

  if (!selectedTrend) return null;

  const sourcesCount = numberValue(selectedTrend.sources_count) || numberValue(selectedTrend.news_count) + numberValue(selectedTrend.product_count) + numberValue(selectedTrend.github_repo_count);
  const ideas = selectedTrend.project_ideas?.length ? selectedTrend.project_ideas : ['관련 신호를 바탕으로 미니 프로젝트 주제 만들기'];
  const refs = selectedTrend.source_refs?.length ? selectedTrend.source_refs : [];

  return (
    <section className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <div className="mb-3 flex items-center justify-between border-b border-outline-soft pb-3">
          <h2 className="text-sm font-black uppercase text-ink">Trend Ranking</h2>
          <span className="text-xs font-bold uppercase text-muted">{trends.length} signals</span>
        </div>
        <div className="grid gap-2">
          {trends.map((trend, index) => {
            const isSelected = trend.id === selectedTrend.id;

            return (
              <button
                key={trend.id}
                type="button"
                onClick={() => setSelectedId(trend.id)}
                className={`border p-4 text-left transition-colors ${isSelected ? 'border-ink bg-ink text-white' : 'border-outline-soft bg-white text-ink hover:border-ink'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className={`text-xs font-bold uppercase ${isSelected ? 'text-white' : 'text-muted'}`}>#{trend.rank ?? index + 1}</p>
                    <h3 className="mt-2 truncate text-xl font-black">{trend.keyword}</h3>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-2xl font-black">{trend.score ?? '-'}</p>
                    <p className={`text-xs font-bold uppercase ${isSelected ? 'text-white' : 'text-muted'}`}>{statusLabel(trend.status)}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="lg:col-span-2">
        <article className="border border-outline-soft bg-white">
          <div className="border-b border-outline-soft p-5 md:p-6">
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-widest text-muted">SELECTED_TREND</p>
                <h2 className="mt-2 break-words text-4xl font-black leading-tight text-ink md:text-5xl">{selectedTrend.keyword}</h2>
                <p className="mt-4 max-w-3xl text-base leading-8 text-muted">
                  {selectedTrend.summary ?? '최근 수집된 뉴스, AI 제품, GitHub 저장소 신호를 바탕으로 감지된 개발 트렌드입니다.'}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 md:w-80">
                {[
                  ['SCORE', selectedTrend.score ?? '-'],
                  ['STATUS', statusLabel(selectedTrend.status)],
                  ['SOURCES', sourcesCount || '-'],
                ].map(([label, value]) => (
                  <div key={label} className="border border-outline-soft bg-surface p-3">
                    <p className="text-xs font-bold uppercase text-muted">{label}</p>
                    <p className="mt-2 text-xl font-black text-ink">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-5 p-5 md:p-6 lg:grid-cols-2">
            <SignalBars bars={selectedTrend.bars} />

            <div className="grid gap-4">
              <div className="border border-outline-soft bg-surface p-4">
                <h3 className="text-sm font-black uppercase text-ink">Signal Mix</h3>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {[
                    ['NEWS', numberValue(selectedTrend.news_count)],
                    ['PRODUCTS', numberValue(selectedTrend.product_count)],
                    ['GITHUB', numberValue(selectedTrend.github_repo_count)],
                  ].map(([label, value]) => (
                    <div key={label} className="border border-outline-soft bg-white p-3">
                      <p className="text-xs font-bold uppercase text-muted">{label}</p>
                      <p className="mt-2 text-2xl font-black text-ink">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <RankingExplanation trend={selectedTrend} sourcesCount={sourcesCount} />

              <div className="border border-outline-soft bg-surface p-4">
                <h3 className="text-sm font-black uppercase text-ink">Next Actions</h3>
                <div className="mt-4 grid gap-2">
                  {ideas.slice(0, 4).map((idea) => (
                    <Link key={idea} href="/projects" className="flex items-center justify-between gap-3 border border-outline-soft bg-white p-3 text-sm font-bold text-ink hover:border-ink">
                      <span>{idea}</span>
                      <ArrowRight className="h-4 w-4 shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-outline-soft p-5 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h3 className="text-sm font-black uppercase text-ink">Detected Sources</h3>
              <span className="text-xs font-bold uppercase text-muted">{refs.length ? `${refs.length} refs` : 'No refs'}</span>
            </div>
            {refs.length ? (
              <div className="grid gap-2 md:grid-cols-2">
                {refs.slice(0, 8).map((ref) => (
                  <Link key={`${ref.type}-${ref.id}`} href={signalHref(ref)} className="flex items-start gap-3 border border-outline-soft bg-surface p-3 hover:border-ink">
                    <span className="mt-0.5 text-ink">
                      <SourceIcon type={ref.type} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-bold uppercase text-muted">{sourceLabel(ref.type)}</span>
                      <span className="mt-1 block line-clamp-2 text-sm font-semibold leading-6 text-ink">{ref.title}</span>
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-outline-soft bg-surface p-6 text-sm font-semibold text-muted">
                다음 트렌드 집계부터 출처 링크가 표시됩니다.
              </div>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
