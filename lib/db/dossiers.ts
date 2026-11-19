// Saved evidence and PRDs (evidence_dossiers). A user's own rows go through their client and row-level security;
// every write also names the user so it stays safe if a policy ever changes. Shared PRDs and built examples are
// public by the owner's choice and are read with the service key.
import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';

export function saveDossier(supabase: SupabaseClient, row: Record<string, unknown>) {
  return supabase.from('evidence_dossiers').upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'user_id,dossier_key' }).select('id').single();
}

export function deleteDossier(supabase: SupabaseClient, userId: string, id: string) {
  return supabase.from('evidence_dossiers').delete().eq('id', id).eq('user_id', userId);
}

/** Changes a saved PRD the user owns; rows without a PRD are left alone. */
export function updateSavedPrd(supabase: SupabaseClient, userId: string, id: string, patch: Record<string, unknown>) {
  return supabase.from('evidence_dossiers').update(patch).eq('id', id).eq('user_id', userId).not('prd_markdown', 'is', null).select('id').maybeSingle();
}

/** The user's latest saved items. '*' so the page keeps working before optional columns (dossier_share) exist. */
export async function recentDossiers<T>(supabase: SupabaseClient | null, limit: number): Promise<T[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from('evidence_dossiers').select('*').order('updated_at', { ascending: false }).limit(limit);
  return error ? [] : ((data ?? []) as T[]);
}

/** The user's saved PRDs, newest first. */
export async function myPrds<T>(supabase: SupabaseClient, userId: string, limit: number): Promise<T[]> {
  const { data, error } = await supabase.from('evidence_dossiers').select('id,title,opportunity_slug,evidence_ids,prd_markdown,updated_at').eq('user_id', userId).order('updated_at', { ascending: false }).limit(limit);
  return error ? [] : ((data ?? []) as T[]);
}

/** The problems this user already saved evidence for. */
export function savedOpportunitySlugs(supabase: SupabaseClient) {
  return supabase.from('evidence_dossiers').select('opportunity_slug').not('opportunity_slug', 'is', null).limit(50);
}

/** What people built from one problem, from PRDs their owners made public with a link (built.sql). */
export async function builtExamples(slug: string) {
  const { data, error } = (await createAdminClient()?.from('evidence_dossiers').select('id,title,built_url,built_note,built_at').eq('opportunity_slug', slug).eq('shared', true).not('built_at', 'is', null).order('built_at', { ascending: false }).limit(6)) ?? { data: null, error: null };
  return error ? [] : ((data ?? []) as Array<{ id: string; title: string; built_url: string; built_note: string | null; built_at: string }>);
}

export async function builtExampleCounts(slugs: string[]) {
  const service = slugs.length ? createAdminClient() : null;
  if (!service) return new Map<string, number>();
  const { data, error } = await service.rpc('built_example_counts', { p_slugs: slugs });
  const rows = error ? [] : (data ?? []) as Array<{ opportunity_slug: string; maker_count: number }>;
  return new Map(rows.map((row) => [row.opportunity_slug, row.maker_count]));
}

export type ListedPrd = { id: string; title: string; opportunity_slug: string | null; evidence_ids: string[]; built_url: string | null; updated_at: string };

/** Lists shared, listed PRDs whose reports are below the moderation threshold. */
export async function listedPrds(limit = 60): Promise<ListedPrd[]> {
  const service = createAdminClient();
  if (!service) return [];
  const moderated = await service.rpc('moderated_listed_prds', { p_limit: limit });
  if (!moderated.error) return (moderated.data ?? []) as ListedPrd[];
  if (moderated.error.code !== 'PGRST202') {
    console.error('Listed PRDs failed', moderated.error.message);
    return [];
  }
  // The gallery can still be read while the report migration has yet to be deployed.
  const { data, error } = await service.from('evidence_dossiers').select('id,title,opportunity_slug,evidence_ids,built_url,updated_at').eq('shared', true).eq('listed', true).not('prd_markdown', 'is', null).order('updated_at', { ascending: false }).limit(limit);
  if (error) console.error('Listed PRDs failed', error.message);
  return error ? [] : ((data ?? []) as ListedPrd[]);
}

/** A PRD its owner shared, or null. */
export async function sharedPrd(id: string) {
  const service = createAdminClient();
  if (!service) return null;
  const { data } = await service.from('evidence_dossiers').select('title,prd_markdown,evidence_ids,opportunity_slug,updated_at').eq('id', id).eq('shared', true).maybeSingle();
  return data?.prd_markdown ? data : null;
}

export type UserDossierPrd = {
  id: string;
  title: string;
  opportunity_slug: string | null;
  evidence_ids: string[];
  evidence: unknown;
  prd_markdown: string;
  updated_at: string;
};

/** Saved PRDs owned by one user (service-role lookup for personal MCP tokens). */
export async function userPrds(service: SupabaseClient, userId: string, limit = 20): Promise<UserDossierPrd[]> {
  const { data, error } = await service
    .from('evidence_dossiers')
    .select('id,title,opportunity_slug,evidence_ids,evidence,prd_markdown,updated_at')
    .eq('user_id', userId)
    .not('prd_markdown', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(limit);
  return error ? [] : ((data ?? []) as UserDossierPrd[]);
}

/** One saved PRD owned by the user (service-role lookup for personal MCP tokens). */
export async function userPrdById(service: SupabaseClient, userId: string, id: string): Promise<UserDossierPrd | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await service
    .from('evidence_dossiers')
    .select('id,title,opportunity_slug,evidence_ids,evidence,prd_markdown,updated_at')
    .eq('user_id', userId)
    .eq('id', id)
    .not('prd_markdown', 'is', null)
    .maybeSingle();
  return error || !data ? null : (data as UserDossierPrd);
}

/** Most recently saved PRD for an opportunity slug by one user, used to pin active MCP builds. */
export async function userPinnedDossierForSlug(service: SupabaseClient, userId: string, slug: string): Promise<UserDossierPrd | null> {
  const { data, error } = await service
    .from('evidence_dossiers')
    .select('id,title,opportunity_slug,evidence_ids,evidence,prd_markdown,updated_at')
    .eq('user_id', userId)
    .eq('opportunity_slug', slug)
    .not('prd_markdown', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return error || !data ? null : (data as UserDossierPrd);
}
