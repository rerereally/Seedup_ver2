import { normalizeForMatch } from './rules';
import type { Opportunity } from './types';

const MAX_CANDIDATES = 3;

export function selectCompareOpportunities(slugs: string | string[] | undefined, opportunities: readonly Opportunity[]) {
  const values = typeof slugs === 'string' ? [slugs] : slugs ?? [];
  const requested = new Set(values.flatMap((value) => value.split(',')).map((slug) => slug.trim()).filter(Boolean));
  const bySlug = new Map(opportunities.map((item) => [item.slug, item]));
  const matches = [...requested].flatMap((slug) => bySlug.get(slug) ?? []);
  return {
    candidates: matches.slice(0, MAX_CANDIDATES),
    hasUnknownSlugs: matches.length < requested.size,
    hasExtraSlugs: matches.length > MAX_CANDIDATES,
  };
}

export function similarCompareSlugs(anchor: Opportunity, opportunities: readonly Opportunity[]) {
  const keywords = [...new Set(anchor.keywords.map(normalizeForMatch).filter(Boolean))];
  const related = opportunities
    .filter((item) => item.qualified && item.slug !== anchor.slug)
    .map((item) => {
      const candidateKeywords = new Set(item.keywords.map(normalizeForMatch));
      return { slug: item.slug, shared: keywords.filter((keyword) => candidateKeywords.has(keyword)).length };
    })
    .filter((item) => item.shared > 0)
    .sort((a, b) => b.shared - a.shared)
    .slice(0, MAX_CANDIDATES - 1);
  return [anchor.slug, ...related.map((item) => item.slug)];
}
