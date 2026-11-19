// Idea evaluations (the model's reference score), with the user's own client.
import type { SupabaseClient } from '@supabase/supabase-js';

const RECENT_COLUMNS = 'id,idea_text,status,score,result';

/** The user's latest completed evaluation of the same idea since `after`, matched by key or, on older rows, by text. */
export async function cachedEvaluation(supabase: SupabaseClient, userId: string, key: string, idea: string, after: string) {
  const latest = (column: 'evaluation_key' | 'idea_text', value: string) => supabase.from('idea_evaluations').select('id,result').eq('user_id', userId).eq(column, value).eq('status', 'completed').gte('created_at', after).order('created_at', { ascending: false }).limit(1).maybeSingle();
  const byKey = await latest('evaluation_key', key);
  // A database without the evaluation_key column (older schema) errors here, so the text match takes over.
  const byText = byKey.error ? await latest('idea_text', idea) : null;
  return byKey.data ?? byText?.data ?? null;
}

/** Saves an evaluation; on an older schema without evaluation_key the row is saved without it. */
export async function saveEvaluation(supabase: SupabaseClient, record: Record<string, unknown> & { evaluation_key?: unknown }) {
  const first = await supabase.from('idea_evaluations').insert(record).select('id').single();
  if (!first.error) return first;
  const { evaluation_key: _evaluationKey, ...legacy } = record;
  return supabase.from('idea_evaluations').insert(legacy).select('id').single();
}

export function evaluationById(supabase: SupabaseClient, id: string) {
  return supabase.from('idea_evaluations').select(RECENT_COLUMNS).eq('id', id).maybeSingle();
}

export function recentEvaluations(supabase: SupabaseClient, userId: string, limit = 8) {
  return supabase.from('idea_evaluations').select(RECENT_COLUMNS).eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
}
