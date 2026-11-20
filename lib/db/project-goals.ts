// Locked project goals (supervisor_projects.sql): every lock is a new version with its reason, never an overwrite
// (plan 3-1). The current goal is the highest version. Written only through lock_project_goal with the service key.
import type { SupabaseClient } from '@supabase/supabase-js';
import { userPinnedDossierForSlug, userPrdById, type UserDossierPrd } from '@/lib/db/dossiers';
import { resolveProjectKey } from '@/lib/db/supervisor-projects';
import { readBuildProgress, writeBuildProgress } from '@/lib/opportunities/build-progress';
import { parsePrdMarkdown } from '@/lib/opportunities/prd-markdown';
import { normalizeSpec, type Spec } from '@/lib/opportunities/spec';
import type { Evidence } from '@/lib/opportunities/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { goalChange } from '@/lib/supervisor/goal';
import type { ProjectGoal, ProjectKey, SuccessCriterion, Track } from '@/lib/supervisor/types';

export type GoalInput = Pick<ProjectGoal, 'track' | 'statement' | 'criteria' | 'inScope' | 'outOfScope' | 'changeReason'>;

const STATUSES = new Set<SuccessCriterion['status']>(['open', 'partial', 'met']);
const text = (value: unknown, max: number) => (typeof value === 'string' && value.trim() && value.trim().length <= max ? value.trim() : null);

function list(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20) return null;
  const items = value.map((item) => text(item, 200));
  return items.every((item) => item !== null) ? items as string[] : null;
}

/** The PUT body as a goal, or the reason it is refused. Criteria keep their G-n ids; new ones get the next free number. */
export function readGoalInput(body: unknown): { goal: GoalInput } | { error: string } {
  const raw = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const track = raw.track === 'personal' || raw.track === 'launch' ? raw.track as Track : null;
  if (!track) return { error: '트랙은 personal 또는 launch여야 합니다.' };
  const statement = text(raw.statement, 500);
  if (!statement) return { error: '목표 문장을 500자 안으로 적어 주세요.' };
  if (!Array.isArray(raw.criteria) || raw.criteria.length < 2 || raw.criteria.length > 4) return { error: '성공 기준은 2~4개여야 합니다.' };
  const inScope = list(raw.inScope);
  const outOfScope = list(raw.outOfScope);
  if (!inScope || !outOfScope) return { error: '포함 범위와 하지 않는 것은 200자 안의 항목 20개까지입니다.' };
  if (raw.changeReason !== undefined && raw.changeReason !== null && typeof raw.changeReason !== 'string') return { error: '바꾸는 이유는 글이어야 합니다.' };
  const changeReason = typeof raw.changeReason === 'string' && raw.changeReason.trim() ? text(raw.changeReason, 500) : null;
  if (typeof raw.changeReason === 'string' && raw.changeReason.trim() && !changeReason) return { error: '바꾸는 이유는 500자 안으로 적어 주세요.' };

  const used = new Set<string>();
  const criteria: Array<SuccessCriterion | Omit<SuccessCriterion, 'id'>> = [];
  for (const item of raw.criteria as unknown[]) {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>;
    const criterionText = text(row.text, 300);
    const measure = text(row.measure, 300);
    if (!criterionText || !measure) return { error: '성공 기준마다 내용과 재는 방법을 300자 안으로 적어 주세요.' };
    const status = STATUSES.has(row.status as SuccessCriterion['status']) ? row.status as SuccessCriterion['status'] : 'open';
    const featureIds = row.featureIds;
    if (featureIds !== undefined && (!Array.isArray(featureIds) || featureIds.length > 10
      || !featureIds.every((featureId): featureId is string => typeof featureId === 'string' && /^F-\d{2}$/.test(featureId)))) {
      return { error: '성공 기준에 연결할 기능 ID를 확인해 주세요.' };
    }
    const id = typeof row.id === 'string' && /^G-\d{1,3}$/.test(row.id) && !used.has(row.id) ? row.id : null;
    if (id) used.add(id);
    criteria.push({ ...(id ? { id } : {}), text: criterionText, measure, status, ...(featureIds ? { featureIds: [...new Set(featureIds)] } : {}) });
  }
  let next = Math.max(0, ...[...used].map((id) => Number(id.slice(2))));
  const withIds = criteria.map((row) => ('id' in row ? row : { id: `G-${++next}`, ...row }));
  return { goal: { track, statement, criteria: withIds, inScope, outOfScope, changeReason } };
}

type GoalRow = {
  project_key: string; version: number; track: Track; statement: string; criteria: SuccessCriterion[];
  in_scope: string[]; out_of_scope: string[]; locked_at: string; change_reason: string | null;
};

const toGoal = (row: GoalRow): ProjectGoal => ({
  projectKey: row.project_key, version: row.version, track: row.track, statement: row.statement, criteria: row.criteria,
  inScope: row.in_scope, outOfScope: row.out_of_scope, lockedAt: row.locked_at, changeReason: row.change_reason,
});

const COLUMNS = 'project_key,version,track,statement,criteria,in_scope,out_of_scope,locked_at,change_reason';

