// PRD quality evaluation: makes a PRD for 20 fixed cases with one model and scores each with the same code check the
// site uses (specIssues + P0 audit/readiness metrics). Run it before and after changing a model or a prompt.
//   npx tsx scripts/eval-prd.ts [--model <id>] [--no-audit-p0] [--critic-model <id>] [--out eval.json]
import { writeFileSync, appendFileSync } from 'node:fs';
import { generatePrd, specIssues } from '../lib/opportunities/prd';
import { summarizeSpecQuality } from '../lib/opportunities/prd-audit';
import { evalQualitySummary, type EvalRow } from '../lib/opportunities/eval';
import { prdEvalCases } from './prd-eval-cases';

function arg(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

async function main() {
  const model = arg('--model');
  const auditP0 = !hasFlag('--no-audit-p0');
  const criticModel = arg('--critic-model');
  const out = arg('--out') ?? 'prd-eval.json';
  const cases = prdEvalCases();

  const rows: EvalRow[] = [];
  // The written PRDs, so scripts/judge-prd.ts can score their content, not only their shape.
  const docs: Record<string, string | null> = {};
  // Where each PRD spent its time, so a slow run shows which step to fix (thinking, writing, repair or audit).
  const timing: Record<string, { model: string | null; firstText: number | null; written: number | null; repair: number | null; audit: number | null }> = {};
  for (const item of cases) {
    if (!item.input) {
      console.log(`${item.id}: missing from the snapshot, skipped`);
      continue;
    }
    const startedAt = Date.now();
    const marks: { firstText: number | null; written: number | null; repair: number | null; audit: number | null } = { firstText: null, written: null, repair: null, audit: null };
    const at = () => Math.round((Date.now() - startedAt) / 1000);
    const result = await generatePrd(item.input, {
      idea: item.kind === 'idea',
      model,
      auditP0,
      criticModel,
      screens: false,
      onEvent: (event) => {
        if (event.type === 'delta' && marks.firstText === null) marks.firstText = at();
        if (event.type === 'stage') {
          marks.written ??= at();
          if (event.stage === 'checking') marks.repair = at();
          if (event.stage === 'auditing') marks.audit = at();
        }
      },
    }).catch(() => null);
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    const spec = result?.spec ?? null;
    docs[item.id] = result?.markdown ?? null;
    timing[item.id] = { model: result?.model ?? null, ...marks };
    const issues = spec ? specIssues(spec, item.input) : [];
    const cited = spec ? spec.requirements.filter((row) => row.evidence.length).length : 0;
    const quality = spec ? summarizeSpecQuality(spec, item.input) : null;
    rows.push({
      id: item.id,
      kind: item.kind,
      ok: Boolean(spec),
      seconds,
      issues: issues.length,
      requirements: spec ? spec.requirements.length + spec.hypotheses.length : 0,
      cited,
      firstIssue: issues[0] ?? '',
      p0Total: quality?.p0Total ?? 0,
      p0Testable: quality?.p0Testable ?? 0,
      weakP0: quality?.weakP0 ?? 0,
      openDecisions: quality?.openDecisions ?? 0,
      auditChanges: result?.auditChanges.length ?? 0,
      auditDemoted: result?.auditChanges.filter(({ verdict }) => verdict === 'unsupported').length ?? 0,
      auditNarrowed: result?.auditChanges.filter(({ narrowed }) => narrowed).length ?? 0,
    });
    console.log(`${item.id}: ${spec ? `issues ${issues.length}, requirements ${rows[rows.length - 1].requirements}, cited ${cited}, weakP0 ${quality?.weakP0 ?? 0}, openDec ${quality?.openDecisions ?? 0}` : 'failed'}, ${seconds}s (first text ${marks.firstText ?? '-'}s, repair from ${marks.repair ?? '-'}s, audit from ${marks.audit ?? '-'}s, ${result?.model ?? 'no model'})`);
  }

  const summary = evalQualitySummary(rows);
  writeFileSync(out, `${JSON.stringify({ model: model ?? 'default', auditP0, criticModel: criticModel ?? null, at: new Date().toISOString(), summary, rows, docs, timing }, null, 1)}\n`);
  const table = [
    `### PRD 평가 (${model ?? '기본 모델'}${auditP0 ? ` + P0 Critic(${criticModel ?? model ?? '기본'})` : ''})`,
    '',
    `성공 ${summary.ok}/${summary.total} (${summary.successRate}%), 문제 없는 PRD ${summary.clean}건, PRD당 지적 평균 ${summary.meanIssues}, 중간 시간 ${summary.medianSeconds}초, 원문 인용 비율(문제 케이스) ${summary.citedShare}%, P0 테스트 가능 수락기준율 ${summary.testableP0Rate}%, 약한 P0 평균 ${summary.meanWeakP0}, 미결 의사결정 평균 ${summary.meanOpenDecisions}`,
    '',
    '| 케이스 | 결과 | 지적 | 요구사항 | 인용 | 약한 P0 | 미결 결정 | 시간 | 첫 지적 |',
    '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((row) => `| ${row.id} | ${row.ok ? '성공' : '실패'} | ${row.issues} | ${row.requirements} | ${row.cited} | ${row.weakP0 ?? 0} | ${row.openDecisions ?? 0} | ${row.seconds}초 | ${row.firstIssue.replace(/\|/g, '/')} |`),
  ].join('\n');
  console.log(`\n${table}`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${table}\n`);
}

void main();
