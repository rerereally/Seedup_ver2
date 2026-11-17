import type { SupabaseClient } from '@supabase/supabase-js';

/** Features a coding agent marked done through MCP, per user and opportunity. Keyed by feature id (F-01). */
export type BuildProgress = Record<string, { title: string; note: string; doneAt: string }>;

/** "F1", "f-1" and "F-01" all name the first feature; anything else is not a feature id. */
export function normalizeFeatureId(value: string) {
  const number = /^\s*f\s*-?\s*0*(\d{1,3})\s*$/i.exec(value)?.[1];
  return number && Number(number) > 0 ? `F-${number.padStart(2, '0')}` : null;
}

/** Reads with whatever client the caller has: the signed-in user's (row level security) or the service role. */
export async function readBuildProgress(client: SupabaseClient | null, userId: string, slug: string): Promise<BuildProgress> {
  if (!client) return {};
  const { data, error } = await client.from('build_progress').select('feature_id,feature_title,note,done_at').eq('user_id', userId).eq('slug', slug);
  // Before supabase/build_progress_2026_11.sql is run the table is missing, and the PRD simply shows no progress.
  if (error) return {};
  return Object.fromEntries((data ?? []).map((row) => [String(row.feature_id), { title: String(row.feature_title ?? ''), note: String(row.note ?? ''), doneAt: String(row.done_at) }]));
}

export async function writeBuildProgress(service: SupabaseClient, userId: string, slug: string, feature: { id: string; title: string }, done: boolean, note: string) {
  const query = done
    ? service.from('build_progress').upsert({ user_id: userId, slug, feature_id: feature.id, feature_title: feature.title.slice(0, 200), note: note.slice(0, 500), done_at: new Date().toISOString() }, { onConflict: 'user_id,slug,feature_id' })
    : service.from('build_progress').delete().eq('user_id', userId).eq('slug', slug).eq('feature_id', feature.id);
  const { error } = await query;
  if (error) throw new Error(`build_progress write failed: ${error.message}`);
}
