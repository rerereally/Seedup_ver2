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
  ai_model?: string | null;
  processed_at?: string | null;
  source_language?: string | null;
  image_url: string | null;
  project_idea: string | null;
  published_at: string | null;
};

export type Trend = {
  id: string;
  keyword: string;
  summary: string | null;
  score: number | null;
  status: string | null;
  rank: number | null;
  bars: number[] | null;
  project_ideas: string[] | null;
  sources_count?: number | null;
  news_count?: number | null;
  product_count?: number | null;
  github_repo_count?: number | null;
  source_refs?: Array<{ type: string; id: string; title: string }> | null;
};

export type AIProduct = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  score: number | null;
  rating_count: number | null;
  user_score_sum?: number | null;
  status: string | null;
  website_url: string | null;
  product_hunt_url?: string | null;
  use_cases?: string[] | null;
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
  forks: number | null;
  language: string | null;
  topics: string[] | null;
  pushed_at: string | null;
  ai_review: string | null;
  beginner_summary: string | null;
  project_idea: string | null;
  relevance_score: number | null;
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

export type ArticleFeedItem = {
  id: string;
  type: 'news' | 'paper';
  title: string;
  summary: string | null;
  content: string | null;
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
  const newsArticles: ArticleFeedItem[] = news.map((item) => ({
    id: item.id,
    type: 'news',
    title: item.title,
    summary: item.summary,
    content: item.content,
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
  const paperArticles: ArticleFeedItem[] = papers.map((paper) => ({
    id: paper.id,
    type: 'paper',
    title: paper.title,
    summary: paper.beginner_summary ?? paper.expert_summary ?? paper.abstract,
    content: paper.expert_summary ?? paper.beginner_summary ?? paper.abstract,
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
  const { data, error } = await supabase.from('trends').select('*').order('rank', { ascending: true });

  if (error) {
    handleReadError(error);
    return [];
  }
  return (data ?? []) as Trend[];
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
  const { data, error } = await supabase.from('github_trends').select('*').order('stars', { ascending: false }).limit(100);

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
