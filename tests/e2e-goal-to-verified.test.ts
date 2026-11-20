import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AgentHandoff, { agentStartPrompt } from '../components/goal/AgentHandoff';
import { RepoGoalExit, repoSpecInput, saveRepoPrdProject } from '../components/goal/RepoExit';
import LangProvider from '../components/LangProvider';
import Dashboard from '../components/supervisor/Dashboard';
import type { SupervisorDetail } from '../components/supervisor/data';
import { driftForProject, featureSignals } from '../components/supervisor/model';
import {
  buildValidationHandoff,
  readValidationPrdInput,
  validationPrdHref,
  type ValidationReportPayload,
} from '../components/ValidationReportPanel';
import type { MemoryEntry, ProjectMemory } from '../lib/db/project-memory';
import type { VerificationRecord, VerificationStore } from '../lib/db/verifications';
import { handleRpc, type McpDeps, type SavedPrdDetail } from '../lib/mcp/server';
import type { BuildProgress } from '../lib/opportunities/build-progress';
import type { CommitFileStatus, FeatureCommit } from '../lib/opportunities/feature-commits';
import { signEvidence } from '../lib/opportunities/live-evidence';
import { normalizeSpec, renderSpecMarkdown, type Spec, type SpecInput } from '../lib/opportunities/spec';
import type { Evidence } from '../lib/opportunities/types';
import { readVerificationToken, signVerificationToken } from '../lib/supervisor/verify-token';
import type { ProjectGoal, SupervisorProject } from '../lib/supervisor/types';
import type { GitHubEvidence } from '../lib/verifier/github';
import { startVerification, type VerifierDependencies } from '../lib/verifier/run';

const USER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const DOSSIER_ID = '11111111-2222-3333-4444-555555555555';
const PROJECT_KEY = `prd:${DOSSIER_ID}`;
const SITE = 'https://seedup.test';
const AT = '2026-11-20T10:00:00Z';
const SHA = '1234567890abcdef1234567890abcdef12345678';
const SIGNING_KEY = 'e2e-test-verification-signing-key-32bytes';

const EVIDENCE: Evidence[] = [
  {
    id: 'ev-1',
    platform: 'github',
    quote: 'Oncall handoff notes in Slack get lost between shifts.',
    quoteKo: '교대 때 슬랙 인수인계 메모가 흩어진다.',
    url: 'https://github.com/example/oncall/issues/1',
    score: 18,
    postedAt: AT,
  },
  {
    id: 'ev-2',
    platform: 'hn',
    quote: 'We spend 30 minutes every Monday summarizing unresolved alerts.',
    quoteKo: '매주 월요일 미해결 경고를 정리하는 데 30분이 걸린다.',
    url: 'https://news.ycombinator.com/item?id=101',
    score: 42,
    postedAt: AT,
  },
  {
    id: 'ev-3',
    platform: 'stackoverflow',
    quote: 'Need a simple Slack bot that groups alerts by status for the next engineer.',
    quoteKo: '다음 담당자를 위해 경고를 상태별로 묶어 주는 슬랙 봇이 필요하다.',
    url: 'https://stackoverflow.com/questions/202',
    score: 11,
    postedAt: AT,
  },
];

function buildTestSpec(): { input: SpecInput; spec: Spec; markdown: string } {
  const input: SpecInput = {
    title: '온콜 인수인계 슬랙 봇',
    problem: '교대 때 슬랙에 흩어진 경고를 손으로 정리하느라 인수인계가 늦어진다.',
    gap: '슬랙 메시지만으로 5분 안에 요약하는 가벼운 도구가 없다.',
    evidence: EVIDENCE,
    competitors: ['PagerDuty Handoff'],
  };
  const spec = normalizeSpec({
    summary: '온콜 교대 때 슬랙 경고를 상태별로 요약해 주는 봇.',
    target_users: ['SRE 팀'],
    requirements: [
      {
        title: '교대 기간의 슬랙 경고 요약',
        detail: '채널과 기간을 받아 경고를 묶어 요약한다.',
        priority: 'P0',
        evidence: [1, 2],
        acceptance: ['교대 기간의 경고를 수집해 요약 문자열을 반환한다.'],
      },
      {
        title: '미해결 이슈 필터링',
        detail: '해결 표시가 없는 경고만 골라 보여 준다.',
        priority: 'P1',
        evidence: [2, 3],
        acceptance: ['미해결 경고만 상태별로 분리해 반환한다.'],
      },
    ],
    features: [
      {
        title: '메시지 수집과 요약',
        detail: '슬랙 채널 경고를 모아 요약을 만든다.',
        requirements: [1],
      },
      {
        title: '진행 중 이슈 필터',
        detail: '미해결 경고만 추려 보여 준다.',
        requirements: [2],
      },
    ],
    non_goals: ['경고 자동 복구'],
    metrics: ['인수인계 요약 생성 5초 이내'],
  }, EVIDENCE, false, { idea: true });
  const markdown = renderSpecMarkdown(input, spec);
  return { input, spec, markdown };
}

