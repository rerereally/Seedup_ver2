import { createClient } from '@/lib/supabase/server';
import {
  byNewest,
  getAIProducts,
  getArticleFeedItems,
  getGitHubTrends,
  getProjectIdeas,
  hasNewsBody,
  isSeedupRelevantPaper,
  toNewsArticle,
  toPaperArticle,
} from './data-catalog';
import type { AIProduct, GitHubTrend, NewsItem, ProjectIdea, ResearchPaper } from './data-types';

const SEARCH_LIMITS = { articles: 12, repos: 8, products: 8, projects: 8 };
// Paper visibility rules (isSeedupRelevantPaper) run in JS, so fetch a few extra candidates first.
const PAPER_SEARCH_CANDIDATES = 48;

/**
 * Builds a PostgREST `.or()` ilike filter. The query is LIKE-escaped (\ % _), then the value is
 * double-quoted with `"` and `\` escaped, so commas and parentheses in the query stay literal.
 */
export function searchFilter(columns: string[], query: string) {
  const like = query.replace(/[\\%_]/g, (c) => `\\${c}`);
  const pattern = `"%${like.replace(/["\\]/g, (c) => `\\${c}`)}%"`;
  return columns.map((column) => `${column}.ilike.${pattern}`).join(',');
}

/**
 * Builds a PostgREST `cs` (array contains) filter, so a query matches a text[] column holding the query as an exact tag.
 * Returns '' when the query is empty, too long, or has characters that cannot be a tag.
 */
export function tagFilter(columns: string[], query: string) {
  const tag = query.trim().toLowerCase();
  if (!tag || tag.length > 40 || !/^[\p{L}\p{N} \-_.+#]+$/u.test(tag)) return '';
  const value = `"${tag.replace(/["\\]/g, (c) => `\\${c}`)}"`;
  return columns.map((column) => `${column}.cs.{${value}}`).join(',');
}

/** Text ilike clauses plus exact-tag clauses, joined into one `.or()` string. */
function searchOr(query: string, textColumns: string[], tagColumns: string[] = []) {
  return [searchFilter(textColumns, query), tagFilter(tagColumns, query)].filter(Boolean).join(',');
}

/** Searches the whole database, not the capped lists the loaders keep. Falls back to in-memory filtering if the DB cannot answer. */
export async function searchContent(query: string) {
  try {
    const supabase = await createClient();
    if (supabase) return await searchContentInDb(supabase, query);
  } catch (error) {
    console.warn(`Supabase search fell back to in-memory filtering: ${error instanceof Error ? error.message : String(error)}`);
  }
  return searchContentInMemory(query);
}

async function searchContentInDb(supabase: NonNullable<Awaited<ReturnType<typeof createClient>>>, query: string) {
  const [news, papers, repos, products, projects] = await Promise.all([
    supabase
      .from('news_items')
      .select('*')
      .or(searchOr(query, ['title', 'summary', 'category', 'source'], ['related_skills', 'topic_tags', 'skill_tags']))
      .not('content', 'is', null)
      .neq('content', '')
      .order('published_at', { ascending: false })
      .limit(SEARCH_LIMITS.articles),
    supabase
      .from('research_papers')
      .select('*')
      .or(searchOr(query, ['title', 'abstract', 'beginner_summary', 'expert_summary', 'review_type', 'source'], ['related_skills']))
      .order('published_at', { ascending: false })
      .limit(PAPER_SEARCH_CANDIDATES),
    supabase
      .from('github_trends')
      .select('*')
      .or(searchOr(query, ['repo_full_name', 'description', 'beginner_summary', 'language'], ['topics', 'topic_tags', 'skill_tags']))
      .order('stars_delta_7d', { ascending: false, nullsFirst: false })
      .order('stars', { ascending: false })
      .limit(SEARCH_LIMITS.repos),
    supabase
      .from('ai_products')
      .select('*')
      .or(searchOr(query, ['name', 'description', 'category', 'target_user'], ['use_cases', 'topic_tags', 'skill_tags']))
      .order('newsletter_priority', { ascending: false, nullsFirst: false })
      .order('launch_date', { ascending: false, nullsFirst: false })
      .order('score', { ascending: false, nullsFirst: false })
      .limit(SEARCH_LIMITS.products),
    supabase
      .from('project_ideas')
      .select('*')
      .or(searchOr(query, ['title', 'description', 'related_trend', 'level'], ['stack']))
      .order('created_at', { ascending: false })
      .limit(SEARCH_LIMITS.projects),
  ]);
  for (const { error } of [news, papers, repos, products, projects]) {
    if (error) throw error;
  }

  const articles = [
    ...((news.data ?? []) as NewsItem[]).filter(hasNewsBody).map(toNewsArticle),
    ...((papers.data ?? []) as ResearchPaper[]).filter(isSeedupRelevantPaper).map(toPaperArticle),
  ].sort(byNewest);

  return {
    articles: articles.slice(0, SEARCH_LIMITS.articles),
    repos: ((repos.data ?? []) as GitHubTrend[]).slice(0, SEARCH_LIMITS.repos),
    products: ((products.data ?? []) as AIProduct[]).slice(0, SEARCH_LIMITS.products),
    projects: ((projects.data ?? []) as ProjectIdea[]).slice(0, SEARCH_LIMITS.projects),
  };
}

/** Same matching as the page used before the DB search; only runs when the DB query cannot. */
async function searchContentInMemory(query: string) {
  const q = query.toLowerCase();
  const matches = (values: Array<string | null | undefined>) => values.some((value) => value?.toLowerCase().includes(q));
  const [articles, repos, products, projects] = await Promise.all([getArticleFeedItems(), getGitHubTrends(), getAIProducts(), getProjectIdeas()]);
  return {
    articles: articles.filter((item) => matches([item.title, item.summary, item.category, item.source, ...(item.related_skills ?? [])])).slice(0, SEARCH_LIMITS.articles),
    repos: repos.filter((repo) => matches([repo.repo_full_name, repo.description, repo.beginner_summary, repo.language, ...(repo.topics ?? [])])).slice(0, SEARCH_LIMITS.repos),
    products: products.filter((product) => matches([product.name, product.description, product.category, product.target_user, ...(product.use_cases ?? []), ...(product.topic_tags ?? []), ...(product.skill_tags ?? [])])).slice(0, SEARCH_LIMITS.products),
    projects: projects.filter((project) => matches([project.title, project.description, project.related_trend, project.level, ...(project.stack ?? [])])).slice(0, SEARCH_LIMITS.projects),
  };
}
