'use client';

import type { Trend, TrendSnapshot } from '@/lib/data';
import { isGenericTitle } from '@/lib/ingest/trend-builder';
import { ArrowUpRight, ChevronDown, Code2, FileText, PackageSearch, Radio } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const ALL = '전체';
const CATEGORY_TABS = [ALL, '개발 워크플로우', 'AI 도구·모델', '구현 패턴', '오픈소스 프로젝트', '빌드 아이디어'] as const;

// What the ranking step decided about a topic, in the words a reader would use.
const STATUS: Record<string, { label: string; dot: string }> = {
  hot: { label: '가장 뜨거움', dot: 'bg-hot' },
  rising: { label: '오르는 중', dot: 'bg-emerald-500' },
  new: { label: '새로 등장', dot: 'bg-seed' },
  steady: { label: '꾸준함', dot: 'bg-outline-strong' },
  cooling: { label: '식는 중', dot: 'bg-outline-strong' },
  watch: { label: '지켜보는 중', dot: 'bg-outline-strong' },
};

function numberValue(value: number | null | undefined) {
  return Number(value ?? 0);
}

function scoreOf(trend: Trend) {
  return numberValue(trend.display_score ?? trend.score);
}

function categoryOf(trend: Trend) {
  if (trend.category === 'AI 개발 방식') return '개발 워크플로우';
  if (trend.category === 'AI 도구/모델') return 'AI 도구·모델';
  if (trend.category === '스킬/아키텍처') return '구현 패턴';
  if (trend.category === '오픈소스/GitHub') return '오픈소스 프로젝트';
  if (trend.category) return trend.category;
  const keyword = trend.keyword.toLowerCase();
  const type = trend.entity_type ?? trend.trend_type;
  if (type === 'workflow' || type === 'development_method') return '개발 워크플로우';
  if (type === 'tool' || type === 'model' || type === 'ai_tool' || type === 'ai_model' || type === 'product_category' || keyword.includes('claude') || keyword.includes('gemini')) return 'AI 도구·모델';
  if (type === 'open_source_project') return '오픈소스 프로젝트';
  if (type === 'build_idea' || type === 'project_idea') return '빌드 아이디어';
  return '구현 패턴';
}

function sourceLabel(type: string) {
  if (type === 'news' || type === 'rss') return '뉴스·블로그';
  if (type === 'product' || type === 'product_hunt') return 'Product Hunt';
  if (type === 'github') return 'GitHub';
  if (type === 'paper') return '논문';
  if (type === 'hackernews') return 'Hacker News';
  if (type === 'devto') return 'DEV.to';
  if (type === 'stackoverflow') return 'Stack Overflow';
  if (type === 'huggingface') return 'Hugging Face';
  if (type === 'npm') return 'npm';
  return type;
}

function signalHref(ref: { type: string; id: string; url?: string | null }) {
  if (ref.type === 'news') return `/news/${ref.id}`;
  if (ref.type === 'product' || ref.type === 'product_hunt') return `/ai-products/${ref.id}`;
  if (ref.type === 'github') return `/github-trends/${ref.id}`;
  return ref.url ?? '/trends';
}

function SourceIcon({ type }: { type: string }) {
  if (type === 'news' || type === 'rss' || type === 'hackernews' || type === 'devto' || type === 'stackoverflow') return <FileText className="h-4 w-4" />;
  if (type === 'product' || type === 'product_hunt' || type === 'huggingface' || type === 'npm') return <PackageSearch className="h-4 w-4" />;
  if (type === 'github') return <Code2 className="h-4 w-4" />;
  return <Radio className="h-4 w-4" />;
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit' }).format(date);
}

/** The largest source and how many others, for a row: the full mix sits in the opened detail. */
function shortMix(trend: Trend) {
  const rows = signalRows(trend).sort((a, b) => b.count - a.count);
  if (!rows.length) return '신호 집계 중';
  return `${rows[0].type} ${rows[0].count}${rows.length > 1 ? ` 외 ${rows.length - 1}곳` : ''}`;
}

