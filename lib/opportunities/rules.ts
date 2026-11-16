import { MIN_EVIDENCE, MIN_PLATFORMS } from './types';
import type { OpportunityStatus, SupplyItem } from './types';

export function normalizeForMatch(value: string) {
  return value.toLowerCase().replace(/[`"'“”‘’*_>]/g, '').replace(/\s+/g, ' ').trim();
}

/** The trust boundary of the engine: a quote is only kept if it really appears in the source post. */
export function isVerbatimQuote(quote: string, sourceText: string) {
  const normalized = normalizeForMatch(quote);
  return normalized.length >= 15 && normalizeForMatch(sourceText).includes(normalized);
}

export function meetsEvidenceBar(evidenceCount: number, platformCount: number) {
  return evidenceCount >= MIN_EVIDENCE && platformCount >= MIN_PLATFORMS;
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
