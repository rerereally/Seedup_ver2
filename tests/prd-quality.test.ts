import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultPolicy, estimateCost, pickPrdModel, prdModels } from '../lib/opportunities/models';
import { isAdminUser } from '../lib/auth/admin';
import { specIssues } from '../lib/opportunities/prd';
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
    requirements: [1, 2, 3].map((n) => ({ title: `요구 ${n}`, detail: `설정 파일 한 줄로 ${n}번째 동작을 바꾸면 다음 요청부터 적용된다`, evidence: [1] })),
    features: [{ title: 'f', detail: 'd', requirements: [1, 2, 3] }],
    screens: [{ name: 's', does: 'd', features: [1] }],
    metrics: ['3개 제공사에서 같은 형식'],
  }, 1);
  assert.deepEqual(specIssues(good, input), []);
});

test('every account picks from one menu; the admin policy decides what runs, and the free model always does', () => {
  const keys = ['OPENROUTER_MODEL', 'EXAONE_API_KEY'] as const;
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    process.env.OPENROUTER_MODEL = 'base/model:free';
    delete process.env.EXAONE_API_KEY;
    const policy = defaultPolicy();
    assert.deepEqual(prdModels(policy).map((row) => row.label), ['무료 모델', 'K-EXAONE 2.5', 'Claude Haiku 5.5', 'DeepSeek V4.1 Flash', 'Claude Sonnet 5.5', 'GPT-6.1 Sol', 'Claude Opus 5.5']);
    // By default only the free model runs; paid models are listed but blocked, EXAONE waits for its key.
    assert.equal(pickPrdModel('base/model:free', policy), 'base/model:free');
    assert.equal(pickPrdModel('anthropic/claude-haiku-5.5', policy), undefined);
    assert.equal(pickPrdModel('exaone', policy), undefined);
    process.env.EXAONE_API_KEY = 'key';
    assert.equal(pickPrdModel('exaone', policy), 'exaone');

    const opened = { enabled: ['base/model:free', 'anthropic/claude-haiku-5.5'] };
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

test('costs come from reported tokens, and admins come from the setting or Supabase app metadata', () => {
  assert.equal(estimateCost('anthropic/claude-haiku-5.5', 1_000_000, 1_000_000), 0.6);
  assert.equal(estimateCost('base/model:free', 5_000, 3_000), 0);
  assert.equal(isAdminUser({ email: 'x@example.com', app_metadata: { role: 'admin' } }), true);
  assert.equal(isAdminUser({ email: 'x@example.com', app_metadata: {} }), false);
  assert.equal(isAdminUser(null), false);
});

import { normalizeRivals } from '../lib/opportunities/spec';

test('the rival comparison keeps only competitors the input listed, under their listed names', () => {
  const rivals = normalizeRivals([
    { name: 'portkey-ai', misses: 'no schema mapping', answer: 'maps every provider' },
    { name: 'Invented Tool', misses: 'made up' },
    { name: 'litellm', misses: '' },
  ], ['Portkey-AI', 'LiteLLM']);
  assert.deepEqual(rivals, [{ name: 'Portkey-AI', misses: 'no schema mapping', answer: 'maps every provider' }]);
});

test('a document-first PRD with no screens yet is not asked to place its features on screens', () => {
  const docOnly = normalizeSpec({ summary: 's', requirements: [{ title: 'r', detail: '설정 파일 한 줄로 모델을 바꾸면 다음 요청부터 적용된다', evidence: [1] }], features: [{ title: 'f', detail: 'd', requirements: [1] }], screens: [], metrics: ['1초 안에 응답한다'] }, 1);
  assert.doesNotMatch(specIssues(docOnly, input).join('\n'), /화면에도 없습니다/);
  const withScreen = normalizeSpec({ summary: 's', requirements: [{ title: 'r', evidence: [1] }], features: [{ title: 'f', requirements: [1] }, { title: 'g', requirements: [1] }], screens: [{ name: 'home', features: [1] }] }, 1);
  assert.match(specIssues(withScreen, input).join('\n'), /F-02 "g"이 어느 화면에도 없습니다/);
});
