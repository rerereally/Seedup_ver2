import { createClient } from '@/lib/supabase/server';

function handleReadError(error: { code?: string; message?: string }) {
  if (error.code === '42501' || error.code === 'PGRST205') {
    console.warn(`Supabase read error: ${error.message}`);
    return;
  }

  throw error;
}

export type NewsItem = {
  id: string;
  title: string;
  summary: string | null;
  content: string | null;
  content_type?: string | null;
  newsletter_section?: string | null;
  newsletter_priority?: number | null;
  short_summary?: string | null;
  category: string | null;
  source: string | null;
  source_url?: string | null;
  original_url?: string | null;
  raw_title?: string | null;
  raw_content?: string | null;
  ai_summary?: string | null;
  beginner_summary?: string | null;
  why_it_matters?: string | null;
  key_points?: string[] | null;
  related_skills?: string[] | null;
  difficulty?: string | null;
  relevance_score?: number | null;
  view_count?: number | null;
  like_count?: number | null;
  dislike_count?: number | null;
  target_levels?: string[] | null;
  target_goals?: string[] | null;
  target_interests?: string[] | null;
  content_depth?: string | null;
  topic_tags?: string[] | null;
  skill_tags?: string[] | null;
  intent_tags?: string[] | null;
  audience_tags?: string[] | null;
  related_roles?: string[] | null;
  learning_topics?: string[] | null;
  project_convertible?: boolean | null;
  personalization_hooks?: string[] | null;
  source_quality_score?: number | null;
  novelty_score?: number | null;
  buildability_score?: number | null;
  project_connect_score?: number | null;
  daily_rank_score?: number | null;
  recommendation_reasons?: string[] | null;
  ranked_at?: string | null;
  ai_model?: string | null;
  processed_at?: string | null;
  source_language?: string | null;
  canonical_key?: string | null;
  duplicate_group_key?: string | null;
  duplicate_count?: number | null;
  quality_notes?: string[] | null;
  image_url: string | null;
  project_idea: string | null;
  published_at: string | null;
};

export type Trend = {
  id: string;
  keyword: string;
  display_name?: string | null;
  normalized_name?: string | null;
  entity_type?: string | null;
  trend_type?: string | null;
  category?: string | null;
  summary: string | null;
  raw_score?: number | null;
  display_score?: number | null;
  previous_score?: number | null;
  weekly_growth_rate?: number | null;
  trend_direction?: 'up' | 'down' | 'flat' | 'new' | string | null;
  why_trending?: string[] | null;
  related_skills?: string[] | null;
  related_tools?: string[] | null;
  target_roles?: string[] | null;
  score: number | null;
  status: string | null;
  rank: number | null;
  bars: number[] | null;
  project_ideas: string[] | null;
  sources_count?: number | null;
  news_count?: number | null;
  product_count?: number | null;
  github_repo_count?: number | null;
  paper_count?: number | null;
  source_mix?: Partial<Record<string, number>> | null;
  detected_sources?: Array<{ type: string; id: string; title: string; url?: string | null; source_name?: string | null }> | null;
  source_refs?: Array<{ type: string; id: string; title: string; url?: string | null; source_name?: string | null }> | null;
  recent_snapshots?: TrendSnapshot[];
};

export type TrendSnapshot = {
  date: string;
  score: number;
  signal_count: number;
  news_count: number;
  github_repo_count: number;
  product_count: number;
  paper_count: number;
};

export type AIProduct = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  content_type?: string | null;
  newsletter_section?: string | null;
  newsletter_priority?: number | null;
  short_summary?: string | null;
  score: number | null;
  rating_count: number | null;
  user_score_sum?: number | null;
  status: string | null;
  website_url: string | null;
  product_hunt_url?: string | null;
  use_cases?: string[] | null;
  topic_tags?: string[] | null;
  skill_tags?: string[] | null;
  intent_tags?: string[] | null;
  audience_tags?: string[] | null;
  related_roles?: string[] | null;
  learning_topics?: string[] | null;
  project_convertible?: boolean | null;
  personalization_hooks?: string[] | null;
  source_quality_score?: number | null;
  novelty_score?: number | null;
  buildability_score?: number | null;
  project_connect_score?: number | null;
  recommendation_reasons?: string[] | null;
  pricing_type?: string | null;
  target_user?: string | null;
  related_project_ideas?: string[] | null;
  view_count?: number | null;
  like_count?: number | null;
  dislike_count?: number | null;
};

