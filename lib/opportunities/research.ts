import { DAY_MS, historyPointAt } from './insight';
import type { Opportunity } from './types';

type Problem = Pick<Opportunity, 'slug' | 'name' | 'nameEn'>;
type EvidenceSignal = Problem & { evidence: number; platforms: number };
type DemandSignal = Problem & { growth: number };
type GapSignal = Problem & { narrowed: boolean; directGrowth: number };
type FieldTrend = { label: string; labelEn?: string; growth: number };

export function dailyResearch(opportunities: readonly Opportunity[], now: number) {
  const daily = researchInWindow(opportunities, now, 1);
  return daily.changeCount >= 3 ? daily : researchInWindow(opportunities, now, 7);
}

function researchInWindow(opportunities: readonly Opportunity[], now: number, windowDays: 1 | 7) {
  const cutoff = now - windowDays * DAY_MS;
  const newProblems: EvidenceSignal[] = [];
  const demandRising: DemandSignal[] = [];
  const newlyQualified: EvidenceSignal[] = [];
  const gapClosing: GapSignal[] = [];
  const fields = new Map<string, FieldTrend>();

  for (const item of opportunities) {
    const history = item.history ?? [];
    const after = historyPointAt(history, now);
    if (!after || Date.parse(after.at) <= cutoff) continue;

    const baseline = historyPointAt(history, cutoff);
    const problem = { slug: item.slug, name: item.name, nameEn: item.nameEn };
    const evidence = { ...problem, evidence: after.evidence, platforms: after.platforms };
    if (!baseline) newProblems.push(evidence);

    // The first run establishes a count, so growth requires a later point even for new problems.
    const before = baseline ?? history[0];
    if (!before.qualified && after.qualified) newlyQualified.push(evidence);

    const narrowed = before.status === 'open' && after.status === 'narrowing';
    const directGrowth = after.direct - before.direct;
    if (narrowed || directGrowth > 0) gapClosing.push({ ...problem, narrowed, directGrowth });

    const growth = after.evidence - before.evidence;
    if (growth <= 0) continue;
    demandRising.push({ ...problem, growth });

    const labels = new Set<string>();
    const terms = [{ label: item.audience, labelEn: item.audienceEn }, ...item.keywords.map((label) => ({ label, labelEn: undefined }))];
    for (const term of terms) {
      const label = term.label?.trim();
      if (!label) continue;
      const key = label.toLowerCase();
      if (labels.has(key)) continue;
      labels.add(key);
      const field = fields.get(key);
      fields.set(key, { label: field?.label ?? label, labelEn: field?.labelEn || term.labelEn?.trim(), growth: (field?.growth ?? 0) + growth });
    }
  }

  return {
    windowDays,
    changeCount: newProblems.length + demandRising.length + newlyQualified.length + gapClosing.length,
    newProblems,
    demandRising: demandRising.sort((a, b) => b.growth - a.growth),
    newlyQualified,
    gapClosing,
    fieldTrend: [...fields.values()].sort((a, b) => b.growth - a.growth),
  };
}

export type DailyTotal = { at: string; quotes: number; problems: number; qualified: number };

/**
 * Totals across every problem at the end of each of the last `days` days, oldest first, read from the engine's
 * history points: quotes found, problems tracked and problems past the bar. A problem counts from its first point.
 */
export function dailyTotals(opportunities: readonly Opportunity[], now: number, days = 7): DailyTotal[] {
  return Array.from({ length: days }, (_, index) => {
    const at = now - (days - 1 - index) * DAY_MS;
    let quotes = 0;
    let problems = 0;
    let qualified = 0;
    for (const item of opportunities) {
      const point = historyPointAt(item.history ?? [], at);
      if (!point) continue;
      problems += 1;
      quotes += point.evidence;
      if (point.qualified) qualified += 1;
    }
    return { at: new Date(at).toISOString(), quotes, problems, qualified };
  });
}