function compactMix(trend: Trend) {
  const sourceMix = trend.source_mix ?? {};
  const richMix = [
    numberValue(sourceMix.github) ? `GitHub ${sourceMix.github}` : null,
    numberValue(sourceMix.product_hunt) ? `Product Hunt ${sourceMix.product_hunt}` : null,
    numberValue(sourceMix.huggingface) ? `Hugging Face ${sourceMix.huggingface}` : null,
    numberValue(sourceMix.npm) ? `npm ${sourceMix.npm}` : null,
    numberValue(sourceMix.hackernews) ? `HN ${sourceMix.hackernews}` : null,
    numberValue(sourceMix.devto) ? `DEV.to ${sourceMix.devto}` : null,
    numberValue(sourceMix.stackoverflow) ? `Stack Overflow ${sourceMix.stackoverflow}` : null,
    numberValue(sourceMix.rss) ? `RSS ${sourceMix.rss}` : null,
    numberValue(sourceMix.paper) ? `논문 ${sourceMix.paper}` : null,
  ].filter(Boolean).join(', ');
  if (richMix) return richMix;

  return [
    numberValue(trend.github_repo_count) ? `GitHub ${trend.github_repo_count}` : null,
    numberValue(trend.news_count) ? `뉴스 ${trend.news_count}` : null,
    numberValue(trend.product_count) ? `제품 ${trend.product_count}` : null,
    numberValue(trend.paper_count) ? `논문 ${trend.paper_count}` : null,
  ].filter(Boolean).join(', ') || '신호 집계 중';
}

/** Score change across the stored daily snapshots: real, dated numbers, unlike the generated `bars`. */
function scoreChange(snapshots: TrendSnapshot[]) {
  if (snapshots.length < 2) return null;
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  return { delta: last.score - first.score, title: `${formatDate(first.date)} ${first.score}점에서 ${formatDate(last.date)} ${last.score}점` };
}

function Change({ snapshots }: { snapshots: TrendSnapshot[] }) {
  const change = scoreChange(snapshots);
  if (!change || change.delta === 0) return null;
  return <span title={change.title} className={`num ${change.delta > 0 ? 'text-ink' : 'text-muted'}`}>{change.delta > 0 ? '▲' : '▼'} {Math.abs(change.delta)}<span className="sr-only">점, {change.title}</span></span>;
}