export type AIProductReview = {
  id: string;
  product_id: string;
  user_id: string;
  author_name: string | null;
  rating: number;
  title: string | null;
  body: string;
  created_at: string;
  updated_at: string;
};

export type ProjectIdea = {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  duration_days: number | null;
  stack: string[] | null;
  related_trend: string | null;
  portfolio_value?: string | null;
  plan: string[] | null;
  view_count?: number | null;
  like_count?: number | null;
  dislike_count?: number | null;
};

export type ScrapItem = {
  id: string;
  item_type: string;
  item_id: string | null;
  title: string;
  description: string | null;
  tag: string | null;
  created_at: string;
};

export type GitHubTrend = {
  id: string;
  repo_full_name: string;
  repo_url: string;
  description: string | null;
  stars: number | null;
  stars_delta_7d?: number | null;
  forks: number | null;
  language: string | null;
  topics: string[] | null;
  pushed_at: string | null;
  last_seen_at?: string | null;
  content_type?: string | null;
  newsletter_section?: string | null;
  newsletter_priority?: number | null;
  short_summary?: string | null;
  ai_review: string | null;
  beginner_summary: string | null;
  project_idea: string | null;
  relevance_score: number | null;
  topic_tags?: string[] | null;
  skill_tags?: string[] | null;
  intent_tags?: string[] | null;
  audience_tags?: string[] | null;
  related_roles?: string[] | null;
  learning_topics?: string[] | null;
  project_convertible?: boolean | null;
  personalization_hooks?: string[] | null;
  source_quality_score?: number | null;
  novelty_score?: number | null;
  buildability_score?: number | null;
  project_connect_score?: number | null;
  recommendation_reasons?: string[] | null;
  view_count?: number | null;
  like_count?: number | null;
  dislike_count?: number | null;
};

export type ResearchPaper = {
  id: string;
  title: string;
  abstract: string | null;
  authors: string[] | null;
  source: string | null;
  source_url: string | null;
  paper_url: string | null;
  pdf_url: string | null;
  code_url: string | null;
  categories: string[] | null;
  review_type: string | null;
  beginner_summary: string | null;
  expert_summary: string | null;
  why_it_matters: string | null;
  key_points: string[] | null;
  related_skills: string[] | null;
  implementation_idea: string | null;
  service_idea: string | null;
  difficulty: string | null;
  target_reader: string | null;
  relevance_score: number | null;
  view_count?: number | null;
  like_count?: number | null;
  dislike_count?: number | null;
  target_levels?: string[] | null;
  target_goals?: string[] | null;
  target_interests?: string[] | null;
  content_depth?: string | null;
  trend_score: number | null;
  buildability_score: number | null;
  beginner_score: number | null;
  business_score: number | null;
  research_depth_score: number | null;
  has_code: boolean | null;
  is_huggingface_trending: boolean | null;
  published_at: string | null;
  created_at: string;
};

export type NewsPaperLink = {
  id: string;
  news_id: string;
  paper_id: string;
  relevance_reason: string | null;
  relevance_score: number | null;
  research_papers: ResearchPaper | null;
};

export type IngestRun = {
  id: string;
  source: string;
  status: string;
  inserted_count: number;
  skipped_count: number;
  error_count: number;
  duration_ms: number;
  detail: Record<string, unknown> | null;
  created_at: string;
};

export type IngestRejection = {
  id: string;
  source: string;
  source_url: string | null;
  original_url: string | null;
  title: string;
  reason: string;
  keyword_score: number | null;
  ai_score: number | null;
  daily_rank_score: number | null;
  matched_keywords: string[] | null;
  soft_excluded: string[] | null;
  hard_excluded: string[] | null;
  created_at: string;
};

