import type { SupabaseClient } from '@supabase/supabase-js';
import { getContentHref } from '@/lib/content-targets';
import type { KeptItem, KeptType } from './server';

/**
 * The user's kept items for the MCP tool. Repositories carry their GitHub address and basic facts, read from the
 * collected repo row; everything else links to its page on the site.
 */
export async function readKept(service: SupabaseClient, userId: string, type: KeptType | null, limit: number, siteUrl: string): Promise<KeptItem[]> {
  let query = service.from('scraps').select('item_type,item_id,title,description,tag,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
  query = type ? query.eq('item_type', type) : query.in('item_type', ['github', 'news', 'paper', 'ai_product', 'project']);
  const { data, error } = await query;
  if (error || !data?.length) return [];

  const repoIds = data.filter((row) => row.item_type === 'github' && row.item_id).map((row) => String(row.item_id));
  const repos = new Map<string, { repo_url: string; language: string | null; stars: number | null }>();
  if (repoIds.length) {
    const { data: rows } = await service.from('github_trends').select('id,repo_url,language,stars').in('id', repoIds);
    for (const row of rows ?? []) repos.set(String(row.id), row);
  }

  return data.map((row) => {
    const page = `${siteUrl}${getContentHref(String(row.item_type), row.item_id ? String(row.item_id) : null)}`;
    const repo = row.item_type === 'github' ? repos.get(String(row.item_id)) : undefined;
    const facts = repo ? [repo.language, repo.stars ? `${repo.stars} stars` : null].filter(Boolean).join(', ') : '';
    return { type: String(row.item_type), title: String(row.title), note: row.description ? String(row.description).slice(0, 280) : null, url: repo?.repo_url || page, page, savedAt: String(row.created_at), extra: facts || undefined };
  });
}
