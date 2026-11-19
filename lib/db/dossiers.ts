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

/** The problems this user already saved evidence for. */
export function savedOpportunitySlugs(supabase: SupabaseClient) {
  return supabase.from('evidence_dossiers').select('opportunity_slug').not('opportunity_slug', 'is', null).limit(50);
}

/** What people built from one problem, from PRDs their owners made public with a link (built.sql). */
export async function builtExamples(slug: string) {
  const { data, error } = (await createAdminClient()?.from('evidence_dossiers').select('id,title,built_url,built_note,built_at').eq('opportunity_slug', slug).eq('shared', true).not('built_at', 'is', null).order('built_at', { ascending: false }).limit(6)) ?? { data: null, error: null };
  return error ? [] : ((data ?? []) as Array<{ id: string; title: string; built_url: string; built_note: string | null; built_at: string }>);
}

/** A PRD its owner shared, or null. */
export async function sharedPrd(id: string) {
  const service = createAdminClient();
  if (!service) return null;
  const { data } = await service.from('evidence_dossiers').select('title,prd_markdown,evidence_ids,opportunity_slug,updated_at').eq('id', id).eq('shared', true).maybeSingle();
  return data?.prd_markdown ? data : null;
}
