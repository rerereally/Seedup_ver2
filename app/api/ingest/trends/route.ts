import { assertIngestAuth } from '@/lib/ingest/auth';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type TrendCandidate = {
  keyword: string;
  score: number;
  news: number;
  products: number;
  repos: number;
  recentSignals: number;
  previousSignals: number;
  refs: Array<{ type: string; id: string; title: string }>;
  projectIdeas: Set<string>;
};

const STOPWORDS = new Set(['api', 'web', 'app', 'data', 'tool', 'tools', 'new', 'open', 'source']);
const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: Request) {
  return ingest(request);
}

export async function POST(request: Request) {
  return ingest(request);
}

async function ingest(request: Request) {
  const startedAt = Date.now();
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase server configuration' }, { status: 500 });
  }

  const [{ data: news }, { data: products }, { data: repos }] = await Promise.all([
    supabase.from('news_items').select('id,title,category,related_skills,project_idea,relevance_score,original_url,published_at,created_at').order('published_at', { ascending: false }).limit(120),
    supabase.from('ai_products').select('id,name,category,use_cases,related_project_ideas,score,website_url,product_hunt_url,created_at').order('created_at', { ascending: false }).limit(120),
    supabase.from('github_trends').select('id,repo_full_name,repo_url,topics,language,project_idea,stars,relevance_score,pushed_at,created_at').order('stars', { ascending: false }).limit(120),
  ]);

  const signals: KeywordSignalInput[] = [];

  for (const item of news ?? []) {
    addSignal(signals, item.category, 18 + Number(item.relevance_score ?? 50) / 10, 'news', item.id, item.title, item.original_url, item.published_at ?? item.created_at, item.project_idea);
    for (const skill of item.related_skills ?? []) addSignal(signals, skill, 10, 'news', item.id, item.title, item.original_url, item.published_at ?? item.created_at, item.project_idea);
  }

  for (const item of products ?? []) {
    const url = item.product_hunt_url ?? item.website_url;
    addSignal(signals, item.category, 16 + Number(item.score ?? 7), 'product', item.id, item.name, url, item.created_at, item.related_project_ideas?.[0]);
    for (const useCase of item.use_cases ?? []) addSignal(signals, useCase, 8, 'product', item.id, item.name, url, item.created_at, item.related_project_ideas?.[0]);
  }

  for (const repo of repos ?? []) {
    const weight = 12 + Math.min(Number(repo.stars ?? 0) / 1000, 12) + Number(repo.relevance_score ?? 50) / 20;
    for (const topic of repo.topics ?? []) addSignal(signals, topic, weight, 'github', repo.id, repo.repo_full_name, repo.repo_url, repo.pushed_at ?? repo.created_at, repo.project_idea);
    addSignal(signals, repo.language, 6, 'github', repo.id, repo.repo_full_name, repo.repo_url, repo.pushed_at ?? repo.created_at, repo.project_idea);
  }

  const { error: signalError } = await supabase.from('keyword_signals').upsert(
    signals.map(({ projectIdea, ...signal }) => signal),
    { onConflict: 'source_type,source_id,normalized_keyword' },
  );

  if (signalError) {
    return NextResponse.json({ error: 'Keyword signal upsert failed', detail: signalError.message }, { status: 500 });
  }

  const since30Days = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const { data: storedSignals, error: readError } = await supabase
    .from('keyword_signals')
    .select('keyword,normalized_keyword,source_type,source_id,source_title,weight,metadata,detected_at')
    .gte('detected_at', since30Days)
    .order('detected_at', { ascending: false })
    .limit(2000);

  if (readError) {
    return NextResponse.json({ error: 'Keyword signal read failed', detail: readError.message }, { status: 500 });
  }

  const map = buildTrendCandidates(storedSignals ?? []);

  const ranked = [...map.values()]
    .filter((candidate) => candidate.keyword.length >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  let rank = 1;
  let upserted = 0;
  let errors = 0;

  for (const candidate of ranked) {
    const score = Math.max(1, Math.min(100, Math.round(candidate.score)));
    const growth = candidate.previousSignals ? Math.round(((candidate.recentSignals - candidate.previousSignals) / candidate.previousSignals) * 100) : candidate.recentSignals > 1 ? 100 : 0;
    const { error } = await supabase.from('trends').upsert(
      {
        keyword: candidate.keyword,
        rank,
        summary: `${candidate.keyword} 관련 신호가 최근 30일 동안 뉴스 ${candidate.news}개, 제품 ${candidate.products}개, GitHub ${candidate.repos}개에서 누적 감지되었습니다. 최근 7일 변화율은 ${growth}%입니다.`,
        score,
        status: growth >= 80 || score >= 85 ? 'Hot' : growth >= 25 || score >= 60 ? 'Rising' : 'Watch',
        bars: buildBars(score),
        project_ideas: [...candidate.projectIdeas].slice(0, 4),
        sources_count: candidate.news + candidate.products + candidate.repos,
        news_count: candidate.news,
        product_count: candidate.products,
        github_repo_count: candidate.repos,
        source_refs: candidate.refs.slice(0, 8),
      },
      { onConflict: 'keyword' },
    );

    if (error) errors += 1;
    else upserted += 1;
    rank += 1;
  }

  const { error: snapshotError } = await supabase.from('trend_snapshots').upsert(
    ranked.map((candidate) => ({
      keyword: candidate.keyword,
      snapshot_date: new Date().toISOString().slice(0, 10),
      score: Math.max(1, Math.min(100, Math.round(candidate.score))),
      signal_count: candidate.news + candidate.products + candidate.repos,
      news_count: candidate.news,
      product_count: candidate.products,
      github_repo_count: candidate.repos,
      source_refs: candidate.refs.slice(0, 8),
    })),
    { onConflict: 'keyword,snapshot_date' },
  );

  if (snapshotError) errors += 1;

  await recordIngestRun(supabase, {
    source: 'trends',
    status: getRunStatus(errors, upserted),
    inserted: upserted,
    skipped: 0,
    errors,
    durationMs: Date.now() - startedAt,
    detail: { signals: signals.length, ranked: ranked.length },
  });

  return NextResponse.json({ ok: true, signals: signals.length, upserted, errors });
}