export type ArticleFeedItem = {
  id: string;
  type: 'news' | 'paper';
  title: string;
  summary: string | null;
  content: string | null;
  newsletter_section?: string | null;
  newsletter_priority?: number | null;
  short_summary?: string | null;
  category: string | null;
  source: string | null;
  source_url: string | null;
  original_url: string | null;
  image_url: string | null;
  project_idea: string | null;
  beginner_summary: string | null;
  why_it_matters: string | null;
  key_points: string[] | null;
  related_skills: string[] | null;
  topic_tags?: string[] | null;
  skill_tags?: string[] | null;
  intent_tags?: string[] | null;
  audience_tags?: string[] | null;
  related_roles?: string[] | null;
  learning_topics?: string[] | null;
  project_convertible?: boolean | null;
  personalization_hooks?: string[] | null;
  source_quality_score?: number | null;
  novelty_score?: number | null;
  buildability_score?: number | null;
  project_connect_score?: number | null;
  daily_rank_score?: number | null;
  recommendation_reasons?: string[] | null;
  difficulty: string | null;
  relevance_score: number | null;
  target_levels: string[] | null;
  target_goals: string[] | null;
  target_interests: string[] | null;
  content_depth: string | null;
  view_count: number;
  like_count: number;
  dislike_count: number;
  published_at: string | null;
  created_at?: string | null;
};

export async function getNewsItems() {
  const supabase = await createClient();
  if (!supabase) return [];
  const rankedResult = await supabase
    .from('news_items')
    .select('*')
    .order('daily_rank_score', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false });

  if (!rankedResult.error) return (rankedResult.data ?? []) as NewsItem[];

  const { data, error } = await supabase
    .from('news_items')
    .select('*')
    .order('published_at', { ascending: false });

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

