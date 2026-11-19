import type { Opportunity } from './types';

export const FIT_TIMES = [
  { value: 'day', days: 1, label: ['주말 하루', 'One weekend day'] },
  { value: 'weekend', days: 2, label: ['주말 이틀', 'Two weekend days'] },
  { value: 'week', days: 7, label: ['일주일', 'One week'] },
  { value: 'longer', days: Infinity, label: ['더 길게', 'Longer'] },
] as const;

type FitTime = (typeof FIT_TIMES)[number]['value'];
type QueryValue = string | string[] | undefined;
export type FitQuery = { fit?: QueryValue; stack?: QueryValue; time?: QueryValue };
export type FitChoice = { enabled: boolean; stack: string[]; time: FitTime };

const MAX_STACK_ITEMS = 20;
export const MAX_STACK_ITEM_LENGTH = 40;

function stackKey(value: string) {
  const key = value.toLowerCase().replace(/[.\s-]/g, '');
  if (key === 'next') return 'nextjs';
  if (key === 'node') return 'nodejs';
  if (key === 'postgres') return 'postgresql';
  if (key === 'js') return 'javascript';
  if (key === 'ts') return 'typescript';
  return key;
}

export function normalizeFitStack(values: unknown[]) {
  const stack = new Map<string, string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    for (const part of value.split(',')) {
      const name = part.trim().slice(0, MAX_STACK_ITEM_LENGTH);
      const key = stackKey(name);
      if (key && key !== '아직모르겠음' && !stack.has(key)) stack.set(key, name);
      if (stack.size === MAX_STACK_ITEMS) return [...stack.values()];
    }
  }
  return [...stack.values()];
}

export function firstQueryValue(value: QueryValue) {
  return Array.isArray(value) ? value[0] : value;
}

export function parseFitChoice(query: FitQuery, preferredStack: unknown = []): FitChoice {
  const stack = firstQueryValue(query.stack);
  const requestedTime = firstQueryValue(query.time);
  const time = FIT_TIMES.find((option) => option.value === requestedTime);
  return {
    enabled: firstQueryValue(query.fit) === '1',
    stack: normalizeFitStack(stack === undefined ? [preferredStack].flat() : [stack]),
    time: time?.value ?? 'weekend',
  };
}

export function fitParams(choice: FitChoice) {
  const params = new URLSearchParams({ stack: choice.stack.join(','), time: choice.time });
  if (choice.enabled) params.set('fit', '1');
  return params;
}

type FitOpportunity = Pick<Opportunity, 'build' | 'qualified' | 'evidence'>;
type TimeFit = 'fits' | 'longer' | 'team' | 'unknown';

export function scoreOpportunityFit({ build }: Pick<Opportunity, 'build'>, choice: FitChoice): { overlap: number; timeFit: TimeFit } {
  if (!build) return { overlap: 0, timeFit: 'unknown' };
  const stack = new Set(normalizeFitStack(choice.stack).map(stackKey));
  const overlap = normalizeFitStack(build.stack).filter((name) => stack.has(stackKey(name))).length;
  const budget = FIT_TIMES.find((option) => option.value === choice.time)!.days;
  let timeFit: TimeFit = 'unknown';
  if (build.size === 'team') timeFit = choice.time === 'longer' ? 'team' : 'longer';
  else if (Number.isFinite(build.days) && build.days > 0) {
    timeFit = build.days > budget || (build.size === 'weeks' && budget <= 2) ? 'longer' : 'fits';
  }
  return { overlap, timeFit };
}

export function rankOpportunities<T extends FitOpportunity>(items: T[], choice: FitChoice) {
  return items.map((item) => ({ item, fit: choice.enabled ? scoreOpportunityFit(item, choice) : null })).sort((a, b) => {
    if (choice.stack.length && a.fit && b.fit) {
      const fitOrder = Number(b.fit.timeFit === 'fits') - Number(a.fit.timeFit === 'fits') || b.fit.overlap - a.fit.overlap;
      if (fitOrder) return fitOrder;
    }
    return Number(b.item.qualified) - Number(a.item.qualified) || b.item.evidence.length - a.item.evidence.length;
  });
}
