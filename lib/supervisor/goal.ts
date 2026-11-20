// The goal model (docs/supervisor-plan.md 3-1): which requirements and features serve which success criteria, what
// serves none, the order that moves open criteria first, and what a goal change sends back for a recheck. Pure, so the
// planning tab, the MCP server and the hook bundle share one answer. Locking and versions live in lib/db/project-goals.ts.
import type { Spec, SpecRequirement } from '../opportunities/spec';
import type { ProjectGoal, SuccessCriterion } from './types';

export type GoalLinks = {
  /** Requirement or hypothesis id → criterion ids it serves. */
  requirements: Record<string, string[]>;
  /** Feature id → criterion ids it serves, directly or through its requirements. */
  features: Record<string, string[]>;
};
export type UnlinkedItem = { id: string; title: string; kind: 'requirement' | 'hypothesis' | 'feature' };
export type FeatureContribution = { featureId: string; criterionIds: string[]; openCriteria: number };

// Words too common in PRDs to show that a line serves a criterion.
const STOP = new Set(['사용자', '기능', '화면', '데이터', '서비스', '관리', '있다', '한다', 'user', 'users', 'the', 'and', 'for', 'with', 'can', 'app', 'data', 'feature', 'that', 'this']);
const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u)
  .filter((word) => word.length >= (/[a-z]/.test(word) ? 3 : 2) && !STOP.has(word));
// A prefix match lets a Korean noun meet itself with a particle attached ("알림" and "알림을").
const near = (a: string, b: string) => a.startsWith(b) || b.startsWith(a);
const CRITERION_ID = /\bG-\d{1,3}\b/g;

const requirementText = (row: SpecRequirement) => `${row.title} ${row.detail} ${(row.acceptance ?? []).join(' ')}`;

/**
 * Links each requirement and feature to the criteria it serves. A line that names a criterion (`G-2`) is linked to it;
 * otherwise a shared word links it. A feature also serves every criterion its requirements serve.
 * shortcut: word overlap misses synonyms and can link on a shared noun; upgrade to embeddings if the false rate is high.
 */
export function linkSpecToGoal(spec: Spec, criteria: SuccessCriterion[]): GoalLinks {
  const known = new Set(criteria.map((row) => row.id));
  const vocab = criteria.map((row) => ({ id: row.id, words: words(`${row.text} ${row.measure}`) }));
  const serves = (text: string) => {
    const named = [...text.matchAll(CRITERION_ID)].map((match) => match[0]).filter((id) => known.has(id));
    const lineWords = words(text);
    const shared = vocab.filter((row) => row.words.some((goal) => lineWords.some((word) => near(word, goal)))).map((row) => row.id);
    return [...new Set([...named, ...shared])].sort();
  };
  const requirements = Object.fromEntries([...spec.requirements, ...spec.hypotheses].map((row) => [row.id, serves(requirementText(row))]));
  const features = Object.fromEntries(spec.features.map((row) => [row.id, [...new Set([
    ...serves(`${row.title} ${row.detail}`),
    ...row.requirementIds.flatMap((id) => requirements[id] ?? []),
  ])].sort()]));
  return { requirements, features };
}

/** Requirements, hypotheses and features no success criterion covers: "목표와 무관", to tie to a criterion, drop or move out of scope. */
export function unlinkedItems(spec: Spec, criteria: SuccessCriterion[]): UnlinkedItem[] {
  if (!criteria.length) return [];
  const links = linkSpecToGoal(spec, criteria);
  const empty = (ids: string[] | undefined) => !ids?.length;
  return [
    ...spec.requirements.filter((row) => empty(links.requirements[row.id])).map((row) => ({ id: row.id, title: row.title, kind: 'requirement' as const })),
    ...spec.hypotheses.filter((row) => empty(links.requirements[row.id])).map((row) => ({ id: row.id, title: row.title, kind: 'hypothesis' as const })),
    ...spec.features.filter((row) => empty(links.features[row.id])).map((row) => ({ id: row.id, title: row.title, kind: 'feature' as const })),
  ];
}

/**
 * Features in goal-contribution order: the most open (not yet met) criteria served first, then the most criteria, then
 * feature order. Features that serve no criterion come last. get_next_task applies this inside its dependency rules.
 */
export function featureContribution(spec: Spec, criteria: SuccessCriterion[]): FeatureContribution[] {
  const links = linkSpecToGoal(spec, criteria);
  const open = new Set(criteria.filter((row) => row.status !== 'met').map((row) => row.id));
  return spec.features
    .map((row, index) => {
      const criterionIds = links.features[row.id] ?? [];
      return { featureId: row.id, criterionIds, openCriteria: criterionIds.filter((id) => open.has(id)).length, index };
    })
    .sort((a, b) => b.openCriteria - a.openCriteria || b.criterionIds.length - a.criterionIds.length || a.index - b.index)
    .map(({ index: _index, ...row }) => row);
}

/**
 * The criteria a new goal version changed (text or measure edited) or removed, and the features linked to them under the
 * previous version, which go to needs_recheck. A status change alone is progress, not a goal change.
 */
export function goalChange(spec: Spec, previous: Pick<ProjectGoal, 'criteria'>, next: Pick<ProjectGoal, 'criteria'>) {
  const after = new Map(next.criteria.map((row) => [row.id, row]));
  const before = new Set(previous.criteria.map((row) => row.id));
  const removed = previous.criteria.filter((row) => !after.has(row.id)).map((row) => row.id);
  const changed = previous.criteria.filter((row) => {
    const now = after.get(row.id);
    return now && (now.text.trim() !== row.text.trim() || now.measure.trim() !== row.measure.trim());
  }).map((row) => row.id);
  const added = next.criteria.filter((row) => !before.has(row.id)).map((row) => row.id);
  const touched = new Set([...removed, ...changed]);
  const links = linkSpecToGoal(spec, previous.criteria);
  const recheckFeatureIds = spec.features.filter((row) => (links.features[row.id] ?? []).some((id) => touched.has(id))).map((row) => row.id);
  return { added, changed, removed, recheckFeatureIds };
}

const STATUS = { open: '⬜', partial: '🟡', met: '🟢' } as const;

/**
 * The locked goal in a few lines for MCP responses, AGENTS.md and the session-start hook. Kept short on purpose: it rides
 * on every response (plan 3-11, token budget).
 */
export function goalSummary(goal: ProjectGoal, lang: 'ko' | 'en' = 'ko'): string {
  const en = lang === 'en';
  const lines = [
    `${en ? 'Goal' : '목표'} v${goal.version} (${goal.track === 'launch' ? (en ? 'B launch' : 'B 출시용') : (en ? 'A personal' : 'A 개인용')}): ${goal.statement}`,
    ...goal.criteria.map((row) => `${STATUS[row.status]} ${row.id} ${row.text} (${en ? 'measure' : '재는 방법'}: ${row.measure})`),
  ];
  if (goal.outOfScope.length) lines.push(`${en ? 'Not doing' : '하지 않는 것'}: ${goal.outOfScope.join(' / ')}`);
  return lines.join('\n');
}
