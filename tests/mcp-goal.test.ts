import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import type { MemoryEntry, ProjectMemory } from '../lib/db/project-memory';
import { handleMcpRequest } from '../lib/mcp/endpoint';
import { handleRpc, peopleFirst, type McpDeps, type SavedPrdDetail } from '../lib/mcp/server';
import { normalizeSpec, renderAgentBrief } from '../lib/opportunities/spec';
import { hookBundle } from '../lib/supervisor/hook-bundle';
import { humanTasks } from '../lib/supervisor/human-queue';
import type { ProjectGoal } from '../lib/supervisor/types';

const USER = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const OWN = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const PROJECT = `prd:${OWN}`;
const SITE = 'https://seedup.test';
const AT = '2026-11-20T01:00:00Z';
const MARKDOWN = `## Summary
Plan tasks and reminders.

## Requirements
### R-01 Archive notes
Evidence: E-1
### R-02 Schedule reminders
Evidence: E-1

## Features
### F-01 Archive notes (R-01)
Move old notes to an archive.
### F-02 Send reminders (R-02)
Send a reminder using Resend.

## What existing tools miss
- Existing calendar: Manual reminders
`;
const EVIDENCE = [{ id: 'e1', platform: 'hn' as const, quote: 'I miss scheduled reminders.', quoteKo: '', url: 'https://example.test/evidence', score: 1, postedAt: null }];
const SAVED: SavedPrdDetail = { id: OWN, title: 'My PRD', opportunitySlug: null, evidenceCount: 1, updatedAt: AT, prdMarkdown: MARKDOWN, evidence: EVIDENCE };
const GOAL: ProjectGoal = {
  projectKey: PROJECT, track: 'personal', version: 2, lockedAt: AT, changeReason: 'Clarify scope',
  statement: 'Help people keep their appointments.',
  criteria: [
    { id: 'G-1', text: 'Schedule reminders', measure: 'Deliver within one minute', status: 'open' },
    { id: 'G-2', text: 'Synchronize calendars', measure: 'Refresh within five minutes', status: 'open' },
  ],
  inScope: ['Appointments'], outOfScope: ['Paid plans'],
};
const MEMORY: ProjectMemory = {
  decisions: ['Use email reminders', 'Use UTC internally', 'Limit retries', 'An older decision'].map((title, i) => ({
    id: String(i), projectKey: PROJECT, at: AT, goalVersion: 2, title, why: 'Long rationale kept in full memory',
    rejected: [], author: { kind: 'agent', name: 'Codex' }, approved: i === 0 ? true : null, featureIds: [], criterionIds: [],
  })),
  handoffs: ['Test the email flow', 'Old handoff'].map((next) => ({
    projectKey: PROJECT, agent: 'Codex', doing: 'Build the reminder', next, cautions: [], unverifiedShas: [], at: AT,
  })),
  facts: [{ kind: 'env_name', text: 'REMINDER_SENDER', author: 'Codex', projectKey: PROJECT, at: AT }],
};

function deps(over: Partial<McpDeps> = {}): McpDeps {
  const unexpected = async (): Promise<never> => { throw new Error('Unexpected dependency call'); };
  return {
    opportunities: unexpected, cachedSpec: unexpected, generate: unexpected, consume: unexpected, related: unexpected,
    linkCommit: unexpected, flagRecheck: unexpected, unlinkedCommitCount: unexpected,
    setProgress: unexpected, notifyBlocked: unexpected, kept: unexpected, validate: unexpected, watch: unexpected,
    progress: async () => ({}), featureFiles: async () => ({}),
    myPrd: async (id) => id === OWN ? SAVED : null, myPrds: async () => [SAVED],
    projectGoal: async (key) => key === PROJECT ? GOAL : null, projectMemory: async () => MEMORY,
    ...over,
  };
}

