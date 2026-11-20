// npx tsx scripts/compare-eval.ts eval-results/audit-on.json eval-results/audit-off.json
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

type EvalResult = {
  auditP0: boolean;
  model?: string;
  rows: Array<{ id: string; ok: boolean; seconds: number; p0Total?: number; auditDemoted?: number; auditNarrowed?: number }>;
};

function readResult(file: string): EvalResult {
  const data = JSON.parse(readFileSync(file, 'utf8')) as Partial<EvalResult> | null;
  const count = (value: number | undefined) => value === undefined || (Number.isInteger(value) && value >= 0);
  if (typeof data?.auditP0 !== 'boolean' || !Array.isArray(data.rows) || !data.rows.length
    || data.rows.some((row) => !row || typeof row.id !== 'string' || typeof row.ok !== 'boolean'
      || !Number.isFinite(row.seconds) || row.seconds < 0 || !count(row.p0Total) || !count(row.auditDemoted) || !count(row.auditNarrowed))
    || new Set(data.rows.map(({ id }) => id)).size !== data.rows.length) {
    throw new Error(`Invalid PRD evaluation: ${file}`);
  }
  return data as EvalResult;
}

function totals({ rows, auditP0 }: EvalResult) {
  const passed = rows.filter(({ ok }) => ok);
  const times = passed.map(({ seconds }) => seconds).sort((a, b) => a - b);
  const middle = Math.floor(times.length / 2);
  const sum = (key: 'p0Total' | 'auditDemoted' | 'auditNarrowed') =>
    passed.every((row) => row[key] !== undefined) ? passed.reduce((total, row) => total + (row[key] ?? 0), 0) : null;
  return {
    passed: passed.length,
    cases: rows.length,
    p0: sum('p0Total'),
    demoted: auditP0 ? sum('auditDemoted') : 0,
    narrowed: auditP0 ? sum('auditNarrowed') : 0,
    median: !times.length ? null : times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2,
  };
}

export function compareEvalFiles(first: string, second: string) {
  const a = readResult(first);
  const b = readResult(second);
  if (a.auditP0 === b.auditP0) throw new Error('Provide one audit-on and one audit-off result.');
  if (a.model && b.model && a.model !== b.model) throw new Error('Writer model settings differ.');
  const ids = new Set(a.rows.map(({ id }) => id));
  if (ids.size !== b.rows.length || b.rows.some(({ id }) => !ids.has(id))) throw new Error('The results must contain the same case IDs.');
  return a.auditP0 ? { on: totals(a), off: totals(b) } : { on: totals(b), off: totals(a) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const [, , first, second, extra] = process.argv;
    if (!first || !second || extra) throw new Error('Usage: compare-eval.ts <audit-on.json> <audit-off.json>');
    const { on, off } = compareEvalFiles(first, second);
    const values = (row: ReturnType<typeof totals>) =>
      [`${row.passed}/${row.cases}`, row.p0, row.demoted, row.narrowed, row.median].map((value) => value ?? '—').join(' | ');
    console.log([
      '| 감사 | 생성 성공 | P0 전체 | 가설로 이동 | 범위 축소 | 성공 건 중간 시간(초) |',
      '|---|---:|---:|---:|---:|---:|',
      `| 켬 | ${values(on)} |`,
      `| 끔 | ${values(off)} |`,
      '', '—: 결과 파일에 항목별 기록이 없습니다.',
    ].join('\n'));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
