// npx tsx --env-file=.env scripts/eval-rivals.ts [--out eval-results/rivals.json] [--yes]
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { buildValidationReport } from '../lib/opportunities/report';
import { prdEvalCases, prdEvalSnapshot } from './prd-eval-cases';

type RivalRun = {
  id: string;
  enabled: boolean;
  elapsedMs: number;
  stats: Awaited<ReturnType<typeof buildValidationReport>>['rivalStats'] | null;
  error?: string;
};

function summarize(runs: RivalRun[], enabled: boolean) {
  const group = runs.filter((row) => row.enabled === enabled);
  const times = group.filter(({ stats }) => stats).map(({ elapsedMs }) => elapsedMs).sort((a, b) => a - b);
  const middle = Math.floor(times.length / 2);
  return {
    enabled,
    direct: group.reduce((sum, { stats }) => sum + (stats?.direct ?? 0), 0),
    candidates: group.reduce((sum, { stats }) => sum + (stats?.candidates ?? 0), 0),
    researchQueries: group.reduce((sum, { stats }) => sum + (stats?.researchQueries ?? 0), 0),
    medianMs: !times.length ? null : times.length % 2 ? times[middle] : (times[middle - 1] + times[middle]) / 2,
    failed: group.length - times.length,
  };
}

async function main(build = buildValidationReport) {
  const { values } = parseArgs({ options: { yes: { type: 'boolean' }, out: { type: 'string' } } });
  const snapshot = prdEvalSnapshot();
  const cases = prdEvalCases(snapshot);
  if (cases.some(({ input }) => !input)) throw new Error('Some fixed PRD cases are missing from the snapshot.');
  console.log(`예상 호출 수: 리포트 ${cases.length * 2}건, 모델 단계 최대 ${cases.length * 8}회(모델 재시도 및 대체 호출, 웹 검색 별도).`);
  if (!values.yes) return console.log('--yes를 지정해야 모델과 검색 API를 호출합니다.');
  if (!process.env.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY is required.');

  const runs: RivalRun[] = [];
  for (const [index, { id, input }] of cases.entries()) {
    if (!input) continue;
    // Alternate the order to reduce the effect of temporary provider load on one mode.
    for (const enabled of index % 2 ? [true, false] : [false, true]) {
      const started = performance.now();
      try {
        const report = await build(input.problem, snapshot.opportunities, { rivalAgent: enabled });
        runs.push({ id, enabled, elapsedMs: Math.round(performance.now() - started), stats: report.rivalStats });
      } catch (error) {
        runs.push({ id, enabled, elapsedMs: Math.round(performance.now() - started), stats: null, error: error instanceof Error ? error.name : 'UnknownError' });
      }
      console.log(`${id} · RIVAL_AGENT ${enabled ? 'on' : 'off'}`);
    }
  }
  const at = new Date().toISOString();
  const summary = [summarize(runs, false), summarize(runs, true)];
  const out = values.out ?? `eval-results/rivals-${at.replaceAll(':', '-')}.json`;
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, `${JSON.stringify({ at, snapshot: snapshot.generatedAt, summary, runs }, null, 2)}\n`, { flag: 'wx' });
  console.log([
    '| RIVAL_AGENT | 직접 경쟁 | 전체 후보 | 추가 검색 | 성공 건 중간 시간(ms) | 실패 |',
    '|---|---:|---:|---:|---:|---:|',
    ...summary.map((row) => `| ${row.enabled ? '켬' : '끔'} | ${row.direct} | ${row.candidates} | ${row.researchQueries} | ${row.medianMs ?? '—'} | ${row.failed} |`),
    '', `결과 저장: ${out}`,
  ].join('\n'));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
