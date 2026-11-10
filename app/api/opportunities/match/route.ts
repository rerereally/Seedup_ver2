import { getOpportunityEmbeddings } from '@/lib/opportunities/data';
import { createEmbedding } from '@/lib/opportunities/llm';
import { rankBySimilarity } from '@/lib/opportunities/match';
import { cosineSimilarity } from '@/lib/opportunities/rules';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_QUERY_LENGTH = 200;
const REQUESTS_PER_MINUTE = 30;
const MIN_SIMILARITY = 0.32;
const SIMILARITY_BAND = 0.06;
const MAX_MATCHES = 5;
const MAX_CACHED_QUERIES = 300;

// Per-instance, best effort. It keeps one visitor from burning the free embedding quota.
const recentRequests = new Map<string, number[]>();
const queryCache = new Map<string, string[]>();

function isThrottled(key: string) {
  const now = Date.now();
  const recent = (recentRequests.get(key) ?? []).filter((time) => now - time < 60_000);
  if (recent.length >= REQUESTS_PER_MINUTE) return true;
  recent.push(now);
  recentRequests.set(key, recent);
  if (recentRequests.size > 2_000) recentRequests.clear();
  return false;
}

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, MAX_QUERY_LENGTH) ?? '';
  if (query.length < 2) return NextResponse.json({ slugs: [] });

  const cacheKey = query.toLowerCase();
  const cached = queryCache.get(cacheKey);
  if (cached) return NextResponse.json({ slugs: cached });

  const client = request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (isThrottled(client)) return NextResponse.json({ slugs: null, reason: 'throttled' }, { status: 429 });

  // The page keeps its keyword result whenever this cannot answer, so failures are not user-facing.
  const embedding = await createEmbedding(query, { timeoutMs: 7_000 });
  if (!embedding) return NextResponse.json({ slugs: null, reason: 'unavailable' });

  const stored = await getOpportunityEmbeddings();
  const scores = Object.entries(stored).map(([slug, vector]) => ({ slug, score: cosineSimilarity(embedding, vector) }));
  const slugs = rankBySimilarity(scores, MIN_SIMILARITY, SIMILARITY_BAND, MAX_MATCHES);

  if (queryCache.size >= MAX_CACHED_QUERIES) queryCache.clear();
  queryCache.set(cacheKey, slugs);
  return NextResponse.json({ slugs });
}
