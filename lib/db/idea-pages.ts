// Idea pages with a waitlist. The owner's pages go through their client and row-level security; a visitor joining a
// waitlist and the public page itself use the service key, since a visitor owns neither row.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_SIGNUPS_PER_PAGE = 2000;

/** The owner's pages with how many people joined each waitlist. */
export async function ownerPages(supabase: SupabaseClient) {
  const { data, error } = await supabase.from('idea_pages').select('id,slug,idea,headline,created_at,waitlist_signups(count)').order('created_at', { ascending: false });
  return error ? null : (data ?? []).map(({ waitlist_signups: signups, ...row }) => ({ ...row, signups: Number((signups as Array<{ count: number }> | null)?.[0]?.count ?? 0) }));
}

export async function countOwnerPages(supabase: SupabaseClient) {
  const { count } = await supabase.from('idea_pages').select('id', { count: 'exact', head: true });
  return count ?? 0;
}

export function createPage(supabase: SupabaseClient, row: Record<string, unknown>) {
  return supabase.from('idea_pages').insert(row).select('id,slug').single();
}

export function deletePage(supabase: SupabaseClient, userId: string, id: string) {
  return supabase.from('idea_pages').delete().eq('id', id).eq('user_id', userId);
}

/** The waitlist of one of the owner's pages, oldest first; null when the page is not theirs. */
export async function ownerWaitlist(supabase: SupabaseClient, userId: string, slug: string) {
  const { data: page } = await supabase.from('idea_pages').select('id').eq('slug', slug).eq('user_id', userId).maybeSingle();
  if (!page) return null;
  const { data } = await supabase.from('waitlist_signups').select('email,created_at').eq('page_id', page.id).order('created_at', { ascending: true });
  return (data ?? []) as Array<{ email: string; created_at: string }>;
}

/** A public idea page's copy, or null. */
export async function publicPage(slug: string) {
  const { data } = (await createAdminClient()?.from('idea_pages').select('headline,pitch').eq('slug', slug).maybeSingle()) ?? { data: null };
  return data;
}

/** A visitor joins a waitlist: `ok`, or why not. */
export async function joinWaitlist(slug: string, email: string): Promise<'ok' | 'unavailable' | 'missing' | 'full' | 'error'> {
  const service = createAdminClient();
  if (!service) return 'unavailable';
  const { data: page } = await service.from('idea_pages').select('id').eq('slug', slug).maybeSingle();
  if (!page) return 'missing';
  const { count } = await service.from('waitlist_signups').select('id', { count: 'exact', head: true }).eq('page_id', page.id);
  if ((count ?? 0) >= MAX_SIGNUPS_PER_PAGE) return 'full';
  const { error } = await service.from('waitlist_signups').upsert({ page_id: page.id, email }, { onConflict: 'page_id,email', ignoreDuplicates: true });
  return error ? 'error' : 'ok';
}
