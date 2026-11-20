// Offline demo CLI for the Seedup 2-stage supervisor (no network, no DB, fake dependencies only).
// Demonstrates:
//   1) Bad diff (secret + not implemented + TODO) -> blocked statically with 0 model calls
//   2) Fixed diff + passing CI -> passed with verified code citations & 🟢 supervisor_verified token
//   3) Out-of-spec commit -> drift warning (out_of_spec)
// Output follows DESIGN.md section 8.1 (first line outcome, locked goal, body, single Next: line).
//
// Usage:
//   npx tsx scripts/demo-seedup-supervisor.ts
import { normalizeSpec } from '../lib/opportunities/spec';
import type { VerificationRecord, VerificationStore } from '../lib/db/verifications';
import { findDrift } from '../lib/supervisor/drift';
import { goalSummary } from '../lib/supervisor/goal';
import { readVerificationToken, signVerificationToken } from '../lib/supervisor/verify-token';
import type { ProjectGoal } from '../lib/supervisor/types';
import { startVerification, type VerifierDependencies } from '../lib/verifier/run';

const PROJECT_KEY = 'overdue-invoice-tracking';
const REPO = 'demo-builder/invoice-tracker';
const USER_ID = 'demo-user-01';
const DEMO_SIGNING_SECRET = 'demo-offline-signing-key-not-for-prod';

const DEMO_GOAL: ProjectGoal = {
  projectKey: PROJECT_KEY,
  version: 1,
  track: 'launch',
  statement: '연체 송장을 자동으로 판별하고 중복 없이 독촉 초안을 만든다.',
  criteria: [
    { id: 'G-1', text: '마감일이 지난 미결제 송장을 100% 연체로 판별', measure: '단위 테스트 5건 통과', status: 'partial' },
    { id: 'G-2', text: '같은 송장에 24시간 내 중복 독촉 발송 0건', measure: '중복 차단 테스트 통과', status: 'open' },
  ],
  inScope: ['연체 판별', '독촉 메일 초안 및 중복 차단'],
  outOfScope: ['자동 결제 출금', '회계 ERP 연동'],
  lockedAt: '2026-11-20T00:00:00.000Z',
  changeReason: null,
};

const DEMO_SPEC = normalizeSpec(
  {
    summary: '연체 송장 판별 및 중복 없는 독촉 알림 도구',
    requirements: [
      {
        title: '사용자는 연체 송장을 자동 판별하고 중복 없이 독촉할 수 있어야 한다',
        detail: '마감일 경과 미결제 송장을 골라 24시간 이내 발송 이력이 없을 때만 독촉 초안을 만든다.',
        evidence: [1],
        priority: 'P0',
        acceptance: ['마감일 경과 송장을 연체로 분류한다', '24시간 내 발송 이력이 있으면 건너뛴다'],
      },
    ],
    features: [
      {
        title: 'Reminder sender',
        detail: '연체 송장을 판별하고 24시간 내 중복 독촉을 막아 초안을 반환한다.',
        requirements: [1],
      },
    ],
    screens: [
      { name: 'Reminders', does: '연체 송장 목록과 독촉 초안을 확인한다.', features: [1] },
    ],
    non_goals: ['자동 결제 출금', '회계 ERP 연동'],
    metrics: ['중복 독촉 0건 (단위 테스트로 확인)'],
  },
  1,
);

function createMemoryStore(): VerificationStore {
  const rows = new Map<string, VerificationRecord>();
  const keyOf = (item: { userId: string; projectKey: string; featureId: string; sha: string }) =>
    `${item.userId}:${item.projectKey}:${item.featureId}:${item.sha}`;
  return {
    async authorize() {},
    async find(query) {
      return rows.get(keyOf(query)) ?? null;
    },
    async get(userId, id) {
      for (const row of rows.values()) {
        if (row.userId === userId && row.id === id) return row;
      }
      return null;
    },
    async claim(row) {
      const existing = rows.get(keyOf(row));
      if (existing) return existing;
      rows.set(keyOf(row), row);
      return row;
    },
    async save(row) {
      rows.set(keyOf(row), row);
    },
    async consume() {
      return true;
    },
    async refund() {},
  };
}

/** DESIGN.md 8.2 / 8.5 status marks: ⚪ belongs to self-reported only; open criterion uses ⬜. */
function formatGoalBlock(goal: ProjectGoal): string {
  return goalSummary(goal, 'ko')
    .replace(/^⚪ /gm, '⬜ ')
    .split('\n')
    .slice(0, 4)
    .join('\n');
}

function renderScene(title: string, outcome: string, goal: ProjectGoal, bodyLines: string[], nextCall: string): string {
  return [
    `=== ${title} ===`,
    outcome,
    '',
    formatGoalBlock(goal),
    '',
    ...bodyLines,
    '',
    `Next: ${nextCall}`,
  ].join('\n');
}

