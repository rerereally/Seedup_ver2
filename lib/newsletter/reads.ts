import type { SupabaseClient } from '@supabase/supabase-js';
import type { AIProduct, GitHubTrend, NewsItem, ProjectIdea, ResearchPaper } from '@/lib/data';
import { isRecommendableNewsItem, pickNewsletterSections, toNewsletterContentItems } from '@/lib/recommendations';
import type { NewsletterContentItem, ScoredNewsletterItem } from '@/lib/recommendations';
import type { DigestRead } from './opportunity-digest';

export const READS_PER_ISSUE = 5;

// The order a reader meets the sections in: today's briefing first, then one pick from each kind.
const SECTION_ORDER = ['dailyBriefing', 'productRadar', 'githubPick', 'buildIdea', 'careerTip', 'deepDive', 'paperToProject'] as const;

/** The curated candidates for one issue: recent articles, papers, products, repos and build ideas, read once for everyone. */
export async function loadReadCandidates(service: SupabaseClient): Promise<NewsletterContentItem[]> {
  const [news, papers, products, repos, projects] = await Promise.all([
    service.from('news_items').select('*').not('content', 'is', null).order('published_at', { ascending: false }).limit(40),
    service.from('research_papers').select('*').order('published_at', { ascending: false }).limit(15),
    service.from('ai_products').select('*').order('launch_date', { ascending: false, nullsFirst: false }).limit(20),
    service.from('github_trends').select('*').order('stars', { ascending: false }).limit(20),
    service.from('project_ideas').select('*').order('created_at', { ascending: false }).limit(20),
  ]);
  return toNewsletterContentItems({
    news: ((news.data ?? []) as NewsItem[]).filter(isRecommendableNewsItem),
    papers: (papers.data ?? []) as ResearchPaper[],
    products: (products.data ?? []) as AIProduct[],
    repos: (repos.data ?? []) as GitHubTrend[],
    projects: (projects.data ?? []) as ProjectIdea[],
  });
}

/** The issue's reads: the best of each section, in section order, with the first reason the reader would care. */
export function pickReads(scored: ScoredNewsletterItem[], limit = READS_PER_ISSUE): DigestRead[] {
  const sections = pickNewsletterSections(scored);
  return SECTION_ORDER.flatMap((key) => sections[key]).slice(0, limit).map(({ content, reasons }) => ({
    title: content.title,
    href: content.href,
    source: content.sourceLabel,
    reason: reasons[0] ?? null,
  }));
}
