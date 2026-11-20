// Goal baseline evaluation (read-only): measures how often saved PRDs in evidence_dossiers
// actually fill the Goals, Non-goals, and Success metrics sections, and how many success metrics
// are measurable (contain a number, ratio, or time period). Never prints or writes personal data.
//
// Usage:
//   npx tsx --env-file=.env scripts/eval-goal.ts [--out eval-results/YYYY-MM-DD-goal-baseline.json] [--no-write]
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient, type PostgrestError } from '@supabase/supabase-js';

const PAGE_SIZE = 1000;

export type GoalSectionKey = 'goals' | 'nonGoals' | 'metrics';

// Section headings produced by lib/opportunities/spec.ts (renderSpecMarkdown / renderAgentBrief).
const SECTION_PATTERNS: ReadonlyArray<readonly [GoalSectionKey, RegExp]> = [
  ['goals', /^(?:목표|goals)$/i],
  ['nonGoals', /^(?:하지\s*않을\s*것|non-?goals|do not build)$/i],
  ['metrics', /^(?:성공\s*지표|success\s*metrics|done when)$/i],
];

// Placeholder lines produced by lib/opportunities/spec.ts (renderSpecMarkdown, renderAgentBrief,
// renderBuilderPrompt) plus empty markers (cf. lib/opportunities/prd-markdown.ts isNone).
const PLACEHOLDERS = new Set([
  '정의되지 않음',
  'not defined',
  'nothing listed yet',
  'agree on a measurable outcome first',
  'anything not listed above',
  '없음',
  '해당 없음',
  'none',
  'n/a',
]);

