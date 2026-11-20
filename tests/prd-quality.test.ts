import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureProse } from '../lib/llm-fixtures';
import { carefulWebModels, criticWebModels, defaultPolicy, estimateCost, lightWebModels, pickPrdModel, prdModels } from '../lib/opportunities/models';
import { isAdminUser } from '../lib/auth/admin';
import { generatePrd, specIssues } from '../lib/opportunities/prd';
import { checkIdeaClarity, planQuestions } from '../lib/opportunities/questions';
import { normalizeSpec } from '../lib/opportunities/spec';

const input = { title: 't', problem: 'p', gap: '', competitors: [], evidence: [{ id: 'e1', platform: 'hn' as const, quote: 'q', quoteKo: '', url: 'u', score: 0, postedAt: null }] };

test('the code check names vague, unserved and unmeasured parts, and stays quiet on a good draft', () => {
  const weak = normalizeSpec({ summary: 's', requirements: [{ title: '쉽게 모델을 바꾼다', detail: '빠르게', evidence: [1] }], features: [], screens: [], metrics: ['좋아진다'] }, 1);
  const issues = specIssues(weak, input).join('\n');
  assert.match(issues, /요구사항이 1개뿐/);
  assert.match(issues, /detail이 너무 짧/);
  assert.match(issues, /모호한 표현/);
  assert.match(issues, /충족하는 기능이 없/);
  assert.match(issues, /metrics 1개에 숫자나 조건이 없습니다/);

  const good = normalizeSpec({
    summary: 's',
    requirements: [1, 2, 3].map((n) => ({ title: `요구 ${n}`, detail: `설정 파일 한 줄로 ${n}번째 동작을 바꾸면 다음 요청부터 적용된다`, evidence: [1], acceptance: ['설정을 바꾼 경우 다음 요청에서 새 설정값을 반환한다'] })),
    features: [{ title: 'f', detail: 'd', requirements: [1, 2, 3] }],
    screens: [{ name: 's', does: 'd', features: [1] }],
    metrics: ['3개 제공사에서 같은 형식. 측정: 제공사별 응답을 같은 스키마로 검사하는 테스트를 실행한다.'],
  }, 1);
  assert.deepEqual(specIssues(good, input), []);
});

test('every account picks from one menu; GPT 6.2 Sol is always the default, and admin policy gates optional models', () => {
  const keys = ['OPENROUTER_MODEL', 'EXAONE_API_KEY'] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.OPENROUTER_MODEL = 'base/model:free';
    delete process.env.EXAONE_API_KEY;
    const policy = defaultPolicy();
    assert.deepEqual(prdModels(policy).map((row) => row.label), ['GPT 6.2 Sol', 'Claude Haiku 5.5', 'DeepSeek V4.1 Flash', 'Claude Sonnet 5.5', 'Claude Opus 5.5', 'K-EXAONE 2.5', '무료 모델']);
    // By default GPT 6.2 Sol, Claude Haiku 5.5 and the free fallback run; optional paid models stay blocked, EXAONE waits for its key.
    assert.equal(pickPrdModel('openai/gpt-6.2-sol', policy), 'openai/gpt-6.2-sol');
    assert.equal(pickPrdModel('anthropic/claude-haiku-5.5', policy), 'anthropic/claude-haiku-5.5');
    assert.equal(pickPrdModel('base/model:free', policy), 'base/model:free');
    assert.equal(pickPrdModel('anthropic/claude-opus-5.5', policy), undefined);
    assert.equal(pickPrdModel('exaone', policy), undefined);
    process.env.EXAONE_API_KEY = 'key';
    assert.equal(pickPrdModel('exaone', policy), 'exaone');

    // Even a legacy policy without GPT 6.2 Sol keeps GPT 6.2 Sol available as the fixed default.
    const opened = { enabled: ['base/model:free', 'anthropic/claude-haiku-5.5'] };
    assert.equal(pickPrdModel('openai/gpt-6.2-sol', opened), 'openai/gpt-6.2-sol');
    assert.equal(pickPrdModel('anthropic/claude-haiku-5.5', opened), 'anthropic/claude-haiku-5.5');
    assert.equal(pickPrdModel('anthropic/claude-opus-5.5', opened), undefined);
    assert.equal(pickPrdModel('someone/expensive-model', { enabled: ['someone/expensive-model'] }), undefined);
    assert.equal(pickPrdModel('exaone', opened), undefined);
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});