const request = (name: string, args: Record<string, unknown>) => ({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
type Reply = {
  result: {
    isError?: boolean;
    content: [{ text: string }];
    structuredContent?: {
      id?: string;
      goal?: string;
      project?: string;
      goalLocked?: boolean;
      files?: Array<{ path: string; content: string; executable?: boolean }>;
    };
  };
};

async function call(name: string, args: Record<string, unknown>, dependencies = deps()) {
  const { result } = await handleRpc(request(name, args), dependencies, SITE) as Reply;
  return { ...result, body: result.content[0].text };
}

function mockEndpoint(t: TestContext, github: (url: URL, init?: RequestInit) => Response = () => { throw new Error('Unexpected GitHub call'); }) {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.invalid',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'fixture-publishable',
    SUPABASE_SECRET_KEY: 'fixture-service',
    GITHUB_TOKEN: 'fixture-github-token',
  };
  for (const [name, value] of Object.entries(env)) {
    const previous = process.env[name];
    process.env[name] = value;
    t.after(() => { if (previous === undefined) delete process.env[name]; else process.env[name] = previous; });
  }
  const writes: unknown[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string, init?: RequestInit) => {
    const url = new URL(input);
    if (url.hostname === 'api.github.com') return github(url, init);
    assert.equal(url.hostname, 'supabase.invalid');
    switch (url.pathname) {
      case '/rest/v1/mcp_tokens':
        return init?.method === 'PATCH' ? new Response(null, { status: 204 }) : Response.json([{ user_id: USER }]);
      case '/rest/v1/evidence_dossiers':
        assert.equal(url.searchParams.get('user_id'), `eq.${USER}`);
        return Response.json(url.searchParams.get('id') === `eq.${OWN}`
          ? [{ id: OWN, title: SAVED.title, opportunity_slug: null, evidence_ids: ['e1'], evidence: EVIDENCE, prd_markdown: MARKDOWN, updated_at: AT }]
          : []);
      case '/rest/v1/project_goals':
        return Response.json(null);
      case '/rest/v1/supervisor_projects': {
        if (!init?.method || init.method === 'GET') return Response.json(null);
        const body = JSON.parse(String(init?.body));
        writes.push(body);
        if (init?.method === 'POST') {
          assert.deepEqual(body, { user_id: USER, project_key: PROJECT });
          return new Response(null, { status: 201 });
        }
        assert.equal(url.searchParams.get('user_id'), `eq.${USER}`);
        assert.equal(url.searchParams.get('project_key'), `eq.${PROJECT}`);
        return Response.json({ user_id: USER, project_key: PROJECT, repo: body.repo, track: 'personal', strict: false, goal_version: null });
      }
      default:
        throw new Error(`Unexpected DB request: ${url.pathname}`);
    }
  });
  return {
    writes,
    async tool(name: string, args: Record<string, unknown>, pathKey?: string) {
      const token = `sdp_${'a'.repeat(48)}`;
      const response = await handleMcpRequest(new Request(pathKey ? `${SITE}/api/mcp/${pathKey}` : `${SITE}/api/mcp`, {
        method: 'POST',
        headers: pathKey ? {} : { authorization: `Bearer ${token}` },
        body: JSON.stringify(request(name, args)),
      }), pathKey);
      assert.equal(response.status, 200);
      const { result } = await response.json() as Reply;
      return { ...result, body: result.content[0].text };
    },
  };
}

test('the authenticated endpoint resolves a saved PRD only through the owner’s dossier', async (t) => {
  const { tool } = mockEndpoint(t);
  for (const name of ['get_opportunity', 'setup_project'] as const) {
    const other = await tool(name, { project: `prd:${OTHER}` });
    assert.equal(other.isError, true);
    assert.match(other.body, /not found/i);
    assert.doesNotMatch(other.body, /My PRD|scheduled reminders/);
  }
  const own = await tool('get_opportunity', { slug: PROJECT });
  assert.equal(own.isError, undefined);
  assert.match(own.body, /My PRD/);
  assert.match(own.body, /I miss scheduled reminders/);
  assert.match(own.body, /Existing calendar/);

  const pathToken = `sdp_${'b'.repeat(48)}`;
  const setupViaPathToken = await tool('setup_project', { project: PROJECT }, pathToken);
  assert.equal(setupViaPathToken.isError, undefined);
  assert.doesNotMatch(setupViaPathToken.body, /sdp_[a-f0-9]{48}|Bearer\s|\/api\/mcp\/|fixture-service|fixture-github-token/i);
  for (const file of setupViaPathToken.structuredContent?.files ?? []) {
    assert.doesNotMatch(file.content, /sdp_[a-f0-9]{48}|Bearer\s|\/api\/mcp\/|fixture-service|fixture-github-token/i);
  }
});

