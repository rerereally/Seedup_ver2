import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createClient } from '@supabase/supabase-js';
import { decodeProjectKey, featureSignals, latestActivity, driftForProject } from '../components/supervisor/model';
import { supervisorDetail, supervisorList, type SupervisorDetail } from '../components/supervisor/data';
import Dashboard, { DASHBOARD_TABS, pickTab } from '../components/supervisor/Dashboard';
import ProjectList from '../components/supervisor/ProjectList';
import type { BuildProgress } from '../lib/opportunities/build-progress';
import type { FeatureCommit } from '../lib/opportunities/feature-commits';
import type { ProjectGoal } from '../lib/supervisor/types';
import type { Spec } from '../lib/opportunities/spec';
import { getOpportunities } from '../lib/opportunities/data';

const USER = '00000000-0000-0000-0000-00000000000a';
const PRD = 'abcdef00-2222-3333-4444-555555555555';
const KEY = `prd:${PRD}`;
const spec: Spec = {
  summary: 'A ledger', targetUsers: [], requirements: [], hypotheses: [], screens: [], nonGoals: [], risks: [], metrics: [], draft: false,
  features: [{ id: 'F-01', title: '기록', detail: 'ledger record', requirementIds: [], slots: null }, { id: 'F-02', title: '합계', detail: 'total', requirementIds: [], slots: null }],
};
const goal: ProjectGoal = {
  projectKey: KEY, version: 2, track: 'personal', statement: '1분 안에 기록한다', lockedAt: '2026-11-20T09:00:00Z', changeReason: '범위 축소',
  criteria: [{ id: 'G-1', text: '기록 완료', measure: '시간', status: 'met' }, { id: 'G-2', text: '합계 일치', measure: '대조', status: 'partial' }, { id: 'G-3', text: '내보내기', measure: '파일', status: 'open' }],
  inScope: ['기록'], outOfScope: ['payment billing'],
};
const progress: BuildProgress = { 'F-01': { title: '기록', status: 'done', note: 'local_checked라고 쓴 메모', updatedAt: '2026-11-20T10:00:00Z', doneAt: '2026-11-20T10:00:00Z' } };
const commit = (patch: Partial<FeatureCommit>): FeatureCommit => ({ id: 'c1', sha: 'a'.repeat(40), feature_id: 'F-01', message: 'ledger record', files: ['app/ledger/page.tsx'], created_at: '2026-11-20T09:30:00Z', dismissed_at: null, ...patch });

/** Every tab of one project page, in order, as one string (the page shows one tab at a time). */
const allTabs = (project: SupervisorDetail, lang: 'ko' | 'en') => DASHBOARD_TABS.map((tab) => renderToStaticMarkup(createElement(Dashboard, { project, lang, tab }))).join('');

test('encoded page params decode once and malformed percent signs still fail key validation', () => {
  assert.equal(decodeProjectKey(encodeURIComponent(KEY)), KEY);
  assert.equal(decodeProjectKey('bad%key'), 'bad%key');
});

test('feature signals retain unstarted spec features and never promote done or free text to verification', () => {
  const signals = featureSignals(spec, progress);
  assert.equal(signals.length, 2);
  assert.equal(signals[0].verification, 'self_reported');
  assert.equal(signals[1].status, 'todo');
  assert.deepEqual(featureSignals(null, progress).map((row) => row.id), ['F-01']);
  assert.deepEqual(featureSignals(null, {}), []);
});

test('verification_level maps supervisor_verified (done only), local_checked, and falls back to self_reported', () => {
  const verifiedDone = { 'F-01': { ...progress['F-01'], status: 'done' as const, verificationLevel: 'supervisor_verified' as const } };
  assert.equal(featureSignals(null, verifiedDone)[0].verification, 'supervisor_verified');

  const verifiedRecheck = { 'F-01': { ...progress['F-01'], status: 'needs_recheck' as const, verificationLevel: 'supervisor_verified' as const } };
  assert.equal(featureSignals(null, verifiedRecheck)[0].verification, 'self_reported');

  const localChecked = { 'F-01': { ...progress['F-01'], verificationLevel: 'local_checked' as const } };
  assert.equal(featureSignals(null, localChecked)[0].verification, 'local_checked');

  const unknown = { 'F-01': { ...progress['F-01'], verification: 'passed' } };
  assert.equal(featureSignals(null, unknown)[0].verification, 'self_reported');
});

