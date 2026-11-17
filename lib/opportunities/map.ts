import { PLATFORM_LABELS } from './types';
import type { Opportunity } from './types';
import type { MapPoint } from '@/components/OpportunityMap';

const RECENT_DAYS = 90;
const MAX_POINTS = 24;

/** The first quote that reads as a sentence: no shouting, no fragment cut off at a colon. */
function readableQuote(item: Opportunity) {
  const quote = item.evidence.find((row) => row.quote.length >= 30 && row.quote.length <= 240 && row.quote !== row.quote.toUpperCase() && !/[:,]$/.test(row.quote.trim()));
  return quote ? { text: quote.quote, source: PLATFORM_LABELS[quote.platform], url: quote.url } : null;
}

/**
 * Places each problem by counted values only: evidence strength (quotes × platforms, log scale) across, and how empty the
 * market is (fewer direct competitors) up. A small fixed nudge per point keeps equal problems from hiding each other.
 */
export function mapPoints(opportunities: Opportunity[], now = Date.now()): MapPoint[] {
  const chosen = [...opportunities].sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.evidence.length - a.evidence.length).slice(0, MAX_POINTS);
  const weight = (item: Opportunity) => Math.log2(1 + item.evidence.length * new Set(item.evidence.map((row) => row.platform)).size);
  const top = Math.max(1, ...chosen.map(weight));
  // Most problems have no direct competitor yet, so they share a height; the nudge spreads them into a readable band.
  const nudge = (index: number, salt: number, spread: number) => ((((index * salt) % 11) - 5) / 5) * spread;
  const clamp = (value: number) => Math.min(0.95, Math.max(0.05, value));
  return chosen.map((item, index) => {
    const platforms = new Set(item.evidence.map((row) => row.platform)).size;
    return {
      slug: item.slug,
      name: item.name,
      problem: item.problem,
      strength: clamp(weight(item) / top + nudge(index, 7, 0.02)),
      openness: clamp(1 / (1 + item.directCount) - 0.06 + nudge(index, 5, 0.07)),
      evidence: item.evidence.length,
      platforms,
      direct: item.directCount,
      recent: item.evidence.filter((row) => row.postedAt && now - new Date(row.postedAt).getTime() < RECENT_DAYS * 86_400_000).length,
      qualified: item.qualified,
      quote: readableQuote(item),
    };
  });
}
