import { createClient } from '@/lib/supabase/server';
import { cached } from '@/lib/cache';
import { isGenericTitle } from '@/lib/ingest/trend-builder';
import { averagePerDay, baselineSlack, daysBefore, periodState, valuesAt } from '@/lib/popularity';
import type {
  AIProduct,
  AIProductReview,
  ArticleFeedItem,
  GitHubTrend,
  ModelIntelligence,
  NewsItem,
  NewsPaperLink,
  ProjectIdea,
  ResearchPaper,
  Trend,
  TrendSnapshot,
} from './data-types';

export function handleReadError(error: { code?: string; message?: string }) {
  if (error.code === '42501' || error.code === 'PGRST205') {
    console.warn(`Supabase read error: ${error.message}`);
    return;
  }

  throw error;
}

const NEWS_LIST_LIMIT = 300;

/** Shared across visitors for a minute. These tables are public and change only when collection runs. */
export const getNewsItems = () => cached('news', () => loadNewsItems());

async function loadNewsItems() {
  const supabase = await createClient();
  if (!supabase) return [];
  const rankedResult = await supabase
    .from('news_items')
    .select('*')
    .order('daily_rank_score', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false })
    .limit(NEWS_LIST_LIMIT);

  if (!rankedResult.error) return (rankedResult.data ?? []) as NewsItem[];

  const { data, error } = await supabase
    .from('news_items')
    .select('*')
    .order('published_at', { ascending: false })
    .limit(NEWS_LIST_LIMIT);

  if (error) {
    handleReadError(error);
    return [];
  }
  return (data ?? []) as NewsItem[];
}

export async function getNewsItem(id: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from('news_items').select('*').eq('id', id).maybeSingle();

  if (error) {
    handleReadError(error);
    return null;
  }
  return data as NewsItem | null;
}

/** Shared across visitors for a minute. These tables are public and change only when collection runs. */
export const getResearchPapers = (limit = 8) => cached(`papers:${limit}`, () => loadResearchPapers(limit));

async function loadResearchPapers(limit = 8) {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('research_papers')
    .select('*')
    .order('relevance_score', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    handleReadError(error);
    return [];
  }
  return (data ?? []) as ResearchPaper[];
}

export async function getResearchPaper(id: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from('research_papers').select('*').eq('id', id).maybeSingle();

  if (error) {
    handleReadError(error);
    return null;
  }
  return data as ResearchPaper | null;
}

export async function getArticleFeedItems() {
  const [news, papers] = await Promise.all([getNewsItems(), getResearchPapers(80)]);
  return [...news.filter(hasNewsBody).map(toNewsArticle), ...papers.filter(isSeedupRelevantPaper).map(toPaperArticle)].sort(byNewest);
}

export function hasNewsBody(item: NewsItem) {
  return Boolean(item.content?.trim());
}

export function byNewest(a: ArticleFeedItem, b: ArticleFeedItem) {
  return new Date(b.published_at ?? b.created_at ?? 0).getTime() - new Date(a.published_at ?? a.created_at ?? 0).getTime();
}

export function toNewsArticle(item: NewsItem): ArticleFeedItem {
  return {
    id: item.id,
    type: 'news',
    title: item.title,
    summary: item.summary,
    content: item.content,
    newsletter_section: item.newsletter_section ?? null,
    newsletter_priority: item.newsletter_priority ?? null,
    short_summary: item.short_summary ?? null,
    category: item.category ?? '뉴스',
    source: item.source,
    source_url: item.source_url ?? null,
    original_url: item.original_url ?? null,
    image_url: item.image_url,
    project_idea: item.project_idea,
    beginner_summary: item.beginner_summary ?? null,
    why_it_matters: item.why_it_matters ?? null,
    key_points: item.key_points ?? null,
    related_skills: item.related_skills ?? null,
    topic_tags: item.topic_tags ?? null,
    skill_tags: item.skill_tags ?? null,
    intent_tags: item.intent_tags ?? null,
    audience_tags: item.audience_tags ?? null,
    related_roles: item.related_roles ?? null,
    learning_topics: item.learning_topics ?? null,
    project_convertible: item.project_convertible ?? null,
    personalization_hooks: item.personalization_hooks ?? null,
    source_quality_score: item.source_quality_score ?? null,
    novelty_score: item.novelty_score ?? null,
    buildability_score: item.buildability_score ?? null,
    project_connect_score: item.project_connect_score ?? null,
    daily_rank_score: item.daily_rank_score ?? null,
    recommendation_reasons: item.recommendation_reasons ?? null,
    difficulty: item.difficulty ?? null,
    relevance_score: item.relevance_score ?? null,
    target_levels: item.target_levels ?? null,
    target_goals: item.target_goals ?? null,
    target_interests: item.target_interests ?? null,
    content_depth: item.content_depth ?? null,
    view_count: Number(item.view_count ?? 0),
    like_count: Number(item.like_count ?? 0),
    dislike_count: Number(item.dislike_count ?? 0),
    published_at: item.published_at,
  };
}

