import type { SupabaseClient } from '@supabase/supabase-js';
import { readOpportunityReviews, type OpportunityReviewRow } from '@/lib/db/opportunity-reviews';
import { tidyName } from './names';
import { isListable, meetsEvidenceBar, normalizeForMatch, uniqueQuotes } from './rules';
import type { Opportunity } from './types';

// From reading every published problem's quotes on 2026-11-18. The engine's prompts already reject these kinds,
// but the free models let them through. Slugs stay the same across runs (merge.ts), so an entry keeps applying.
// Kept as the fallback when the database cannot be read so the site never renders unreviewed or empty.
const HIDDEN: Record<string, string> = {
  'milvus-missing-now-function': 'a feature request only Milvus itself can ship',
  'better-auth-prisma-next-adapter': 'a compatibility request for one library, fixed by its maintainers',
  'ai-latex-rendering-error': 'each quote is a rendering bug in a different product',
  'kagi-mcp-server-missing': 'a request for one vendor, and 9 direct rivals already exist',
  'positive-ai-developer-community': 'an opinion about a community, not a problem software solves',
  'gpu-rental-price-arbitrage': 'a price comparison and a wish to trade, not a pain',
  'international-meeting-time-zone-sync': 'everyday complaints about time zones, a space crowded with mature tools',
};

// Quotes that are verbatim but say something other than the problem they are filed under.
const DROPPED_QUOTES: Record<string, string[]> = {
  'agent-workflow-control': ['This has been raised repeatedly by the community for over 7 months with no acknowledgment from the Anthropic team'],
  'ai-agent-guardrails': ['WHEN ASKED TO REBOOT A SERVER IT WENT BACK ON THE SERVER', 'I wish I could give the agent some more autonomy.'],
  'llm-provider-schema-normalization': ['Amazon Bedrock does not provide an API that returns:'],
  'database-cli-inconsistent-commands': ['manually inspecting payloads would not be quick and easy w/o some custom tooling'],
  'distributed-sqlite-concurrent-writes': ['with an EFS volume for database storage. I never experience errors, but when upgrading'],
};

export function fallbackOpportunityReviews(): OpportunityReviewRow[] {
  return [
    ...Object.entries(HIDDEN).map(([slug, reason]) => ({ slug, kind: 'hide' as const, quote: '', reason })),
    ...Object.entries(DROPPED_QUOTES).flatMap(([slug, quotes]) =>
      quotes.map((quote) => ({ slug, kind: 'drop_quote' as const, quote, reason: 'filed under wrong problem' })),
    ),
  ];
}

function rulesFromRows(rows?: OpportunityReviewRow[] | null) {
  if (!rows?.length) {
    return {
      hidden: new Set(Object.keys(HIDDEN)),
      droppedQuotes: new Map(Object.entries(DROPPED_QUOTES).map(([slug, quotes]) => [slug, new Set(quotes.map(normalizeForMatch))])),
    };
  }
  const hidden = new Set<string>();
  const droppedQuotes = new Map<string, Set<string>>();
  for (const row of rows) {
    if (row.kind === 'hide') {
      hidden.add(row.slug);
    } else if (row.kind === 'drop_quote' && row.quote) {
      const set = droppedQuotes.get(row.slug) ?? new Set<string>();
      set.add(normalizeForMatch(row.quote));
      droppedQuotes.set(row.slug, set);
    }
  }
  return { hidden, droppedQuotes };
}

/** Every list shown to people (site, MCP, mail) passes through here, so a review applies everywhere at once. */
export function tidyOpportunities(items: Opportunity[], reviews?: OpportunityReviewRow[] | null): Opportunity[] {
  const { hidden, droppedQuotes } = rulesFromRows(reviews);
  return items
    .filter((item) => !hidden.has(item.slug))
    .map((item) => {
      const dropped = droppedQuotes.get(item.slug) ?? new Set<string>();
      const evidence = uniqueQuotes(item.evidence.filter((quote) => !dropped.has(normalizeForMatch(quote.quote))));
      const platforms = [...new Set(evidence.map((quote) => quote.platform))];
      return {
        ...item,
        name: tidyName(item.name),
        ...(item.nameEn ? { nameEn: tidyName(item.nameEn) } : {}),
        evidence,
        platforms,
        qualified: meetsEvidenceBar(evidence.length, platforms.length),
      };
    })
    .filter(isListable)
    .sort((a, b) => Number(b.qualified) - Number(a.qualified));
}

/** Reads opportunity reviews from the database and falls back to the bundled constants if the database cannot be read. */
export async function reviewOpportunities(items: Opportunity[], service?: SupabaseClient | null): Promise<Opportunity[]> {
  const rows = await readOpportunityReviews(service);
  return tidyOpportunities(items, rows);
}
