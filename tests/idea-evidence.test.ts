import assert from 'node:assert/strict';
import test from 'node:test';
import { phrasePrompt, searchIdeaEvidence, searchIdeaEvidenceWithRetry, termsOf } from '../lib/opportunities/idea-evidence';

type FakePost = { platform: 'github' | 'hn' | 'stackoverflow' | 'web'; url: string; title: string; text: string; score: number; postedAt: null };
type FakeStored = { id: string; platform: 'github' | 'hn' | 'stackoverflow' | 'web'; quote: string; quoteKo: string; url: string; score: number; postedAt: null; terms: string[] };

const IDEA = 'Zarnoff ledger for freelancers';
// Each quote is 8 to 20 plain words, ends with a period, and appears word for word in the post text that uses it.
const QA = 'Every time I switch between my two laptops I lose the whole draft.';
const QB = 'Our whole team loses track of changes whenever someone updates the spreadsheet.';
const QC = 'Nobody on our side can find the invoice from last quarter quickly.';
const PARAPHRASE = 'Switching machines always wipes out my unfinished notes for good.';
const STORED_QUOTE = 'Keeping my digest notes synced is a nightmare across all my devices.';

const postA = (platform: FakePost['platform'], score: number): FakePost => ({
  platform,
  url: `https://example.com/a-${platform}`,
  title: 'Draft loss',
  text: `Honestly this is my biggest annoyance at work. ${QA} Anyone else?`,
  score,
  postedAt: null,
});
const postB: FakePost = {
  platform: 'hn',
  url: 'https://news.ycombinator.com/item?id=2',
  title: 'Spreadsheet chaos',
  text: `This keeps happening to us all the time. ${QB} Is there a fix?`,
  score: 5,
  postedAt: null,
};
const postC: FakePost = {
  platform: 'hn',
  url: 'https://news.ycombinator.com/item?id=3',
  title: 'Lost invoices',
  text: `Our finance people struggle with this every quarter. ${QC} Any tips?`,
  score: 4,
  postedAt: null,
};

/**
 * Fake sources: `phrase` answers the phrase prompt, `pick` answers the pick prompt. Every call is recorded.
 * The sources object is cast to never so it fits the module's parameter type without a real network or database.
 */
function fakeSources(opts: {
  phrase: (prompt: string) => unknown;
  pick?: (prompt: string) => unknown;
  demand?: (phrase: string, sites: string[]) => FakePost[];
  reviews?: FakePost[];
  stored?: FakeStored[];
}) {
  const calls = {
    phrase: 0,
    pick: 0,
    demand: [] as Array<{ phrase: string; sites: string[] }>,
    reviews: [] as string[],
    save: [] as unknown[][],
  };
  const sources = {
    ask: async (prompt: string, _options: unknown) => {
      if (prompt.includes('Write the phrases')) {
        calls.phrase += 1;
        return opts.phrase(prompt) as never;
      }
      if (prompt.includes('Below are public posts')) {
        calls.pick += 1;
        return (opts.pick?.(prompt) ?? { quotes: [] }) as never;
      }
      throw new Error('unexpected prompt');
    },
    demand: async (phrase: string, sites: string[]) => {
      calls.demand.push({ phrase, sites });
      return (opts.demand?.(phrase, sites) ?? []) as never;
    },
    reviews: async (phrase: string) => {
      calls.reviews.push(phrase);
      return (opts.reviews ?? []) as never;
    },
    stored: async (_terms: string[]) => (opts.stored ?? []) as never,
    save: async (...args: unknown[]) => {
      calls.save.push(args);
    },
  };
  return { sources: sources as never, calls };
}

const phraseAnswer = (phrases: string[], extra: Record<string, unknown> = {}) => () => ({ phrases, sites: [], ...extra });

test('termsOf lowercases, splits on non-letters, drops short and stop words, and removes duplicates', () => {
  assert.deepEqual(termsOf(['The Digest for Teams', 'digest tool', 'ab cd']), ['digest', 'teams', 'tool']);
});

test('phrasePrompt lists the avoided phrases only when avoid is given', () => {
  assert.ok(phrasePrompt('x', ['old one']).includes('old one'));
  assert.ok(!phrasePrompt('x').includes('already found too little'));
});

test('a web quote is kept only when it matches its post word for word', async () => {
  const { sources } = fakeSources({
    phrase: phraseAnswer(['switch laptops draft']),
    demand: () => [postA('web', 10), postB],
    pick: () => ({
      quotes: [
        { id: 0, quote: QA, quote_ko: '' },
        { id: 1, quote: PARAPHRASE, quote_ko: '' },
      ],
    }),
  });
  const result = await searchIdeaEvidence(IDEA, {}, sources);
  assert.equal(result.quotes.length, 1);
  assert.equal(result.quotes[0].quote, QA);
  assert.equal(result.quotes[0].platform, 'web');
  assert.ok(result.quotes[0].id.startsWith('lv_'));
});

test('a stored quote is reused whole and counted in reused', async () => {
  const stored: FakeStored[] = [
    {
      id: 'lv_saved1',
      platform: 'hn',
      quote: STORED_QUOTE,
      quoteKo: '',
      url: 'https://news.ycombinator.com/item?id=1',
      score: 3,
      postedAt: null,
      terms: ['digest'],
    },
  ];
  // One fresh post, so the stored row is index 1 in the numbered list.
  const { sources } = fakeSources({
    phrase: phraseAnswer(['digest notes sync']),
    demand: () => [postB],
    stored,
    pick: () => ({ quotes: [{ id: 1, quote: STORED_QUOTE, quote_ko: '' }] }),
  });
  const result = await searchIdeaEvidence(IDEA, {}, sources);
  assert.equal(result.quotes.length, 1);
  assert.equal(result.quotes[0].id, 'lv_saved1');
  assert.equal(result.quotes[0].quote, STORED_QUOTE);
  assert.equal(result.reused, 1);
});

