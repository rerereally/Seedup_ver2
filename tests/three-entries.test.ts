import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AgentPackDownload from '../components/AgentPackDownload';
import LangProvider from '../components/LangProvider';
import { RepoGoalExit, repoSpecInput, saveRepoPrdProject } from '../components/goal/RepoExit';
import { buildValidationHandoff, readValidationPrdInput, validationPrdHref, type ValidationReportPayload } from '../components/ValidationReportPanel';
import { agentStartPrompt, supervisorHref } from '../components/goal/prompt';
import type { Spec } from '../lib/opportunities/spec';

const PRD_ID = 'abcdef00-1111-2222-3333-444444444444';
const PROJECT_KEY = `prd:${PRD_ID}`;

const sampleSpec: Spec = {
  summary: '기존 CLI 도구에 설정 점검과 배포 알림을 더합니다.',
  targetUsers: ['1인 개발자'],
  requirements: [{ id: 'R-1', title: '설정 점검', detail: '빠진 키를 실행 전에 알린다', evidence: [] }],
  hypotheses: [],
  features: [{ id: 'F-1', title: '환경 변수 점검', detail: '필수 키 누락을 감지한다', requirementIds: ['R-1'], slots: null }],
  screens: [],
  nonGoals: ['유료 팀 플랜'],
  risks: [],
  metrics: ['실행 전 누락 키 탐지율'],
  draft: false,
};

test('repo reverse-spec saves a personal PRD key and links the analyzed repository to that project', async () => {
  const calls: Array<{ url: string; method: string; body: Record<string, unknown> }> = [];
  const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown>;
    calls.push({ url, method: init?.method ?? 'GET', body });
    if (url === '/api/opportunities/dossiers') return Response.json({ ok: true, id: PRD_ID });
    if (url === `/api/projects/${encodeURIComponent(PROJECT_KEY)}/repo`) return Response.json({ ok: true, projectKey: PROJECT_KEY, repo: 'octocat/demo-cli' });
    return new Response(null, { status: 404 });
  }) as typeof fetch;

  const input = repoSpecInput('octocat', { name: 'demo-cli', description: 'Deploy helper CLI' });
  const saved = await saveRepoPrdProject({ login: 'octocat', repoName: 'demo-cli', input, spec: sampleSpec }, fakeFetch);

  assert.deepEqual(saved, { projectKey: PROJECT_KEY, repoConnected: true });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, '/api/opportunities/dossiers');
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].body.title, 'demo-cli 역기획');
  assert.ok(typeof calls[0].body.prdMarkdown === 'string' && calls[0].body.prdMarkdown.length >= 40);
  assert.equal(calls[1].url, `/api/projects/${encodeURIComponent(PROJECT_KEY)}/repo`);
  assert.equal(calls[1].method, 'PUT');
  assert.deepEqual(calls[1].body, { repo: 'octocat/demo-cli' });

  // Failed dossier save returns null key and skips repo linking.
  const denied = await saveRepoPrdProject(
    { login: 'octocat', repoName: 'demo-cli', input, spec: sampleSpec },
    (async () => new Response(null, { status: 401 })) as typeof fetch,
  );
  assert.deepEqual(denied, { projectKey: null, repoConnected: false });
});

test('repo PRD exit shows GoalLock once generated and reveals AgentHandoff after the goal is locked', () => {
  const input = repoSpecInput('octocat', { name: 'demo-cli', description: 'Deploy helper CLI' });
  for (const lang of ['ko', 'en'] as const) {
    const beforeLock = renderToStaticMarkup(
      createElement(
        LangProvider,
        { lang } as Parameters<typeof LangProvider>[0],
        createElement(RepoGoalExit, {
          login: 'octocat',
          repoName: 'demo-cli',
          input,
          spec: sampleSpec,
          projectKey: PROJECT_KEY,
          goalLocked: false,
        }),
      ),
    );
    assert.ok(beforeLock.includes(PROJECT_KEY));
    assert.match(beforeLock, lang === 'ko' ? /목표 잠그기/ : /Lock the goal/);
    assert.doesNotMatch(beforeLock, /agent-handoff-title/);

    const afterLock = renderToStaticMarkup(
      createElement(
        LangProvider,
        { lang } as Parameters<typeof LangProvider>[0],
        createElement(RepoGoalExit, {
          login: 'octocat',
          repoName: 'demo-cli',
          input,
          spec: sampleSpec,
          projectKey: PROJECT_KEY,
          goalLocked: true,
          repoConnected: true,
        }),
      ),
    );
    assert.match(afterLock, /agent-handoff-title/);
    assert.ok(afterLock.includes('octocat/demo-cli'));
    assert.ok(afterLock.includes(`href="${supervisorHref(PROJECT_KEY)}"`));
    assert.ok(afterLock.includes(`resume_project ${JSON.stringify({ project: PROJECT_KEY }).replace(/"/g, '&quot;')}`));
    assert.match(afterLock, /AGENTS\.md/);
  }
});

