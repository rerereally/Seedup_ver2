'use client';

import type { ModelIntelligence, Trend, TrendSnapshot } from '@/lib/data';
import ModelIntelligencePanel from '@/components/ModelIntelligencePanel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDown, ArrowRight, ArrowUp, ChevronsUpDown, Code2, FileText, PackageSearch, Radio, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';

const CATEGORY_TABS = ['개발 워크플로우', 'AI 도구·모델', '구현 패턴', '오픈소스 프로젝트', '빌드 아이디어', '모델 인텔리전스'] as const;

const TREND_TYPE_LABELS: Record<string, string> = {
  development_method: '개발 워크플로우',
  workflow: '개발 워크플로우',
  ai_tool: 'AI 도구',
  ai_model: 'AI 모델',
  tool: 'AI 도구',
  model: 'AI 모델',
  protocol: '구현 패턴',
  architecture: '구현 패턴',
  skill: '구현 패턴',
  pattern: '구현 패턴',
  framework: '구현 패턴',
  open_source_project: '오픈소스 프로젝트',
  product_category: '제품 카테고리',
  project_idea: 'Build Idea',
  build_idea: 'Build Idea',
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

function statusLabel(status: string | null) {
  if (!status) return 'WATCH';
  return status.toUpperCase();
}

function directionIcon(direction: string | null | undefined) {
  if (direction === 'up') return <ArrowUp className="h-4 w-4" />;
  if (direction === 'down') return <ArrowDown className="h-4 w-4" />;
  if (direction === 'new') return <Sparkles className="h-4 w-4" />;
  return <ChevronsUpDown className="h-4 w-4" />;
}

function sourceLabel(type: string) {
  if (type === 'news' || type === 'rss') return 'News/Blog';
  if (type === 'product' || type === 'product_hunt') return 'Product Hunt';
  if (type === 'github') return 'GitHub';
  if (type === 'paper') return 'Paper';
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

function directionForSnapshots(items: TrendSnapshot[], index: number) {
  if (index === 0) return '-';
  const diff = items[index].score - items[index - 1].score;
  if (diff > 1) return '▲';
  if (diff < -1) return '▼';
  return '→';
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
    numberValue(sourceMix.paper) ? `Paper ${sourceMix.paper}` : null,
  ].filter(Boolean).join(' · ');
  if (richMix) return richMix;

  return [
    numberValue(trend.github_repo_count) ? `GitHub ${trend.github_repo_count}` : null,
    numberValue(trend.news_count) ? `News ${trend.news_count}` : null,
    numberValue(trend.product_count) ? `Product ${trend.product_count}` : null,
    numberValue(trend.paper_count) ? `Paper ${trend.paper_count}` : null,
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
  const max = Math.max(1, ...snapshots.map((item) => item.score));
  const first = snapshots[0];
  const last = snapshots[snapshots.length - 1];
  const growth = first && last && first.score > 0 ? Math.round(((last.score - first.score) / first.score) * 100) : 0;

  return (
    <div className="border border-outline-soft bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-black uppercase text-ink">7D Interest</h3>
          <p className="mt-1 text-xs font-bold text-muted">
            Score: {first?.score ?? '-'} → {last?.score ?? '-'} · Signals: {first?.signal_count ?? '-'} → {last?.signal_count ?? '-'} · Growth: {growth >= 0 ? '▲' : '▼'} {growth}%
          </p>
        </div>
      </div>
      <div className="flex h-24 items-end gap-2 border-b border-outline-soft pb-2">
        {snapshots.map((item) => (
          <div key={item.date} className="flex min-w-0 flex-1 flex-col items-center gap-2">
            <div className="w-full bg-ink" style={{ height: `${Math.max(8, Math.round((item.score / max) * 100))}%` }} />
            <span className="text-[10px] font-bold text-muted">{formatDate(item.date)}</span>
          </div>
        ))}
      </div>
      {snapshots.length < 7 && (
        <p className="mt-3 text-xs font-semibold leading-5 text-muted">아직 추이 데이터가 부족합니다. 며칠 더 수집하면 상승/하락 추이를 볼 수 있습니다.</p>
      )}
    </div>
  );
}

function SignalBreakdownTable({ trend }: { trend: Trend }) {
  const sourceMix = trend.source_mix ?? {};
  const rows = [
    { type: 'GitHub', count: numberValue(sourceMix.github ?? trend.github_repo_count), weight: 'High', meaning: '오픈소스 구현/활동 신호' },
    { type: 'npm', count: numberValue(sourceMix.npm), weight: 'High', meaning: '패키지 채택 신호' },
    { type: 'Product Hunt', count: numberValue(sourceMix.product_hunt ?? trend.product_count), weight: 'High', meaning: '제품 출시/시장성 신호' },
    { type: 'Hugging Face', count: numberValue(sourceMix.huggingface), weight: 'High', meaning: '모델/Space/데모 신호' },
    { type: 'Hacker News', count: numberValue(sourceMix.hackernews), weight: 'Medium-High', meaning: '개발자 커뮤니티 관심 신호' },
    { type: 'DEV.to', count: numberValue(sourceMix.devto), weight: 'Medium', meaning: '구현 튜토리얼 신호' },
    { type: 'Stack Overflow', count: numberValue(sourceMix.stackoverflow), weight: 'Medium', meaning: '실제 개발 문제/질문 신호' },
    { type: 'RSS/News', count: numberValue(sourceMix.rss ?? trend.news_count), weight: 'Medium', meaning: '산업/제품/기술 변화 신호' },
    { type: 'Paper', count: numberValue(sourceMix.paper ?? trend.paper_count), weight: 'Medium-High', meaning: '연구/구현 패턴 근거' },
  ].filter((row) => row.count > 0);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Source Type</TableHead>
          <TableHead>Count</TableHead>
          <TableHead>Weight</TableHead>
          <TableHead>Meaning</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.type}>
            <TableCell className="font-black">{row.type}</TableCell>
            <TableCell>{row.count}</TableCell>
            <TableCell>{row.weight}</TableCell>
            <TableCell className="text-muted">{row.meaning}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function TrendDetail({ trend }: { trend: Trend }) {
  const snapshots = trend.recent_snapshots ?? [];
  const sources = trend.detected_sources ?? trend.source_refs ?? [];
  const extraSources = Math.max(0, sources.length - 5);
  const nextActions = trend.project_ideas?.length
    ? trend.project_ideas
    : [`${trend.keyword} 개념 이해하기`, `작은 ${trend.keyword} 예제 만들어보기`, '외부 API 또는 DB 연결하기', '포트폴리오 프로젝트로 확장하기'];

  return (
    <div className="border-t border-outline-soft bg-surface p-4 md:p-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border border-outline-soft bg-white p-4">
          <h3 className="text-sm font-black uppercase text-ink">Summary</h3>
          <p className="mt-3 text-sm leading-7 text-muted">{trend.summary ?? '최근 수집된 개발 신호를 바탕으로 감지된 트렌드입니다.'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="border border-outline-soft bg-surface px-2 py-1 text-xs font-bold text-muted">{categoryOf(trend)}</span>
            <span className="border border-outline-soft bg-surface px-2 py-1 text-xs font-bold text-muted">{TREND_TYPE_LABELS[String(trend.entity_type ?? trend.trend_type ?? '')] ?? trend.entity_type ?? trend.trend_type ?? 'Entity'}</span>
            <span className="border border-outline-soft bg-surface px-2 py-1 text-xs font-bold text-muted">{compactMix(trend)}</span>
          </div>
        </section>

        <InterestBars snapshots={snapshots} />

        <section className="border border-outline-soft bg-white p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-black uppercase text-ink">7D Interest Trend Table</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Signals</TableHead>
                <TableHead>News</TableHead>
                <TableHead>GitHub</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Papers</TableHead>
                <TableHead>Direction</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {snapshots.map((item, index) => (
                <TableRow key={item.date}>
                  <TableCell className="font-bold">{formatDate(item.date)}</TableCell>
                  <TableCell>{item.score}</TableCell>
                  <TableCell>{item.signal_count}</TableCell>
                  <TableCell>{item.news_count}</TableCell>
                  <TableCell>{item.github_repo_count}</TableCell>
                  <TableCell>{item.product_count}</TableCell>
                  <TableCell>{item.paper_count}</TableCell>
                  <TableCell>{directionForSnapshots(snapshots, index)}</TableCell>
                </TableRow>
              ))}
              {!snapshots.length && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted">아직 추이 데이터가 없습니다. 트렌드 집계를 한 번 더 실행해주세요.</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </section>

        <section className="border border-outline-soft bg-white p-4 lg:col-span-2">
          <h3 className="mb-3 text-sm font-black uppercase text-ink">Signal Breakdown</h3>
          <SignalBreakdownTable trend={trend} />
        </section>

        <section className="border border-outline-soft bg-white p-4">
          <h3 className="text-sm font-black uppercase text-ink">Why Trending</h3>
          <div className="mt-3 grid gap-2">
            {(trend.why_trending?.length ? trend.why_trending : ['출처 다양성, 최근성, 실행 가능성을 합쳐 점수화했습니다.']).slice(0, 5).map((item) => (
              <p key={item} className="border border-outline-soft bg-surface px-3 py-2 text-sm font-semibold leading-6 text-muted">{item}</p>
            ))}
          </div>
        </section>

        <section className="border border-outline-soft bg-white p-4">
          <h3 className="text-sm font-black uppercase text-ink">Related Skills & Tools</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...(trend.related_skills ?? []), ...(trend.related_tools ?? [])].slice(0, 14).map((item) => (
              <span key={item} className="border border-outline-soft bg-surface px-2 py-1 text-xs font-bold text-muted">{item}</span>
            ))}
            {!(trend.related_skills?.length || trend.related_tools?.length) && <span className="text-sm text-muted">관련 스킬 데이터를 집계 중입니다.</span>}
          </div>
        </section>

        <section className="border border-outline-soft bg-white p-4">
          <h3 className="text-sm font-black uppercase text-ink">Recommended For</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {(trend.target_roles?.length ? trend.target_roles : ['AI 앱 빌더', '풀스택 개발자']).map((role) => (
              <span key={role} className="border border-ink bg-ink px-2 py-1 text-xs font-bold text-white">{role}</span>
            ))}
          </div>
        </section>

        <section className="border border-outline-soft bg-white p-4">
          <h3 className="text-sm font-black uppercase text-ink">Next Actions</h3>
          <ol className="mt-3 grid gap-2">
            {nextActions.slice(0, 5).map((item, index) => (
              <li key={`${item}-${index}`} className="flex gap-3 border border-outline-soft bg-surface px-3 py-2 text-sm font-semibold leading-6 text-muted">
                <span className="font-black text-ink">{index + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="border border-outline-soft bg-white p-4 lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-black uppercase text-ink">Detected Sources</h3>
            {!!extraSources && <span className="text-xs font-bold text-muted">+{extraSources} more</span>}
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {sources.slice(0, 5).map((ref) => (
              <Link key={`${ref.type}-${ref.id}`} href={signalHref(ref)} className="flex items-start gap-3 border border-outline-soft bg-surface p-3 hover:border-ink">
                <span className="mt-0.5 text-ink"><SourceIcon type={ref.type} /></span>
                <span className="min-w-0">
                  <span className="block text-xs font-bold uppercase text-muted">{sourceLabel(ref.type)} {ref.source_name ? `· ${ref.source_name}` : ''}</span>
                  <span className="mt-1 block line-clamp-2 text-sm font-semibold leading-6 text-ink">{ref.title}</span>
                </span>
                <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-muted" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function TrendAccordion({ trends, models = [] }: { trends: Trend[]; models?: ModelIntelligence[] }) {
  const [category, setCategory] = useState<(typeof CATEGORY_TABS)[number]>('개발 워크플로우');
  const [openId, setOpenId] = useState<string | null>(null);

  const visibleTrends = useMemo(() => {
    return trends
      .filter(isMeaningfulTrend)
      .filter((trend) => categoryOf(trend) === category)
      .sort((a, b) => scoreOf(b) - scoreOf(a))
      .slice(0, 30);
  }, [category, trends]);

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap gap-2">
        {CATEGORY_TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => {
              setCategory(item);
              setOpenId(null);
            }}
            className={`min-h-11 border px-3 text-xs font-black ${category === item ? 'border-ink bg-ink text-white' : 'border-outline-soft bg-white text-muted hover:border-ink hover:text-ink'}`}
          >
            {item}
          </button>
        ))}
      </div>

      {category === '모델 인텔리전스' ? <ModelIntelligencePanel models={models} /> : <div className="grid gap-3">
        {visibleTrends.map((trend, index) => {
          const isOpen = openId === trend.id;
          const growth = numberValue(trend.weekly_growth_rate);
          return (
            <article key={trend.id} className="border border-outline-soft bg-white">
              <button type="button" onClick={() => setOpenId(isOpen ? null : trend.id)} className="grid w-full gap-4 p-4 text-left hover:bg-surface sm:p-5 md:grid-cols-[5rem_1fr_6rem] md:items-center">
                <div className="text-2xl font-black text-muted/70 md:text-3xl">
                  {String(index + 1).padStart(2, '0')}
                </div>
                <div className="min-w-0">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="border border-emerald-500/40 bg-emerald-50 px-2 py-1 text-xs font-black uppercase text-emerald-700">{statusLabel(trend.status)}</span>
                    <span className="text-xs font-black uppercase tracking-[0.24em] text-muted">{TREND_TYPE_LABELS[String(trend.entity_type ?? trend.trend_type ?? '')] ?? trend.entity_type ?? trend.trend_type ?? categoryOf(trend)}</span>
                  </div>
                  <h2 className="line-clamp-2 text-2xl font-black leading-tight text-ink md:truncate md:text-3xl">{trend.display_name ?? trend.keyword}</h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase text-muted">
                    <span className="inline-flex items-center gap-1">{directionIcon(trend.trend_direction)} {growth >= 0 ? '+' : ''}{growth}%</span>
                    <span>·</span>
                    <span>{compactMix(trend)}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3 md:justify-end">
                  <div className="text-right">
                    <div className="text-xs font-bold text-muted">점수</div>
                    <div className="text-4xl font-black text-emerald-500">{scoreOf(trend)}</div>
                  </div>
                  <span className="text-muted">{isOpen ? <ArrowUp className="h-5 w-5" /> : <ArrowDown className="h-5 w-5" />}</span>
                </div>
              </button>
              {isOpen && <TrendDetail trend={trend} />}
            </article>
          );
        })}
        {!visibleTrends.length && (
          <div className="border border-dashed border-outline-soft bg-white p-8 text-sm font-semibold text-muted">
            이 카테고리의 트렌드는 아직 집계되지 않았습니다. 트렌드 집계를 다시 실행하면 새 분류 기준으로 채워집니다.
          </div>
        )}
      </div>}
    </section>
  );
}