test('get_next_task uses the locked goal, chooses by contribution, and includes short project memory', async () => {
  const next = await call('get_next_task', { project: PROJECT });
  assert.equal(next.structuredContent?.id, 'F-02');
  assert.match(next.structuredContent?.goal ?? '', /Paid plans/);
  assert.match(next.body, /Help people keep their appointments/);
  assert.match(next.body, /G-1 Schedule reminders.*Deliver within one minute/);
  assert.match(next.body, /Not doing: Paid plans/);
  assert.match(next.body, /Use email reminders \(대화에서 승인\)/);
  assert.match(next.body, /Test the email flow/);
  assert.match(next.body, /update_feature_status.*prd:11111111/);
  assert.doesNotMatch(next.body, /An older decision|Old handoff|Long rationale/);
  const complete = await call('get_next_task', { slug: PROJECT }, deps({ progress: async () => Object.fromEntries(
    ['F-01', 'F-02'].map((id) => [id, { title: id, status: 'done', note: '', updatedAt: AT, doneAt: AT }]),
  ) }));
  assert.match(complete.body, /G-1 Schedule reminders/);
  assert.match(complete.body, /All features are done/);
});

test('initialize and AGENTS.md expose the locked goal for a saved PRD', async () => {
  const initialized = await handleRpc({ jsonrpc: '2.0', id: 1, method: 'initialize' }, deps(), SITE) as { result: { instructions: string } };
  assert.match(initialized.result.instructions, /Active locked goals from recent PRDs/);
  assert.ok(initialized.result.instructions.includes(PROJECT));
  assert.ok(initialized.result.instructions.includes(GOAL.statement));
  for (const brief of [
    await call('get_my_prd', { id: OWN, format: 'agents' }),
    await call('generate_verified_prd', { project: PROJECT }),
  ]) {
    assert.match(brief.body, /Save as AGENTS.md/);
    assert.ok(brief.body.includes('resume_project ' + JSON.stringify({ project: PROJECT })));
    assert.match(brief.body, /before stopping.*save_handoff/i);
    assert.ok(brief.body.includes(PROJECT));
    assert.ok(brief.body.includes(GOAL.statement));
    assert.match(brief.body, /Success criteria\n- G-1 Schedule reminders/);
    assert.match(brief.body, /Do not build\n- Paid plans/);
    assert.match(brief.body, /Recent decisions\n- Use email reminders/);
    assert.doesNotMatch(brief.body, /An older decision/);
  }
});

test('check_env rejects values and only compares names reported from the local environment', async () => {
  for (const args of [
    { names: ['RESEND_API_KEY=fixture-secret'] },
    { names: ['RESEND_API_KEY'], value: 'fixture-secret' },
    { names: { RESEND_API_KEY: 'fixture-secret' } },
  ]) {
    const result = await call('check_env', { project: PROJECT, ...args });
    assert.equal(result.isError, true);
    assert.doesNotMatch(result.body, /fixture-secret/);
  }
  const result = await call('check_env', { project: PROJECT, names: ['RESEND_API_KEY', 'UNRELATED_NAME'] });
  assert.equal(result.isError, undefined);
  assert.match(result.body, /Present: RESEND_API_KEY\nMissing: REMINDER_SENDER/);
  assert.doesNotMatch(result.body, /UNRELATED_NAME/);
});

test('a scope decision requires asking the user and records the terminal approval against the current goal version', async () => {
  const entries: MemoryEntry[] = [];
  const d = deps({ addProjectMemory: async (key, entry) => {
    assert.equal(key, PROJECT);
    entries.push(entry);
    return { id: String(entries.length) };
  } });
  const args = { project: PROJECT, title: 'Add paid plans now', why: 'Users asked for billing', agent: 'Codex', scope_change: false };
  const pending = await call('record_decision', args, d);
  assert.match(pending.body, /ASK USER \(in the terminal, before acting\):/);
  assert.match(pending.body, /Re-lock the goal on the web \(MCP has no goal-lock tool\): https:\/\/seedup\.test\/supervisor\/prd%3A11111111-1111-1111-1111-111111111111 \(planning: https:\/\/seedup\.test\/prd\)/);
  const approval = await call('record_decision', { ...args, approval: '대화에서 승인' }, d);
  assert.match(approval.body, /대화에서 승인/);
  assert.match(approval.body, /Re-lock the goal on the web \(MCP has no goal-lock tool\): https:\/\/seedup\.test\/supervisor\/prd%3A11111111-1111-1111-1111-111111111111/);
  const explicitScope = await call('record_decision', { project: PROJECT, title: 'Expand target users', why: 'Teams asked', agent: 'Codex', scope_change: true }, d);
  assert.match(explicitScope.body, /Re-lock the goal on the web \(MCP has no goal-lock tool\): https:\/\/seedup\.test\/supervisor\/prd%3A11111111-1111-1111-1111-111111111111/);
  const nonScope = await call('record_decision', { project: PROJECT, title: 'Use ISO timestamps', why: 'Standard format', agent: 'Codex', scope_change: false }, d);
  assert.doesNotMatch(nonScope.body, /Re-lock the goal on the web/);
  assert.deepEqual(entries.map((entry) => entry.kind === 'decision' && [entry.body.approved, entry.body.goalVersion]), [[null, 2], [true, 2], [null, 2], [null, 2]]);
});

