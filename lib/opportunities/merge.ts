import { cosineSimilarity, countFollowers, meetsEvidenceBar } from './rules';
import type { Evidence, Opportunity, OpportunityPoint, OpportunitySnapshot, SupplyItem } from './types';

// Measured on two runs over the same posts: the same problem scored 0.55 to 0.90, different problems at most 0.46.
const SAME_PROBLEM_SIMILARITY = 0.68;
const SAME_PROBLEM_SHARED_POSTS = 2;
const MAX_MERGED_EVIDENCE = 12;
const MAX_SUPPLY = 8;
const MAX_KEYWORDS = 14;
const MAX_HISTORY = 30;
const STALE_AFTER_DAYS = 21;
const STATUS_RANK = { open: 0, narrowing: 1, unknown: 2, closed: 3 };
const STATUS_WORDS = { open: '열림', narrowing: '좁아지는 중', closed: '닫힘', unknown: '조사 중' };

type Run = { opportunities: Opportunity[]; embeddings: Record<string, number[]> };
export type MergeSummary = { added: string[]; grown: string[]; statusChanged: string[]; carried: number; expired: string[] };

function sameProblem(a: Opportunity, b: Opportunity, embeddingA?: number[], embeddingB?: number[]) {
  if (a.slug === b.slug) return 2;
  const urls = new Set(a.evidence.map((item) => item.url));
  const shared = b.evidence.filter((item) => urls.has(item.url)).length;
  const similarity = embeddingA && embeddingB ? cosineSimilarity(embeddingA, embeddingB) : 0;
  if (shared >= SAME_PROBLEM_SHARED_POSTS || similarity >= SAME_PROBLEM_SIMILARITY) return Math.max(similarity, shared / 10);
  return 0;
}

function point(item: Opportunity, at: string): OpportunityPoint {
  return { at, evidence: item.evidence.length, platforms: item.platforms.length, direct: item.directCount, status: item.status, qualified: item.qualified };
}

const samePoint = (a: OpportunityPoint, b: OpportunityPoint) => a.evidence === b.evidence && a.platforms === b.platforms && a.direct === b.direct && a.status === b.status && a.qualified === b.qualified;

function unionEvidence(older: Evidence[], newer: Evidence[]) {
  const byUrl = new Map<string, Evidence>();
  // The newer copy wins, except that a translation already made is never thrown away.
  for (const item of [...older, ...newer]) byUrl.set(item.url, { ...item, quoteKo: item.quoteKo || byUrl.get(item.url)?.quoteKo || '' });
  return [...byUrl.values()].sort((a, b) => b.score - a.score).slice(0, MAX_MERGED_EVIDENCE);
}

function unionSupply(older: SupplyItem[], newer: SupplyItem[]) {
  const byUrl = new Map<string, SupplyItem>();
  for (const item of [...older, ...newer]) byUrl.set(item.url, item);
  return [...byUrl.values()].sort((a, b) => (a.relation === b.relation ? b.popularity - a.popularity : a.relation === 'direct' ? -1 : 1)).slice(0, MAX_SUPPLY);
}

/**
 * Folds a new run into the published result instead of replacing it. Free models find only part of the
 * picture each time, so evidence for the same problem adds up across runs and a weak run loses nothing.
 */
