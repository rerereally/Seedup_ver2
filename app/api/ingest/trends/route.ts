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
  signalStrength: number;
  recentSignals: number;
  previousSignals: number;
  refs: Array<{ type: string; id: string; title: string }>;
  projectIdeas: Set<string>;
  sourceKeys: Set<string>;
  recentSourceKeys: Set<string>;
  previousSourceKeys: Set<string>;
  newsSourceIds: Set<string>;
  productSourceIds: Set<string>;
  repoSourceIds: Set<string>;
};

type TrendNewsSignal = {
  id: string;
  title: string;
  category: string | null;
  related_skills?: string[] | null;
  topic_tags?: string[] | null;
  skill_tags?: string[] | null;
  intent_tags?: string[] | null;
  project_idea: string | null;
  relevance_score: number | null;
  daily_rank_score?: number | null;
  original_url: string | null;
  published_at: string | null;
  created_at?: string | null;
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

  const [newsResult, { data: products }, { data: repos }] = await Promise.all([
    supabase.from('news_items').select('id,title,category,related_skills,topic_tags,skill_tags,intent_tags,project_idea,relevance_score,daily_rank_score,original_url,published_at,created_at').order('published_at', { ascending: false }).limit(160),
    supabase.from('ai_products').select('id,name,category,use_cases,related_project_ideas,score,website_url,product_hunt_url,created_at').order('created_at', { ascending: false }).limit(120),
    supabase.from('github_trends').select('id,repo_full_name,repo_url,topics,language,project_idea,stars,relevance_score,pushed_at,created_at').order('stars', { ascending: false }).limit(120),
  ]);
  const news: TrendNewsSignal[] | null = newsResult.error
    ? (await supabase.from('news_items').select('id,title,category,related_skills,project_idea,relevance_score,original_url,published_at,created_at').order('published_at', { ascending: false }).limit(160)).data
    : newsResult.data;

  const signals: KeywordSignalInput[] = [];

  for (const item of news ?? []) {
    const newsWeight = 14 + Number(item.relevance_score ?? 50) / 12 + Number(item.daily_rank_score ?? 0) / 10;
    addSignal(signals, item.category, newsWeight, 'news', item.id, item.title, item.original_url, item.published_at ?? item.created_at, item.project_idea);
    for (const tag of item.topic_tags ?? []) addSignal(signals, tag, newsWeight * 0.9, 'news', item.id, item.title, item.original_url, item.published_at ?? item.created_at, item.project_idea);
    for (const skill of [...(item.related_skills ?? []), ...(item.skill_tags ?? [])]) addSignal(signals, skill, 10 + Number(item.daily_rank_score ?? 0) / 18, 'news', item.id, item.title, item.original_url, item.published_at ?? item.created_at, item.project_idea);
    for (const intent of item.intent_tags ?? []) addSignal(signals, intent, 7, 'news', item.id, item.title, item.original_url, item.published_at ?? item.created_at, item.project_idea);
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

  // Deduplicate by conflict key before upsert — same (source_type, source_id, normalized_keyword)
  // appearing twice in one batch causes PostgreSQL to reject the entire upsert.
  const signalMap = new Map<string, Omit<KeywordSignalInput, 'projectIdea'>>();
  for (const { projectIdea, ...signal } of signals) {
    const key = `${signal.source_type}::${signal.source_id}::${signal.normalized_keyword}`;
    const existing = signalMap.get(key);
    if (!existing || signal.weight > existing.weight) {
      signalMap.set(key, signal);
    }
  }
  const deduplicatedSignals = [...signalMap.values()];

  const BATCH_SIZE = 200;
  for (let i = 0; i < deduplicatedSignals.length; i += BATCH_SIZE) {
    const batch = deduplicatedSignals.slice(i, i + BATCH_SIZE);
    const { error: signalError } = await supabase
      .from('keyword_signals')
      .upsert(batch, { onConflict: 'source_type,source_id,normalized_keyword' });
    if (signalError) {
      console.error('Keyword signal upsert batch failed', signalError);
      return NextResponse.json({ error: 'Keyword signal upsert failed', detail: signalError.message }, { status: 500 });
    }
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
    .filter((candidate) => candidate.keyword.length >= 2 && candidate.sourceKeys.size >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  let rank = 1;
  let upserted = 0;
  let errors = 0;

  for (const candidate of ranked) {
    const score = Math.max(1, Math.min(100, Math.round(candidate.score)));
    const growth = candidate.previousSignals ? Math.round(((candidate.recentSignals - candidate.previousSignals) / candidate.previousSignals) * 100) : candidate.recentSignals > 1 ? 100 : 0;
    const sourceCount = candidate.sourceKeys.size;
    const { error } = await supabase.from('trends').upsert(
      {
        keyword: candidate.keyword,
        rank,
        summary: `${candidate.keyword} 관련 신호가 최근 30일 동안 뉴스 ${candidate.news}개, 제품 ${candidate.products}개, GitHub ${candidate.repos}개 출처에서 감지되었습니다. 최신성, 출처 다양성, 7일 성장률, 콘텐츠 품질을 함께 반영한 순위입니다.`,
        score,
        status: growth >= 80 || score >= 85 ? 'Hot' : growth >= 25 || score >= 60 ? 'Rising' : 'Watch',
        bars: buildBars(score),
        project_ideas: [...candidate.projectIdeas].slice(0, 4),
        sources_count: sourceCount,
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
      signal_count: candidate.sourceKeys.size,
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
    detail: { signals: signals.length, deduplicated: deduplicatedSignals.length, ranked: ranked.length },
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
    const recencyBoost = ageDays <= 2 ? 1.35 : ageDays <= 7 ? 1.15 : ageDays <= 14 ? 0.85 : Math.max(0.35, 1 - ageDays / 45);
    const sourceBoost = signal.source_type === 'news' ? 1.1 : signal.source_type === 'github' ? 1.05 : 1;
    const score = Number(signal.weight ?? 1) * recencyBoost * sourceBoost;
    const sourceKey = `${signal.source_type}:${signal.source_id}`;
    const candidate = map.get(keyword) ?? {
      keyword,
      score: 0,
      news: 0,
      products: 0,
      repos: 0,
      signalStrength: 0,
      recentSignals: 0,
      previousSignals: 0,
      refs: [],
      projectIdeas: new Set<string>(),
      sourceKeys: new Set<string>(),
      recentSourceKeys: new Set<string>(),
      previousSourceKeys: new Set<string>(),
      newsSourceIds: new Set<string>(),
      productSourceIds: new Set<string>(),
      repoSourceIds: new Set<string>(),
    };

    candidate.signalStrength += score;
    candidate.sourceKeys.add(sourceKey);
    if (signal.source_type === 'news') candidate.newsSourceIds.add(String(signal.source_id));
    if (signal.source_type === 'product') candidate.productSourceIds.add(String(signal.source_id));
    if (signal.source_type === 'github') candidate.repoSourceIds.add(String(signal.source_id));
    if (isRecent) candidate.recentSignals += 1;
    if (isPrevious) candidate.previousSignals += 1;
    if (isRecent) candidate.recentSourceKeys.add(sourceKey);
    if (isPrevious) candidate.previousSourceKeys.add(sourceKey);
    if (!candidate.refs.some((ref) => ref.type === signal.source_type && ref.id === signal.source_id)) {
      candidate.refs.push({ type: signal.source_type, id: signal.source_id, title: signal.source_title });
    }
    const projectIdea = signal.metadata?.project_idea;
    if (typeof projectIdea === 'string') candidate.projectIdeas.add(projectIdea);
    map.set(keyword, candidate);
  }

  for (const candidate of map.values()) {
    candidate.news = candidate.newsSourceIds.size;
    candidate.products = candidate.productSourceIds.size;
    candidate.repos = candidate.repoSourceIds.size;

    const sourceTypeDiversity = [candidate.news, candidate.products, candidate.repos].filter(Boolean).length;
    const uniqueSources = candidate.sourceKeys.size;
    const recentSources = candidate.recentSourceKeys.size;
    const previousSources = candidate.previousSourceKeys.size;
    const growthRatio = previousSources ? Math.max(0, (recentSources - previousSources) / previousSources) : recentSources >= 2 ? 1 : 0;
    const diversityScore = sourceTypeDiversity * 10;
    const coverageScore = Math.min(26, uniqueSources * 4);
    const freshnessScore = Math.min(24, recentSources * 6);
    const momentumScore = Math.min(18, growthRatio * 18);
    const strengthScore = Math.min(32, candidate.signalStrength / 4);

    candidate.score = strengthScore + freshnessScore + diversityScore + coverageScore + momentumScore;
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