test('last activity compares instants rather than string order and ignores invalid or absent dates', () => {
  assert.equal(latestActivity([null, '', 'invalid']), null);
  assert.equal(latestActivity(['2026-11-20T11:00:00+09:00', '2026-11-20T03:00:00Z']), '2026-11-20T03:00:00Z');
});

test('drift has no records without both spec and commits, and dismissed unlinked rows are excluded', () => {
  assert.equal(driftForProject([], spec, goal, progress), null);
  assert.equal(driftForProject([commit({})], null, goal, progress), null);
  assert.equal(driftForProject([commit({ feature_id: '', dismissed_at: '2026-11-20T11:00:00Z' })], spec, goal, progress), null);
});

test('drift groups multi-feature commit rows, forwards file_statuses added routes, and stays compatible with legacy commits', () => {
  const linked = [commit({}), commit({ id: 'c2', feature_id: 'F-02' })];
  assert.deepEqual(driftForProject(linked, spec, goal, progress), []);
  const findings = driftForProject([commit({ feature_id: '', message: 'payment billing', files: ['billing.ts'] })], spec, goal, progress)!;
  assert.deepEqual(findings.map((row) => row.kind), ['unlinked_commit', 'non_goal']);
  const outOfSpec = driftForProject([
    commit({
      id: 'c3',
      sha: 'c'.repeat(40),
      feature_id: 'F-01',
      message: 'add invoices screen and api',
      files: ['app/invoices/page.tsx', 'app/api/invoices/route.ts', 'app/ledger/page.tsx'],
      file_statuses: { 'app/invoices/page.tsx': 'added', 'app/api/invoices/route.ts': 'added', 'app/ledger/page.tsx': 'modified' },
    }),
  ], spec, goal, progress)!;
  assert.deepEqual(outOfSpec.map((row) => row.kind), ['out_of_spec']);
  assert.deepEqual(outOfSpec[0].files, ['app/invoices/page.tsx', 'app/api/invoices/route.ts']);
});

test('touched_done uses files from before the commit and only a feature already complete at that time', () => {
  const after = commit({ id: 'c2', sha: 'b'.repeat(40), feature_id: 'F-02', created_at: '2026-11-20T11:00:00Z' });
  const findings = driftForProject([commit({}), after], spec, goal, progress)!;
  assert.deepEqual(findings.map((row) => row.kind), ['touched_done']);
  assert.equal(findings[0].sha, after.sha);
  assert.deepEqual(driftForProject([commit({}), { ...after, created_at: '2026-11-20T09:40:00Z' }], spec, goal, progress), []);
});

function database(reply: (url: URL) => unknown) {
  return createClient('https://supabase.invalid', 'test-key', {
    auth: { persistSession: false }, global: { fetch: async (input, init) => {
      assert.equal(init?.method ?? 'GET', 'GET', 'supervisor reads must not write');
      const url = new URL(String(input));
      assert.equal(url.searchParams.get('user_id'), `eq.${USER}`, 'every private read is bound to the signed-in user');
      const json = reply(url);
      const single = new Headers(init?.headers).get('accept')?.includes('vnd.pgrst.object');
      return Response.json(single && Array.isArray(json) ? json[0] ?? null : json);
    } },
  });
}

test('another user or missing PRD key stops before reading its goals, memory or progress', async () => {
  const queried: string[] = [];
  const client = database((url) => { queried.push(url.pathname); return []; });
  assert.equal(await supervisorDetail(client, USER, KEY), null);
  assert.deepEqual(queried, ['/rest/v1/evidence_dossiers']);
  assert.equal(await supervisorDetail(client, USER, '../secrets'), null);
  assert.equal(queried.length, 1);
});