test('setup_project returns AGENTS.md, CLAUDE.md, and hookBundle without tokens, falls back without a locked goal, and resume_project guides setup_project first', async () => {
  // 1. With a locked goal: returns AGENTS.md (matching web export), CLAUDE.md, and all 6 hookBundle files.
  const withGoal = await call('setup_project', { project: PROJECT });
  assert.equal(withGoal.isError, undefined);
  assert.match(withGoal.body, /^Prepared 8 repository setup files for prd:11111111-1111-1111-1111-111111111111\./);
  assert.match(withGoal.body, /Help people keep their appointments\./);
  assert.match(withGoal.body, /\/hooks/);
  assert.match(withGoal.body, /\nNext: connect_repo \{"project":"prd:11111111-1111-1111-1111-111111111111","repo":"<owner\/repo>"\}$/);

  const files = withGoal.structuredContent?.files ?? [];
  assert.equal(withGoal.structuredContent?.goalLocked, true);
  assert.deepEqual(files.map((file) => file.path), [
    'AGENTS.md',
    'CLAUDE.md',
    '.seedup/goal.md',
    '.seedup/hook.mjs',
    '.seedup/pre-commit.sh',
    '.seedup/audit.mjs',
    '.claude/settings.json',
    '.codex/hooks.json',
  ]);
  const byPath = new Map(files.map((file) => [file.path, file.content]));
  const agentsMd = byPath.get('AGENTS.md') ?? '';
  assert.ok(agentsMd.includes('resume_project ' + JSON.stringify({ project: PROJECT })));
  assert.ok(Buffer.byteLength(agentsMd, 'utf8') <= 24_000);
  assert.ok(agentsMd.includes(`## Project key\n\`${PROJECT}\``));
  assert.ok(agentsMd.includes(`## Locked goal (v2)\n${GOAL.statement}`));
  assert.match(agentsMd, /G-1 Schedule reminders \(measure: Deliver within one minute\)/);
  assert.match(agentsMd, /## Do not build\n- Paid plans/);
  assert.doesNotMatch(agentsMd, /Recent decisions/);
  assert.match(byPath.get('CLAUDE.md') ?? '', /AGENTS\.md/);
  assert.equal((byPath.get('CLAUDE.md') ?? '').trim().split('\n').length, 1);

  for (const file of files) {
    assert.doesNotMatch(file.content, /sdp_[a-f0-9]{48}|Bearer\s|\/api\/mcp\/|svt1\./i, `${file.path} must not contain any token`);
  }

  // When a repo is already connected, setup_project Next: points directly to get_next_task.
  const withRepo = await call('setup_project', { project: PROJECT }, deps({
    supervisorProject: async () => ({ userId: USER, projectKey: PROJECT, repo: 'owner/reminders', track: 'personal', strict: false, goalVersion: 2, updatedAt: AT }),
  }));
  assert.match(withRepo.body, /\nNext: get_next_task \{"project":"prd:11111111-1111-1111-1111-111111111111"\}$/);

  // 2. Without a locked goal: AGENTS.md uses the shared renderer without goal context and the hook bundle is omitted.
  const withoutGoal = await call('setup_project', { project: PROJECT }, deps({ projectGoal: async () => null }));
  assert.equal(withoutGoal.isError, undefined);
  assert.equal(withoutGoal.structuredContent?.goalLocked, false);
  const noGoalFiles = withoutGoal.structuredContent?.files ?? [];
  assert.deepEqual(noGoalFiles.map((file) => file.path), ['AGENTS.md', 'CLAUDE.md']);
  const withGoalWithoutContext = renderAgentBrief(
    { title: SAVED.title, problem: 'Plan tasks and reminders.', gap: '', evidence: EVIDENCE, competitors: ['Existing calendar'] },
    {
      ...normalizeSpec({
        summary: 'Plan tasks and reminders.',
        requirements: [
          { title: 'Archive notes', evidence: [1] },
          { title: 'Schedule reminders', evidence: [1] },
        ],
        features: [
          { title: 'Archive notes', detail: 'Move old notes to an archive.', requirements: [1] },
          { title: 'Send reminders', detail: 'Send a reminder using Resend.', requirements: [2] },
        ],
      }, EVIDENCE, true, { idea: true }),
      rivals: [{ name: 'Existing calendar', misses: 'Manual reminders', answer: '' }],
    },
    'agents',
    PROJECT,
  );
  assert.equal(noGoalFiles[0].content, withGoalWithoutContext);
  assert.doesNotMatch(noGoalFiles[0].content, /## Locked goal/);
  assert.equal(hookBundle(PROJECT, GOAL, humanTasks(normalizeSpec({ summary: 's', requirements: [], features: [] }, 0))).length, 6);

  // 3. resume_project guides setup_project first when repository files are not set up yet (fresh project or has_setup_files: false).
  const freshResume = await call('resume_project', { project: PROJECT }, deps({
    projectMemory: async () => ({ decisions: [], handoffs: [], facts: [] }),
  }));
  assert.match(freshResume.body, /call setup_project first/);
  assert.match(freshResume.body, /\nNext: setup_project \{"project":"prd:11111111-1111-1111-1111-111111111111"\}$/);

  const explicitMissing = await call('resume_project', { project: PROJECT, has_setup_files: false });
  assert.match(explicitMissing.body, /\nNext: setup_project \{"project":"prd:11111111-1111-1111-1111-111111111111"\}$/);

  const explicitPresent = await call('resume_project', { project: PROJECT, has_setup_files: true }, deps({
    projectMemory: async () => ({ decisions: [], handoffs: [], facts: [] }),
  }));
  assert.match(explicitPresent.body, /\nNext: get_next_task \{"project":"prd:11111111-1111-1111-1111-111111111111"\}$/);
});

test('handoff writes exclude credentials and resume uses summaries while full memory keeps details', async () => {
  const entries: MemoryEntry[] = [];
  const d = deps({ addProjectMemory: async (_key, entry) => { entries.push(entry); return { id: '1' }; } });
  const args = { project: PROJECT, agent: 'Codex', doing: 'Build the reminder', next: 'Test the email flow', unverified_shas: ['abc1234'] };
  const rejected = await call('save_handoff', { ...args, cautions: ['RESEND_API_KEY=fixture-secret'] }, d);
  assert.equal(rejected.isError, true);
  assert.doesNotMatch(rejected.body, /fixture-secret/);
  const handoff = await call('save_handoff', args, d);
  assert.equal(handoff.isError, undefined);
  assert.deepEqual(entries, [{ kind: 'handoff', body: { agent: 'Codex', doing: args.doing, next: args.next, cautions: [], unverifiedShas: ['abc1234'] } }]);
  const resumed = await call('resume_project', { project: PROJECT }, d);
  assert.match(resumed.body, /Test the email flow/);
  assert.doesNotMatch(resumed.body, /Old handoff|Long rationale/);
  const full = await call('get_project_memory', { project: PROJECT }, d);
  assert.deepEqual(JSON.parse(full.body), MEMORY);
});

test('connect_repo checks GitHub with the server token and only persists public repositories', async (t) => {
  let checked = 0;
  const { tool, writes } = mockEndpoint(t, (url, init) => {
    checked++;
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer fixture-github-token');
    const privateRepo = url.pathname === '/repos/seedup/private';
    return Response.json({ private: privateRepo, visibility: privateRepo ? 'private' : 'public', full_name: privateRepo ? 'seedup/private' : 'Seedup/Public' });
  });
  assert.equal((await tool('connect_repo', { project: PROJECT, repo: 'seedup/private' })).isError, true);
  assert.equal((await tool('connect_repo', { project: PROJECT, repo: 'https://attacker.test/repo' })).isError, true);
  assert.deepEqual(writes, []);
  assert.match((await tool('connect_repo', { project: PROJECT, repo: 'seedup/public' })).body, /Connected Seedup\/Public/);
  assert.equal(checked, 2);
  assert.equal(writes.length, 2);
});

test('get_next_task puts person-only setup for that feature first, with key names and no values', () => {
  const spec = normalizeSpec({
    summary: 's',
    requirements: [{ title: 'Pay', evidence: [1] }, { title: 'Read', evidence: [1] }],
    features: [{ title: 'Checkout', detail: 'Stripe billing', requirements: [1] }, { title: 'Reader', detail: 'Shows notes', requirements: [2] }],
  }, 1);
  spec.openQuestions = ['Monthly or yearly?'];
  const first = peopleFirst(spec, spec.features[0].id);
  assert.match(first, /^People first/);
  assert.match(first, /STRIPE_SECRET_KEY/);
  assert.match(first, /never ask for or store values/);
  assert.match(first, /1 open decision/);
  assert.equal(peopleFirst(spec, spec.features[1].id), '');
});
