/** One case of the PRD evaluation (scripts/eval-prd.ts). */
export type EvalRow = { id: string; kind: 'problem' | 'idea'; ok: boolean; seconds: number; issues: number; requirements: number; cited: number; firstIssue: string };

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
