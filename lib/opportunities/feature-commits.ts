import type { SupabaseClient } from '@supabase/supabase-js';

export type FeatureCommit = { id: string; feature_id: string; sha: string; message: string; files: string[]; created_at: string };
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

export async function readFeatureCommits(client: SupabaseClient, userId: string, slug: string) {
  const rows: FeatureCommit[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await client.from('feature_commits').select('id,feature_id,sha,message,files,created_at')
      .eq('user_id', userId).eq('slug', slug)
      .order('created_at', { ascending: false }).order('id', { ascending: false })
      .range(offset, offset + pageSize - 1);
    if (error) throw new Error(`feature_commits read failed: ${error.message}`);
    rows.push(...data);
    if (data.length < pageSize) return rows;
  }
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

export async function featureFiles(client: SupabaseClient, userId: string, slug: string): Promise<Record<string, string[]>> {
  const summary = summarizeFeatureCommits(await readFeatureCommits(client, userId, slug));
  return Object.fromEntries(Object.entries(summary).map(([id, { files }]) => [id, files]));
}
