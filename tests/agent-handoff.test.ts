import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AgentHandoff, { agentStartPrompt, loadProjectGoal, renderProjectBrief, supervisorHref } from '../components/goal/AgentHandoff';
import LangProvider from '../components/LangProvider';
import { renderAgentBrief, type Spec, type SpecInput } from '../lib/opportunities/spec';
import type { ProjectGoal } from '../lib/supervisor/types';

const key = 'prd:abcdef00-2222-3333-4444-555555555555';
const input: SpecInput = { title: '배포 알림', problem: '실패를 놓친다', gap: '', evidence: [], competitors: [] };
const spec: Spec = {
  summary: '원래 PRD 목표', targetUsers: [], requirements: [], hypotheses: [],
  features: [{ id: 'F-01', title: '알림', detail: '배포 실패를 알린다', requirementIds: [], slots: null }],
  screens: [], nonGoals: ['결제'], risks: [], metrics: ['알림 도착'], draft: false,
};
const goal: ProjectGoal = {
  projectKey: key, version: 2, track: 'personal', statement: '배포 실패를 1분 안에 확인한다',
  criteria: [{ id: 'G-1', text: '실패 알림', measure: '60초 이내', status: 'open' }],
  inScope: ['알림'], outOfScope: ['팀 관리'], lockedAt: '2026-11-20T09:00:00Z', changeReason: null,
};

test('the start prompt is exact, bilingual, and contains project calls without credentials', () => {
  assert.equal(agentStartPrompt(key, 'ko'), `Seedup 프로젝트 ${key}를 이어서 진행해. resume_project {"project":"${key}"}로 잠긴 목표와 사람이 먼저 할 일을 확인하고, get_next_task {"project":"${key}"}로 다음 기능 하나를 받아 시작해. 목표나 범위를 바꾸는 결정은 먼저 나에게 물어봐.`);
  for (const lang of ['ko', 'en'] as const) {
    const prompt = agentStartPrompt(key, lang);
    assert.ok(prompt.includes(`resume_project ${JSON.stringify({ project: key })}`));
    assert.ok(prompt.includes(`get_next_task ${JSON.stringify({ project: key })}`));
    assert.doesNotMatch(prompt, /https?:|Bearer|token|api[_-]?key|seedup_/i);
  }
  assert.match(agentStartPrompt(key, 'en'), /Ask me before.*goal or scope/);
});

test('URL paths encode the key while tool arguments retain it as escaped JSON', async (t) => {
  const special = 'prd:한 글/"?#%';
  assert.equal(supervisorHref(special), `/supervisor/${encodeURIComponent(special)}`);
  assert.ok(agentStartPrompt(special, 'ko').includes(`resume_project ${JSON.stringify({ project: special })}`));
  const fetch = t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, options?: RequestInit) => {
    assert.equal(url, `/api/projects/${encodeURIComponent(special)}/goal`);
    assert.equal(options?.cache, 'no-store');
    return Response.json(goal);
  });
  assert.deepEqual(await loadProjectGoal(special), goal);
  fetch.mock.restore();
});

test('personal PRD AGENTS.md carries the project key and locked goal, criteria and exclusions', () => {
  const text = renderProjectBrief(input, spec, 'agents', key, goal);
  assert.ok(text.includes(`## Project key\n\`${key}\``));
  assert.ok(text.includes(`## Locked goal (v2)\n${goal.statement}`));
  assert.match(text, /G-1 실패 알림 \(measure: 60초 이내\)/);
  assert.match(text, /## Do not build\n- 팀 관리/);
  assert.doesNotMatch(text, /원래 PRD 목표/);
});

test('without a goal all existing export formats stay byte for byte identical', () => {
  for (const format of ['agents', 'claude', 'cursor', 'prompt'] as const) {
    for (const project of [undefined, key, 'public-opportunity']) {
      assert.equal(renderProjectBrief(input, spec, format, project, null), renderAgentBrief(input, spec, format, project));
    }
    if (format !== 'agents') assert.equal(renderProjectBrief(input, spec, format, key, goal), renderAgentBrief(input, spec, format, key));
  }
});

test('missing, unavailable or failed goal reads fall back to the existing export', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch');
  for (const status of [401, 404, 503]) {
    fetch.mock.mockImplementation(async () => new Response(null, { status }));
    assert.equal(await loadProjectGoal(key), null);
  }
  fetch.mock.mockImplementation(async () => { throw new Error('offline'); });
  assert.equal(await loadProjectGoal(key), null);
  fetch.mock.mockImplementation(async () => Response.json({ error: 'no goal' }));
  assert.equal(await loadProjectGoal(key), null);
  fetch.mock.mockImplementation(async () => Response.json({ goal }));
  assert.deepEqual(await loadProjectGoal(key), goal);
  fetch.mock.restore();
});

test('handoff renders the project, primary copy action, single-project pack and trust guidance in both languages', () => {
  for (const lang of ['ko', 'en'] as const) {
    const html = renderToStaticMarkup(createElement(LangProvider, { lang } as Parameters<typeof LangProvider>[0], createElement(AgentHandoff, { projectKey: key, input, spec })));
    assert.ok(html.includes(`href="${supervisorHref(key)}"`));
    assert.match(html, /class="btn min-h-11 max-w-full px-5"/);
    assert.match(html, /AGENTS\.md/);
    assert.match(html, /\/hooks/);
    assert.match(html, /overflow-wrap:anywhere/);
    assert.equal((html.match(/<option /g) ?? []).length, 1);
    assert.match(html, lang === 'ko' ? /이미 연결했다면 이 단계는 건너뛰세요/ : /If already connected, skip this step/);
    // GoalLock above already owns the setup queue; handoff does not render a duplicate list.
    assert.doesNotMatch(html, /things to set up first|사람이 먼저 할 일 \d+개/);
  }
});