test('a real public opportunity is still unavailable when the user has no project or saved PRD', async () => {
  const opportunity = (await getOpportunities()).opportunities[0];
  assert.ok(opportunity);
  const queried: string[] = [];
  const client = database((url) => { queried.push(url.pathname); return []; });
  assert.equal(await supervisorDetail(client, USER, opportunity.slug), null);
  assert.ok(!queried.some((path) => /project_goals|project_memory|build_progress|feature_commits/.test(path)));
  assert.equal(await supervisorDetail(client, USER, 'no-such-seedup-project-b2'), null);
});

test('owned personal PRD loads scoped data, exact bundle contents, criterion count and latest memory activity', async () => {
  const client = database((url) => {
    switch (url.pathname.split('/').pop()) {
      case 'verifications':
        assert.equal(url.searchParams.get('project_key'), `eq.${KEY}`);
        assert.ok(!url.searchParams.get('select')?.split(',').some((column) => column === '*' || column === 'token'));
        return [{ id: 'v1', feature_id: 'F-01', repo: 'org/project', sha: 'a'.repeat(40), status: 'failed',
          created_at: '2026-11-20T10:00:00Z', model: null, checks: [],
          verdicts: [{ criterion: '7', verdict: 'unclear', reason: 'Expected source was missing.',
            citations: [{ path: 'tests/read.py', line: 76, quote: 'assert active', verified: false }] }] }];
      case 'evidence_dossiers': return [{ id: PRD, title: '내 프로젝트', evidence_ids: [], prd_markdown: '# ledger', updated_at: '2026-11-19T09:00:00Z' }];
      case 'project_goals': return [{ project_key: KEY, version: goal.version, track: goal.track, statement: goal.statement, criteria: goal.criteria, in_scope: goal.inScope, out_of_scope: goal.outOfScope, locked_at: goal.lockedAt, change_reason: goal.changeReason }];
      case 'project_memory': return url.searchParams.get('kind') === 'eq.decision' ? [{ id: 'd1', body: { title: '범위 축소', why: '시간', author: { kind: 'person', name: '사용자' }, approved: true, goalVersion: 2, rejected: [], featureIds: [], criterionIds: [] }, created_at: '2026-11-20T12:00:00Z' }] : [];
      case 'build_progress': return [{ feature_id: 'F-01', feature_title: '기록', status: 'done', note: 'done', updated_at: progress['F-01'].updatedAt, done_at: progress['F-01'].doneAt }];
      case 'supervisor_projects': return [{ user_id: USER, project_key: KEY, repo: null, track: 'personal', strict: false, goal_version: 2, updated_at: '2026-11-20T09:00:00Z' }];
      default: return [];
    }
  });
  const result = await supervisorDetail(client, USER, encodeURIComponent(KEY));
  assert.ok(result);
  assert.equal(result.criteriaMet, 1);
  assert.equal(result.criteriaTotal, 3);
  assert.equal(result.lastActivityAt, '2026-11-20T12:00:00Z');
  assert.equal(result.features[0].verification, 'self_reported');
  assert.equal(result.drift, null);
  assert.equal(result.decisions[0].title, '범위 축소');
  assert.equal(result.verifications?.[0].feature_id, 'F-01');
  const html = allTabs(result, 'en');
  for (const value of ['Did not pass', 'Criterion', 'Unclear', 'Expected source was missing.', 'tests/read.py', 'assert active', 'Unverified']) assert.ok(html.includes(value));
  assert.deepEqual(result.files.map((row) => row.path), ['.seedup/goal.md', '.seedup/hook.mjs', '.seedup/pre-commit.sh', '.seedup/audit.mjs', '.claude/settings.json', '.codex/hooks.json']);
  assert.ok(result.files[0].content.includes(goal.statement));
  assert.ok(JSON.parse(result.files[4].content).hooks.SessionStart);
  assert.ok(JSON.parse(result.files[5].content).hooks.SessionStart);
  const list = await supervisorList(client, USER);
  assert.ok(list.some((row) => row.key === KEY && row.criteriaMet === 1));
});