export function mergeRuns(previous: (Run & { generatedAt: string }) | null, next: Run, now: string): { opportunities: Opportunity[]; embeddings: Record<string, number[]>; summary: MergeSummary } {
  const summary: MergeSummary = { added: [], grown: [], statusChanged: [], carried: 0, expired: [] };
  const embeddings: Record<string, number[]> = {};
  const merged: Opportunity[] = [];
  const remaining = new Map((previous?.opportunities ?? []).map((item) => [item.slug, item]));
  const taken = new Set<string>();

  for (const fresh of next.opportunities) {
    let match: Opportunity | null = null;
    let best = 0;
    for (const old of remaining.values()) {
      const score = sameProblem(old, fresh, previous?.embeddings[old.slug], next.embeddings[fresh.slug]);
      if (score > best) {
        best = score;
        match = old;
      }
    }

    if (!match) {
      let slug = fresh.slug;
      while (taken.has(slug) || remaining.has(slug)) slug = `${slug}-2`;
      taken.add(slug);
      const added = { ...fresh, slug, lastSeenAt: now };
      merged.push({ ...added, history: [point(added, now)] });
      if (next.embeddings[fresh.slug]) embeddings[slug] = next.embeddings[fresh.slug];
      if (previous) summary.added.push(fresh.name);
      continue;
    }

    remaining.delete(match.slug);
    taken.add(match.slug);
    const evidence = unionEvidence(match.evidence, fresh.evidence);
    const platforms = [...new Set(evidence.map((item) => item.platform))];
    const dates = evidence.flatMap((item) => (item.postedAt ? [item.postedAt] : [])).sort();
    const firstSeenAt = dates[0] ?? match.firstSeenAt ?? fresh.firstSeenAt;
    const supply = unionSupply(match.supply, fresh.supply);
    // The link and the name stay as first published, so saved links and dossiers keep working.
    const grown: Opportunity = {
      ...fresh,
      slug: match.slug,
      name: match.name,
      problem: match.problem,
      gap: fresh.gap || match.gap,
      keywords: [...new Set([...match.keywords, ...fresh.keywords])].slice(0, MAX_KEYWORDS),
      // A run that could not review supply must not erase a status an earlier run established.
      status: fresh.status === 'unknown' ? match.status : fresh.status,
      evidence,
      platforms,
      qualified: meetsEvidenceBar(evidence.length, platforms.length),
      supply,
      directCount: fresh.status === 'unknown' ? match.directCount : fresh.directCount,
      firstSeenAt,
      followersAfterSignal: countFollowers(supply, firstSeenAt),
      lastSeenAt: now,
    };
    const history = match.history?.length ? match.history : [point(match, match.lastSeenAt ?? previous?.generatedAt ?? now)];
    const latest = point(grown, now);
    grown.history = (samePoint(history[history.length - 1], latest) ? history : [...history, latest]).slice(-MAX_HISTORY);
    merged.push(grown);
    embeddings[match.slug] = previous?.embeddings[match.slug] ?? next.embeddings[fresh.slug];
    if (evidence.length > match.evidence.length) summary.grown.push(`${match.name} ${match.evidence.length}→${evidence.length}`);
    if (grown.status !== match.status) summary.statusChanged.push(`${match.name} ${match.status}→${grown.status}`);
  }

  const staleBefore = new Date(now).getTime() - STALE_AFTER_DAYS * 86_400_000;
  for (const old of remaining.values()) {
    const lastSeenAt = old.lastSeenAt ?? previous?.generatedAt ?? now;
    if (new Date(lastSeenAt).getTime() < staleBefore) {
      summary.expired.push(old.name);
      continue;
    }
    merged.push({ ...old, lastSeenAt, history: old.history?.length ? old.history : [point(old, lastSeenAt)] });
    if (previous?.embeddings[old.slug]) embeddings[old.slug] = previous.embeddings[old.slug];
    summary.carried += 1;
  }

  merged.sort((a, b) => Number(b.qualified) - Number(a.qualified) || STATUS_RANK[a.status] - STATUS_RANK[b.status] || b.evidence.length - a.evidence.length);
  return { opportunities: merged, embeddings, summary };
}

/** What changed since the point before the latest one, in the words shown on the opportunity page. */
export function describeChange(before: OpportunityPoint, after: OpportunityPoint) {
  const parts: string[] = [];
  if (after.evidence !== before.evidence) parts.push(`증언 ${before.evidence}건 → ${after.evidence}건`);
  if (after.platforms !== before.platforms) parts.push(`플랫폼 ${before.platforms}종 → ${after.platforms}종`);
  if (after.direct !== before.direct) parts.push(`직접 경쟁 ${before.direct}개 → ${after.direct}개`);
  if (after.status !== before.status) parts.push(`${STATUS_WORDS[before.status]} → ${STATUS_WORDS[after.status]}`);
  if (after.qualified !== before.qualified) parts.push(after.qualified ? '근거 기준 통과' : '근거 기준 미달로 내려감');
  return parts;
}

export function applyMerge(snapshot: OpportunitySnapshot, opportunities: Opportunity[]): OpportunitySnapshot {
  return { ...snapshot, opportunities, stats: { ...snapshot.stats, candidates: opportunities.length, qualified: opportunities.filter((item) => item.qualified).length } };
}

