import assert from 'node:assert/strict';
import test from 'node:test';
import { TOOLKIT, recommendToolkit, renderToolkit } from '../lib/opportunities/toolkit';

const spec = (summary: string, features: Array<[string, string]>) => ({
  summary,
  requirements: [],
  screens: [],
  nonGoals: [],
  features: features.map(([title, detail], index) => ({ id: `F-0${index + 1}`, title, detail, requirementIds: [], slots: null })),
});

test('the toolkit uses feature and deployed stack signals, preserves feature links, and orders build to deploy', () => {
  const recs = recommendToolkit({
    ...spec('결제 대시보드', [['구독 결제', 'Stripe로 월 구독을 받는다'], ['로그인', 'Google 계정으로 로그인한다']]),
    technicalDesign: {
      architecture: 'Next.js 앱을 Vercel에 배포하고 오류 모니터링을 설정한다.',
      stack: ['TypeScript'],
      dataModel: ['PostgreSQL stores account preferences.'],
      interfaces: ['Stripe API 키를 서버 환경에 둔다.'],
      milestones: [],
    },
  });
  assert.deepEqual(recs.map((row) => row.tool.id), [
    'shadcn-ui', 'better-auth', 'stripe', 'drizzle', 'playwright', 'gitleaks', 'semgrep', 'sentry', 'lighthouse-ci',
  ]);
  assert.deepEqual(recs.find((row) => row.tool.id === 'stripe')?.features, ['F-01']);
  assert.deepEqual(recs.find((row) => row.tool.id === 'better-auth')?.features, ['F-02']);
  assert.deepEqual(recs.find((row) => row.tool.id === 'drizzle')?.features, []);
});

test('a local CLI does not inherit AI, web, JavaScript database or deployment tools', () => {
  const recs = recommendToolkit({
    ...spec('로컬 전용 CLI 도구', [['요약 보고서 생성', '파일에서 통계를 읽어 Markdown 요약을 생성한다.']]),
    technicalDesign: {
      architecture: 'The CLI generates an error report for invalid files.',
      stack: ['Python standard library and SQLite'],
      dataModel: [],
      interfaces: [],
      milestones: [],
    },
  });
  assert.deepEqual(recs, []);
  assert.equal(renderToolkit(recs, 'ko'), '');
});

test('a browser tool can use browser tests without inheriting production checks', () => {
  const recs = recommendToolkit({
    ...spec('A web app for local browsing', [['Error reporting', 'Show errors when reading an archive.']]),
    nonGoals: ['No deployment or hosting.'],
  });
  assert.deepEqual(recs.map((row) => row.tool.id), ['playwright']);
});

test('model calls give the AI SDK a feature to serve', () => {
  const recs = recommendToolkit(spec('Document organizer', [
    ['Summarize files', 'Generate a word-count summary using the local index.'],
    ['Chat with a document', 'Call an LLM through the OpenAI API.'],
  ]));
  assert.deepEqual(recs.find((row) => row.tool.id === 'ai-sdk')?.features, ['F-02']);
});

test('every toolkit entry has a GitHub repo and an https link, and the agent brief turns checks into a checklist', () => {
  for (const tool of TOOLKIT) {
    assert.match(tool.repo, /^[\w.-]+\/[\w.-]+$/, tool.id);
    assert.match(tool.url, /^https:\/\//, tool.id);
  }
  const recs = recommendToolkit(spec('CLI with an API key', []));
  assert.match(renderToolkit(recs, 'ko', true), /^## Tools and checks/);
  assert.match(renderToolkit(recs, 'ko', true), /- \[ \] \[Gitleaks\]/);
  assert.match(renderToolkit(recs, 'ko'), /## 추천 도구와 점검/);
});