test('web model chains route careful tasks to GPT 6.2 Sol, light/critic tasks to Claude Haiku 5.5, and keep free models last', () => {
  assert.deepEqual(carefulWebModels(undefined, ['free/a:free']), ['openai/gpt-6.2-sol', 'anthropic/claude-haiku-5.5', 'free/a:free']);
  assert.deepEqual(carefulWebModels('anthropic/claude-sonnet-5.5', ['free/a:free']), ['anthropic/claude-sonnet-5.5', 'openai/gpt-6.2-sol', 'anthropic/claude-haiku-5.5', 'free/a:free']);
  assert.deepEqual(lightWebModels(['free/a:free']), ['anthropic/claude-haiku-5.5', 'openai/gpt-6.2-sol', 'free/a:free']);
  assert.deepEqual(criticWebModels('openai/gpt-6.2-sol', ['free/a:free']), ['anthropic/claude-haiku-5.5', 'openai/gpt-6.2-sol', 'free/a:free']);
  assert.deepEqual(criticWebModels('anthropic/claude-haiku-5.5', ['free/a:free']), ['openai/gpt-6.2-sol', 'anthropic/claude-haiku-5.5', 'free/a:free']);
});

test('costs come from reported tokens, and admins come from the setting or Supabase app metadata', () => {
  assert.equal(estimateCost('openai/gpt-6.2-sol', 1_000_000, 1_000_000), 12);
  assert.equal(estimateCost('anthropic/claude-haiku-5.5', 1_000_000, 1_000_000), 0.6);
  assert.equal(estimateCost('base/model:free', 5_000, 3_000), 0);
  assert.equal(isAdminUser({ email: 'x@example.com', app_metadata: { role: 'admin' } }), true);
  assert.equal(isAdminUser({ email: 'x@example.com', app_metadata: {} }), false);
  assert.equal(isAdminUser(null), false);
});