export function toPaperArticle(paper: ResearchPaper): ArticleFeedItem {
  return {
    id: paper.id,
    type: 'paper',
    title: paper.title,
    summary: readablePaperText(paper.beginner_summary ?? paper.expert_summary ?? paper.abstract, paper.title),
    content: readablePaperText(paper.expert_summary ?? paper.beginner_summary ?? paper.abstract, paper.title),
    newsletter_section: paper.implementation_idea || paper.service_idea ? 'paper_to_project' : 'deep_dive',
    newsletter_priority: paper.trend_score ?? paper.relevance_score ?? null,
    short_summary: readablePaperText(paper.beginner_summary ?? paper.expert_summary, paper.title),
    category: paper.review_type ?? '논문',
    source: paper.source ?? 'Research',
    source_url: paper.source_url,
    original_url: paper.paper_url,
    image_url: null,
    project_idea: paper.implementation_idea ?? paper.service_idea,
    beginner_summary: paper.beginner_summary,
    why_it_matters: paper.why_it_matters,
    key_points: paper.key_points,
    related_skills: paper.related_skills ?? paper.categories,
    topic_tags: paper.categories ?? null,
    skill_tags: paper.related_skills ?? paper.categories,
    intent_tags: paper.implementation_idea ? ['프로젝트 연결 가능'] : ['심화 학습'],
    audience_tags: paper.difficulty ? [paper.difficulty] : null,
    related_roles: null,
    learning_topics: paper.related_skills ?? paper.categories,
    project_convertible: Boolean(paper.implementation_idea || paper.service_idea || paper.code_url),
    personalization_hooks: paper.why_it_matters ? [paper.why_it_matters] : null,
    source_quality_score: 72,
    novelty_score: paper.trend_score ?? null,
    buildability_score: paper.buildability_score ?? null,
    project_connect_score: paper.implementation_idea || paper.service_idea ? 76 : null,
    daily_rank_score: null,
    recommendation_reasons: paper.implementation_idea ? ['논문을 프로젝트로 연결 가능'] : ['심화 학습에 적합'],
    difficulty: paper.difficulty,
    relevance_score: paper.relevance_score,
    target_levels: paper.target_levels ?? null,
    target_goals: paper.target_goals ?? null,
    target_interests: paper.target_interests ?? null,
    content_depth: paper.content_depth ?? null,
    view_count: Number(paper.view_count ?? 0),
    like_count: Number(paper.like_count ?? 0),
    dislike_count: Number(paper.dislike_count ?? 0),
    published_at: paper.published_at,
    created_at: paper.created_at,
  };
}

