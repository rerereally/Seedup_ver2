import type { MetadataRoute } from 'next';
import { getAIProducts, getGitHubTrends, getNewsItems, getResearchPapers } from '@/lib/data';
import { getOpportunities } from '@/lib/opportunities/data';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://seedup.rerereally.com').replace(/\/+$/, '');

/**
 * Every public page a search engine should find: the curated reads, repos, papers and products, each verified problem,
 * (shared PRD links stay out: their page asks not to be indexed). Private pages (library, profile, admin) are left out and blocked in robots.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [{ opportunities, generatedAt }, news, repos, papers, products] = await Promise.all([
    getOpportunities(),
    getNewsItems().catch(() => []),
    getGitHubTrends().catch(() => []),
    getResearchPapers(60).catch(() => []),
    getAIProducts().catch(() => []),
  ]);
  const entry = (path: string, lastModified?: string | null, priority = 0.5): MetadataRoute.Sitemap[number] => ({ url: `${SITE}${path}`, ...(lastModified ? { lastModified } : {}), priority });
  return [
    entry('/', generatedAt, 1),
    entry('/newsletter-preview', generatedAt, 0.9),
    entry('/news', null, 0.9),
    entry('/news?tab=github', null, 0.8),
    entry('/prd', null, 0.8),
    entry('/about', null, 0.7),
    entry('/guide', null, 0.7),
    entry('/terms', null, 0.2),
    entry('/privacy', null, 0.2),
    entry('/ai-products', null, 0.6),
    entry('/trends', null, 0.6),
    ...opportunities.map((item) => entry(`/opportunities/${item.slug}`, item.lastSeenAt ?? generatedAt, item.qualified ? 0.8 : 0.5)),
    ...news.map((item) => entry(`/news/${item.id}`, item.published_at)),
    ...repos.map((item) => entry(`/github-trends/${item.id}`, item.last_seen_at ?? item.pushed_at)),
    ...papers.map((item) => entry(`/papers/${item.id}`, item.published_at)),
    ...products.map((item) => entry(`/ai-products/${item.id}`, null, 0.4)),
  ];
}
