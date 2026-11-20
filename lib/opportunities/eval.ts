/** Fixed 12 problem slugs committed in lib/opportunities/data/snapshot.json (each with >= 2 verified quotes). */
export const PROBLEM_CASES = [
  'gif-api-replacement',
  'llm-provider-schema-normalization',
  'cross-session-ai-coding-memory',
  'silent-workflow-failure-detection',
  'research-paper-backlog-triage',
  'cron-queue-worker-monitoring',
  'database-cli-inconsistent-commands',
  'llm-code-validation',
  'matrix-homeserver-migration',
  'international-meeting-time-zone-sync',
  'resume-data-entry-automation',
  'unified-ai-conversation-viewer',
] as const;

/** One case of the PRD evaluation (scripts/eval-prd.ts). */
export type EvalRow = {
  id: string;
  kind: 'problem' | 'idea';
  ok: boolean;
  seconds: number;
  issues: number;
  requirements: number;
  cited: number;
  firstIssue: string;
  p0Total?: number;
  p0Testable?: number;
  weakP0?: number;
  openDecisions?: number;
  auditChanges?: number;
  auditDemoted?: number;
  auditNarrowed?: number;
};

/**
 * The numbers compared between runs: how many PRDs came back, how many passed the code check with nothing to fix,
 * the mean number of issues on the ones that came back, the median time, and how much of the problem cases' PRDs
 * cite a quote (idea cases have none to cite).
 */
export function evalSummary(rows: EvalRow[]) {
  const done = rows.filter((row) => row.ok);
  const seconds = done.map((row) => row.seconds).sort((a, b) => a - b);
  const problems = done.filter((row) => row.kind === 'problem');
  const requirements = problems.reduce((sum, row) => sum + row.requirements, 0);
  return {
    total: rows.length,
    ok: done.length,
    successRate: rows.length ? Math.round((done.length / rows.length) * 100) : 0,
    clean: done.filter((row) => row.issues === 0).length,
    meanIssues: done.length ? Math.round((done.reduce((sum, row) => sum + row.issues, 0) / done.length) * 10) / 10 : 0,
    medianSeconds: seconds.length ? seconds[Math.floor((seconds.length - 1) / 2)] : 0,
    citedShare: requirements ? Math.round((problems.reduce((sum, row) => sum + row.cited, 0) / requirements) * 100) : 0,
  };
}

/** Extended PRD evaluation summary adding P0 testability, weak-P0 rate, and open implementation decisions. */
export function evalQualitySummary(rows: EvalRow[]) {
  const base = evalSummary(rows);
  const done = rows.filter((row) => row.ok);
  const p0Total = done.reduce((sum, row) => sum + Number(row.p0Total ?? 0), 0);
  const p0Testable = done.reduce((sum, row) => sum + Number(row.p0Testable ?? 0), 0);
  const totalWeakP0 = done.reduce((sum, row) => sum + Number(row.weakP0 ?? 0), 0);
  const totalOpenDecisions = done.reduce((sum, row) => sum + Number(row.openDecisions ?? 0), 0);
  const totalAuditChanges = done.reduce((sum, row) => sum + Number(row.auditChanges ?? 0), 0);
  return {
    ...base,
    p0Total,
    testableP0Rate: p0Total ? Math.round((p0Testable / p0Total) * 100) : 100,
    meanWeakP0: done.length ? Math.round((totalWeakP0 / done.length) * 10) / 10 : 0,
    meanOpenDecisions: done.length ? Math.round((totalOpenDecisions / done.length) * 10) / 10 : 0,
    totalAuditChanges,
  };
}

export type PrecisionLabels = Record<string, { slug: string; quote: string; relevant: boolean; note?: string; by: string }>;

/**
 * Citation precision over the quotes still published: labeled ones count, a label for a quote no longer shown is
 * ignored, and quotes without a label are returned so they can be judged. `byPeople` counts labels a person confirmed
 * (anything but the model's draft), since the promise to users rests on human judgement.
 */
export function precisionOf(opportunities: Array<{ slug: string; evidence: Array<{ id: string; quote: string }> }>, labels: PrecisionLabels) {
  const published = opportunities.flatMap((item) => item.evidence.map((evidence) => ({ id: evidence.id, slug: item.slug, quote: evidence.quote })));
  const labeled = published.flatMap((row) => (labels[row.id] ? [{ ...row, ...labels[row.id] }] : []));
  const relevant = labeled.filter((row) => row.relevant).length;
  return {
    labeled: labeled.length,
    relevant,
    byPeople: labeled.filter((row) => row.by !== 'claude-draft').length,
    precision: labeled.length ? Math.round((relevant / labeled.length) * 100) : null,
    wrong: labeled.filter((row) => !row.relevant),
    unlabeled: published.filter((row) => !labels[row.id]),
  };
}
