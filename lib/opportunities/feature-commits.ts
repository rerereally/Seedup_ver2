import type { SupabaseClient } from '@supabase/supabase-js';
import type { BuildProgress } from './build-progress';

export type FeatureCommit = { id: string; feature_id: string; sha: string; message: string; files: string[]; created_at: string; dismissed_at: string | null };
export type FeatureCommitSummary = Record<string, { count: number; files: string[] }>;

export async function writeFeatureCommit(
  service: SupabaseClient, userId: string, slug: string,
  link: { sha: string; message: string; files: string[]; featureIds: string[] },
) {
  const featureIds = link.featureIds.length ? link.featureIds : [''];
  const rows = featureIds.map((featureId) => ({
    user_id: userId, slug, feature_id: featureId, sha: link.sha, message: link.message, files: link.files,
  }));
  const { error } = await service.from('feature_commits').upsert(rows, {
    onConflict: 'user_id,slug,sha,feature_id', ignoreDuplicates: true,
  });
  if (error) throw new Error(`feature_commits write failed: ${error.message}`);
}

export async function readFeatureCommits(client: SupabaseClient, userId: string, slug: string, before?: string) {
  const rows: FeatureCommit[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const query = client.from('feature_commits').select('id,feature_id,sha,message,files,created_at,dismissed_at')
      .eq('user_id', userId).eq('slug', slug);
    if (before) query.lt('created_at', before);
    const { data, error } = await query
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`feature_commits read failed: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
}

export function unlinkedFeatureCommits(rows: FeatureCommit[]) {
  return rows.filter((row) => row.feature_id === '' && row.dismissed_at === null);
}

export async function countUnlinkedCommits(client: SupabaseClient, userId: string, slug: string) {
  const { count, error } = await client.from('feature_commits').select('id', { count: 'exact', head: true })
    .eq('user_id', userId).eq('slug', slug).eq('feature_id', '').is('dismissed_at', null);
  if (error) throw new Error(`feature_commits count failed: ${error.message}`);
  return count ?? 0;
}

export function dismissUnlinkedCommit(client: SupabaseClient, userId: string, id: string) {
  return client.from('feature_commits').update({ dismissed_at: new Date().toISOString() })
    .eq('user_id', userId).eq('id', id).eq('feature_id', '').select('id').maybeSingle();
}

export function summarizeFeatureCommits(rows: FeatureCommit[]): FeatureCommitSummary {
  const grouped = new Map<string, { count: number; files: Set<string> }>();
  for (const row of rows) {
    if (!row.feature_id) continue;
    const group = grouped.get(row.feature_id) ?? { count: 0, files: new Set<string>() };
    group.count += 1;
    for (const file of row.files) group.files.add(file);
    grouped.set(row.feature_id, group);
  }
  return Object.fromEntries([...grouped].map(([id, { count, files }]) => [id, { count, files: [...files] }]));
}

export async function featureFiles(client: SupabaseClient, userId: string, slug: string, beforeSha?: string): Promise<Record<string, string[]>> {
  let before: string | undefined;
  if (beforeSha) {
    const { data, error } = await client.from('feature_commits').select('created_at')
      .eq('user_id', userId).eq('slug', slug).eq('sha', beforeSha)
      .order('created_at').limit(1).single();
    if (error) throw new Error(`feature_commits timestamp read failed: ${error.message}`);
    before = data.created_at;
  }
  const summary = summarizeFeatureCommits(await readFeatureCommits(client, userId, slug, before));
  return Object.fromEntries(Object.entries(summary).map(([id, { files }]) => [id, files]));
}

export function touchedDoneFeatures(progress: BuildProgress, linkedFiles: Record<string, string[]>, files: string[], ownFeatures: ReadonlySet<string>) {
  const changed = new Set(files);
  return Object.entries(linkedFiles).flatMap(([id, paths]) => {
    if (ownFeatures.has(id) || progress[id]?.status !== 'done') return [];
    const overlap = paths.filter((path) => changed.has(path));
    return overlap.length ? [{ id, files: overlap }] : [];
  });
}