function readablePaperText(value: string | null | undefined, title: string) {
  if (!value) return null;
  const cleaned = value
    .replace(/^arxiv:\S+\s*/i, '')
    .replace(/^announce\s+type:\s*\w+\s*/i, '')
    .replace(/^abstract:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  if (/^[A-Za-z0-9:.\-\s]+$/.test(cleaned) && cleaned.length < 120) {
    return `${title} 논문의 핵심 내용을 초보 개발자도 이해할 수 있게 정리한 리뷰입니다.`;
  }
  return cleaned;
}

export function isSeedupRelevantPaper(paper: ResearchPaper) {
  const text = [paper.title, paper.abstract, paper.beginner_summary, paper.expert_summary, paper.implementation_idea, paper.service_idea, ...(paper.categories ?? []), ...(paper.related_skills ?? [])]
    .join(' ')
    .toLowerCase();
  const visibleText = [paper.beginner_summary, paper.expert_summary, paper.implementation_idea, paper.service_idea].join('\n');
  if (/기반\s+미니\s+데모\s+만들기|논문 아이디어를 활용한|arxiv:\S+|announce type|abstract:/i.test(visibleText)) return false;
  if ((paper.expert_summary?.length ?? 0) < 500 || (paper.beginner_summary?.length ?? 0) < 160 || (paper.why_it_matters?.length ?? 0) < 70) return false;
  const offDomain = /medical|clinical|medicine|patient|public health|healthcare|health question|disease|diagnosis|protein|genomics|molecule|drug discovery|biology/.test(text);
  if (!offDomain) return true;
  return /coding agent|code agent|software engineering|developer tool|devtool|code generation|api|sdk|cli|ide|debug|deployment|observability|backend|frontend|database|devops/.test(text);
}

export async function getRelatedPapersForNews(newsId: string) {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('news_paper_links')
    .select('*, research_papers(*)')
    .eq('news_id', newsId)
    .order('relevance_score', { ascending: false })
    .limit(3);

  if (error) {
    handleReadError(error);
    return [];
  }
  return (data ?? []) as NewsPaperLink[];
}

/** Shared across visitors for a minute. These tables are public and change only when collection runs. */
export const getTrends = () => cached('trends', () => loadTrends());

async function loadTrends() {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from('trends').select('*').order('rank', { ascending: true }).limit(180);

  if (error) {
    handleReadError(error);
    return [];
  }
  const trends = ((data ?? []) as Trend[]).filter(isDisplayableTrend);
  if (!trends.length) return trends;

  const since = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const keywords = trends.map((trend) => trend.keyword);
  const snapshotResult = await supabase
    .from('trend_snapshots')
    .select('keyword,snapshot_date,score,signal_count,news_count,github_repo_count,product_count,paper_count')
    .in('keyword', keywords)
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true });

  const { data: snapshots, error: snapshotError } = snapshotResult.error
    ? await supabase
      .from('trend_snapshots')
      .select('keyword,snapshot_date,score,signal_count,news_count,github_repo_count,product_count')
      .in('keyword', keywords)
      .gte('snapshot_date', since)
      .order('snapshot_date', { ascending: true })
    : snapshotResult;

  if (snapshotError) {
    handleReadError(snapshotError);
    return trends;
  }

  const snapshotMap = new Map<string, TrendSnapshot[]>();
  for (const item of (snapshots ?? []) as Array<{
    keyword: unknown;
    snapshot_date: unknown;
    score?: unknown;
    signal_count?: unknown;
    news_count?: unknown;
    github_repo_count?: unknown;
    product_count?: unknown;
    paper_count?: unknown;
  }>) {
    const key = String(item.keyword);
    const current = snapshotMap.get(key) ?? [];
    current.push({
      date: String(item.snapshot_date),
      score: Number(item.score ?? 0),
      signal_count: Number(item.signal_count ?? 0),
      news_count: Number(item.news_count ?? 0),
      github_repo_count: Number(item.github_repo_count ?? 0),
      product_count: Number(item.product_count ?? 0),
      paper_count: Number(item.paper_count ?? 0),
    });
    snapshotMap.set(key, current);
  }

  return trends.map((trend) => ({
    ...trend,
    recent_snapshots: snapshotMap.get(trend.keyword) ?? [],
  }));
}

export const getModelIntelligence = () => cached('model-intelligence', loadModelIntelligence);