type KeywordSignalInput = {
  keyword: string;
  normalized_keyword: string;
  source_type: string;
  source_id: string;
  source_title: string;
  source_url: string | null;
  weight: number;
  metadata: { project_idea?: string };
  detected_at: string;
  projectIdea?: string | null;
};

function addSignal(
  signals: KeywordSignalInput[],
  rawKeyword: string | null | undefined,
  weight: number,
  type: string,
  id: string,
  title: string,
  url?: string | null,
  detectedAt?: string | null,
  projectIdea?: string | null,
) {
  const keyword = normalizeKeyword(rawKeyword);
  if (!keyword) return;

  signals.push({
    keyword,
    normalized_keyword: keyword.toLowerCase(),
    source_type: type,
    source_id: id,
    source_title: title,
    source_url: url ?? null,
    weight,
    metadata: projectIdea ? { project_idea: projectIdea } : {},
    detected_at: detectedAt ?? new Date().toISOString(),
    projectIdea,
  });
}

function buildTrendCandidates(signals: Array<Record<string, any>>) {
  const map = new Map<string, TrendCandidate>();
  const now = Date.now();

  for (const signal of signals) {
    const keyword = normalizeKeyword(signal.keyword);
    if (!keyword) continue;

    const detectedTime = new Date(signal.detected_at ?? Date.now()).getTime();
    const ageDays = Math.max(0, (now - detectedTime) / DAY_MS);
    const isRecent = ageDays <= 7;
    const isPrevious = ageDays > 7 && ageDays <= 14;
    const recencyBoost = Math.max(0.25, 1 - ageDays / 45);
    const sourceBoost = signal.source_type === 'github' ? 1.15 : signal.source_type === 'product' ? 1.08 : 1;
    const score = Number(signal.weight ?? 1) * recencyBoost * sourceBoost;
    const candidate = map.get(keyword) ?? {
      keyword,
      score: 0,
      news: 0,
      products: 0,
      repos: 0,
      recentSignals: 0,
      previousSignals: 0,
      refs: [],
      projectIdeas: new Set<string>(),
    };

    candidate.score += score;
    if (signal.source_type === 'news') candidate.news += 1;
    if (signal.source_type === 'product') candidate.products += 1;
    if (signal.source_type === 'github') candidate.repos += 1;
    if (isRecent) candidate.recentSignals += 1;
    if (isPrevious) candidate.previousSignals += 1;
    candidate.refs.push({ type: signal.source_type, id: signal.source_id, title: signal.source_title });
    const projectIdea = signal.metadata?.project_idea;
    if (typeof projectIdea === 'string') candidate.projectIdeas.add(projectIdea);
    map.set(keyword, candidate);
  }

  for (const candidate of map.values()) {
    const sourceDiversity = [candidate.news, candidate.products, candidate.repos].filter(Boolean).length;
    candidate.score += sourceDiversity * 8;
    if (candidate.recentSignals > candidate.previousSignals) candidate.score += Math.min(20, (candidate.recentSignals - candidate.previousSignals) * 4);
  }

  return map;
}

function normalizeKeyword(value: string | null | undefined) {
  if (!value) return '';
  const keyword = value.trim().replace(/^#/, '').replace(/\s+/g, ' ');
  if (!keyword || STOPWORDS.has(keyword.toLowerCase())) return '';
  return keyword.length > 28 ? keyword.slice(0, 28) : keyword;
}

function buildBars(score: number) {
  return [0.55, 0.62, 0.7, 0.78, 0.9, 1].map((ratio) => Math.max(12, Math.round(score * ratio)));
}