test('dashboard renders the goal first, all criterion states, safe text, English copy and green badge only for supervisor_verified', () => {
  const project: SupervisorDetail = { key: KEY, title: '<script>alert(1)</script>', goal, criteriaMet: 1, criteriaTotal: 3, lastActivityAt: goal.lockedAt,
    features: featureSignals(spec, progress), specAvailable: true, lockSpec: null, prd: { markdown: null, quotes: [] }, repo: null, track: null, strict: false, commits: [], facts: [], spec: null, progress: {}, history: {}, next: null, featureFiles: {}, specQuotes: [],  drift: [], decisions: [], files: [], verifications: [],
    handoffs: [{ projectKey: KEY, agent: 'Codex', doing: 'Read inputs', next: 'Check totals', cautions: ['Missing headers'], unverifiedShas: ['b'.repeat(40)], at: goal.lockedAt }] };
  const html = allTabs(project, 'en');
  assert.ok(html.indexOf('Locked goal') < html.indexOf('Feature signals'));
  for (const value of ['open', 'partial', 'met', 'Self-reported', 'Goal version', 'Out of scope', 'Recent decisions']) assert.ok(html.includes(value));
  assert.ok(!html.includes('text-seed'));
  for (const value of ['Read inputs', 'Check totals', 'Missing headers', 'Unverified commits']) assert.ok(html.includes(value));

  const verifiedProgress: BuildProgress = {
    'F-01': { ...progress['F-01'], status: 'done', verificationLevel: 'supervisor_verified' },
    'F-02': { title: '합계', status: 'in_progress', note: '', verificationLevel: 'local_checked', updatedAt: '2026-11-20T10:00:00Z', doneAt: null },
  };
  const verifiedProject: SupervisorDetail = { ...project, features: featureSignals(spec, verifiedProgress) };
  const koHtml = renderToStaticMarkup(createElement(Dashboard, { project: verifiedProject, lang: 'ko' }));
  assert.ok(koHtml.includes('text-seed'));
  assert.ok(koHtml.includes('🟢 감독관 검증'));
  assert.ok(koHtml.includes('🔵 로컬 확인'));
  const enHtml = renderToStaticMarkup(createElement(Dashboard, { project: verifiedProject, lang: 'en' }));
  assert.ok(enHtml.includes('🟢 Supervisor verified'));
  assert.ok(enHtml.includes('🔵 Local check'));

  const list = renderToStaticMarkup(createElement(ProjectList, { projects: [project], lang: 'en' }));
  assert.ok(list.includes('&lt;script&gt;'));
  assert.ok(!list.includes('<script>'));
  assert.ok(list.includes(encodeURIComponent(KEY)));
});

test('empty dashboard shows missing records without claiming verification or inventing a goal', () => {
  const project: SupervisorDetail = { key: KEY, title: 'empty', goal: null, criteriaMet: 0, criteriaTotal: 0, lastActivityAt: null,
    features: [], specAvailable: false, lockSpec: null, prd: { markdown: null, quotes: [] }, repo: null, track: null, strict: false, commits: [], facts: [], spec: null, progress: {}, history: {}, next: null, featureFiles: {}, specQuotes: [],  drift: null, decisions: [], files: [], verifications: [], handoffs: [] };
  const html = renderToStaticMarkup(createElement(Dashboard, { project, lang: 'ko' }));
  assert.ok(html.includes('아직 기록 없음'));
  assert.ok(html.includes('아직 잠긴 목표가 없습니다'));
  assert.ok(!html.includes('text-seed'));
});