const BULLET_LINE = /^\s*(?:[-*+•]|\d+[.)])\s+(.*)$/;
const CHECKBOX_PREFIX = /^\[[ xX]\]\s+/;
const MARKDOWN_MARKS = /\*\*|__|`/g;

// Measurable metric = contains a number, an explicit ratio/proportion, or a time period/cadence.
const HAS_NUMBER = /\d/;
const HAS_RATIO = /%|퍼센트|\bpercent(?:age)?\b|절반|과반|\bhalf\b|\b(?:two|three|four|five|ten)\s+times\b|(?:두|세|네|다섯|열)\s*배/i;
const HAS_PERIOD =
  /(?:매일|매주|매월|매달|매년|일간|주간|월간|연간|당일|하루|이틀|사흘|일주일|한\s*주|한\s*달|분기|반기|개월|시간\s*이내|분\s*이내|초\s*이내|일\s*이내|주\s*이내)|\b(?:daily|weekly|monthly|quarterly|yearly|annually|per\s+(?:day|week|month|year|hour|minute|second)|within\s+(?:a|an|one|\d+)\s+(?:day|week|month|hour|minute|second)s?|days?|weeks?|months?|hours?|minutes?|seconds?)\b/i;

export type PrdGoalAnalysis = {
  goals: { filled: boolean; itemCount: number };
  nonGoals: { filled: boolean; itemCount: number };
  metrics: { filled: boolean; itemCount: number; measurableItemCount: number };
  allThreeFilled: boolean;
};

export type RateCount = {
  count: number;
  total: number;
  rate: number | null;
};

export type GoalBaselineSummary = {
  totalPrds: number;
  sections: Record<GoalSectionKey, RateCount>;
  allThreeFilled: RateCount;
  measurableMetrics: {
    measurableItems: number;
    totalItems: number;
    itemRate: number | null;
    prdsWithMeasurableMetric: number;
    prdsWithFilledMetrics: number;
    prdRate: number | null;
    filledMetricsPrdRate: number | null;
  };
};

export type GoalBaselineReport = GoalBaselineSummary & {
  measuredAt: string;
  commitSha: string | null;
  source: 'evidence_dossiers.prd_markdown';
};

function cleanItem(raw: string): string {
  return raw
    .replace(CHECKBOX_PREFIX, '')
    .replace(MARKDOWN_MARKS, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isPlaceholder(text: string): boolean {
  const normalized = cleanItem(text).toLowerCase().replace(/[.。]+$/, '').trim();
  return !normalized || PLACEHOLDERS.has(normalized);
}

export function isMeasurableMetric(text: string): boolean {
  if (isPlaceholder(text)) return false;
  return HAS_NUMBER.test(text) || HAS_RATIO.test(text) || HAS_PERIOD.test(text);
}

function headingText(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(MARKDOWN_MARKS, '')
    .replace(/[:：]\s*$/, '')
    .trim();
}

function extractSectionItems(lines: string[]): string[] {
  const bulletItems: string[] = [];
  const plainItems: string[] = [];
  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed || /^#{1,6}\s+/.test(trimmed) || /^[-*_]{3,}$/.test(trimmed)) continue;
    const bullet = BULLET_LINE.exec(raw);
    if (bullet) {
      const cleaned = cleanItem(bullet[1]);
      if (!isPlaceholder(cleaned)) bulletItems.push(cleaned);
    } else {
      const cleaned = cleanItem(trimmed.replace(/^>\s*/, ''));
      if (!isPlaceholder(cleaned)) plainItems.push(cleaned);
    }
  }
  return bulletItems.length ? bulletItems : plainItems;
}

export function analyzePrdGoalSections(markdown: string): PrdGoalAnalysis {
  const buckets: Record<GoalSectionKey, string[]> = {
    goals: [],
    nonGoals: [],
    metrics: [],
  };

  let current: GoalSectionKey | null = null;
  let inFence = false;

  for (const rawLine of markdown.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (/^(?:```|~~~)/.test(trimmed)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    if (/^#{1,2}\s+\S/.test(trimmed)) {
      const label = headingText(trimmed);
      const matched = /^##\s+/.test(trimmed)
        ? SECTION_PATTERNS.find(([, pattern]) => pattern.test(label))?.[0] ?? null
        : null;
      current = matched;
      continue;
    }

    if (current) buckets[current].push(rawLine);
  }

  const goalItems = extractSectionItems(buckets.goals);
  const nonGoalItems = extractSectionItems(buckets.nonGoals);
  const metricItems = extractSectionItems(buckets.metrics);
  const measurableItemCount = metricItems.filter(isMeasurableMetric).length;

  const goalsFilled = goalItems.length > 0;
  const nonGoalsFilled = nonGoalItems.length > 0;
  const metricsFilled = metricItems.length > 0;

  return {
    goals: { filled: goalsFilled, itemCount: goalItems.length },
    nonGoals: { filled: nonGoalsFilled, itemCount: nonGoalItems.length },
    metrics: { filled: metricsFilled, itemCount: metricItems.length, measurableItemCount },
    allThreeFilled: goalsFilled && nonGoalsFilled && metricsFilled,
  };
}

function rate(count: number, total: number): number | null {
  return total > 0 ? Number(((count / total) * 100).toFixed(1)) : null;
}

