// Locked project goals (supervisor_projects.sql): every lock is a new version with its reason, never an overwrite
// (plan 3-1). The current goal is the highest version. Written only through lock_project_goal with the service key.
import type { SupabaseClient } from '@supabase/supabase-js';
import { resolveProjectKey } from '@/lib/db/supervisor-projects';
import type { ProjectGoal, ProjectKey, SuccessCriterion, Track } from '@/lib/db/supervisor-projects';
import { createAdminClient } from '@/lib/supabase/admin';

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
    const id = typeof row.id === 'string' && /^G-\d{1,3}$/.test(row.id) && !used.has(row.id) ? row.id : null;
    if (id) used.add(id);
    criteria.push(id ? { id, text: criterionText, measure, status } : { text: criterionText, measure, status });
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
    lock: (goal: GoalInput) => lockProjectGoal(service, userId, key, goal),
  };
}