test('MCP PRD uses the selected effort on paid fallback and audits with the actual writer’s other family', async (t) => {
  const keys = ['OPENROUTER_API_KEY', 'OPENROUTER_FREE_ONLY', 'LLM_FIXTURES'] as const;
  const previous = keys.map((key) => process.env[key]);
  process.env.OPENROUTER_API_KEY = 'mock-key';
  process.env.OPENROUTER_FREE_ONLY = 'true';
  delete process.env.LLM_FIXTURES;
  const calls: Array<{ title: string; model: string; effort: string }> = [];
  const text = fixtureProse().replace('경고 단위로 묶은 요약을 돌려준다.', '경고 단위로 묶은 요약을 돌려준다. [E1]');
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const title = new Headers(init.headers).get('x-title') ?? '';
    calls.push({ title, model: body.model, effort: body.reasoning.effort });
    if (title === 'Seedup PRD' && body.model === 'anthropic/claude-haiku-5.5') {
      return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`);
    }
    return new Response(null, { status: 503 });
  });
  try {
    const result = await generatePrd(input, { paid: { model: 'openai/gpt-6.2-sol', reasoning: 'medium' }, repair: false });
    assert.equal(result?.model, 'anthropic/claude-haiku-5.5');
    assert.deepEqual(calls.filter(({ title }) => title === 'Seedup PRD' || title === 'Seedup P0 evidence critic'), [
      { title: 'Seedup PRD', model: 'openai/gpt-6.2-sol', effort: 'medium' },
      { title: 'Seedup PRD', model: 'anthropic/claude-haiku-5.5', effort: 'medium' },
      { title: 'Seedup P0 evidence critic', model: 'openai/gpt-6.2-sol', effort: 'low' },
    ]);
    assert.ok(calls.every(({ model }) => model === 'openai/gpt-6.2-sol' || model === 'anthropic/claude-haiku-5.5'));
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
});

import { coverRivals, normalizeRivals } from '../lib/opportunities/spec';

test('the rival comparison keeps only competitors the input listed, under their listed names', () => {
  const rivals = normalizeRivals([
    { name: 'portkey-ai', misses: 'no schema mapping', answer: 'maps every provider' },
    { name: 'Invented Tool', misses: 'made up' },
    { name: 'litellm', misses: '' },
  ], ['Portkey-AI', 'LiteLLM']);
  assert.deepEqual(rivals, [{ name: 'Portkey-AI', misses: 'no schema mapping', answer: 'maps every provider' }]);
});

test('every listed competitor stays in the PRD: the ones the model skipped are added as not compared yet', () => {
  const picked = [{ name: 'MemoriPilot', misses: 'Copilot only', answer: 'works in every tool' }];
  const covered = coverRivals(picked, ['Cortex', 'memoripilot', 'Memex']);
  assert.deepEqual(covered.map((row) => row.name), ['MemoriPilot', 'Cortex', 'Memex']);
  assert.equal(covered[0], picked[0]);
  assert.match(covered[1].misses, /아직 비교하지 않았습니다/);
  assert.match(coverRivals([], ['Cortex'], 'en')[0].misses, /Not compared yet/);
  assert.deepEqual(coverRivals(picked, []), picked);
});

test('a document-first PRD with no screens yet is not asked to place its features on screens', () => {
  const docOnly = normalizeSpec({ summary: 's', requirements: [{ title: 'r', detail: '설정 파일 한 줄로 모델을 바꾸면 다음 요청부터 적용된다', evidence: [1] }], features: [{ title: 'f', detail: 'd', requirements: [1] }], screens: [], metrics: ['1초 안에 응답한다'] }, 1);
  assert.doesNotMatch(specIssues(docOnly, input).join('\n'), /화면에도 없습니다/);
  const withScreen = normalizeSpec({ summary: 's', requirements: [{ title: 'r', evidence: [1] }], features: [{ title: 'f', requirements: [1] }, { title: 'g', requirements: [1] }], screens: [{ name: 'home', features: [1] }] }, 1);
  assert.match(specIssues(withScreen, input).join('\n'), /F-02 "g"이 어느 화면에도 없습니다/);
});

import { changedLines, lineDiff } from '../lib/opportunities/spec-diff';

test('the PRD diff shows removed and added lines in order, and only changes in the short form', () => {
  const before = '# PRD\n\n- R1 로그인\n- R2 검색\n- R3 알림';
  const after = '# PRD\n\n- R1 로그인\n- R2 검색과 필터\n- R3 알림';
  assert.deepEqual(lineDiff(before, after).filter((line) => line.kind !== 'same'), [{ kind: 'removed', text: '- R2 검색' }, { kind: 'added', text: '- R2 검색과 필터' }]);
  assert.deepEqual(changedLines('a\n\nb', 'a\n\nb\n\nc').map((line) => line.text), ['c']);
  assert.deepEqual(changedLines('same', 'same'), []);
});

import { repairCachedSpec } from '../lib/opportunities/spec';

test('a PRD read back from the cache gets a P0, open readiness questions and every listed competitor, idempotently', () => {
  const old = normalizeSpec({ summary: 's', requirements: [{ title: 'r', detail: '설정 한 줄로 모델을 바꾼다', evidence: [1], priority: 'P1' }], features: [{ title: 'f', detail: 'd', requirements: [1] }], screens: [] }, 1);
  const stored = { ...old, rivals: [{ name: 'MemoriPilot', misses: 'Copilot only', answer: '' }] };
  const evidence = [{ id: 'ev_1', platform: 'hn' as const, quote: 'q', quoteKo: '', url: 'https://x.test', score: 0, postedAt: '2026-11-01' }];
  const repaired = repairCachedSpec({ competitors: ['MemoriPilot', 'Cortex'], evidence }, stored);
  assert.equal(repaired.requirements[0].priority, 'P0');
  assert.ok(repaired.features[0].slots && Object.values(repaired.features[0].slots).every((items) => items.length > 0));
  assert.deepEqual(repaired.rivals?.map((row) => row.name), ['MemoriPilot', 'Cortex']);
  assert.equal(repaired.requirements[0].evidenceStrength, 'some');
  assert.deepEqual(repairCachedSpec({ competitors: ['MemoriPilot', 'Cortex'], evidence }, repaired), repaired);
});

test('web PRD defaults to GPT 6.2 Sol for writing, Claude Haiku 5.5 for P0 audit/slots, and falls back to free only last', async (t) => {
  const keys = ['OPENROUTER_API_KEY', 'OPENROUTER_MODEL', 'OPENROUTER_FREE_ONLY', 'PRD_FREE_MODELS', 'LLM_FIXTURES'] as const;
  const previous = keys.map((key) => process.env[key]);
  process.env.OPENROUTER_API_KEY = 'mock-key';
  process.env.OPENROUTER_MODEL = 'base/model:free';
  process.env.OPENROUTER_FREE_ONLY = 'true';
  process.env.PRD_FREE_MODELS = 'fallback/free:free';
  delete process.env.LLM_FIXTURES;
  const calls: Array<{ title: string; model: string }> = [];
  const text = fixtureProse().replace('경고 단위로 묶은 요약을 돌려준다.', '경고 단위로 묶은 요약을 돌려준다. [E1]');
  t.mock.method(globalThis, 'fetch', async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    const title = new Headers(init.headers).get('x-title') ?? '';
    calls.push({ title, model: body.model });
    if (title === 'Seedup PRD' && body.model === 'openai/gpt-6.2-sol') {
      return new Response(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\ndata: [DONE]\n\n`);
    }
    if (title === 'Seedup P0 evidence critic' && body.model === 'anthropic/claude-haiku-5.5') {
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ verdicts: [{ id: 'R-01', verdict: 'supported', reason: '원문이 뒷받침함' }] }) } }] }));
    }
    if (title === 'Seedup readiness slots' && body.model === 'anthropic/claude-haiku-5.5') {
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ inputs: ['a'], rules: ['b'], errors: ['c'], access: ['d'], data: ['e'], done: ['f'] }) } }] }));
    }
    if (title === 'Seedup planning questions' && body.model === 'anthropic/claude-haiku-5.5') {
      return new Response(null, { status: 503 });
    }
    if (title === 'Seedup planning questions' && body.model === 'openai/gpt-6.2-sol') {
      return new Response(null, { status: 503 });
    }
    if (title === 'Seedup planning questions' && body.model === 'fallback/free:free') {
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ questions: [{ key: 'first', question: '누가 쓰나요?', why: '대상 고정', options: ['개발자', '디자이너'] }, { key: 'when', question: '언제 쓰나요?', why: '시점 고정', options: ['배포 전', '배포 후'] }] }) } }] }));
    }
    if (title === 'Seedup idea clarity' && body.model === 'anthropic/claude-haiku-5.5') {
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ missing: [], suggestion: '' }) } }] }));
    }
    return new Response(null, { status: 503 });
  });
  try {
    const result = await generatePrd(input, { repair: false });
    assert.equal(result?.model, 'openai/gpt-6.2-sol');
    assert.ok(calls.some((call) => call.title === 'Seedup PRD' && call.model === 'openai/gpt-6.2-sol'));
    assert.ok(calls.some((call) => call.title === 'Seedup P0 evidence critic' && call.model === 'anthropic/claude-haiku-5.5'));
    assert.ok(calls.some((call) => call.title === 'Seedup readiness slots' && call.model === 'anthropic/claude-haiku-5.5'));

    const questions = await planQuestions('LLM 응답 스키마 변환기', ['provider schema mismatch']);
    assert.equal(questions?.length, 2);
    assert.deepEqual(calls.filter((call) => call.title === 'Seedup planning questions').map((call) => call.model), ['anthropic/claude-haiku-5.5', 'openai/gpt-6.2-sol', 'fallback/free:free']);

    const clarity = await checkIdeaClarity('개발자를 위한 LLM 응답 스키마 변환기');
    assert.deepEqual(clarity, { missing: [], suggestion: '' });
    assert.deepEqual(calls.filter((call) => call.title === 'Seedup idea clarity').map((call) => call.model), ['anthropic/claude-haiku-5.5']);
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
});
