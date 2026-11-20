// The goal's first draft from a PRD, criterion ids, and what no success criterion covers. Pure, so tests run it.
import type { Spec } from '@/lib/opportunities/spec';
import { unlinkedItems as unlinkedGoalItems } from '@/lib/supervisor/goal';
import type { SuccessCriterion } from '@/lib/supervisor/types';

export type GoalDraft = { statement: string; criteria: SuccessCriterion[]; inScope: string[]; outOfScope: string[] };

export const MIN_CRITERIA = 2;
export const MAX_CRITERIA = 4;

export const criterion = (index: number, text = '', measure = '', id = `G-${index + 1}`): SuccessCriterion => ({ id, text, measure, status: 'open' });

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

/** The next free G-n after the ones in use, so removing a criterion never makes a new one reuse its id. */
export const nextCriterionId = (rows: SuccessCriterion[]) =>
  `G-${Math.max(0, ...rows.map((row) => Number(/^G-(\d+)$/.exec(row.id)?.[1] ?? 0))) + 1}`;

/** Requirements, hypotheses and features no success criterion covers (A1 goal.ts); empty criteria rows are ignored. */
export function unlinkedItems(spec: Spec, criteria: SuccessCriterion[]) {
  return unlinkedGoalItems(spec, criteria.filter((row) => row.text.trim() || row.measure.trim()));
}
