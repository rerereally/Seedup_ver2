// Supervisor projects (supervisor_projects.sql): one row per user and project key, holding the track, the connected
// repository, strict mode and the current goal version. Written only with the service key; callers pass the user id.
import type { SupabaseClient } from '@supabase/supabase-js';
import { userPrdById } from '@/lib/db/dossiers';

// shortcut: A1 types.ts 머지 후 import로 교체 (docs/supervisor-plan.md 4절을 글자 그대로 옮김)
export type ProjectKey = string; // '<slug>' | `prd:${string}`
export type Track = 'personal' | 'launch';

export type SuccessCriterion = { id: string; text: string; measure: string; status: 'open' | 'partial' | 'met' };
export type ProjectGoal = {
  projectKey: ProjectKey; version: number; track: Track;
  statement: string; criteria: SuccessCriterion[]; inScope: string[]; outOfScope: string[];
  lockedAt: string; changeReason: string | null;
};
export type Decision = {
  id: string; projectKey: ProjectKey; goalVersion: number; title: string; why: string; rejected: string[];
  author: { kind: 'person' | 'agent'; name: string }; approved: boolean | null; featureIds: string[]; criterionIds: string[]; at: string;
};
export type Handoff = { projectKey: ProjectKey; agent: string; doing: string; next: string; cautions: string[]; unverifiedShas: string[]; at: string };
export type ProjectFact = { projectKey: ProjectKey; kind: 'stack' | 'command' | 'env_name' | 'do_not_touch' | 'other'; text: string; author: string; at: string };
export type SupervisorProject = { userId: string; projectKey: ProjectKey; repo: string | null; track: Track; strict: boolean; goalVersion: number | null };

const SLUG = /^[a-z0-9][a-z0-9-]{0,119}$/;
const PRD_KEY = /^prd:([0-9a-f-]{36})$/i;

/**
 * The key if this user may use it, else null. `prd:<id>` must be a saved PRD the user owns (plan 3-3); a public
 * opportunity slug only has to be well formed, since every row under it is the user's own.
 */
export async function resolveProjectKey(service: SupabaseClient, userId: string, key: string): Promise<ProjectKey | null> {
  const id = key.match(PRD_KEY)?.[1].toLowerCase();
  if (id) return (await userPrdById(service, userId, id)) ? `prd:${id}` : null;
  return SLUG.test(key) ? key : null;
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
