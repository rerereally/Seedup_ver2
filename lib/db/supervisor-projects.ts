// Supervisor projects (supervisor_projects.sql): one row per user and project key, holding the track, the connected
// repository, strict mode and the current goal version. Written only with the service key; callers pass the user id.
import type { SupabaseClient } from '@supabase/supabase-js';
import { userPrdById } from '@/lib/db/dossiers';
import { getOpportunity } from '@/lib/opportunities/data';
import { isGitHubLogin } from '@/lib/seeds/github';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ProjectKey, SupervisorProject, Track } from '@/lib/supervisor/types';

const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;
const PRD_KEY = /^prd:([0-9a-f-]{36})$/i;

/**
 * The key if this user may use it, else null (plan 3-3). `prd:<id>` must be a saved PRD the user owns; a public slug
 * must name a real opportunity. `exists` is swapped only in tests.
 */
export async function resolveProjectKey(
  service: SupabaseClient, userId: string, key: string,
  exists = async (slug: string) => Boolean(await getOpportunity(slug)),
): Promise<ProjectKey | null> {
  const id = key.match(PRD_KEY)?.[1].toLowerCase();
  if (id) return (await userPrdById(service, userId, id)) ? `prd:${id}` : null;
  return SLUG.test(key) && await exists(key) ? key : null;
}

type ProjectRow = { user_id: string; project_key: string; repo: string | null; track: Track; strict: boolean; goal_version: number | null };

const toProject = (row: ProjectRow): SupervisorProject => ({
  userId: row.user_id, projectKey: row.project_key, repo: row.repo, track: row.track, strict: row.strict, goalVersion: row.goal_version,
});

export async function supervisorProject(service: SupabaseClient, userId: string, key: ProjectKey): Promise<SupervisorProject | null> {
  const { data, error } = await service.from('supervisor_projects').select('user_id,project_key,repo,track,strict,goal_version')
    .eq('user_id', userId).eq('project_key', key).maybeSingle();
  if (error) throw error;
  return data ? toProject(data as ProjectRow) : null;
}

/** The user's supervisor projects, most recently updated first (the dashboard list). */
export async function userSupervisorProjects(client: SupabaseClient, userId: string, limit = 50): Promise<Array<SupervisorProject & { updatedAt: string }>> {
  const { data, error } = await client.from('supervisor_projects').select('user_id,project_key,repo,track,strict,goal_version,updated_at')
    .eq('user_id', userId).order('updated_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data as Array<ProjectRow & { updated_at: string }>).map((row) => ({ ...toProject(row), updatedAt: row.updated_at }));
}

/** Creates the project row if missing (personal track, no goal yet); memory rows need it to exist. */
export async function ensureSupervisorProject(service: SupabaseClient, userId: string, key: ProjectKey) {
  const { error } = await service.from('supervisor_projects')
    .upsert({ user_id: userId, project_key: key }, { onConflict: 'user_id,project_key', ignoreDuplicates: true });
  if (error) throw error;
}

/** Sets the repository (connect_repo) or strict mode. The track moves with each locked goal instead. */
export async function updateSupervisorProject(service: SupabaseClient, userId: string, key: ProjectKey, patch: { repo?: string | null; strict?: boolean }) {
  await ensureSupervisorProject(service, userId, key);
  const { data, error } = await service.from('supervisor_projects').update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId).eq('project_key', key).select('user_id,project_key,repo,track,strict,goal_version').single();
  if (error) throw error;
  return toProject(data as ProjectRow);
}

/** Validates an owner/repo GitHub repository identifier before saving it to supervisor_projects. */
export function parseGitHubRepo(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  const [owner, repository, extra] = trimmed.split('/');
  if (!owner || !repository || extra !== undefined) return null;
  if (!isGitHubLogin(owner)) return null;
  if (!/^[a-z\d_.-]{1,100}$/i.test(repository) || /^\.+$/.test(repository)) return null;
  return `${owner}/${repository}`;
}

/**
 * Links an analyzed GitHub repository to a project owned by the signed-in user, keeping service-key usage inside
 * lib/db (same pattern as userProjectGoals). Returns 'unavailable' without admin config, or null for an unowned key.
 */
export async function userProjectRepo(
  userId: string,
  rawKey: string,
  repo: string,
  service: SupabaseClient | null = createAdminClient(),
): Promise<SupervisorProject | null | 'unavailable'> {
  if (!service) return 'unavailable';
  const key = await resolveProjectKey(service, userId, rawKey);
  if (!key) return null;
  return updateSupervisorProject(service, userId, key, { repo });
}
