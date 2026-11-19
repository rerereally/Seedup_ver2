import assert from 'node:assert/strict';
import test from 'node:test';
import { judgePair, summarizeComparisons } from '../scripts/ab-prd';
import { prdEvalCases } from '../scripts/prd-eval-cases';
import type { SpecInput } from '../lib/opportunities/spec';

const input: SpecInput = {
  title: 'Test product', problem: 'Test problem', gap: '', competitors: ['Existing Tool'],
  evidence: [{ id: 'quote-1', quote: 'I have to enter that twice.', quoteKo: '같은 내용을 두 번 입력해야 합니다.', platform: 'hn', url: 'https://example.com/quote', score: 0, postedAt: null }],
};
const verdict = (side: 'A' | 'B' | 'tie') => ({
  competition: side, grounding: side, factuality: side, actionability: side, overall: side, reason: 'Example',
});

test('the A/B and quality evaluations share 20 usable snapshot cases', () => {
  const cases = prdEvalCases();
  assert.equal(cases.length, 20);
  assert.equal(new Set(cases.map(({ id }) => id)).size, 20);
  assert.ok(cases.every(({ input }) => input));
});

test('pairwise judging can use either order and hides labels and model IDs', async () => {
  const prompts: string[] = [];
  const judge = async <T>(prompt: string): Promise<T> => {
    prompts.push(prompt);
    return verdict('A') as T;
  };
  const models = ['vendor/writer', 'other/judge'];
  const compare = (value: number) => judgePair(input, 'Seedup first draft via vendor/writer', 'Second draft via other/judge', models[1], models, judge, () => value);
  assert.equal((await compare(0.1)).seedupSide, 'A');
  assert.equal((await compare(0.9)).seedupSide, 'B');
  assert.ok(prompts.every((prompt) => !/seedup|vendor\/writer|other\/judge/i.test(prompt)));
  assert.match(JSON.parse(prompts[0]).A, /first draft/);
  assert.match(JSON.parse(prompts[1]).A, /Second draft/);
  assert.deepEqual(JSON.parse(prompts[0]).reference.directCompetitors, ['Existing Tool']);
  assert.deepEqual(JSON.parse(prompts[0]).reference.quotes.map(({ quote, translation }: { quote: string; translation: string }) => [quote, translation]), [
    ['I have to enter that twice.', '같은 내용을 두 번 입력해야 합니다.'],
  ]);
});

test('win rate uses the shuffled side, includes ties, and reports missing judgments and run spread', () => {
  const shared = { baseline: 'vendor/writer', judge: 'other/judge' };
  const [metric] = summarizeComparisons([
    { ...shared, run: 1, seedupSide: 'B', verdict: verdict('B') },
    { ...shared, run: 1, seedupSide: 'A', verdict: verdict('tie') },
    { ...shared, run: 2, seedupSide: 'A', verdict: verdict('B') },
    { ...shared, run: 3, seedupSide: 'A', verdict: null },
  ]);
  assert.deepEqual(metric, {
    criterion: 'competition', wins: 1, losses: 1, ties: 1, missing: 1,
    winRate: 100 / 3, rates: [50, 0], runsWithJudgments: 2, sd: 25, min: 0, max: 50,
  });
});