/** The daily score on a fixed 0 to 100 axis, so a one-point wobble looks like one point. */
function Sparkline({ snapshots, className }: { snapshots: TrendSnapshot[]; className: string }) {
  if (snapshots.length < 2) return null;
  const points = snapshots.map((item, index) => `${(index / (snapshots.length - 1)) * 100},${30 - (Math.min(100, Math.max(0, item.score)) / 100) * 28}`).join(' ');
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true" className={className}>
      <line x1="0" x2="100" y1="30" y2="30" className="stroke-outline-soft" vectorEffect="non-scaling-stroke" />
      <polyline points={points} fill="none" className="stroke-tertiary" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Grey steps for the source mix: the bar shows proportions, not evidence, so it stays out of green.
const MIX_SHADES = ['bg-ink', 'bg-tertiary', 'bg-muted', 'bg-outline-strong', 'bg-surface-high'];

function SourceMix({ trend }: { trend: Trend }) {
  const rows = signalRows(trend).sort((a, b) => b.count - a.count);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (!total) return null;
  const shown = rows.slice(0, 4);
  const rest = rows.slice(4).reduce((sum, row) => sum + row.count, 0);
  const parts = rest ? [...shown, { type: '기타', count: rest }] : shown;
  return (
    <div>
      <div aria-hidden="true" className="flex h-1.5 overflow-hidden rounded-full bg-surface-high">
        {parts.map((row, index) => <span key={row.type} className={MIX_SHADES[index]} style={{ width: `${(row.count / total) * 100}%` }} />)}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted" aria-label="신호가 나온 곳">
        {parts.map((row, index) => <li key={row.type} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${MIX_SHADES[index]}`} />{row.type} <span className="num text-tertiary">{row.count}</span></li>)}
      </ul>
    </div>
  );
}

function isMeaningfulTrend(trend: Trend) {
  const keyword = (trend.display_name ?? trend.keyword).trim();
  if (isGenericTitle(keyword)) return false;
  if (/^(product|github|news|paper)\s+\d+$/i.test(trend.keyword)) return false;
  return true;
}

function InterestBars({ snapshots }: { snapshots: TrendSnapshot[] }) {
  if (!snapshots.length) return <p className="mt-3 text-sm leading-6 text-muted">아직 기록이 없습니다. 집계가 한 번 더 돌면 채워집니다.</p>;

  const max = Math.max(1, ...snapshots.map((item) => item.score));
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];

  return (
    <>
      <div className="mt-3 flex h-24 items-end gap-1.5">
        {snapshots.map((item, index) => (
          <div key={item.date} title={`${formatDate(item.date)}, ${item.score}점`} className="flex h-full min-w-0 max-w-10 flex-1 flex-col justify-end">
            <div className={`w-full rounded-t-[5px] ${index === snapshots.length - 1 ? 'bg-seed' : 'bg-surface-high'}`} style={{ height: `${Math.max(6, Math.round((item.score / max) * 100))}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-outline-soft pt-2 text-xs text-muted">
        <span>{formatDate(first.date)}</span>
        {snapshots.length > 1 && <span>{formatDate(last.date)}</span>}
      </div>
      <p className="mt-2 text-[13px] leading-5 text-muted">
        {snapshots.length > 1
          ? <>점수 <span className="num text-ink">{first.score} → {last.score}</span>, 신호 <span className="num text-ink">{first.signal_count} → {last.signal_count}</span></>
          : '아직 하루치뿐입니다. 며칠 더 모이면 흐름이 보입니다.'}
      </p>
    </>
  );
}

function signalRows(trend: Trend) {
  const sourceMix = trend.source_mix ?? {};
  return [
    { type: 'GitHub', count: numberValue(sourceMix.github ?? trend.github_repo_count), meaning: '직접 만들어 올린 사람이 있습니다' },
    { type: 'npm', count: numberValue(sourceMix.npm), meaning: '패키지로 쓰이고 있습니다' },
    { type: 'Product Hunt', count: numberValue(sourceMix.product_hunt ?? trend.product_count), meaning: '제품으로 출시됐습니다' },
    { type: 'Hugging Face', count: numberValue(sourceMix.huggingface), meaning: '모델이나 데모가 올라왔습니다' },
    { type: 'Hacker News', count: numberValue(sourceMix.hackernews), meaning: '개발자들이 이야기합니다' },
    { type: 'DEV.to', count: numberValue(sourceMix.devto), meaning: '따라 하는 글이 나왔습니다' },
    { type: 'Stack Overflow', count: numberValue(sourceMix.stackoverflow), meaning: '쓰다가 막힌 질문이 있습니다' },
    { type: '뉴스·블로그', count: numberValue(sourceMix.rss ?? trend.news_count), meaning: '기사로 다뤄졌습니다' },
    { type: '논문', count: numberValue(sourceMix.paper ?? trend.paper_count), meaning: '연구 근거가 있습니다' },
  ].filter((row) => row.count > 0);
}

function Block({ title, children, className = '' }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      <h3 className="label">{title}</h3>
      {children}
    </section>
  );
}

function TrendDetail({ trend, id }: { trend: Trend; id: string }) {
  const snapshots = trend.recent_snapshots ?? [];
  const sources = trend.detected_sources ?? trend.source_refs ?? [];
  const extraSources = Math.max(0, sources.length - 5);
  const signals = signalRows(trend);
  // Skills and tools can name the same thing, so the list is de-duplicated before it is cut.
  const related = [...new Set([...(trend.related_skills ?? []), ...(trend.related_tools ?? [])])].slice(0, 14);
  const reasons = (trend.why_trending?.length ? trend.why_trending : ['여러 출처에 얼마나 겹쳐 나왔는지, 얼마나 최근인지를 합쳐 점수를 냈습니다.']).slice(0, 5);
  const roles = trend.target_roles?.length ? trend.target_roles : ['AI 앱 빌더', '풀스택 개발자'];
  // An idea that only repeats the topic's own name says nothing, so those are dropped before falling back.
  const name = (trend.display_name ?? trend.keyword).trim();
  const ideas = [...new Set((trend.project_ideas ?? []).map((item) => item.trim()))].filter((item) => item && item !== name && item !== trend.keyword);
  const nextActions = ideas.length ? ideas : [`이 주제가 무엇인지 한 문단으로 정리하기`, '근거가 된 저장소 하나를 직접 돌려 보기', '작은 예제를 만들어 막히는 지점 적어 두기'];

  return (
    <div id={id} className="grid gap-x-12 gap-y-8 border-t border-outline-soft bg-white px-4 py-6 md:px-6 md:py-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-8">
        <p className="max-w-[40em] text-[15px] leading-7 text-ink">{trend.summary ?? '최근 모인 개발 신호에서 감지된 주제입니다.'}</p>

        <Block title="왜 지금 올라왔나">
          <ul className="mt-2 divide-y divide-outline-soft">
            {reasons.map((item) => <li key={item} className="py-2.5 text-sm leading-6 text-ink">{item}</li>)}
          </ul>
        </Block>

        <Block title="다음에 해볼 것">
          <ol className="mt-2 divide-y divide-outline-soft">
            {nextActions.slice(0, 5).map((item, index) => (
              <li key={`${item}-${index}`} className="flex gap-4 py-2.5 text-sm leading-6 text-ink">
                <span className="num w-4 shrink-0 text-muted">{index + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </Block>
      </div>

      <div className="grid content-start gap-8">
        <Block title="최근 7일 점수"><InterestBars snapshots={snapshots} /></Block>

        {!!signals.length && (
          <Block title="신호가 나온 곳">
            <dl className="mt-2 divide-y divide-outline-soft">
              {signals.map((row) => (
                <div key={row.type} className="flex items-baseline gap-3 py-2.5 text-sm">
                  <dt className="w-28 shrink-0 font-semibold text-ink">{row.type}</dt>
                  <dd className="min-w-0 flex-1 text-muted">{row.meaning}</dd>
                  <dd className="num text-ink">{row.count}</dd>
                </div>
              ))}
            </dl>
          </Block>
        )}

        {!!related.length && (
          <Block title="함께 보는 기술">
            <div className="mt-3 flex flex-wrap gap-1.5">
              {related.map((item) => <span key={item} className="chip">{item}</span>)}
            </div>
          </Block>
        )}

        <Block title="이런 분께 맞습니다">
          <p className="mt-2 text-sm leading-6 text-ink">{roles.join(', ')}</p>
        </Block>
      </div>

      {!!sources.length && (
        <Block title={`근거가 된 글${extraSources ? ` (외 ${extraSources}건)` : ''}`} className="lg:col-span-2">
          <ul className="mt-2 divide-y divide-outline-soft">
            {sources.slice(0, 5).map((ref) => (
              <li key={`${ref.type}-${ref.id}`}>
                <Link href={signalHref(ref)} className="group flex items-center gap-3 py-3">
                  <span className="shrink-0 text-muted"><SourceIcon type={ref.type} /></span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink group-hover:underline group-hover:underline-offset-4">{ref.title}</span>
                  <span className="hidden shrink-0 text-[13px] text-muted sm:inline">{sourceLabel(ref.type)}{ref.source_name && ref.source_name !== sourceLabel(ref.type) ? ` (${ref.source_name})` : ''}</span>
                  <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
                </Link>
              </li>
            ))}
          </ul>
        </Block>
      )}
    </div>
  );
}

type Category = (typeof CATEGORY_TABS)[number];

export type PeriodMode = 'popular' | 'rising';

/** A topic's number for the chosen period, for the row and the top cards. */
function PeriodValue({ trend, label, mode }: { trend: Trend; label?: string; mode: PeriodMode }) {
  if (!label || trend.period_value == null) return null;
  const value = Math.round(trend.period_value);
  if (mode === 'popular') return <span className="num text-tertiary">{label} 평균 {value}</span>;
  return <span className={`num ${value > 0 ? 'text-seed' : 'text-muted'}`}>{label} {value > 0 ? '+' : ''}{value}</span>;
}

/**
 * `periodLabel`: a period is chosen, so topics come ordered by `period_value`: their average score over it
 * (`popular`) or how much it rose (`rising`).
 */
export default function TrendAccordion({ trends, periodLabel, mode = 'popular' }: { trends: Trend[]; periodLabel?: string; mode?: PeriodMode }) {
  const [category, setCategory] = useState<Category>(ALL);
  const [openId, setOpenId] = useState<string | null>(null);

  const ranked = useMemo(() => trends.filter(isMeaningfulTrend).sort((a, b) => (periodLabel ? Number(b.period_value ?? 0) - Number(a.period_value ?? 0) : 0) || scoreOf(b) - scoreOf(a)), [trends, periodLabel]);
  const counts = useMemo(() => {
    const result: Record<string, number> = { [ALL]: ranked.length };
    for (const trend of ranked) result[categoryOf(trend)] = (result[categoryOf(trend)] ?? 0) + 1;
    return result;
  }, [ranked]);
  const visibleTrends = useMemo(() => ranked.filter((trend) => category === ALL || categoryOf(trend) === category).slice(0, 30), [category, ranked]);
  const top = Math.max(1, ...visibleTrends.map(scoreOf));
  const leaders = ranked.slice(0, 3);
  const openFromCard = (trend: Trend) => {
    setCategory(ALL);
    setOpenId(trend.id);
    requestAnimationFrame(() => document.getElementById(`trend-${trend.id}`)?.scrollIntoView({ block: 'nearest' }));
  };

  return (
    <section className="grid gap-5">
      {leaders.length > 0 && (
        <div>
          <h2 className="text-[17px] font-bold tracking-[-0.015em]">{!periodLabel ? '점수 상위 3개' : mode === 'popular' ? `${periodLabel} 인기 상위 3개` : `${periodLabel} 동안 가장 많이 오른 3개`}</h2>
          <ol className="mt-3 grid gap-4 md:grid-cols-3">
            {leaders.map((trend, index) => {
              const snapshots = trend.recent_snapshots ?? [];
              return (
                <li key={trend.id} className="flex">
                  <button type="button" onClick={() => openFromCard(trend)} aria-controls={`trend-${trend.id}`} className="card flex w-full flex-col p-5 text-left transition-colors hover:border-outline-strong">
                    <span className="flex items-baseline justify-between gap-3 text-[13px] text-muted"><span>{index + 1}위, {categoryOf(trend)}</span>{periodLabel ? <PeriodValue trend={trend} label={periodLabel} mode={mode} /> : <Change snapshots={snapshots} />}</span>
                    <span className="mt-1.5 line-clamp-2 text-[17px] font-bold leading-snug tracking-tight text-ink">{trend.display_name ?? trend.keyword}</span>
                    <span className="mt-3 flex items-end justify-between gap-4">
                      <span className="num text-[32px] font-bold leading-none tracking-tight text-ink">{scoreOf(trend)}<span className="ml-1 text-sm font-normal text-muted">점</span></span>
                      <Sparkline snapshots={snapshots} className="h-10 w-28 shrink-0" />
                    </span>
                    {snapshots.length > 1 && <span className="mt-1 self-end text-[12px] text-muted">{formatDate(snapshots[0].date)}부터 기록 {snapshots.length}개</span>}
                    <span className="mt-4 block border-t border-outline-soft pt-4"><SourceMix trend={trend} /></span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      )}

      <div className="seg justify-self-start">
        {CATEGORY_TABS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={category === item}
            onClick={() => {
              setCategory(item);
              setOpenId(null);
            }}
          >
            {item}
            <span className="num text-xs">{counts[item] ?? 0}</span>
          </button>
        ))}
      </div>

      {visibleTrends.length ? (
        <ol className="rows">
          <li aria-hidden="true" className="grid grid-cols-[1.75rem_minmax(0,1fr)_auto] gap-x-3 px-2 py-3 text-[13px] text-muted md:grid-cols-[2.25rem_minmax(0,1fr)_auto]">
            <span>순위</span><span>주제</span><span className="pr-7">최근 기록과 점수</span>
          </li>
          {visibleTrends.map((trend, index) => {
            const isOpen = openId === trend.id;
            const statusKey = String(trend.status ?? 'watch').toLowerCase();
            // Every topic is stored as "new" today, so the label says something only when it differs.
            const status = statusKey === 'new' ? null : STATUS[statusKey] ?? STATUS.watch;
            const score = scoreOf(trend);
            const detailId = `trend-${trend.id}`;
            return (
              <li key={trend.id}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={detailId}
                  onClick={() => setOpenId(isOpen ? null : trend.id)}
                  className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 px-2 py-4 text-left transition-colors hover:bg-surface-low md:grid-cols-[2.25rem_minmax(0,1fr)_auto]"
                >
                  <span className="num text-sm text-muted">{index + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[15px] font-semibold leading-snug text-ink">{trend.display_name ?? trend.keyword}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13px] text-muted">
                      {status && <span className="inline-flex items-center gap-1.5 text-tertiary"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />{status.label}</span>}
                      <Change snapshots={trend.recent_snapshots ?? []} />
                      <PeriodValue trend={trend} label={periodLabel} mode={mode} />
                      {category === ALL && <span>{categoryOf(trend)}</span>}
                      <span className="truncate" title={compactMix(trend)}>{shortMix(trend)}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-3 md:gap-4">
                    <Sparkline snapshots={trend.recent_snapshots ?? []} className="hidden h-7 w-20 md:block" />
                    <span aria-hidden="true" className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-surface-high sm:block">
                      <span className={`block h-full rounded-full ${index === 0 ? 'bg-seed' : 'bg-outline-strong'}`} style={{ width: `${Math.max(4, Math.round((score / top) * 100))}%` }} />
                    </span>
                    <span className={`num w-9 text-right text-[15px] font-semibold ${index === 0 ? 'text-seed' : 'text-ink'}`}><span className="sr-only">점수 </span>{score}</span>
                    <ChevronDown aria-hidden="true" className={`h-4 w-4 text-muted transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </span>
                </button>
                {isOpen && <TrendDetail trend={trend} id={detailId} />}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="empty-state">이 분류에는 아직 모인 주제가 없습니다.</p>
      )}
    </section>
  );
}