test('save receives the found quotes and the terms, never the idea text', async () => {
  const { sources, calls } = fakeSources({
    phrase: phraseAnswer(['switch laptops draft']),
    demand: () => [postA('web', 10)],
    pick: () => ({ quotes: [{ id: 0, quote: QA, quote_ko: '' }] }),
  });
  const result = await searchIdeaEvidence(IDEA, {}, sources);
  assert.equal(calls.save.length, 1);
  const [savedQuotes, savedTerms] = calls.save[0] as [unknown[], string[]];
  assert.deepEqual(savedQuotes, result.quotes);
  assert.deepEqual(savedTerms, ['switch', 'laptops', 'draft']);
  assert.ok(!JSON.stringify(calls.save).includes(IDEA));
});

test('app reviews are searched only for everyday ideas', async () => {
  const everyday = fakeSources({ phrase: phraseAnswer(['a b c'], { everyday: true }) });
  await searchIdeaEvidence(IDEA, {}, everyday.sources);
  assert.equal(everyday.calls.reviews.length, 1);

  const developer = fakeSources({ phrase: phraseAnswer(['a b c'], { everyday: false }) });
  await searchIdeaEvidence(IDEA, {}, developer.sources);
  assert.equal(developer.calls.reviews.length, 0);
});

test('only allowed site names reach demand', async () => {
  const { sources, calls } = fakeSources({ phrase: phraseAnswer(['a b c'], { sites: ['money', 'not-a-site'] }) });
  await searchIdeaEvidence(IDEA, {}, sources);
  assert.equal(calls.demand.length, 1);
  assert.deepEqual(calls.demand[0].sites, ['money']);
});

test('phrases already in avoid are not searched again', async () => {
  const { sources, calls } = fakeSources({ phrase: phraseAnswer(['a b c', 'old phrase']) });
  await searchIdeaEvidence(IDEA, { avoid: ['old phrase'] }, sources);
  assert.deepEqual(
    calls.demand.map((row) => row.phrase),
    ['a b c'],
  );
});

test('the retry searches again with the first phrases avoided, and merges quotes without duplicates', async () => {
  const { sources, calls } = fakeSources({
    phrase: (prompt) => (prompt.includes('already found too little') ? { phrases: ['second phrase'], sites: [] } : { phrases: ['first phrase'], sites: [] }),
    demand: (phrase) => (phrase === 'first phrase' ? [postA('github', 10)] : [postB]),
    pick: (prompt) => ({ quotes: [{ id: 0, quote: prompt.includes(postB.text) ? QB : QA, quote_ko: '' }] }),
  });
  const result = await searchIdeaEvidenceWithRetry(IDEA, { deadline: Date.now() + 120_000 }, sources);
  assert.equal(calls.phrase, 2);
  assert.deepEqual(result.quotes.map((row) => row.quote), [QA, QB]);
  assert.equal(new Set(result.quotes.map((row) => row.id)).size, 2);
  assert.deepEqual(result.phrases, ['first phrase', 'second phrase']);
});

test('the retry does not run when the deadline is close', async () => {
  const { sources, calls } = fakeSources({
    phrase: (prompt) => (prompt.includes('already found too little') ? { phrases: ['second phrase'], sites: [] } : { phrases: ['first phrase'], sites: [] }),
    demand: (phrase) => (phrase === 'first phrase' ? [postA('github', 10)] : [postB]),
    pick: () => ({ quotes: [{ id: 0, quote: QA, quote_ko: '' }] }),
  });
  const result = await searchIdeaEvidenceWithRetry(IDEA, { deadline: Date.now() + 1_000 }, sources);
  assert.equal(calls.phrase, 1);
  assert.equal(result.quotes.length, 1);
});

test('the retry does not run when the first search already passes the bar', async () => {
  const { sources, calls } = fakeSources({
    phrase: phraseAnswer(['first phrase']),
    demand: () => [postA('github', 30), postB, postC],
    pick: () => ({
      quotes: [
        { id: 0, quote: QA, quote_ko: '' },
        { id: 1, quote: QB, quote_ko: '' },
        { id: 2, quote: QC, quote_ko: '' },
      ],
    }),
  });
  const result = await searchIdeaEvidenceWithRetry(IDEA, { deadline: Date.now() + 120_000 }, sources);
  assert.equal(calls.phrase, 1);
  assert.equal(result.quotes.length, 3);
  assert.equal(new Set(result.quotes.map((row) => row.platform)).size, 2);
});

test('a null phrase answer returns an empty result and never searches', async () => {
  const { sources, calls } = fakeSources({ phrase: () => null });
  const result = await searchIdeaEvidence(IDEA, {}, sources);
  assert.deepEqual(result, { phrases: [], quotes: [], reused: 0, sites: [] });
  assert.equal(calls.demand.length, 0);
});

test('the default sources skip App Store reviews unless APP_REVIEW_EVIDENCE=true', async () => {
  const { ideaEvidenceSources } = await import('../lib/opportunities/idea-evidence');
  const before = process.env.APP_REVIEW_EVIDENCE;
  delete process.env.APP_REVIEW_EVIDENCE;
  try {
    assert.deepEqual(await ideaEvidenceSources.reviews('budget app'), []);
  } finally {
    if (before !== undefined) process.env.APP_REVIEW_EVIDENCE = before;
  }
});
