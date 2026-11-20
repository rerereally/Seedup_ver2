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
  /** Feature id → criterion ids explicitly confirmed by the person who locked the goal. */
  confirmedFeatures: Record<string, string[]>;
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
  const inferred = criteria.filter((row) => row.featureIds === undefined);
  const known = new Set(inferred.map((row) => row.id));
  const vocab = inferred.map((row) => ({ id: row.id, words: words(`${row.text} ${row.measure}`) }));
  const serves = (text: string) => {
    const named = [...text.matchAll(CRITERION_ID)].map((match) => match[0]).filter((id) => known.has(id));
    const lineWords = words(text);
    const shared = vocab.filter((row) => row.words.some((goal) => lineWords.some((word) => near(word, goal)))).map((row) => row.id);
    return [...new Set([...named, ...shared])].sort();
  };
  const requirements = Object.fromEntries([...spec.requirements, ...spec.hypotheses].map((row) => [row.id, serves(requirementText(row))]));
  const confirmedFeatures = Object.fromEntries(spec.features.map((row) => [row.id, criteria
    .filter((criterion) => criterion.featureIds?.includes(row.id)).map((criterion) => criterion.id).sort()]));
  const features = Object.fromEntries(spec.features.map((row) => [row.id, [...new Set([
    ...confirmedFeatures[row.id],
    ...serves(`${row.title} ${row.detail}`),
    ...row.requirementIds.flatMap((id) => requirements[id] ?? []),
  ])].sort()]));
  // A confirmed feature covers the requirements it serves without linking other features to that criterion.
  for (const feature of spec.features) {
    for (const id of feature.requirementIds) {
      if (requirements[id]) requirements[id] = [...new Set([...requirements[id], ...confirmedFeatures[feature.id]])].sort();
    }
  }
  return { requirements, features, confirmedFeatures };
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
 * Recheck features of edited or removed criteria and features whose confirmed link was added or removed.
 * A status change alone is progress, not a goal change.
 */
export function goalChange(spec: Spec, previous: Pick<ProjectGoal, 'criteria'>, next: Pick<ProjectGoal, 'criteria'>) {
  const before = new Map(previous.criteria.map((row) => [row.id, row]));
  const after = new Map(next.criteria.map((row) => [row.id, row]));
  const beforeLinks = linkSpecToGoal(spec, previous.criteria).features;
  const afterLinks = linkSpecToGoal(spec, next.criteria).features;
  const added = [...after.keys()].filter((id) => !before.has(id));
  const removed = [...before.keys()].filter((id) => !after.has(id));
  const changed: string[] = [];
  const recheck = new Set<string>();
  for (const id of new Set([...before.keys(), ...after.keys()])) {
    const was = before.get(id);
    const now = after.get(id);
    const edited = was && now && (was.text.trim() !== now.text.trim() || was.measure.trim() !== now.measure.trim());
    const explicit = was?.featureIds !== undefined || now?.featureIds !== undefined;
    let linksChanged = false;
    for (const feature of spec.features) {
      const linkedBefore = beforeLinks[feature.id].includes(id);
      const linkChanged = explicit && linkedBefore !== afterLinks[feature.id].includes(id);
      linksChanged ||= linkChanged;
      if (linkChanged || (linkedBefore && (!now || edited))) recheck.add(feature.id);
    }
    if (was && now && (edited || linksChanged)) changed.push(id);
  }
  const recheckFeatureIds = spec.features.filter((row) => recheck.has(row.id)).map((row) => row.id);
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
