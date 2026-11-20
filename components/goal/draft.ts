// The goal's first draft from a PRD, and which requirements and features no success criterion covers. Pure, so tests run it.
import type { Spec } from '@/lib/opportunities/spec';
import type { SuccessCriterion } from './types';

export type GoalDraft = { statement: string; criteria: SuccessCriterion[]; inScope: string[]; outOfScope: string[] };

export const MIN_CRITERIA = 2;
export const MAX_CRITERIA = 4;

export const criterion = (index: number, text = '', measure = ''): SuccessCriterion => ({ id: `G-${index + 1}`, text, measure, status: 'open' });

/** Goals give the statement, metrics the criteria ("text: how to measure"), features the scope, non-goals what is left out. */
export function goalDraft(spec: Spec, idea: string): GoalDraft {
  const criteria = spec.metrics.slice(0, MAX_CRITERIA).map((metric, index) => {
    const cut = metric.search(/[:：]/);
    return cut > 0 ? criterion(index, metric.slice(0, cut).trim(), metric.slice(cut + 1).trim()) : criterion(index, metric.trim());
  });
  while (criteria.length < MIN_CRITERIA) criteria.push(criterion(criteria.length));
  return {
    statement: spec.goals?.[0] || spec.summary || idea,
    criteria,
    inScope: (spec.features.length ? spec.features : spec.requirements).slice(0, 8).map((row) => row.title),
    outOfScope: spec.nonGoals.slice(0, 8),
  };
}

// Words too common in PRDs to show that a line serves a criterion.
const STOP = new Set(['사용자', '기능', '화면', '데이터', '서비스', '관리', 'user', 'users', 'the', 'and', 'for', 'with', 'can', 'app', 'data', 'feature']);
const words = (text: string) => text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((word) => word.length >= (/[a-z]/.test(word) ? 3 : 2) && !STOP.has(word));
// A prefix match lets a Korean noun meet itself with a particle attached ("알림" and "알림을").
const near = (a: string, b: string) => a.startsWith(b) || b.startsWith(a);

/**
 * Requirements, hypotheses and features that share no word with any success criterion; a feature also counts as linked
 * through a linked requirement. shortcut: 단어 겹침으로 연결 판정, A1 goal.ts의 연결 검사가 머지되면 그것으로 교체.
 */
export function unlinkedItems(spec: Spec, criteria: SuccessCriterion[]): Array<{ id: string; title: string }> {
  const goalWords = criteria.flatMap((row) => words(`${row.text} ${row.measure}`));
  if (!goalWords.length) return [];
  const serves = (text: string) => words(text).some((word) => goalWords.some((goal) => near(word, goal)));
  const requirements = [...spec.requirements, ...spec.hypotheses];
  const linked = new Set(requirements.filter((row) => serves(`${row.title} ${row.detail} ${(row.acceptance ?? []).join(' ')}`)).map((row) => row.id));
  return [
    ...requirements.filter((row) => !linked.has(row.id)),
    ...spec.features.filter((row) => !row.requirementIds.some((id) => linked.has(id)) && !serves(`${row.title} ${row.detail}`)),
  ].map((row) => ({ id: row.id, title: row.title }));
}
