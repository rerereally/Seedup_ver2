'use client';

import type { ModelIntelligence, Trend, TrendSnapshot } from '@/lib/data';
import ModelIntelligencePanel from '@/components/ModelIntelligencePanel';
import { ArrowUpRight, ChevronDown, Code2, FileText, PackageSearch, Radio } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

const ALL = '전체';
const MODELS = '모델 인텔리전스';
const CATEGORY_TABS = [ALL, '개발 워크플로우', 'AI 도구·모델', '구현 패턴', '오픈소스 프로젝트', '빌드 아이디어', '모델 인텔리전스'] as const;

// What the ranking step decided about a topic, in the words a reader would use.
const STATUS: Record<string, { label: string; dot: string }> = {
  hot: { label: '가장 뜨거움', dot: 'bg-hot' },
  rising: { label: '오르는 중', dot: 'bg-[#3ddc84]' },
  new: { label: '새로 등장', dot: 'bg-[#6ea8ff]' },
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
  ].filter(Boolean).join(' · ');
  if (richMix) return richMix;

  return [
    numberValue(trend.github_repo_count) ? `GitHub ${trend.github_repo_count}` : null,
    numberValue(trend.news_count) ? `뉴스 ${trend.news_count}` : null,
    numberValue(trend.product_count) ? `제품 ${trend.product_count}` : null,
    numberValue(trend.paper_count) ? `논문 ${trend.paper_count}` : null,
  ].filter(Boolean).join(' · ') || '신호 집계 중';
}