test('validation report passes evidence IDs, signed quotes, related slugs and competitors into /prd/new', () => {
  const idea = 'CI 실패 원인을 PR에 바로 요약해 주는 봇';
  const report: ValidationReportPayload = {
    markdown: '# 검증 리포트\n본문',
    quotes: [
      { id: 'lv_alpha1', platform: 'github', quote: 'Our CI logs take 15 minutes to dig through.', quoteKo: 'CI 로그를 찾는 데 15분 걸린다.', url: 'https://github.com/org/repo/issues/1', score: 12, postedAt: '2026-11-10T00:00:00Z', sig: 'sig-alpha' },
      { id: 'lv_beta2', platform: 'hn', quote: 'Every flaky test wastes an hour of review.', quoteKo: '불안정한 테스트마다 리뷰 1시간이 날아간다.', url: 'https://news.ycombinator.com/item?id=2', score: 8, postedAt: '2026-11-12T00:00:00Z', sig: 'sig-beta' },
    ],
    related: [{ slug: 'ci-failure-summary', name: 'CI 실패 요약', qualified: true, quotes: 4 }],
    rivals: [
      { name: 'BuildPulse', relation: 'direct', description: 'Detects flaky tests in CI' },
      { name: 'Datadog CI', relation: 'adjacent', description: 'Full CI observability suite' },
    ],
    gap: 'No lightweight PR-only summary for solo teams',
  };

  const href = validationPrdHref(idea, report);
  const url = new URL(href, 'https://seedup.test');
  assert.equal(url.pathname, '/prd/new');
  assert.equal(url.searchParams.get('idea'), idea);
  assert.equal(url.searchParams.get('evidence'), 'lv_alpha1,lv_beta2');
  assert.equal(url.searchParams.get('related'), 'ci-failure-summary');
  assert.equal(url.searchParams.get('competitors'), 'BuildPulse, Datadog CI');

  const pool = [{
    slug: 'ci-failure-summary',
    quotes: [{ id: 'ev-catalog-1' }],
  }];

  // 1. Full handoff via sessionStorage + URL keeps signed live quotes, evidence IDs and detailed competitor notes.
  const handoff = buildValidationHandoff(idea, report);
  const full = readValidationPrdInput(idea, url.search, JSON.stringify(handoff), pool);
  assert.ok(full);
  assert.deepEqual(full.evidenceIds, ['lv_alpha1', 'lv_beta2']);
  assert.equal(full.liveQuotes.length, 2);
  assert.equal(full.liveQuotes[0].sig, 'sig-alpha');
  assert.deepEqual(full.competitors, ['BuildPulse (direct): Detects flaky tests in CI', 'Datadog CI (adjacent): Full CI observability suite']);

  // 2. URL-only fallback (e.g. new tab without sessionStorage) still receives catalog evidence IDs and competitor names.
  const urlOnly = readValidationPrdInput(idea, '?idea=x&evidence=ev-catalog-1&competitors=BuildPulse%2C%20Datadog%20CI', null, pool);
  assert.ok(urlOnly);
  assert.deepEqual(urlOnly.evidenceIds, ['ev-catalog-1']);
  assert.deepEqual(urlOnly.competitors, ['BuildPulse', 'Datadog CI']);

  // 3. Stale sessionStorage from a different idea is ignored.
  const stale = readValidationPrdInput('완전히 다른 아이디어', '', JSON.stringify(handoff), pool);
  assert.equal(stale, null);
});

test('/agents renders per-project start prompts without tokens and fixes the stale pre-commit copy', () => {
  const projects = [
    { key: PROJECT_KEY, title: '배포 알림 CLI' },
    { key: 'ci-failure-summary', title: 'CI 실패 요약' },
  ];

  for (const lang of ['ko', 'en'] as const) {
    const html = renderToStaticMarkup(
      createElement(
        LangProvider,
        { lang } as Parameters<typeof LangProvider>[0],
        createElement(AgentPackDownload, { projects, showStartPrompt: true }),
      ),
    );
    assert.match(html, lang === 'ko' ? /프로젝트별 시작 문장/ : /Start prompt per project/);
    for (const project of projects) {
      const prompt = agentStartPrompt(project.key, lang);
      assert.ok(html.includes(project.title));
      assert.ok(html.includes(project.key));
      assert.ok(html.includes(`href="${supervisorHref(project.key)}"`));
      assert.ok(html.includes(prompt.replace(/"/g, '&quot;')));
      assert.doesNotMatch(prompt, /https?:|Bearer|token|api[_-]?key|seedup_/i);
    }
    assert.doesNotMatch(html, /현재 번들에는 pre-commit 검사가 없습니다|The current bundle has no pre-commit check/);
    assert.match(html, /\.seedup\/audit\.mjs/);

    // Without showStartPrompt (inside AgentHandoff), AgentPackDownload does not duplicate the prompt section.
    const compact = renderToStaticMarkup(
      createElement(
        LangProvider,
        { lang } as Parameters<typeof LangProvider>[0],
        createElement(AgentPackDownload, { projects }),
      ),
    );
    assert.doesNotMatch(compact, /프로젝트별 시작 문장|Start prompt per project/);
  }

  // Verify the stale copy bug is completely removed from the source file as well.
  const source = readFileSync(join(process.cwd(), 'components/AgentPackDownload.tsx'), 'utf8');
  assert.doesNotMatch(source, /현재 번들에는 pre-commit 검사가 없습니다|The current bundle has no pre-commit check/);
  assert.match(source, /\.seedup\/pre-commit\.sh/);
});
