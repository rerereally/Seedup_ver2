import { clientOf, rateLimited } from '@/lib/throttle';
import { getOpportunityEmbeddings } from '@/lib/opportunities/data';
import { createEmbedding } from '@/lib/opportunities/llm';
import { rankBySimilarity } from '@/lib/opportunities/match';
import { cosineSimilarity } from '@/lib/opportunities/rules';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_QUERY_LENGTH = 200;
const REQUESTS_PER_MINUTE = 30;
// With nemotron-3-embed-1b, ideas typed on the site score 0.5 to 0.8 against their own problem and 0.24 to 0.28 against
// a problem that only shares a word ("회의록" vs meeting time zones), measured 2026-11-19.
const MIN_SIMILARITY = 0.35;
const SIMILARITY_BAND = 0.06;
const MAX_MATCHES = 5;
const MAX_CACHED_QUERIES = 300;

const queryCache = new Map<string, string[]>();

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim().slice(0, MAX_QUERY_LENGTH) ?? '';
  if (query.length < 2) return NextResponse.json({ slugs: [] });

  const cacheKey = query.toLowerCase();
  const cached = queryCache.get(cacheKey);
  if (cached) return NextResponse.json({ slugs: cached });

  if (await rateLimited(`match:${clientOf(request)}`, REQUESTS_PER_MINUTE)) return NextResponse.json({ slugs: null, reason: 'throttled' }, { status: 429 });

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
