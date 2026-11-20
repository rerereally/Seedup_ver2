// Saved evidence and PRDs (evidence_dossiers). A user's own rows go through their client and row-level security;
// every write also names the user so it stays safe if a policy ever changes. Shared PRDs and built examples are
// public by the owner's choice and are read with the service key.
import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { specInputFor } from '@/lib/opportunities/context';
import { findEvidence, getOpportunities } from '@/lib/opportunities/data';
import type { Evidence, SupplyItem } from '@/lib/opportunities/types';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * The key a saved item is stored under. It used to be the quotes alone, so two different ideas that kept the same quotes
 * landed on one row: the second overwrote the first's PRD and took over its project key and locked goal. A row saved
 * under the old key with the same title keeps it (its project key must not change); everything else gets a key that
 * includes the title.
 */
export function dossierKeyFor(evidenceIds: string[], title: string, legacyTitle: string | null) {
  const hash = (text: string) => createHash('sha256').update(text).digest('hex').slice(0, 32);
  const name = title.trim().toLowerCase();
  if (!evidenceIds.length) return hash(`idea:${name}`);
  const quotes = [...evidenceIds].sort().join(',');
  return legacyTitle !== null && legacyTitle.trim().toLowerCase() === name ? hash(quotes) : hash(`${quotes}\ntitle:${name}`);
}

/** The title of the row saved under the old quotes-only key, or null when there is none. */
export async function legacyDossierTitle(supabase: SupabaseClient, userId: string, evidenceIds: string[]) {
  if (!evidenceIds.length) return null;
  const key = createHash('sha256').update([...evidenceIds].sort().join(',')).digest('hex').slice(0, 32);
  const { data } = await supabase.from('evidence_dossiers').select('title').eq('user_id', userId).eq('dossier_key', key).maybeSingle();
  return typeof data?.title === 'string' ? data.title : null;
}

export function saveDossier(supabase: SupabaseClient, row: Record<string, unknown>) {
  return supabase.from('evidence_dossiers').upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: 'user_id,dossier_key' }).select('id').single();
}

export async function hasSharedDossier(supabase: SupabaseClient, userId: string, id: string) {
  const { data } = await supabase.from('evidence_dossiers').select('id').eq('id', id).eq('user_id', userId).eq('shared', true).maybeSingle();
  return Boolean(data);
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

/**
 * Saves the quotes a validation report found for an idea as the user's PRD draft (no PRD yet), so an agent can make
 * the PRD from it next. The same idea with the same quotes reuses one draft; new quotes make a new one, so a PRD
 * already made from older quotes is never overwritten.
 */
export async function saveIdeaDraft(service: SupabaseClient, userId: string, idea: string, evidence: Evidence[]) {
  const title = idea.trim().slice(0, 120);
  const ids = evidence.map((row) => row.id).sort();
  const dossierKey = createHash('sha256').update(['mcp-idea', title.toLowerCase(), ...ids].join('\n')).digest('hex').slice(0, 32);
  const { data, error } = await saveDossier(service, { user_id: userId, dossier_key: dossierKey, title, opportunity_slug: null, evidence_ids: ids, evidence });
  if (error) throw error;
  return (data as { id: string }).id;
}

type ValidationCompetitor = Pick<SupplyItem, 'name' | 'description'>;
export type SavedValidationReport = { markdown: string; level: string; generatedAt: string; competitors?: ValidationCompetitor[] };

/**
 * Keeps the validate_idea report on its draft (validation_report column). Kept apart from saveIdeaDraft and never
 * thrown, so a database without the column (migration not applied yet) still saves the draft itself.
 */
export async function saveDraftReport(service: SupabaseClient, userId: string, id: string, report: SavedValidationReport) {
  const { error } = await service.from('evidence_dossiers').update({ validation_report: report }).eq('user_id', userId).eq('id', id);
  if (error) console.error('validation report save failed', error.message);
}

/** The saved validate_idea report for one PRD or draft, or null (none saved, or the column is not there yet). */
export async function draftReport(client: SupabaseClient, userId: string, id: string): Promise<SavedValidationReport | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await client.from('evidence_dossiers').select('validation_report').eq('user_id', userId).eq('id', id).maybeSingle();
  const report = (data as { validation_report?: unknown } | null)?.validation_report as Partial<SavedValidationReport> | null | undefined;
  if (error || typeof report?.markdown !== 'string') return null;
  const competitors = Array.isArray(report.competitors) ? report.competitors.filter((row) =>
    typeof row?.name === 'string' && typeof row.description === 'string').slice(0, 8) : undefined;
  return { markdown: report.markdown, level: String(report.level ?? ''), generatedAt: String(report.generatedAt ?? ''), ...(competitors?.length ? { competitors } : {}) };
}

export function validationCompetitorNotes(competitors: ValidationCompetitor[]) {
  return competitors.map(({ name, description }) => description ? `${name}: ${description}` : name);
}

/** Recheck structured competitor listings against their saved report or the published catalog. */
export async function savedPrdCompetitorNotes(
  client: SupabaseClient, userId: string, row: UserDossierPrd, report?: SavedValidationReport | null,
) {
  if (!/^- (?:경쟁 도구 설명|Competitor listing):/m.test(row.prd_markdown)) return undefined;
  const saved = report === undefined ? await draftReport(client, userId, row.id) : report;
  if (saved?.competitors?.length) return validationCompetitorNotes(saved.competitors);
  const { opportunities } = await getOpportunities();
  const picked = findEvidence(opportunities, Array.isArray(row.evidence_ids) ? row.evidence_ids : []);
  return specInputFor(opportunities, picked)?.competitorNotes;
}

/** A draft saved by saveIdeaDraft that has no PRD yet. */
export async function userIdeaDraft(service: SupabaseClient, userId: string, id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { data, error } = await service.from('evidence_dossiers').select('id,title,evidence').eq('user_id', userId).eq('id', id).is('prd_markdown', null).maybeSingle();
  return error || !data ? null : (data as { id: string; title: string; evidence: unknown });
}

/** Writes the PRD made from a draft; a draft that got its PRD meanwhile is left alone. */
export async function setIdeaDraftPrd(service: SupabaseClient, userId: string, id: string, markdown: string) {
  const { error } = await service.from('evidence_dossiers').update({ prd_markdown: markdown, updated_at: new Date().toISOString() }).eq('user_id', userId).eq('id', id).is('prd_markdown', null);
  if (error) throw error;
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

/** A row from userPrds: null markdown means a draft (validate_idea quotes with no PRD yet). */
export type UserDossierRow = Omit<UserDossierPrd, 'prd_markdown'> & { prd_markdown: string | null };

/** Saved PRDs and idea drafts owned by one user (service-role lookup for personal MCP tokens). */
export async function userPrds(service: SupabaseClient, userId: string, limit = 20): Promise<UserDossierRow[]> {
  const { data, error } = await service
    .from('evidence_dossiers')
    .select('id,title,opportunity_slug,evidence_ids,evidence,prd_markdown,updated_at')
    .eq('user_id', userId)
    .or('prd_markdown.not.is.null,opportunity_slug.is.null')
    .order('updated_at', { ascending: false })
    .limit(limit);
  return error ? [] : ((data ?? []) as UserDossierRow[]);
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
