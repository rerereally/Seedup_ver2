import { PLATFORM_LABELS, localizedOpportunity } from './types';
import type { Opportunity } from './types';
import type { MapPoint } from '@/components/OpportunityMap';

const RECENT_DAYS = 90;
const MAX_POINTS = 24;

/** The first quote that reads as a sentence: no shouting, no fragment cut off at a colon. */
function readableQuote(item: Opportunity) {
  const quote = item.evidence.find((row) => row.quote.length >= 30 && row.quote.length <= 240 && row.quote !== row.quote.toUpperCase() && !/[:,]$/.test(row.quote.trim()));
  return quote ? { text: quote.quote, ko: quote.quoteKo || '', source: PLATFORM_LABELS[quote.platform], url: quote.url } : null;
}

/**
 * Places each problem by counted values only: evidence strength (quotes × platforms, log scale) across, and how empty the
 * market is up. A direct competitor counts fully and a tool that covers part of the problem a quarter, so problems with
 * no direct rival still spread by how much is already half-built. Both axes are then stretched to the day's own range,
 * so the map compares today's problems with each other and never bunches into one corner. A small fixed nudge keeps
 * equal problems apart.
 */
export function mapPoints(opportunities: Opportunity[], now = Date.now(), lang: 'ko' | 'en' = 'ko'): MapPoint[] {
  const chosen = [...opportunities].sort((a, b) => Number(b.qualified) - Number(a.qualified) || b.evidence.length - a.evidence.length).slice(0, MAX_POINTS);
  const weight = (item: Opportunity) => Math.log2(1 + item.evidence.length * new Set(item.evidence.map((row) => row.platform)).size);
  const room = (item: Opportunity) => 1 / (1 + item.directCount + item.supply.filter((tool) => tool.relation === 'partial').length / 4);
  const stretch = (values: number[]) => {
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    return (value: number) => (hi > lo ? 0.08 + (0.84 * (value - lo)) / (hi - lo) : 0.5);
  };
  const across = stretch(chosen.map(weight));
  const up = stretch(chosen.map(room));
  const nudge = (index: number, salt: number, spread: number) => ((((index * salt) % 11) - 5) / 5) * spread;
  const clamp = (value: number) => Math.min(0.95, Math.max(0.05, value));
  return chosen.map((item, index) => {
    const platforms = new Set(item.evidence.map((row) => row.platform)).size;
    const text = localizedOpportunity(item, lang);
    return {
      slug: item.slug,
      name: text.name,
      problem: text.problem,
      strength: clamp(across(weight(item)) + nudge(index, 7, 0.02)),
      openness: clamp(up(room(item)) + nudge(index, 5, 0.03)),
      evidence: item.evidence.length,
      platforms,
      direct: item.directCount,
      recent: item.evidence.filter((row) => row.postedAt && now - new Date(row.postedAt).getTime() < RECENT_DAYS * 86_400_000).length,
      qualified: item.qualified,
      quote: readableQuote(item),
    };
  });
}