async function loadModelIntelligence(): Promise<ModelIntelligence[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data: latest, error: latestError } = await supabase
    .from('ai_model_snapshots')
    .select('snapshot_date')
    .order('snapshot_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError || !latest?.snapshot_date) return [];
  const { data, error } = await supabase
    .from('ai_model_snapshots')
    .select('snapshot_date,model_id,model_name,provider,popularity_rank,intelligence_rank,intelligence_score,arena_rank,arena_elo,context_length,prompt_price,completion_price,throughput,latency,supported_parameters,fetched_at')
    .eq('snapshot_date', latest.snapshot_date);

  if (error) {
    handleReadError(error);
    return [];
  }

  return (data ?? []) as ModelIntelligence[];
}

function isDisplayableTrend(trend: Trend) {
  const keyword = trend.keyword.trim();
  if (isGenericTitle(keyword)) return false;
  if (/(이\s*저장소|이\s*프로젝트|활용하여|참고하여|핵심\s*기능\s*만들어보기)/i.test(trend.keyword)) return false;

  const sourceCount = Number(trend.sources_count ?? 0);
  const sourceDiversity = [
    Number(trend.news_count ?? 0),
    Number(trend.product_count ?? 0),
    Number(trend.github_repo_count ?? 0),
    Number(trend.paper_count ?? 0),
  ].filter(Boolean).length;

  const category = normalizeTrendCategory(trend.category);
  if (category === '오픈소스 프로젝트') return Number(trend.github_repo_count ?? 0) > 0;
  if (category === 'AI 도구·모델') return ['tool', 'model', 'ai_tool', 'ai_model'].includes(String(trend.entity_type ?? trend.trend_type ?? ''));
  if (category === '개발 워크플로우') return true;
  if (category === '구현 패턴') return true;
  if (category === '빌드 아이디어') return sourceCount >= 2;

  if (trend.category === '오픈소스/GitHub') return Number(trend.github_repo_count ?? 0) > 0;
  if (trend.category === '스킬/아키텍처') return sourceCount >= 3 && sourceDiversity >= 2;
  return sourceCount >= 2 || Number(trend.display_score ?? trend.score ?? 0) >= 60;
}

function normalizeTrendCategory(value: string | null | undefined) {
  if (value === 'AI 개발 방식') return '개발 워크플로우';
  if (value === 'AI 도구/모델') return 'AI 도구·모델';
  if (value === '스킬/아키텍처') return '구현 패턴';
  if (value === '오픈소스/GitHub') return '오픈소스 프로젝트';
  return value ?? '';
}

/** Shared across visitors for a minute. These tables are public and change only when collection runs. */
export const getAIProducts = () => cached('ai-products', () => loadAIProducts());

async function loadAIProducts() {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('ai_products')
    .select('*')
    .order('newsletter_priority', { ascending: false, nullsFirst: false })
    .order('launch_date', { ascending: false, nullsFirst: false })
    .order('score', { ascending: false, nullsFirst: false });

  if (error) {
    handleReadError(error);
    return [];
  }
  return (data ?? []) as AIProduct[];
}

export async function getAIProduct(id: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from('ai_products').select('*').eq('id', id).maybeSingle();

  if (error) {
    handleReadError(error);
    return null;
  }
  return data as AIProduct | null;
}

export async function getAIProductReviews(productId: string) {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('ai_product_reviews')
    .select('*')
    .eq('product_id', productId)
    .order('created_at', { ascending: false });

  if (error) {
    handleReadError(error);
    return [];
  }
  return (data ?? []) as AIProductReview[];
}

/** Shared across visitors for a minute. These tables are public and change only when collection runs. */
export const getProjectIdeas = () => cached('project-ideas', () => loadProjectIdeas());

async function loadProjectIdeas() {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from('project_ideas').select('*').order('created_at', { ascending: false });

  if (error) {
    handleReadError(error);
    return [];
  }
  return (data ?? []) as ProjectIdea[];
}

export async function getProjectIdea(id: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from('project_ideas').select('*').eq('id', id).maybeSingle();

  if (error) {
    handleReadError(error);
    return null;
  }
  return data as ProjectIdea | null;
}

/** Shared across visitors for a minute. These tables are public and change only when collection runs. */
export const getGitHubTrends = () => cached('github-trends', () => loadGitHubTrends());