/** The current (highest) locked goal, or null when none is locked yet. */
export async function currentProjectGoal(service: SupabaseClient, userId: string, key: ProjectKey): Promise<ProjectGoal | null> {
  const { data, error } = await service.from('project_goals').select(COLUMNS)
    .eq('user_id', userId).eq('project_key', key).order('version', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data ? toGoal(data as GoalRow) : null;
}

/** Every locked version, newest first (goal history). */
export async function projectGoalHistory(service: SupabaseClient, userId: string, key: ProjectKey, limit = 20): Promise<ProjectGoal[]> {
  const { data, error } = await service.from('project_goals').select(COLUMNS)
    .eq('user_id', userId).eq('project_key', key).order('version', { ascending: false }).limit(limit);
  if (error) throw error;
  return (data as GoalRow[]).map(toGoal);
}

/** Locks the next version. 'reason-required' when a goal already exists and no change reason was given. */
export async function lockProjectGoal(service: SupabaseClient, userId: string, key: ProjectKey, goal: GoalInput): Promise<ProjectGoal | 'reason-required'> {
  const { data, error } = await service.rpc('lock_project_goal', {
    p_user_id: userId, p_project_key: key, p_track: goal.track, p_statement: goal.statement, p_criteria: goal.criteria,
    p_in_scope: goal.inScope, p_out_of_scope: goal.outOfScope, p_change_reason: goal.changeReason,
  });
  if (error?.message === 'change_reason_required') return 'reason-required';
  if (error) throw error;
  return toGoal(data as GoalRow);
}

/**
 * The spec used to validate links and recheck features: a `prd:` key reads that PRD, a public slug the user's pinned PRD.
 * shortcut: a slug with no pinned PRD (only the shared PRD cache) gets no spec, so no recheck; read the cache too if
 * goals get locked on unpinned public opportunities.
 */
export async function projectSpec(service: SupabaseClient, userId: string, key: ProjectKey): Promise<Spec | null> {
  const id = /^prd:(.+)$/.exec(key)?.[1];
  const saved: UserDossierPrd | null = id ? await userPrdById(service, userId, id) : await userPinnedDossierForSlug(service, userId, key);
  const parsed = saved ? parsePrdMarkdown(saved.prd_markdown) : null;
  if (!saved || !parsed) return null;
  const evidence = Array.isArray(saved.evidence) ? (saved.evidence as Evidence[]) : [];
  // A personal PRD can inherit an opportunity slug from its quotes and still include features tied to hypotheses.
  return normalizeSpec(parsed, evidence, false, { idea: Boolean(id) || !saved.opportunity_slug });
}

// Only work that was started or finished can need a recheck; untouched features stay todo.
const RECHECK_FROM = new Set(['in_progress', 'improving', 'done']);

/**
 * After a new goal version (plan 3-1): the features affected by edited criteria or links go to needs_recheck,
 * so get_next_task puts them first. Returns the features it flagged.
 */
export async function recheckForGoalChange(
  service: SupabaseClient, userId: string, key: ProjectKey, previous: ProjectGoal, next: ProjectGoal,
  loadSpec: (service: SupabaseClient, userId: string, key: ProjectKey) => Promise<Spec | null> = projectSpec,
): Promise<string[]> {
  const spec = await loadSpec(service, userId, key);
  if (!spec) return [];
  const change = goalChange(spec, previous, next);
  if (!change.recheckFeatureIds.length) return [];
  const progress = await readBuildProgress(service, userId, key);
  const flagged = change.recheckFeatureIds.filter((id) => RECHECK_FROM.has(progress[id]?.status ?? 'todo'));
  const linkedAdditions = next.criteria.filter((row) => row.featureIds?.length && change.added.includes(row.id)).map((row) => row.id);
  const touched = [...change.changed, ...change.removed, ...linkedAdditions].join(', ');
  for (const id of flagged) {
    await writeBuildProgress(service, userId, key, { id, title: progress[id].title }, 'needs_recheck', `목표 v${next.version}에서 ${touched}이 바뀌어 다시 확인이 필요합니다.`);
  }
  return flagged;
}

/**
 * The goal API's handle on one project, bound to a signed-in user and a key they may use (null otherwise), so the
 * service key stays in lib/db instead of reaching app/.
 */
export async function userProjectGoals(userId: string, rawKey: string) {
  const service = createAdminClient();
  if (!service) return 'unavailable' as const;
  const key = await resolveProjectKey(service, userId, rawKey);
  if (!key) return null;
  return {
    current: () => currentProjectGoal(service, userId, key),
    lock: async (goal: GoalInput) => {
      const featureIds = goal.criteria.flatMap((row) => row.featureIds ?? []);
      const [previous, spec] = await Promise.all([
        currentProjectGoal(service, userId, key),
        featureIds.length ? projectSpec(service, userId, key) : undefined,
      ]);
      if (featureIds.some((id) => !spec?.features.some((feature) => feature.id === id))) return 'invalid-feature-ids' as const;
      const locked = await lockProjectGoal(service, userId, key, goal);
      // The goal is already locked; a failed recheck must not turn the save into an error.
      if (previous && locked !== 'reason-required') {
        await recheckForGoalChange(service, userId, key, previous, locked, spec ? async () => spec : undefined)
          .catch((error) => console.error('Goal recheck failed', (error as { message?: string }).message));
      }
      return locked;
    },
  };
}
