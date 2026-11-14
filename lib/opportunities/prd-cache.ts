import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Spec, SpecInput } from './spec';

/** Same quotes, same key, whatever order they were picked in. */
export const prdCacheKey = (evidenceIds: string[]) => createHash('sha256').update([...evidenceIds].sort().join(',')).digest('hex').slice(0, 40);

export async function readPrdCache(service: SupabaseClient | null, evidenceIds: string[]) {
  if (!service || !evidenceIds.length) return null;
  const { data } = await service.from('prd_cache').select('input,spec,created_at').eq('evidence_key', prdCacheKey(evidenceIds)).maybeSingle();
  return data ? { input: data.input as SpecInput, spec: data.spec as Spec, createdAt: String(data.created_at) } : null;
}

export async function writePrdCache(service: SupabaseClient | null, evidenceIds: string[], input: SpecInput, spec: Spec) {
  if (!service || !evidenceIds.length) return;
  const { error } = await service.from('prd_cache').upsert({ evidence_key: prdCacheKey(evidenceIds), input, spec, created_at: new Date().toISOString() });
  if (error) console.error('PRD cache write failed', error.message);
}