test('tabs: unknown values fall back to the overview, and each MCP record shows on its own tab', () => {
  assert.equal(pickTab('setup'), 'setup');
  assert.equal(pickTab('nope'), 'overview');
  assert.equal(pickTab(undefined), 'overview');
  const project: SupervisorDetail = { key: KEY, title: 't', goal: null, criteriaMet: 0, criteriaTotal: 0, lastActivityAt: null,
    features: [], specAvailable: false, lockSpec: null, drift: null, decisions: [], files: [], verifications: [], handoffs: [],
    prd: { markdown: '# Spec title', quotes: [{ quote: 'I keep losing issues', url: 'https://news.ycombinator.com/item?id=1', platform: 'hn' }] },
    repo: 'octo/app', track: 'personal', strict: true,
    commits: [{ sha: 'a'.repeat(40), message: 'Add digest\nbody', featureId: 'F-01', files: 2, at: '2026-11-20T10:00:00Z', dismissed: false }],
    facts: [{ projectKey: KEY, kind: 'env_name', text: 'SLACK_WEBHOOK_URL', author: 'Claude Code', at: '2026-11-20T10:00:00Z' }],
    spec, progress, history: {}, next: null, featureFiles: { 'F-01': { count: 1, files: ['src/lib/read.py', 'README.md'] } }, specQuotes: [] };
  const render = (tab: (typeof DASHBOARD_TABS)[number]) => renderToStaticMarkup(createElement(Dashboard, { project, lang: 'en', tab }));
  assert.ok(render('prd').includes('Spec title') && render('prd').includes('I keep losing issues'));
  assert.ok(render('activity').includes('https://github.com/octo/app/commit/' + 'a'.repeat(40)) && render('activity').includes('Add digest'));
  assert.ok(!render('activity').includes('body'));
  assert.ok(render('memory').includes('SLACK_WEBHOOK_URL'));
  assert.ok(render('setup').includes('octo/app') && render('setup').includes('On: no self-reported done'));
  assert.ok(!render('overview').includes('SLACK_WEBHOOK_URL'));
  assert.ok(render('overview').includes('aria-current="page"'));
  const files = render('files');
  assert.ok(files.includes('src/lib/') && files.includes('read.py') && files.includes('README.md') && files.includes('F-01'));
  assert.ok(render('work').includes(spec.features[0].title));
});

test('a PRD with no locked goal (one made over MCP) gets the lock form on its dashboard', () => {
  const project: SupervisorDetail = { key: KEY, title: 'mcp prd', goal: null, criteriaMet: 0, criteriaTotal: 0, lastActivityAt: null,
    features: featureSignals(spec, progress), specAvailable: true, lockSpec: spec, prd: { markdown: null, quotes: [] }, repo: null, track: null, strict: false, commits: [], facts: [], spec: null, progress: {}, history: {}, next: null, featureFiles: {}, specQuotes: [],  drift: null, decisions: [], files: [], verifications: [], handoffs: [] };
  const html = renderToStaticMarkup(createElement(Dashboard, { project, lang: 'ko' }));
  assert.ok(html.includes('목표 잠그기'));
  assert.ok(!html.includes('기획 탭에서 목표를 잠가 주세요'));
});

test('the list shows supervisor projects only, not every saved PRD, and skips a project whose PRD is gone', async () => {
  const OTHER = 'abcdef00-9999-3333-4444-555555555555';
  const GONE = 'abcdef00-8888-3333-4444-555555555555';
  const client = database((url) => {
    switch (url.pathname.split('/').pop()) {
      case 'supervisor_projects': return [
        { user_id: USER, project_key: KEY, repo: null, track: 'personal', strict: false, goal_version: null, updated_at: '2026-11-20T09:00:00Z' },
        { user_id: USER, project_key: `prd:${GONE}`, repo: null, track: 'personal', strict: false, goal_version: null, updated_at: '2026-11-20T08:00:00Z' },
      ];
      case 'evidence_dossiers': return [
        { id: PRD, title: '감독 프로젝트', evidence_ids: [], prd_markdown: '# a', updated_at: '2026-11-19T09:00:00Z' },
        { id: OTHER, title: '그냥 저장한 PRD', evidence_ids: [], prd_markdown: '# b', updated_at: '2026-11-19T10:00:00Z' },
      ];
      default: return [];
    }
  });
  const list = await supervisorList(client, USER);
  assert.deepEqual(list.map((row) => [row.key, row.title]), [[KEY, '감독 프로젝트']]);
});