export function summarizeGoalBaseline(markdowns: readonly string[]): GoalBaselineSummary {
  const valid = markdowns.filter((value) => typeof value === 'string' && value.trim().length > 0);
  const totalPrds = valid.length;

  let goalsFilled = 0;
  let nonGoalsFilled = 0;
  let metricsFilled = 0;
  let allThree = 0;
  let totalMetricItems = 0;
  let measurableMetricItems = 0;
  let prdsWithMeasurableMetric = 0;

  for (const markdown of valid) {
    const result = analyzePrdGoalSections(markdown);
    if (result.goals.filled) goalsFilled++;
    if (result.nonGoals.filled) nonGoalsFilled++;
    if (result.metrics.filled) metricsFilled++;
    if (result.allThreeFilled) allThree++;
    totalMetricItems += result.metrics.itemCount;
    measurableMetricItems += result.metrics.measurableItemCount;
    if (result.metrics.measurableItemCount > 0) prdsWithMeasurableMetric++;
  }

  return {
    totalPrds,
    sections: {
      goals: { count: goalsFilled, total: totalPrds, rate: rate(goalsFilled, totalPrds) },
      nonGoals: { count: nonGoalsFilled, total: totalPrds, rate: rate(nonGoalsFilled, totalPrds) },
      metrics: { count: metricsFilled, total: totalPrds, rate: rate(metricsFilled, totalPrds) },
    },
    allThreeFilled: { count: allThree, total: totalPrds, rate: rate(allThree, totalPrds) },
    measurableMetrics: {
      measurableItems: measurableMetricItems,
      totalItems: totalMetricItems,
      itemRate: rate(measurableMetricItems, totalMetricItems),
      prdsWithMeasurableMetric,
      prdsWithFilledMetrics: metricsFilled,
      prdRate: rate(prdsWithMeasurableMetric, totalPrds),
      filledMetricsPrdRate: rate(prdsWithMeasurableMetric, metricsFilled),
    },
  };
}

function formatRate(count: number, total: number, value: number | null): string {
  return value === null ? `— (${count}/${total})` : `${value.toFixed(1)}% (${count}/${total})`;
}

export function formatGoalBaselineSummary(report: GoalBaselineReport): string {
  const { sections, allThreeFilled, measurableMetrics } = report;
  const lines = [
    `측정 시각: ${report.measuredAt}`,
    `커밋 SHA: ${report.commitSha ?? 'unknown'}`,
    `대상 PRD 수: ${report.totalPrds}건`,
    '',
    '| 항목 | 결과 |',
    '| :--- | :--- |',
    `| 목표 (## 목표 / ## Goals) 채움 | ${formatRate(sections.goals.count, sections.goals.total, sections.goals.rate)} |`,
    `| 하지 않을 것 (## 하지 않을 것 / ## Non-goals) 채움 | ${formatRate(sections.nonGoals.count, sections.nonGoals.total, sections.nonGoals.rate)} |`,
    `| 성공 지표 (## 성공 지표 / ## Success metrics) 채움 | ${formatRate(sections.metrics.count, sections.metrics.total, sections.metrics.rate)} |`,
    `| 세 섹션 모두 채움 | ${formatRate(allThreeFilled.count, allThreeFilled.total, allThreeFilled.rate)} |`,
    `| 측정 가능한 성공 지표 (항목 기준) | ${formatRate(measurableMetrics.measurableItems, measurableMetrics.totalItems, measurableMetrics.itemRate)} |`,
    `| 측정 가능한 성공 지표 포함 PRD (전체 PRD 기준) | ${formatRate(measurableMetrics.prdsWithMeasurableMetric, report.totalPrds, measurableMetrics.prdRate)} |`,
  ];
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
    return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() || null;
  } catch {
    return null;
  }
}

async function readAll<T>(
  table: string,
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required');

  const service = createClient(url, key, { auth: { persistSession: false } });
  const rows = await readAll<{ prd_markdown: string | null }>('evidence_dossiers', (from, to) =>
    service
      .from('evidence_dossiers')
      .select('prd_markdown')
      .not('prd_markdown', 'is', null)
      .order('id')
      .range(from, to),
  );

  const now = new Date();
  const summary = summarizeGoalBaseline(rows.flatMap((row) => (row.prd_markdown ? [row.prd_markdown] : [])));
  const report: GoalBaselineReport = {
    measuredAt: now.toISOString(),
    commitSha: currentCommitSha(),
    source: 'evidence_dossiers.prd_markdown',
    ...summary,
  };

  console.log(formatGoalBaselineSummary(report));

  if (!process.argv.includes('--no-write')) {
    const outArg = readArg('--out') ?? `eval-results/${kstDateString(now)}-goal-baseline.json`;
    const outPath = resolve(process.cwd(), outArg);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`\n저장됨: ${outArg}`);
  }
}

if (require.main === module) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
