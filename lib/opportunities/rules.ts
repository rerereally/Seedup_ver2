import { MIN_EVIDENCE, MIN_PLATFORMS } from './types';
import type { Evidence, MemoryPain, OpportunityStatus, ReadMemory, SupplyItem } from './types';

export function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/[`"'“”‘’*_>]/g, '').replace(/\s+/g, ' ').trim();
}

/** The trust boundary of the engine: a quote is only kept if it really appears in the source post. */
export function isVerbatimQuote(quote: string, sourceText: string) {
  const normalized = normalizeForMatch(quote);
  return normalized.length >= 15 && normalizeForMatch(sourceText).includes(normalized);
}

/** The same sentence reached through two links (a story and its comment) is one voice, not two posts. */
export function uniqueQuotes<T extends { quote: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = normalizeForMatch(item.quote);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** The people who described the problem, one candidate per source post. */
export function firstUserSources(quotes: Evidence[], limit = 10) {
  const seen = new Set<string>();
  return quotes.filter((row) => !seen.has(row.url) && seen.add(row.url)).slice(0, limit);
}

// shortcut: 30 days picked by eye; after that a post is read again in case it gained replies. Tune once runs show how fast the pool turns over.
export const READ_MEMORY_DAYS = 30;

/**
 * Adds one run to the memory and forgets what is older than READ_MEMORY_DAYS. Pains whose post became evidence are
 * dropped, since the published result already holds them. Called with no reads and no pains it only prunes.
 */
export function rememberRun(memory: ReadMemory | null, read: string[], pains: Array<Omit<MemoryPain, 'readAt'>>, now: string, usedUrls: ReadonlySet<string>): ReadMemory {
  const cutoff = new Date(now).getTime() - READ_MEMORY_DAYS * 86_400_000;
  const recent = (at: string) => new Date(at).getTime() >= cutoff;
  const readAt = Object.fromEntries(Object.entries(memory?.read ?? {}).filter(([, at]) => recent(at)));
  for (const url of read) readAt[url] = now;
  const added = pains.map(({ who, pain, quote, item }) => ({ who, pain, quote, item: { ...item, text: item.text.slice(0, 800) }, readAt: now }));
  const kept = [...(memory?.pains ?? []).filter((pain) => recent(pain.readAt)), ...added].filter((pain) => !usedUrls.has(pain.item.url));
  return { read: readAt, pains: uniqueQuotes(kept) };
}

export function meetsEvidenceBar(evidenceCount: number, platformCount: number) {
  return evidenceCount >= MIN_EVIDENCE && platformCount >= MIN_PLATFORMS;
}

// A maker announcing their own tool is supply, not someone lacking one. Checked on the title and the opening only,
// since a complaint often ends with "so I built a script".
const PROMOTION = /^(show hn\b|launch hn\b|\[?(show|launch)\]?\s*:|introducing\b)|^\W*(i|we) (just )?(built|made|created|launched|released|open[- ]?sourced|wrote)\b|\b(check out|try) (my|our) (new )?(tool|app|project|library|extension|product)\b/i;

/** True for a post whose author is announcing a product rather than describing a problem. */
export function isPromotion(item: { title: string; text: string }) {
  return PROMOTION.test(item.title.trim()) || PROMOTION.test(item.text.trim().slice(0, 160));
}

/** A quote that stops on a colon or comma was cut mid-thought, so a reader cannot tell what the problem is. */
export function isCompleteQuote(quote: string) {
  return !/[:;,，]\s*$/.test(quote.trim());
}

/** One quote from one place is an anecdote, so such a candidate is not listed at all, not even as below the bar. */
export function isListable(item: { evidence: unknown[] }) {
  return item.evidence.length >= 2;
}

/**
 * Greedy clustering: each vector joins the group whose mean it is closest to, if close enough, or starts a new one.
 * Returns groups of indices into `vectors`, in first-seen order.
 */
export function clusterByEmbedding(vectors: number[][], threshold: number) {
  const groups: Array<{ members: number[]; sum: number[] }> = [];
  vectors.forEach((vector, index) => {
    let best: (typeof groups)[number] | null = null;
    let bestScore = threshold;
    for (const group of groups) {
      const score = cosineSimilarity(vector, group.sum);
      if (score >= bestScore) {
        bestScore = score;
        best = group;
      }
    }
    if (!best) {
      groups.push({ members: [index], sum: [...vector] });
      return;
    }
    best.members.push(index);
    // The sum points the same way as the mean, which is all cosine similarity reads.
    for (let i = 0; i < vector.length; i += 1) best.sum[i] += vector[i];
  });
  return groups.map((group) => group.members);
}

export function classifySupply(supply: SupplyItem[], reviewed: boolean): OpportunityStatus {
  if (!reviewed) return 'unknown';
  const direct = supply.filter((item) => item.relation === 'direct');
  const topStars = Math.max(0, ...direct.filter((item) => item.kind === 'github').map((item) => item.popularity));
  // Outside developer tools the incumbent is an app, and its size shows in store ratings, not stars.
  const topRatings = Math.max(0, ...direct.filter((item) => item.kind === 'appstore').map((item) => item.popularity));
  if (direct.length >= 8 || topStars >= 20_000 || topRatings >= 50_000) return 'closed';
  if (direct.length >= 3 || topStars >= 2_000 || topRatings >= 5_000) return 'narrowing';
  return 'open';
}

/** Tools that appeared after the first complaint, which is how we show the signal led the market. */
export function countFollowers(supply: SupplyItem[], firstSeenAt: string | null) {
  if (!firstSeenAt) return 0;
  const first = new Date(firstSeenAt).getTime();
  return supply.filter((item) => item.relation !== 'unrelated' && item.createdAt && new Date(item.createdAt).getTime() > first).length;
}

export function toSlug(value: string, fallback: string) {
  const slug = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
  return slug || fallback;
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return normA && normB ? dot / Math.sqrt(normA * normB) : 0;
}
