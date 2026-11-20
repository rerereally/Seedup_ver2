import assert from 'node:assert/strict';
import test from 'node:test';
import { TOOLKIT, recommendToolkit, renderToolkit } from '../lib/opportunities/toolkit';

const spec = (summary: string, features: Array<[string, string]>) => ({
  summary,
  requirements: [],
  screens: [],
  features: features.map(([title, detail], index) => ({ id: `F-0${index + 1}`, title, detail, requirementIds: [], slots: null })),
});

test('the toolkit recommends only tools whose words appear, names the matching features, and orders build → deploy', () => {
  const recs = recommendToolkit(spec('결제 대시보드', [['구독 결제', 'Stripe로 월 구독을 받는다'], ['로그인', 'Google 계정으로 로그인한다']]));
  const ids = recs.map((row) => row.tool.id);
  assert.ok(ids.includes('stripe') && ids.includes('better-auth') && ids.includes('shadcn-ui'));
  assert.ok(!ids.includes('mcp-sdk') && !ids.includes('ai-sdk'));
  assert.deepEqual(recs.find((row) => row.tool.id === 'stripe')!.features, ['F-01']);
  assert.deepEqual(recs.find((row) => row.tool.id === 'better-auth')!.features, ['F-02']);
  // Checks without a pattern apply to every PRD.
  for (const id of ['gitleaks', 'semgrep', 'playwright', 'sentry']) assert.ok(ids.includes(id), id);
  const stages = recs.map((row) => row.tool.stage);
  assert.deepEqual(stages, [...stages].sort((a, b) => ['build', 'before-deploy', 'after-deploy'].indexOf(a) - ['build', 'before-deploy', 'after-deploy'].indexOf(b)));
});

test('every toolkit entry has a GitHub repo and an https link, and the agent brief turns checks into a checklist', () => {
  for (const tool of TOOLKIT) {
    assert.match(tool.repo, /^[\w.-]+\/[\w.-]+$/, tool.id);
    assert.match(tool.url, /^https:\/\//, tool.id);
  }
  const brief = renderToolkit(recommendToolkit(spec('CLI tool', [])), 'ko', true);
  assert.match(brief, /^## Tools and checks/);
  assert.match(brief, /- \[ \] \[Gitleaks\]/);
  assert.match(renderToolkit(recommendToolkit(spec('CLI tool', [])), 'ko'), /## 추천 도구와 점검/);
  assert.equal(renderToolkit([], 'ko'), '');
});
