import type { SupabaseClient } from '@supabase/supabase-js';

export const AGENT_FEATURE_STATUSES = ['todo', 'in_progress', 'improving', 'done', 'blocked'] as const;
export type AgentFeatureStatus = (typeof AGENT_FEATURE_STATUSES)[number];
export type FeatureStatus = AgentFeatureStatus | 'needs_recheck';

export type BuildProgress = Record<string, { title: string; status: FeatureStatus; note: string; updatedAt: string; doneAt: string | null }>;
export type BuildProgressHistory = Record<string, Array<{ id: string; status: FeatureStatus; note: string; createdAt: string }>>;

/** "F1", "f-1" and "F-01" all name the first feature; anything else is not a feature id. */
export function normalizeFeatureId(value: string) {
  const number = /^\s*f\s*-?\s*0*(\d{1,3})\s*$/i.exec(value)?.[1];
  return number && Number(number) > 0 ? `F-${number.padStart(2, '0')}` : null;
}

/** Reads with whatever client the caller has: the signed-in user's (row level security) or the service role. */
export async function readBuildProgress(client: SupabaseClient | null, userId: string, slug: string): Promise<BuildProgress> {
  if (!client) return {};
  const { data, error } = await client.from('build_progress').select('feature_id,feature_title,status,note,updated_at,done_at').eq('user_id', userId).eq('slug', slug);
  if (error) return {};
  return Object.fromEntries((data ?? []).map((row) => [row.feature_id, {
    title: row.feature_title,
    status: row.status,
    note: row.note,
    updatedAt: row.updated_at,
    doneAt: row.done_at,
  }]));
}

export async function readBuildProgressHistory(client: SupabaseClient | null, userId: string, slug: string): Promise<BuildProgressHistory> {
  if (!client) return {};
  const { data, error } = await client.from('build_progress_events').select('id,feature_id,status,note,created_at')
    .eq('user_id', userId).eq('slug', slug).order('created_at', { ascending: false });
  if (error) return {};
  const history = new Map<string, BuildProgressHistory[string]>();
  for (const row of data ?? []) {
    const events = history.get(row.feature_id) ?? [];
    events.push({ id: row.id, status: row.status, note: row.note, createdAt: row.created_at });
    history.set(row.feature_id, events);
  }
  return Object.fromEntries(history);
}

export async function writeBuildProgress(service: SupabaseClient, userId: string, slug: string, feature: { id: string; title: string }, status: FeatureStatus, note: string) {
  const { data, error } = await service.rpc('write_build_progress', {
    p_user_id: userId,
    p_slug: slug,
    p_feature_id: feature.id,
    p_feature_title: feature.title.slice(0, 200),
    p_status: status,
    p_note: note.slice(0, 500),
  });
  if (error) throw new Error(`build_progress write failed: ${error.message}`);
  return data === true;
}
