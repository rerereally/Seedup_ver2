import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Spec, SpecInput } from './spec';

/** A PRD is made from at most this many quotes; the API and the PRD page cut the list the same way. */
export const PRD_MAX_EVIDENCE = 12;

/** Same quotes, same key, whatever order they were picked in. */
export const prdCacheKey = (evidenceIds: string[]) => createHash('sha256').update([...evidenceIds].sort().join(',')).digest('hex').slice(0, 40);

export async function readPrdCache(service: SupabaseClient | null, evidenceIds: string[]) {
  if (!service || !evidenceIds.length) return null;
  const { data } = await service.from('prd_cache').select('input,spec,created_at').eq('evidence_key', prdCacheKey(evidenceIds)).maybeSingle();
  return data ? { input: data.input as SpecInput, spec: data.spec as Spec, createdAt: String(data.created_at) } : null;
}

/**
 * Fallback lookup by opportunity title so an active MCP build does not lose its cached PRD
 * when the daily engine appends a new quote and changes the exact evidence_key hash.
 */
export async function readLatestPrdCacheForTitle(service: SupabaseClient | null, title: string) {
  const trimmed = title.trim();
  if (!service || !trimmed) return null;
  const { data } = await service
    .from('prd_cache')
    .select('input,spec,created_at')
    .eq('input->>title', trimmed)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { input: data.input as SpecInput, spec: data.spec as Spec, createdAt: String(data.created_at) } : null;
}

export async function writePrdCache(service: SupabaseClient | null, evidenceIds: string[], input: SpecInput, spec: Spec) {
  if (!service || !evidenceIds.length) return;
  const { error } = await service.from('prd_cache').upsert({ evidence_key: prdCacheKey(evidenceIds), input, spec, created_at: new Date().toISOString() });
  if (error) console.error('PRD cache write failed', error.message);
}

/** The first of these opportunities that already has a saved PRD, so the front page can link straight to a filled one. */
export async function samplePrdSlug(service: SupabaseClient | null, candidates: Array<{ slug: string; evidence: Array<{ id: string }> }>) {
  for (const item of candidates) {
    if (await readPrdCache(service, item.evidence.slice(0, PRD_MAX_EVIDENCE).map((row) => row.id))) return item.slug;
  }
  return null;
}