async function loadGitHubTrends() {
  const supabase = await createClient();
  if (!supabase) return [];
  const rankedResult = await supabase
    .from('github_trends')
    .select('*')
    .order('stars_delta_7d', { ascending: false, nullsFirst: false })
    .order('stars', { ascending: false })
    .limit(150);
  const { data, error } = rankedResult.error
    ? await supabase.from('github_trends').select('*').order('stars', { ascending: false }).limit(150)
    : rankedResult;

  if (error) {
    handleReadError(error);
    return [];
  }
  return (data ?? []) as GitHubTrend[];
}

export async function getGitHubTrend(id: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from('github_trends').select('*').eq('id', id).maybeSingle();

  if (error) {
    handleReadError(error);
    return null;
  }
  return data as GitHubTrend | null;
}

type HistoryTable = 'trend_snapshots' | 'github_repo_snapshots' | 'ai_model_snapshots';

/** The oldest and newest day a history table holds, so a page offers only the periods it can rank. */
const getHistoryRange = (table: HistoryTable) => cached(`history-range:${table}`, async () => {
  const supabase = await createClient();
  if (!supabase) return { oldest: null, newest: null };
  const edge = (ascending: boolean) => supabase.from(table).select('snapshot_date').order('snapshot_date', { ascending }).limit(1).maybeSingle();
  const [first, last] = await Promise.all([edge(true), edge(false)]);
  if (first.error) handleReadError(first.error);
  return { oldest: (first.data?.snapshot_date as string | undefined) ?? null, newest: (last.data?.snapshot_date as string | undefined) ?? null };
});

/**
 * The period a page asked for (if its history reaches that far) and each key's value on that period's first day.
 * Only a few days around that day are read, so the query stays small however long the history grows.
 */
export async function getPeriodBaseline(table: HistoryTable, keyColumn: string, valueColumn: string, keys: string[], requested: string | null | undefined) {
  const { oldest, newest } = await getHistoryRange(table);
  const state = periodState(requested, oldest, newest);
  if (!state.period || !newest || !keys.length) return { state, baseline: new Map<string, number>() };
  const { days } = state.period;
  const baseline = await cached(`period-baseline:${table}:${days}:${newest}`, async () => {
    const supabase = await createClient();
    if (!supabase) return new Map<string, number>();
    const day = daysBefore(newest, days);
    const { data, error } = await supabase
      .from(table)
      .select(`${keyColumn},snapshot_date,${valueColumn}`)
      .in(keyColumn, keys)
      .lte('snapshot_date', day)
      .gte('snapshot_date', daysBefore(day, baselineSlack(days)))
      .order('snapshot_date', { ascending: false })
      .limit(1000);
    if (error) {
      handleReadError(error);
      return new Map<string, number>();
    }
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    return valuesAt(rows.map((row) => ({ key: String(row[keyColumn]), date: String(row.snapshot_date), value: Number(row[valueColumn] ?? 0) })), day);
  });
  return { state, baseline };
}

/** Each trend topic's average daily score over the last `days` days of its history (missing days count as 0). */
export const getTrendAverages = (keys: string[], days: number) => cached(`trend-average:${days}`, async () => {
  const supabase = await createClient();
  const { newest } = await getHistoryRange('trend_snapshots');
  if (!supabase || !newest || !keys.length) return new Map<string, number>();
  const rows: Array<{ key: string; date: string; value: number }> = [];
  // shortcut: pages through every row of the window (about 150 a day), fine up to a month; past that, store daily averages at ingest.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('trend_snapshots')
      .select('keyword,snapshot_date,score')
      .in('keyword', keys)
      .gt('snapshot_date', daysBefore(newest, days))
      .lte('snapshot_date', newest)
      .order('snapshot_date', { ascending: false })
      .range(from, from + 999);
    if (error) {
      handleReadError(error);
      break;
    }
    rows.push(...(data ?? []).map((row) => ({ key: String(row.keyword), date: String(row.snapshot_date), value: Number(row.score ?? 0) })));
    if ((data?.length ?? 0) < 1000) break;
  }
  return averagePerDay(rows);
});
