import { tidyName } from './names';
import { isListable, meetsEvidenceBar, normalizeForMatch, uniqueQuotes } from './rules';
import type { Opportunity } from './types';

// From reading every published problem's quotes on 2026-11-18. The engine's prompts already reject these kinds,
// but the free models let them through. Slugs stay the same across runs (merge.ts), so an entry keeps applying.
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

/** Every list shown to people (site, MCP, mail) passes through here, so a review applies everywhere at once. */
export function tidyOpportunities(items: Opportunity[]): Opportunity[] {
  return items
    .filter((item) => !HIDDEN[item.slug])
    .map((item) => {
      const dropped = new Set((DROPPED_QUOTES[item.slug] ?? []).map(normalizeForMatch));
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
