import { createClient } from '@/lib/supabase/server';

function handleReadError(error: { code?: string; message?: string }) {
  if (error.code === '42501') {
    console.warn(`Supabase permission error: ${error.message}`);
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
};

export type AIProduct = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  score: number | null;
  rating_count: number | null;
  status: string | null;
  website_url: string | null;
  product_hunt_url?: string | null;
  use_cases?: string[] | null;
  pricing_type?: string | null;
  target_user?: string | null;
  related_project_ideas?: string[] | null;
};

export type ProjectIdea = {
  id: string;
  title: string;
  description: string | null;
  level: string | null;
  duration_days: number | null;
  stack: string[] | null;
  related_trend: string | null;
  plan: string[] | null;
};

export type ScrapItem = {
  id: string;
  item_type: string;
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
  const { data, error } = await supabase.from('github_trends').select('*').order('stars', { ascending: false }).limit(20);

  if (error) {
    handleReadError(error);
    return [];
  }
  return (data ?? []) as GitHubTrend[];
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