export async function getResearchPapers(limit = 8) {
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
  const newsArticles: ArticleFeedItem[] = news.filter((item) => Boolean(item.content?.trim())).map((item) => ({
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
  }));
  const paperArticles: ArticleFeedItem[] = papers.filter(isSeedupRelevantPaper).map((paper) => ({
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
  }));

  return [...newsArticles, ...paperArticles].sort((a, b) => new Date(b.published_at ?? b.created_at ?? 0).getTime() - new Date(a.published_at ?? a.created_at ?? 0).getTime());
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

function isSeedupRelevantPaper(paper: ResearchPaper) {
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

export async function getTrends() {
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

function isDisplayableTrend(trend: Trend) {
  const keyword = trend.keyword.trim().toLowerCase();
  const generic = new Set([
    'ai',
    'llm',
    'api',
    'github',
    'open source',
    'typescript',
    'react',
    'next.js',
    'nextjs',
    'node.js',
    'rust',
    'tui',
    'benchmark',
    'python',
    'javascript',
    'developer',
    'development',
    'tool',
    'tools',
    'product',
    'news',
    'paper',
  ]);
  if (generic.has(keyword)) return false;
  if (/(이\s*저장소|이\s*프로젝트|활용하여|참고하여|핵심\s*기능\s*만들어보기)/i.test(trend.keyword)) return false;

  const sourceCount = Number(trend.sources_count ?? 0);
  const sourceDiversity = [
    Number(trend.news_count ?? 0),
    Number(trend.product_count ?? 0),
    Number(trend.github_repo_count ?? 0),
    Number(trend.paper_count ?? 0),
  ].filter(Boolean).length;

  const category = normalizeTrendCategory(trend.category);
  if (category === '오픈소스 프로젝트') return Number(trend.github_repo_count ?? 0) > 0 && !generic.has(keyword);
  if (category === 'AI 도구·모델') return !generic.has(keyword) && ['tool', 'model', 'ai_tool', 'ai_model'].includes(String(trend.entity_type ?? trend.trend_type ?? ''));
  if (category === '개발 워크플로우') return !generic.has(keyword);
  if (category === '구현 패턴') return !generic.has(keyword);
  if (category === '빌드 아이디어') return sourceCount >= 2 && sourceDiversity >= 2;

  if (trend.category === '오픈소스/GitHub') return Number(trend.github_repo_count ?? 0) > 0;
  if (trend.category === '빌드 아이디어') return sourceCount >= 2 && sourceDiversity >= 2;
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

export async function getAIProducts() {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from('ai_products').select('*').order('score', { ascending: false });

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

export async function getProjectIdeas() {
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

export async function getScraps() {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from('scraps').select('*').order('created_at', { ascending: false });

  if (error) {
    handleReadError(error);
    return [];
  }
  return (data ?? []) as ScrapItem[];
}

export async function getScrap(id: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from('scraps').select('*').eq('id', id).maybeSingle();

  if (error) {
    handleReadError(error);
    return null;
  }
  return data as ScrapItem | null;
}

export async function getExistingScrap(itemType: string, itemId: string) {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from('scraps')
    .select('*')
    .eq('user_id', userData.user.id)
    .eq('item_type', itemType)
    .eq('item_id', itemId)
    .maybeSingle();

  if (error) {
    handleReadError(error);
    return null;
  }

  return data as ScrapItem | null;
}

export async function getScrapKeySet() {
  const supabase = await createClient();
  if (!supabase) return new Set<string>();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return new Set<string>();

  const { data, error } = await supabase
    .from('scraps')
    .select('item_type,item_id')
    .eq('user_id', userData.user.id);

  if (error) {
    handleReadError(error);
    return new Set<string>();
  }

  return new Set((data ?? []).map((item) => `${item.item_type}:${item.item_id}`));
}

export async function getGitHubTrends() {
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

export async function getIngestRuns() {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('ingest_runs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30);

  if (error) {
    handleReadError(error);
    return [];
  }
  return (data ?? []) as IngestRun[];
}

export async function getIngestRejections(limit = 40) {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('ingest_rejections')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    handleReadError(error);
    return [];
  }
  return (data ?? []) as IngestRejection[];
}

export async function getIngestQualitySummary() {
  const [runs, rejections, news] = await Promise.all([getIngestRuns(), getIngestRejections(120), getNewsItems()]);
  const recentRuns = runs.slice(0, 12);
  const totalInserted = recentRuns.reduce((sum, run) => sum + Number(run.inserted_count ?? 0), 0);
  const totalSkipped = recentRuns.reduce((sum, run) => sum + Number(run.skipped_count ?? 0), 0);
  const sourceMap = new Map<string, { inserted: number; skipped: number; rejected: number; quality: number; duplicates: number }>();

  for (const run of recentRuns) {
    const detailResults = Array.isArray(run.detail?.results) ? run.detail.results : [];
    for (const item of detailResults) {
      if (!item || typeof item !== 'object') continue;
      const row = item as { source?: string; inserted?: number; skipped?: number };
      if (!row.source) continue;
      const current = sourceMap.get(row.source) ?? { inserted: 0, skipped: 0, rejected: 0, quality: 0, duplicates: 0 };
      current.inserted += Number(row.inserted ?? 0);
      current.skipped += Number(row.skipped ?? 0);
      sourceMap.set(row.source, current);
    }
  }

  for (const rejection of rejections) {
    const current = sourceMap.get(rejection.source) ?? { inserted: 0, skipped: 0, rejected: 0, quality: 0, duplicates: 0 };
    current.rejected += 1;
    sourceMap.set(rejection.source, current);
  }

  for (const item of news) {
    const source = item.source ?? 'Unknown';
    const current = sourceMap.get(source) ?? { inserted: 0, skipped: 0, rejected: 0, quality: 0, duplicates: 0 };
    current.quality = Math.max(current.quality, Number(item.source_quality_score ?? 0));
    current.duplicates += Math.max(0, Number(item.duplicate_count ?? 1) - 1);
    sourceMap.set(source, current);
  }

  return {
    totalInserted,
    totalSkipped,
    rejections: rejections.length,
    sources: Array.from(sourceMap.entries())
      .map(([source, value]) => ({ source, ...value }))
      .sort((a, b) => b.inserted + b.rejected - (a.inserted + a.rejected)),
  };
}
