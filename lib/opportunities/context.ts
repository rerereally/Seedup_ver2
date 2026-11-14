import type { SpecInput } from './spec';
import type { Evidence, Opportunity } from './types';

const MAX_COMPETITORS = 8;

/**
 * Builds the PRD context from every opportunity the picked evidence belongs to, not just the one with most picks.
 * The opportunity with the most picked quotes leads (its name and problem come first); the others add their
 * problem and gap as related context, and every direct competitor is listed once.
 */
export function specInputFor(opportunities: Opportunity[], picked: Array<{ evidence: Evidence; slug: string }>, requestedTitle = ''): SpecInput | null {
  const counts = new Map<string, number>();
  for (const item of picked) counts.set(item.slug, (counts.get(item.slug) ?? 0) + 1);
  const involved = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .flatMap(([slug]) => opportunities.find((item) => item.slug === slug) ?? []);
  const [lead, ...others] = involved;
  if (!lead) return null;

  const distinct = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];
  const relatedProblems = distinct(others.map((item) => item.problem)).filter((problem) => problem !== lead.problem.trim());
  const gaps = distinct([lead.gap, ...others.map((item) => item.gap)]);
  const competitors = distinct(involved.flatMap((item) => item.supply.filter((supply) => supply.relation === 'direct').map((supply) => supply.name))).slice(0, MAX_COMPETITORS);

  return {
    title: requestedTitle || lead.name,
    problem: relatedProblems.length ? `${lead.problem}\n\n함께 담은 관련 문제:\n${relatedProblems.map((problem) => `- ${problem}`).join('\n')}` : lead.problem,
    gap: gaps.join('\n'),
    evidence: picked.map((item) => item.evidence),
    competitors,
  };
}