function isMeaningfulTrend(trend: Trend) {
  const keyword = (trend.display_name ?? trend.keyword).toLowerCase().trim();
  if (/^ai\s+(search|tool|tools|product|products|app|apps|software|service|services)$/.test(keyword)) return false;
  if (/^(ai|llm|agent|coding agent|ai agent|developer|development|tools?|app|service|product|python|javascript|typescript|react|next\.?js|supabase|api|github|open source|rag|mcp|automation|workflow|dashboard|template|starter|boilerplate|framework|search|saas|productivity)$/.test(keyword)) return false;
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
          <div key={item.date} title={`${formatDate(item.date)} · ${item.score}점`} className="flex h-full min-w-0 max-w-10 flex-1 flex-col justify-end">
            <div className={`w-full rounded-t-[5px] ${index === snapshots.length - 1 ? 'bg-ink' : 'bg-surface-high'}`} style={{ height: `${Math.max(6, Math.round((item.score / max) * 100))}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between border-t border-outline-soft pt-2 text-xs text-muted">
        <span>{formatDate(first.date)}</span>
        {snapshots.length > 1 && <span>{formatDate(last.date)}</span>}
      </div>
      <p className="mt-2 text-[13px] leading-5 text-muted">
        {snapshots.length > 1
          ? <>점수 <span className="num text-ink">{first.score} → {last.score}</span> · 신호 <span className="num text-ink">{first.signal_count} → {last.signal_count}</span></>
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
  const related = [...(trend.related_skills ?? []), ...(trend.related_tools ?? [])].slice(0, 14);
  const reasons = (trend.why_trending?.length ? trend.why_trending : ['여러 출처에 얼마나 겹쳐 나왔는지, 얼마나 최근인지를 합쳐 점수를 냈습니다.']).slice(0, 5);
  const roles = trend.target_roles?.length ? trend.target_roles : ['AI 앱 빌더', '풀스택 개발자'];
  // An idea that only repeats the topic's own name says nothing, so those are dropped before falling back.
  const name = (trend.display_name ?? trend.keyword).trim();
  const ideas = [...new Set((trend.project_ideas ?? []).map((item) => item.trim()))].filter((item) => item && item !== name && item !== trend.keyword);
  const nextActions = ideas.length ? ideas : [`이 주제가 무엇인지 한 문단으로 정리하기`, '근거가 된 저장소 하나를 직접 돌려 보기', '작은 예제를 만들어 막히는 지점 적어 두기'];

  return (
    <div id={id} className="grid gap-x-12 gap-y-8 border-t border-outline-soft px-5 py-6 md:px-7 md:py-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
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
                  <dt className="w-28 shrink-0 font-bold text-ink">{row.type}</dt>
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
              {related.map((item) => <span key={item} className="rounded-full bg-surface-high px-2.5 py-1 text-xs text-ink">{item}</span>)}
            </div>
          </Block>
        )}

        <Block title="이런 분께 맞습니다">
          <p className="mt-2 text-sm leading-6 text-ink">{roles.join(' · ')}</p>
        </Block>
      </div>

      {!!sources.length && (
        <Block title={`근거가 된 글${extraSources ? ` · 외 ${extraSources}건` : ''}`} className="lg:col-span-2">
          <ul className="mt-2 divide-y divide-outline-soft">
            {sources.slice(0, 5).map((ref) => (
              <li key={`${ref.type}-${ref.id}`}>
                <Link href={signalHref(ref)} className="group flex items-center gap-3 py-3">
                  <span className="shrink-0 text-muted"><SourceIcon type={ref.type} /></span>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink group-hover:underline group-hover:underline-offset-4">{ref.title}</span>
                  <span className="hidden shrink-0 text-[13px] text-muted sm:inline">{sourceLabel(ref.type)}{ref.source_name && ref.source_name !== sourceLabel(ref.type) ? ` · ${ref.source_name}` : ''}</span>
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

export default function TrendAccordion({ trends, models = [] }: { trends: Trend[]; models?: ModelIntelligence[] }) {
  const [category, setCategory] = useState<Category>(ALL);
  const [openId, setOpenId] = useState<string | null>(null);

  const ranked = useMemo(() => trends.filter(isMeaningfulTrend).sort((a, b) => scoreOf(b) - scoreOf(a)), [trends]);
  const counts = useMemo(() => {
    const result: Record<string, number> = { [ALL]: ranked.length };
    for (const trend of ranked) result[categoryOf(trend)] = (result[categoryOf(trend)] ?? 0) + 1;
    return result;
  }, [ranked]);
  const visibleTrends = useMemo(() => ranked.filter((trend) => category === ALL || categoryOf(trend) === category).slice(0, 30), [category, ranked]);
  const top = Math.max(1, ...visibleTrends.map(scoreOf));

  return (
    <section className="grid gap-5">
      <div className="tabs justify-self-start">
        {CATEGORY_TABS.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={category === item}
            onClick={() => {
              setCategory(item);
              setOpenId(null);
            }}
            className="tab"
          >
            {item}
            {item !== MODELS && <span className="num">{counts[item] ?? 0}</span>}
          </button>
        ))}
      </div>

      {category === MODELS ? <ModelIntelligencePanel models={models} /> : visibleTrends.length ? (
        <ol className="card overflow-hidden">
          {visibleTrends.map((trend, index) => {
            const isOpen = openId === trend.id;
            const growth = Math.round(numberValue(trend.weekly_growth_rate));
            const status = STATUS[String(trend.status ?? 'watch').toLowerCase()] ?? STATUS.watch;
            const score = scoreOf(trend);
            const detailId = `trend-${trend.id}`;
            return (
              <li key={trend.id} className="border-t border-outline-soft first:border-t-0">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={detailId}
                  onClick={() => setOpenId(isOpen ? null : trend.id)}
                  className="grid w-full grid-cols-[1.75rem_minmax(0,1fr)_auto] items-center gap-x-3 px-5 py-4 text-left transition-colors hover:bg-surface-low md:grid-cols-[2.25rem_minmax(0,1fr)_auto] md:px-7"
                >
                  <span className="num text-sm text-muted">{index + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[17px] font-bold leading-snug text-ink">{trend.display_name ?? trend.keyword}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13px] text-muted">
                      <span className="inline-flex items-center gap-1.5 text-ink"><span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${status.dot}`} />{status.label}</span>
                      {trend.trend_direction !== 'new' && growth !== 0 && <span className="num">{growth > 0 ? '▲' : '▼'} {Math.abs(growth)}%</span>}
                      {category === ALL && <span>{categoryOf(trend)}</span>}
                      <span className="truncate">{compactMix(trend)}</span>
                    </span>
                  </span>
                  <span className="flex items-center gap-3 md:gap-4">
                    <span aria-hidden="true" className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-surface-high sm:block">
                      <span className={`block h-full rounded-full ${index === 0 ? 'bg-hot' : 'bg-ink'}`} style={{ width: `${Math.max(4, Math.round((score / top) * 100))}%` }} />
                    </span>
                    <span className={`num w-9 text-right text-xl font-semibold ${index === 0 ? 'text-hot' : 'text-ink'}`}><span className="sr-only">점수 </span>{score}</span>
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