test('full E2E loop: three entries → goal lock → agent start prompt → MCP resume/setup/connect/next/in_progress/verify/done → dashboard 🟢', async () => {
  const previousModels = process.env.VERIFIER_MODELS;
  const previousSecret = process.env.SUPABASE_SECRET_KEY;
  process.env.VERIFIER_MODELS = 'openai/gpt-6.2-sol,anthropic/claude-haiku-5.5';
  process.env.SUPABASE_SECRET_KEY = SIGNING_KEY;

  try {
    const { input, spec, markdown } = buildTestSpec();

    // --- 1. Entry A (PRD workspace), Entry B (Idea validation), Entry C (Repo analysis) all reach AgentHandoff ---
    // Entry B: Idea validation report carries evidence IDs, signed live quotes, and competitors into PRD input.
    const liveQuote = signEvidence({
      id: 'lv_oncall_1',
      platform: 'hn',
      quote: 'Shift handoff takes too long without an automated Slack summary.',
      quoteKo: '자동 슬랙 요약이 없으면 교대 인수인계가 너무 오래 걸린다.',
      url: 'https://news.ycombinator.com/item?id=999',
      score: 19,
      postedAt: AT,
    }, SIGNING_KEY);
    assert.ok(liveQuote);

    const signedCatalogQuotes = EVIDENCE.map((row) => signEvidence(row, SIGNING_KEY)!);
    const validationReport: ValidationReportPayload = {
      markdown: '# 온콜 인수인계 슬랙 봇\n\n## 판정: 실험해 볼 만함',
      quotes: [...signedCatalogQuotes, liveQuote],
      related: [{ slug: 'oncall-handoff', name: '온콜 인수인계', qualified: true, quotes: 3 }],
      rivals: [{ name: 'PagerDuty Handoff', description: 'Complex enterprise setup', url: 'https://example.com/pd', relation: 'direct' }],
    };
    const href = validationPrdHref(input.title, validationReport);
    const handoffPayload = buildValidationHandoff(input.title, validationReport);
    const query = href.slice(href.indexOf('?'));
    const validationPrdInput = readValidationPrdInput(
      input.title,
      query,
      JSON.stringify(handoffPayload),
      [{ slug: 'oncall-handoff', quotes: EVIDENCE.map((row) => ({ id: row.id })) }],
    );
    assert.ok(validationPrdInput);
    assert.deepEqual(validationPrdInput.evidenceIds, ['ev-1', 'ev-2', 'ev-3', 'lv_oncall_1']);
    assert.equal(validationPrdInput.liveQuotes.length, 4);
    assert.deepEqual(validationPrdInput.competitors, ['PagerDuty Handoff (direct): Complex enterprise setup']);

    // Entry C: Repo analysis saves reverse-spec as prd:<id>, connects the analyzed repo, and renders GoalLock -> AgentHandoff.
    const repoInput = repoSpecInput('octocat', { name: 'handoff-bot', description: input.problem }, spec.summary);
    const savedRepoProject = await saveRepoPrdProject(
      { login: 'octocat', repoName: 'handoff-bot', input: repoInput, spec },
      (async (url: string | URL | Request) => {
        const target = String(url);
        if (target === '/api/opportunities/dossiers') {
          return Response.json({ ok: true, id: DOSSIER_ID });
        }
        if (target === `/api/projects/${encodeURIComponent(PROJECT_KEY)}/repo`) {
          return Response.json({ ok: true, projectKey: PROJECT_KEY, repo: 'octocat/handoff-bot' });
        }
        throw new Error(`Unexpected fetch URL: ${target}`);
      }) as typeof fetch,
    );
    assert.deepEqual(savedRepoProject, { projectKey: PROJECT_KEY, repoConnected: true });

    const repoExitHtml = renderToStaticMarkup(
      createElement(
        LangProvider,
        { lang: 'ko' } as Parameters<typeof LangProvider>[0],
        createElement(RepoGoalExit, {
          login: 'octocat',
          repoName: 'handoff-bot',
          input: repoInput,
          spec,
          projectKey: PROJECT_KEY,
          goalLocked: true,
          repoConnected: true,
        }),
      ),
    );
    assert.match(repoExitHtml, /agent-handoff-title/);
    assert.ok(repoExitHtml.includes(PROJECT_KEY));

    // Entry A / Common exit: AgentHandoff renders the start prompt with the project key and zero tokens.
    const handoffHtml = renderToStaticMarkup(
      createElement(
        LangProvider,
        { lang: 'ko' } as Parameters<typeof LangProvider>[0],
        createElement(AgentHandoff, { projectKey: PROJECT_KEY, input, spec }),
      ),
    );
    const startPrompt = agentStartPrompt(PROJECT_KEY, 'ko');
    assert.ok(handoffHtml.includes(PROJECT_KEY));
    assert.doesNotMatch(startPrompt, /sdp_|Bearer|token|api[_-]?key|svt1\./i);
    const extractedKey = /resume_project (\{"project":"[^"]+"\})/.exec(startPrompt);
    assert.ok(extractedKey);
    const parsedArgs = JSON.parse(extractedKey[1]) as { project: string };
    assert.equal(parsedArgs.project, PROJECT_KEY);

    // --- 2. Locked Goal & Shared In-Memory Project State for MCP Integration ---
    const goal: ProjectGoal = {
      projectKey: PROJECT_KEY,
      track: 'personal',
      version: 1,
      lockedAt: AT,
      changeReason: null,
      statement: '교대 인수인계를 5분 안에 끝낸다.',
      criteria: [
        { id: 'G-1', text: '메시지 수집과 슬랙 채널 요약', measure: '30초 안에 수집 및 요약 완료', status: 'open' },
        { id: 'G-2', text: '미해결 이슈 필터', measure: '누락 0건', status: 'open' },
      ],
      inScope: ['메시지 수집과 요약', '진행 중 이슈 필터'],
      outOfScope: ['경고 자동 복구'],
    };

    let projectRow: SupervisorProject = {
      userId: USER,
      projectKey: PROJECT_KEY,
      repo: null,
      track: 'personal',
      strict: true,
      goalVersion: 1,
    };
    const progress: BuildProgress = {};
    const commits: FeatureCommit[] = [];
    const memory: ProjectMemory = { decisions: [], handoffs: [], facts: [] };
    const savedPrd: SavedPrdDetail = {
      id: DOSSIER_ID,
      title: input.title,
      opportunitySlug: null,
      evidenceCount: EVIDENCE.length,
      updatedAt: AT,
      prdMarkdown: markdown,
      evidence: EVIDENCE,
    };

    // Fake GitHub evidence & fake cross-family verifier model for real startVerification().
    const verifiedFileContent = [
      'export function summarizeAlerts(alerts: string[]) {',
      '  return alerts.join("\\n");',
      '}',
      '',
    ].join('\n');
    const unifiedDiff = [
      'diff --git a/src/handoff.ts b/src/handoff.ts',
      'new file mode 100644',
      '--- /dev/null',
      '+++ b/src/handoff.ts',
      '@@ -0,0 +1,3 @@',
      '+export function summarizeAlerts(alerts: string[]) {',
      '+  return alerts.join("\\n");',
      '+}',
    ].join('\n');

    const githubEvidence: GitHubEvidence = {
      sha: SHA,
      diff: unifiedDiff,
      files: { 'src/handoff.ts': verifiedFileContent },
      checks: [{ name: 'ci / test', conclusion: 'success' }],
      unseen: [],
    };

    const verificationRecords = new Map<string, VerificationRecord>();
    const verificationStore: VerificationStore = {
      authorize: async () => {},
      find: async (scope) =>
        [...verificationRecords.values()].find(
          (row) =>
            row.userId === scope.userId &&
            row.projectKey === scope.projectKey &&
            row.featureId === scope.featureId &&
            row.repo === scope.repo &&
            row.sha === scope.sha,
        ) ?? null,
      claim: async (row) => {
        verificationRecords.set(row.id, structuredClone(row));
        return row;
      },
      save: async (row) => {
        verificationRecords.set(row.id, structuredClone(row));
      },
      get: async (userId, id) => {
        const found = verificationRecords.get(id);
        return found?.userId === userId ? structuredClone(found) : null;
      },
      consume: async () => true,
      refund: async () => {},
    };

    let verifierModelChosen = '';
    const verifierDeps: VerifierDependencies = {
      store: verificationStore,
      github: async (repo, sha) => {
        assert.equal(repo, 'octocat/handoff-bot');
        assert.equal(sha, SHA);
        return githubEvidence;
      },
      model: async <T>(_prompt: string, options?: { models?: string[]; noDataCollection?: boolean; onUsage?: (u: { model: string; promptTokens: number; completionTokens: number }) => void }) => {
        assert.equal(options?.noDataCollection, true);
        verifierModelChosen = options?.models?.[0] ?? '';
        options?.onUsage?.({ model: verifierModelChosen, promptTokens: 120, completionTokens: 45 });
        return {
          verdicts: [
            {
              criterion: '1',
              verdict: 'met',
              reason: 'summarizeAlerts collects and joins the shift alerts into a summary string.',
              citations: [
                {
                  path: 'src/handoff.ts',
                  line: 1,
                  quote: 'export function summarizeAlerts(alerts: string[]) {',
                  verified: true,
                },
              ],
            },
          ],
        } as unknown as T;
      },
      sign: (payload) => signVerificationToken(payload, SIGNING_KEY),
    };

    const mcpDeps: McpDeps = {
      opportunities: async () => [],
      cachedSpec: async () => ({ input, spec }),
      myPrd: async (id) => (id === DOSSIER_ID ? savedPrd : null),
      myPrds: async () => [savedPrd],
      projectGoal: async (key) => (key === PROJECT_KEY ? goal : null),
      projectMemory: async () => memory,
      addProjectMemory: async (_key, entry: MemoryEntry) => {
        if (entry.kind === 'decision') {
          memory.decisions.unshift({ id: String(memory.decisions.length + 1), projectKey: PROJECT_KEY, at: AT, ...entry.body });
        } else if (entry.kind === 'handoff') {
          memory.handoffs.unshift({ projectKey: PROJECT_KEY, at: AT, ...entry.body });
        }
        return { id: '1' };
      },
      supervisorProject: async (key) => (key === PROJECT_KEY ? projectRow : null),
      connectRepo: async (key, repo) => {
        assert.equal(key, PROJECT_KEY);
        projectRow = { ...projectRow, repo };
        return repo;
      },
      generate: async () => spec,
      consume: async () => true,
      related: async () => [],
      progress: async () => progress,
      linkCommit: async (_slug, link: { sha: string; message: string; files: string[]; featureIds: string[]; fileStatuses?: Record<string, CommitFileStatus> }) => {
        for (const featureId of link.featureIds.length ? link.featureIds : ['']) {
          if (!commits.some((row) => row.sha === link.sha && row.feature_id === featureId)) {
            commits.push({
              id: String(commits.length + 1),
              feature_id: featureId,
              sha: link.sha,
              message: link.message,
              files: link.files,
              file_statuses: link.fileStatuses ?? {},
              created_at: AT,
              dismissed_at: null,
            });
          }
        }
      },
      featureFiles: async () =>
        Object.fromEntries(
          commits.filter((row) => row.feature_id).map((row) => [row.feature_id, row.files]),
        ),
      flagRecheck: async () => false,
      unlinkedCommitCount: async () => commits.filter((row) => !row.feature_id).length,
      startVerification: (verifyInput) => startVerification({ ...verifyInput, userId: USER }, verifierDeps),
      fetchCommitDiff: async () => unifiedDiff,
      matchesVerificationToken: (token, projectKey, featureId, sha) =>
        Boolean(readVerificationToken(token, { userId: USER, projectKey, featureId, sha }, SIGNING_KEY)),
      setProgress: async (_slug, feature, status, note, verificationLevel) => {
        progress[feature.id] = {
          title: feature.title,
          status,
          note,
          updatedAt: AT,
          doneAt: status === 'done' ? AT : null,
          verificationLevel: status === 'done' ? (verificationLevel ?? 'self_reported') : 'self_reported',
        };
        return status === 'blocked';
      },
      notifyBlocked: async () => {},
      kept: async () => [],
      validate: async () => null,
      watch: async () => true,
    };

    type RpcReply = {
      result: {
        isError?: boolean;
        content: [{ text: string }];
        structuredContent?: Record<string, unknown>;
      };
    };
    const callMcp = async (name: string, args: Record<string, unknown>) => {
      const response = (await handleRpc(
        { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } },
        mcpDeps,
        SITE,
      )) as RpcReply;
      return { ...response.result, body: response.result.content[0].text };
    };

    // Step 1: resume_project with the project key from the start prompt -> guides setup_project first.
    const resumed = await callMcp('resume_project', { project: PROJECT_KEY });
    assert.equal(resumed.isError, undefined);
    assert.match(resumed.body, /교대 인수인계를 5분 안에 끝낸다\./);
    assert.match(resumed.body, /Repository: not connected/);
    assert.match(resumed.body, /0\/2 done/);
    assert.match(resumed.body, /\nNext: setup_project \{"project":"prd:11111111-2222-3333-4444-555555555555"\}$/);

    // Step 2: setup_project returns AGENTS.md, CLAUDE.md, and hookBundle files without tokens -> guides connect_repo.
    const setup = await callMcp('setup_project', { project: PROJECT_KEY });
    assert.equal(setup.isError, undefined);
    const setupFiles = (setup.structuredContent?.files ?? []) as Array<{ path: string; content: string }>;
    assert.equal(setupFiles.length, 8);
    for (const file of setupFiles) {
      assert.doesNotMatch(file.content, /sdp_[a-f0-9]{48}|Bearer\s|\/api\/mcp\/|svt1\./i);
    }
    assert.match(setup.body, /\nNext: connect_repo \{"project":"prd:11111111-2222-3333-4444-555555555555","repo":"<owner\/repo>"\}$/);

    // Step 3: connect_repo connects the public repository.
    const connected = await callMcp('connect_repo', { project: PROJECT_KEY, repo: 'octocat/handoff-bot' });
    assert.equal(connected.isError, undefined);
    assert.match(connected.body, /Connected octocat\/handoff-bot to prd:11111111-2222-3333-4444-555555555555\./);

    // Step 4: F-01 still has open readiness questions, so get_next_task asks for them before any code is written;
    // the agent records the user's approved answer, and the task opens.
    const questions = await callMcp('get_next_task', { project: PROJECT_KEY });
    assert.equal(questions.isError, undefined);
    assert.match(questions.body, /^F-01 메시지 수집과 요약 \[open questions\]/);
    assert.match(questions.body, /\nNext: record_decision \{.*"feature_ids":\["F-01"\].*"approval":"대화에서 승인"\}$/);
    const answered = await callMcp('record_decision', { project: PROJECT_KEY, title: 'Unparsed alerts are skipped and counted', why: 'User answered in the terminal', agent: 'claude-code', scope_change: false, feature_ids: ['F-01'], approval: '대화에서 승인' });
    assert.equal(answered.isError, undefined);
    // Then get_next_task selects F-01 by contribution to G-1 and instructs update_feature_status(in_progress).
    const nextTask = await callMcp('get_next_task', { project: PROJECT_KEY });
    assert.equal(nextTask.isError, undefined);
    assert.equal(nextTask.structuredContent?.id, 'F-01');
    assert.match(nextTask.body, /^F-01 메시지 수집과 요약 \[todo\]/);
    assert.match(nextTask.body, /\nNext: update_feature_status \{"(?:project|slug)":"prd:11111111-2222-3333-4444-555555555555","feature_id":"F-01","status":"in_progress"\}$/);

    // Step 5: update_feature_status(in_progress).
    const inProgress = await callMcp('update_feature_status', {
      project: PROJECT_KEY,
      feature_id: 'F-01',
      status: 'in_progress',
      note: 'Implementing alert summary in src/handoff.ts',
    });
    assert.equal(inProgress.isError, undefined);
    assert.equal(progress['F-01']?.status, 'in_progress');

    // Step 6: verify_feature runs real startVerification with fake GitHub & fake verifier model (cross-family: codex -> anthropic/claude-haiku-5.5).
    const verified = await callMcp('verify_feature', {
      project: PROJECT_KEY,
      feature: 'F-01',
      sha: SHA,
      developed_with: 'codex',
    });
    assert.equal(verified.isError, undefined);
    assert.equal(verifierModelChosen, 'anthropic/claude-haiku-5.5');
    assert.match(verified.body, /^F-01 @ 12345678: 🟢 supervisor verified\./);
    assert.equal(commits.length, 1);
    assert.deepEqual(commits[0].files, ['src/handoff.ts']);
    assert.deepEqual(commits[0].file_statuses, { 'src/handoff.ts': 'added' });

    const nextDoneMatch = /\nNext: update_feature_status (\{.+\})$/.exec(verified.body);
    assert.ok(nextDoneMatch, 'verify_feature should provide the exact update_feature_status done call with token');
    const doneCallArgs = JSON.parse(nextDoneMatch[1]) as {
      project: string;
      feature_id: string;
      status: string;
      sha: string;
      verification_token: string;
    };
    assert.equal(doneCallArgs.project, PROJECT_KEY);
    assert.equal(doneCallArgs.feature_id, 'F-01');
    assert.equal(doneCallArgs.status, 'done');
    assert.equal(doneCallArgs.sha, SHA);
    assert.match(doneCallArgs.verification_token, /^svt1\./);

    // Step 7: update_feature_status(done, token) passes strict completion gate and records supervisor_verified.
    const completed = await callMcp('update_feature_status', doneCallArgs);
    assert.equal(completed.isError, undefined);
    assert.match(completed.body, /^F-01 메시지 수집과 요약 \[done\] 🟢 supervisor verified/);
    assert.equal(progress['F-01']?.status, 'done');
    assert.equal(progress['F-01']?.verificationLevel, 'supervisor_verified');

    // Step 8: /supervisor dashboard model and component render 🟢 감독관 검증 for F-01 and ⚪ 자가 보고 for F-02.
    const signals = featureSignals(spec, progress);
    assert.deepEqual(
      signals.map((item) => ({ id: item.id, status: item.status, verification: item.verification })),
      [
        { id: 'F-01', status: 'done', verification: 'supervisor_verified' },
        { id: 'F-02', status: 'todo', verification: 'self_reported' },
      ],
    );

    const detail: SupervisorDetail = {
      key: PROJECT_KEY,
      title: input.title,
      goal,
      criteriaMet: 0,
      criteriaTotal: goal.criteria.length,
      lastActivityAt: AT,
      features: signals,
      specAvailable: true,
      lockSpec: null,
      drift: driftForProject(commits, spec, goal, progress),
      decisions: memory.decisions,
      handoffs: memory.handoffs,
      verifications: [],
      files: [],
    };
    assert.deepEqual(detail.drift, []);

    const dashboardKo = renderToStaticMarkup(createElement(Dashboard, { project: detail, lang: 'ko' }));
    assert.match(dashboardKo, /🟢 감독관 검증/);
    assert.match(dashboardKo, /⚪ 자가 보고/);

    const dashboardEn = renderToStaticMarkup(createElement(Dashboard, { project: detail, lang: 'en' }));
    assert.match(dashboardEn, /🟢 Supervisor verified/);
    assert.match(dashboardEn, /⚪ Self-reported/);
  } finally {
    if (previousModels === undefined) delete process.env.VERIFIER_MODELS;
    else process.env.VERIFIER_MODELS = previousModels;
    if (previousSecret === undefined) delete process.env.SUPABASE_SECRET_KEY;
    else process.env.SUPABASE_SECRET_KEY = previousSecret;
  }
});
