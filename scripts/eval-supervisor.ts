// Static diff-audit evaluation (read-only, offline):
//   1) Evaluates tests/fixtures/bad-diffs.json against lib/supervisor/diff-audit.ts
//   2) Scans recent first-parent merge commits on main to measure per-rule hit counts,
//      affected commits, and blocker false-positive candidates.
//
// Usage:
//   npx tsx scripts/eval-supervisor.ts [--limit 100] [--ref main] [--out eval-results/YYYY-MM-DD-supervisor-audit.json] [--no-write]
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { auditDiff, scrubSecrets } from '../lib/supervisor/diff-audit';
import type { AuditCode, AuditSeverity } from '../lib/supervisor/types';

export type FixtureExpectation = 'block' | 'warn' | 'clean';

export type AuditFixture = {
  id: string;
  label: string;
  expect: FixtureExpectation;
  expectedCodes: AuditCode[];
  diff: string;
};

export type FixtureCaseResult = {
  id: string;
  label: string;
  expect: FixtureExpectation;
  actual: FixtureExpectation;
  expectedCodes: AuditCode[];
  actualCodes: AuditCode[];
  blockerCount: number;
  warningCount: number;
  matched: boolean;
};

export type FixtureEvalSummary = {
  total: number;
  matched: number;
  blockCases: { matched: number; total: number; rate: number | null };
  warnCases: { matched: number; total: number; rate: number | null };
  cleanCases: { clean: number; falsePositives: number; total: number; falsePositiveRate: number | null };
  mismatches: FixtureCaseResult[];
  results: FixtureCaseResult[];
};

export type RuleExample = {
  sha: string;
  file: string;
  line: number;
  severity: AuditSeverity;
  snippet: string;
};

export type RuleCommitStats = {
  code: AuditCode;
  hits: number;
  blockerHits: number;
  warningHits: number;
  commitsHit: number;
  commitRate: number | null;
  falsePositiveCandidates: number;
  examples: RuleExample[];
};

export type BlockerCandidate = {
  sha: string;
  code: AuditCode;
  file: string;
  line: number;
  snippet: string;
};

export type MergeCommitEvalSummary = {
  ref: string;
  commitsScanned: number;
  commitsWithAnyFinding: number;
  commitsBlocked: number;
  commitsBlockedRate: number | null;
  totalFindings: number;
  totalBlockerHits: number;
  totalWarningHits: number;
  byRule: RuleCommitStats[];
  falsePositiveCandidates: BlockerCandidate[];
};

export type SupervisorAuditReport = {
  measuredAt: string;
  commitSha: string | null;
  command: string;
  fixtures: FixtureEvalSummary;
  mergeCommits: MergeCommitEvalSummary;
};

const ALL_CODES: readonly AuditCode[] = [
  'SEC_SECRET_LEAK',
  'SEC_CLIENT_SECRET',
  'LIE_SKIPPED_TEST',
  'LIE_EMPTY_IMPL',
  'LIE_TODO',
  'LIE_MOCK',
  'LIE_EMPTY_CATCH',
  'SEC_XSS',
  'SEC_SQLI',
  'SEC_NO_AUTH',
];

function pct(count: number, total: number): number | null {
  return total > 0 ? Number(((count / total) * 100).toFixed(1)) : null;
}

function formatRate(count: number, total: number, rate: number | null): string {
  return rate === null ? `— (${count}/${total})` : `${rate.toFixed(1)}% (${count}/${total})`;
}

function sanitizeSnippet(raw: string): string {
  return scrubSecrets(raw).scrubbed.replace(/\s+/g, ' ').trim().slice(0, 100);
}