export async function runSupervisorDemo(): Promise<{
  outputs: string[];
  scene1ModelCalls: number;
  scene1Status: string;
  scene2ModelCalls: number;
  scene2Status: string;
  scene2TokenVerified: boolean;
  scene3DriftKinds: string[];
}> {
  if (!process.env.VERIFIER_MODELS) {
    process.env.VERIFIER_MODELS = 'openai/gpt-6.2-sol,anthropic/claude-haiku-5.5';
  }

  const store = createMemoryStore();
  const outputs: string[] = [];

  // Scene 1: Bad diff (fake secret + not implemented + TODO) -> blocked statically, 0 model calls.
  const badSha = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f60001';
  const fakeKey = ['sk', 'test', 'FAKE0000000000000000000000000000'].join('-');
  const badDiff = [
    'diff --git a/lib/reminders.ts b/lib/reminders.ts',
    '--- a/lib/reminders.ts',
    '+++ b/lib/reminders.ts',
    '@@ -1,0 +1,5 @@',
    `+const RESEND_FALLBACK = '${fakeKey}';`,
    '+export async function sendReminder(invoiceId: string) {',
    '+  // TODO: check 24h cooldown before sending',
    "+  throw new Error('sendReminder not implemented');",
    '+}',
  ].join('\n');

  let scene1ModelCalls = 0;
  const scene1Deps: VerifierDependencies = {
    store,
    github: async (_repo, sha) => ({
      sha,
      diff: badDiff,
      files: {},
      checks: [{ name: 'test', conclusion: 'success' }],
      unseen: [],
    }),
    model: (async () => {
      scene1ModelCalls++;
      throw new Error('Model must not be called when static blockers exist');
    }) as VerifierDependencies['model'],
    sign: (payload) => signVerificationToken(payload, DEMO_SIGNING_SECRET),
  };

  const blocked = await startVerification(
    {
      userId: USER_ID,
      projectKey: PROJECT_KEY,
      featureId: 'F-01',
      repo: REPO,
      sha: badSha,
      developmentModel: 'anthropic/claude-sonnet-5.5',
      criteria: [
        { id: 'C-1', text: '24시간 내 중복 독촉을 차단한다', paths: ['lib/reminders.ts'] },
        { id: 'C-2', text: '단위 테스트(CI)를 통과한다', kind: 'test' },
      ],
      outOfScope: DEMO_GOAL.outOfScope,
    },
    scene1Deps,
  );

  const blockers = blocked.findings.filter((row) => !row.allowed && row.severity === 'blocker');
  const warnings = blocked.findings.filter((row) => !row.allowed && row.severity === 'warning');
  outputs.push(
    renderScene(
      'Scene 1: 구라 · 시크릿 diff → 정적 차단',
      `F-01 Reminder sender [blocked] — ${blockers.length} blockers, ${warnings.length} warnings, model calls: ${scene1ModelCalls}`,
      DEMO_GOAL,
      [
        'Static audit blocked before calling any verifier model (secrets redacted):',
        ...blocked.findings.map((row) => `- [${row.severity}:${row.code}] ${row.file}:${row.line} — ${row.message}`),
      ],
      `verify_feature {"project":"${PROJECT_KEY}","feature_id":"F-01","sha":"<fixed_sha>"}`,
    ),
  );

  // Scene 2: Fixed diff + CI success -> independent model + code citation check -> 🟢 supervisor verified.
  const fixedSha = 'b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a10002';
  const fixedFile = [
    'const COOLDOWN_MS = 24 * 60 * 60 * 1000;',
    '',
    'export function canSendReminder(lastSentAt: number | null, now: number): boolean {',
    '  if (lastSentAt !== null && now - lastSentAt < COOLDOWN_MS) return false;',
    '  return true;',
    '}',
  ].join('\n');
  const fixedTestFile = [
    "import assert from 'node:assert/strict';",
    "import test from 'node:test';",
    "import { canSendReminder } from '../lib/reminders';",
    '',
    "test('blocks duplicate reminder within 24h', () => {",
    '  assert.equal(canSendReminder(1000, 1000 + 60_000), false);',
    '});',
  ].join('\n');
  const fixedDiff = [
    'diff --git a/lib/reminders.ts b/lib/reminders.ts',
    '--- a/lib/reminders.ts',
    '+++ b/lib/reminders.ts',
    '@@ -1,0 +1,6 @@',
    ...fixedFile.split('\n').map((line) => `+${line}`),
    'diff --git a/tests/reminders.test.ts b/tests/reminders.test.ts',
    '--- a/tests/reminders.test.ts',
    '+++ b/tests/reminders.test.ts',
    '@@ -1,0 +1,7 @@',
    ...fixedTestFile.split('\n').map((line) => `+${line}`),
  ].join('\n');

  let scene2ModelCalls = 0;
  const scene2Deps: VerifierDependencies = {
    store,
    github: async (_repo, sha) => ({
      sha,
      diff: fixedDiff,
      files: { 'lib/reminders.ts': fixedFile, 'tests/reminders.test.ts': fixedTestFile },
      checks: [{ name: 'ci / test', conclusion: 'success' }],
      unseen: [],
    }),
    model: (async (_prompt, options) => {
      scene2ModelCalls++;
      options?.onUsage?.({ model: 'openai/gpt-6.2-sol', promptTokens: 420, completionTokens: 110 });
      return {
        verdicts: [
          {
            criterion: 'C-1',
            verdict: 'met',
            reason: '24시간 쿨다운(COOLDOWN_MS)으로 중복 독촉을 차단합니다.',
            citations: [
              {
                path: 'lib/reminders.ts',
                line: 4,
                quote: 'if (lastSentAt !== null && now - lastSentAt < COOLDOWN_MS) return false;',
              },
            ],
          },
          {
            criterion: 'C-2',
            verdict: 'met',
            reason: '중복 차단 테스트와 GitHub CI check (ci / test)가 success로 확인됐습니다.',
            citations: [
              {
                path: 'tests/reminders.test.ts',
                line: 6,
                quote: 'assert.equal(canSendReminder(1000, 1000 + 60_000), false);',
              },
            ],
          },
        ],
        outOfScope: [],
      };
    }) as VerifierDependencies['model'],
    sign: (payload) => signVerificationToken(payload, DEMO_SIGNING_SECRET),
  };

  const passed = await startVerification(
    {
      userId: USER_ID,
      projectKey: PROJECT_KEY,
      featureId: 'F-01',
      repo: REPO,
      sha: fixedSha,
      developmentModel: 'anthropic/claude-sonnet-5.5',
      criteria: [
        { id: 'C-1', text: '24시간 내 중복 독촉을 차단한다', paths: ['lib/reminders.ts'] },
        { id: 'C-2', text: '단위 테스트(CI)를 통과한다', kind: 'test', paths: ['tests/reminders.test.ts'] },
      ],
      outOfScope: DEMO_GOAL.outOfScope,
    },
    scene2Deps,
  );

  const tokenVerified = Boolean(
    passed.token &&
      readVerificationToken(
        passed.token,
        { userId: USER_ID, projectKey: PROJECT_KEY, featureId: 'F-01', sha: fixedSha },
        DEMO_SIGNING_SECRET,
      ),
  );
  const verifiedCitations = passed.verdicts.flatMap((row) => row.citations).filter((c) => c.verified).length;
  const badge = passed.status === 'passed' && tokenVerified
    ? '🟢 감독관 검증 / supervisor verified'
    : '⚪ 미통과 / verification failed';
  outputs.push(
    renderScene(
      'Scene 2: 고친 diff → 서버 2단 검증 통과',
      `F-01 Reminder sender [${passed.status}] ${badge} — model: ${passed.model}, calls: ${scene2ModelCalls}`,
      DEMO_GOAL,
      [
        `Static audit: 0 blockers, 0 warnings · CI checks: ${passed.checks.map((c) => `${c.name}=${c.conclusion}`).join(', ')} · verified citations: ${verifiedCitations} · signed token: ${tokenVerified ? 'valid' : 'missing'}`,
        ...passed.verdicts.map((row) => `- ${row.criterion}: ${row.verdict} — ${row.reason}`),
      ],
      `update_feature_status {"project":"${PROJECT_KEY}","feature_id":"F-01","status":"done","verification_token":"<signed_token>"}`,
    ),
  );

  // Scene 3: Out-of-spec commit (route & table not in spec) -> drift warning.
  const driftSha = 'c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b20003';
  const driftFindings = findDrift(
    [
      {
        sha: driftSha.slice(0, 7),
        message: 'add accounting erp sync endpoint',
        files: ['app/api/erp-export/route.ts', 'supabase/migrations/20261120160000_erp_exports.sql'],
        featureIds: ['F-01'],
        addedFiles: ['app/api/erp-export/route.ts'],
        addedTables: ['erp_exports'],
      },
    ],
    DEMO_SPEC,
    DEMO_GOAL,
  );

  outputs.push(
    renderScene(
      'Scene 3: 이탈 예시 (명세 밖 파일 · 테이블) → 경고',
      `Drift check for ${PROJECT_KEY} (${driftSha.slice(0, 7)}) [warn] — ${driftFindings.length} drift findings`,
      DEMO_GOAL,
      [
        ...driftFindings.map((row) => `- [warn:${row.kind}] ${row.files.join(', ')} — ${row.message}`),
        '',
        'ASK USER (in the terminal, before acting):',
        '명세에 없는 app/api/erp-export/route.ts와 erp_exports 테이블을 이번 범위에 포함할까요, 아니면 되돌릴까요?',
        'Options: 되돌리고 F-01 범위 유지 / 새 목표 버전으로 범위 추가',
        'After the answer: record_decision {"approval":"대화에서 승인" | "대화에서 거절","project":"overdue-invoice-tracking"}',
      ],
      `record_decision {"project":"${PROJECT_KEY}","title":"erp-export 범위 외 변경 처리","feature_ids":["F-01"]}`,
    ),
  );

  return {
    outputs,
    scene1ModelCalls,
    scene1Status: blocked.status,
    scene2ModelCalls,
    scene2Status: passed.status,
    scene2TokenVerified: tokenVerified,
    scene3DriftKinds: driftFindings.map((row) => row.kind),
  };
}

if (require.main === module) {
  void runSupervisorDemo()
    .then(({ outputs }) => {
      console.log(outputs.join('\n\n'));
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