export function evaluateFixtures(fixtures: readonly AuditFixture[]): FixtureEvalSummary {
  const results: FixtureCaseResult[] = fixtures.map((fixture) => {
    const audit = auditDiff(fixture.diff);
    const counted = audit.findings.filter((row) => !row.allowed);
    const actual: FixtureExpectation =
      audit.blockerCount > 0 ? 'block' : audit.warningCount > 0 ? 'warn' : 'clean';
    const actualCodes = [...new Set(counted.map((row) => row.code))];
    const codesOk =
      fixture.expect === 'clean'
        ? actualCodes.length === 0
        : fixture.expectedCodes.every((code) => actualCodes.includes(code));
    return {
      id: fixture.id,
      label: fixture.label,
      expect: fixture.expect,
      actual,
      expectedCodes: fixture.expectedCodes,
      actualCodes,
      blockerCount: audit.blockerCount,
      warningCount: audit.warningCount,
      matched: actual === fixture.expect && codesOk,
    };
  });

  const blockRows = results.filter((row) => row.expect === 'block');
  const warnRows = results.filter((row) => row.expect === 'warn');
  const cleanRows = results.filter((row) => row.expect === 'clean');

  const blockMatched = blockRows.filter((row) => row.matched).length;
  const warnMatched = warnRows.filter((row) => row.matched).length;
  const cleanFp = cleanRows.filter((row) => row.actual !== 'clean').length;

  return {
    total: results.length,
    matched: results.filter((row) => row.matched).length,
    blockCases: { matched: blockMatched, total: blockRows.length, rate: pct(blockMatched, blockRows.length) },
    warnCases: { matched: warnMatched, total: warnRows.length, rate: pct(warnMatched, warnRows.length) },
    cleanCases: {
      clean: cleanRows.length - cleanFp,
      falsePositives: cleanFp,
      total: cleanRows.length,
      falsePositiveRate: pct(cleanFp, cleanRows.length),
    },
    mismatches: results.filter((row) => !row.matched),
    results,
  };
}

function runGit(args: string[]): string {
  return execFileSync('git', args, {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

function resolveRef(requested: string): string {
  try {
    runGit(['rev-parse', '--verify', requested]);
    return requested;
  } catch {
    return 'HEAD';
  }
}

export function evaluateMergeCommits(ref: string, limit: number): MergeCommitEvalSummary {
  const targetRef = resolveRef(ref);
  const shas = runGit(['log', targetRef, '--merges', '--first-parent', '-n', String(limit), '--format=%H'])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const byRuleMap = new Map<AuditCode, {
    hits: number;
    blockerHits: number;
    warningHits: number;
    commits: Set<string>;
    examples: RuleExample[];
  }>();
  for (const code of ALL_CODES) {
    byRuleMap.set(code, { hits: 0, blockerHits: 0, warningHits: 0, commits: new Set(), examples: [] });
  }

  let commitsWithAnyFinding = 0;
  let commitsBlocked = 0;
  let totalFindings = 0;
  let totalBlockerHits = 0;
  let totalWarningHits = 0;
  const falsePositiveCandidates: BlockerCandidate[] = [];

  for (const sha of shas) {
    const shortSha = sha.slice(0, 7);
    const diff = runGit(['diff', `${sha}^1`, sha]);
    const audit = auditDiff(diff);
    const counted = audit.findings.filter((row) => !row.allowed);

    if (counted.length > 0) commitsWithAnyFinding++;
    if (audit.blockerCount > 0) commitsBlocked++;
    totalFindings += counted.length;
    totalBlockerHits += audit.blockerCount;
    totalWarningHits += audit.warningCount;

    for (const finding of counted) {
      const bucket = byRuleMap.get(finding.code);
      if (!bucket) continue;
      bucket.hits++;
      if (finding.severity === 'blocker') {
        bucket.blockerHits++;
        falsePositiveCandidates.push({
          sha: shortSha,
          code: finding.code,
          file: finding.file,
          line: finding.line,
          snippet: sanitizeSnippet(finding.snippet),
        });
      } else {
        bucket.warningHits++;
      }
      bucket.commits.add(shortSha);
      if (bucket.examples.length < 3) {
        bucket.examples.push({
          sha: shortSha,
          file: finding.file,
          line: finding.line,
          severity: finding.severity,
          snippet: sanitizeSnippet(finding.snippet),
        });
      }
    }
  }

  const commitsScanned = shas.length;
  const byRule: RuleCommitStats[] = ALL_CODES.map((code) => {
    const bucket = byRuleMap.get(code)!;
    return {
      code,
      hits: bucket.hits,
      blockerHits: bucket.blockerHits,
      warningHits: bucket.warningHits,
      commitsHit: bucket.commits.size,
      commitRate: pct(bucket.commits.size, commitsScanned),
      falsePositiveCandidates: bucket.blockerHits,
      examples: bucket.examples,
    };
  });

  return {
    ref: targetRef,
    commitsScanned,
    commitsWithAnyFinding,
    commitsBlocked,
    commitsBlockedRate: pct(commitsBlocked, commitsScanned),
    totalFindings,
    totalBlockerHits,
    totalWarningHits,
    byRule,
    falsePositiveCandidates,
  };
}

function formatConsoleReport(report: SupervisorAuditReport): string {
  const { fixtures, mergeCommits } = report;
  const lines: string[] = [
    `측정 시각: ${report.measuredAt}`,
    `커밋 SHA: ${report.commitSha ?? 'unknown'}`,
    `대상 브랜치: ${mergeCommits.ref} (최근 머지 커밋 ${mergeCommits.commitsScanned}건)`,
    '',
    `### 1. 불량 diff fixtures ${fixtures.total}건 결과`,
    '',
    '| 항목 | 결과 |',
    '| :--- | :--- |',
    `| 전체 일치 | ${formatRate(fixtures.matched, fixtures.total, pct(fixtures.matched, fixtures.total))} |`,
    `| 차단 규칙 적중률 (expect=block) | ${formatRate(fixtures.blockCases.matched, fixtures.blockCases.total, fixtures.blockCases.rate)} |`,
    `| 경고 판정 정확도 (expect=warn) | ${formatRate(fixtures.warnCases.matched, fixtures.warnCases.total, fixtures.warnCases.rate)} |`,
    `| 정상 코드 오탐 수 (expect=clean) | ${fixtures.cleanCases.falsePositives}/${fixtures.cleanCases.total} (${formatRate(fixtures.cleanCases.falsePositives, fixtures.cleanCases.total, fixtures.cleanCases.falsePositiveRate)}) |`,
  ];

  if (fixtures.mismatches.length) {
    lines.push('', '기대와 다르게 판정된 fixture:');
    for (const row of fixtures.mismatches) {
      lines.push(`- ${row.id} (${row.label}): expect=${row.expect} [${row.expectedCodes.join(', ')}] → actual=${row.actual} [${row.actualCodes.join(', ') || 'none'}]`);
    }
  }

  lines.push(
    '',
    `### 2. ${mergeCommits.ref} 최근 머지 커밋 ${mergeCommits.commitsScanned}건 규칙별 집계`,
    '',
    `전체 걸린 커밋: ${mergeCommits.commitsWithAnyFinding}/${mergeCommits.commitsScanned}건 · 차단 걸린 커밋(오탐 후보): ${formatRate(mergeCommits.commitsBlocked, mergeCommits.commitsScanned, mergeCommits.commitsBlockedRate)} · 오탐 후보(차단 건수): ${mergeCommits.totalBlockerHits}건 · 경고 건수: ${mergeCommits.totalWarningHits}건`,
    '',
    '| 규칙 | 걸린 수 | 차단 수 (오탐 후보) | 경고 수 | 걸린 커밋 수 | 커밋 비율 | 예시 (최대 3개) |',
    '| :--- | ---: | ---: | ---: | ---: | ---: | :--- |',
  );

  for (const row of mergeCommits.byRule) {
    const sample = row.examples.length
      ? row.examples.map((ex) => `\`${ex.file}:${ex.line}\` (\`${ex.snippet.replace(/\|/g, '/')}\`)`).join('; ')
      : '—';
    const commitRateText = row.commitRate === null ? '—' : `${row.commitRate.toFixed(1)}%`;
    lines.push(`| \`${row.code}\` | ${row.hits} | ${row.blockerHits} | ${row.warningHits} | ${row.commitsHit} | ${commitRateText} | ${sample} |`);
  }

  if (mergeCommits.falsePositiveCandidates.length) {
    lines.push('', `오탐 후보 목록 (실제 머지 커밋 중 차단 규칙 적중 ${mergeCommits.falsePositiveCandidates.length}건):`);
    for (const item of mergeCommits.falsePositiveCandidates) {
      lines.push(`- [${item.code}] ${item.sha} ${item.file}:${item.line} — ${item.snippet}`);
    }
  }

  return lines.join('\n');
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function kstDateString(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(date);
}

function currentCommitSha(): string | null {
  try {
    return runGit(['rev-parse', 'HEAD']).trim() || null;
  } catch {
    return null;
  }
}

function main() {
  const limitRaw = Number(readArg('--limit') ?? '100');
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? limitRaw : 100;
  const ref = readArg('--ref') ?? 'main';

  const fixturesPath = resolve(process.cwd(), 'tests/fixtures/bad-diffs.json');
  const fixtures = JSON.parse(readFileSync(fixturesPath, 'utf8')) as AuditFixture[];

  const now = new Date();
  const report: SupervisorAuditReport = {
    measuredAt: now.toISOString(),
    commitSha: currentCommitSha(),
    command: 'npx tsx scripts/eval-supervisor.ts',
    fixtures: evaluateFixtures(fixtures),
    mergeCommits: evaluateMergeCommits(ref, limit),
  };

  console.log(formatConsoleReport(report));

  if (!process.argv.includes('--no-write')) {
    const outArg = readArg('--out') ?? `eval-results/${kstDateString(now)}-supervisor-audit.json`;
    const outPath = resolve(process.cwd(), outArg);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`\n저장됨: ${outArg}`);
  }
}

if (require.main === module) {
  main();
}
