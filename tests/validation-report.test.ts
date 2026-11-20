import assert from 'node:assert/strict';
import test from 'node:test';
import { buildValidationReport, renderReport } from '../lib/opportunities/report';
import { compareRivalListings, counterQuotesFrom, validationChecks } from '../lib/opportunities/report-checks';
import type { BuildEstimate, Evidence, RawSignal, SupplyItem } from '../lib/opportunities/types';

const now = Date.UTC(2026, 10, 20);
const day = 86_400_000;
const quote = (id: string, platform: Evidence['platform'], age: number): Evidence => ({
  id, platform, quote: `The evidence quote for this case is ${id}.`, quoteKo: '',
  url: `https://example.com/posts/${id}`, postedAt: new Date(now - age * day).toISOString(), score: 0,
});
const tool = (name: string, description: string): Omit<SupplyItem, 'relation'> => ({
  name, description, kind: 'github', url: `https://github.com/sample/${name}`, popularity: 1, createdAt: null,
});
const build: BuildEstimate = { size: 'weeks', days: 10, stack: ['NextJS'], hard: [] };

test('the report applies evidence, rival, recency, reach and scope rules at their boundaries', () => {
  const quotes = [quote('a', 'github', 89), quote('b', 'hn', 90), quote('c', 'hn', 180)];
  const rivals: SupplyItem[] = [
    { ...tool('plain', 'An event digest for teams'), relation: 'direct' },
    { ...tool('limited', 'It only supports Slack.'), relation: 'direct' },
  ];
  const firstUsers = ['a', 'b', 'c', 'd'].map((url) => ({ url }));
  const baseline = { quotes, rivals, candidateCount: 2, firstUsers, build, stack: ['Next.js'], now, lang: 'en' as const };
  const levels = (overrides: Partial<typeof baseline> = {}) =>
    validationChecks({ ...baseline, ...overrides }).map(({ id, level }) => [id, level]);
  assert.deepEqual(levels(), [
    ['demand', 'supported'], ['supply', 'supported'], ['timing', 'caution'], ['reach', 'caution'], ['fit', 'supported'],
  ]);
  assert.deepEqual(levels({
    quotes: [...quotes, quote('recent', 'github', 20)], rivals: [...rivals, { ...tool('third', ''), relation: 'direct' }],
    firstUsers: [...firstUsers, { url: 'e' }, { url: 'a' }], build: { ...build, size: 'team' },
  }), [
    ['demand', 'supported'], ['supply', 'caution'], ['timing', 'supported'], ['reach', 'supported'], ['fit', 'caution'],
  ]);
  assert.deepEqual(levels({ quotes: [quote('future', 'hn', -1)], rivals: [], candidateCount: 0, firstUsers: [], stack: [] }), [
    ['demand', 'caution'], ['supply', 'unclear'], ['timing', 'unclear'], ['reach', 'unclear'], ['fit', 'unclear'],
  ]);
  assert.ok(validationChecks(baseline).every(({ change }) => change.length > 10));
});

test('only overlapping product listings count and explicit limitations prevent counting a missing capability as direct', () => {
  const rivals = compareRivalListings(['slack issue digest'], [
    tool('exact', 'A Slack issue digest with daily updates.'),
    tool('partial', 'An issue digest for email.'),
    tool('unsupported', 'Does not support a Slack issue digest.'),
    tool('irrelevant', 'A general developer tool.'),
  ]);
  assert.deepEqual(rivals.map(({ name, relation }) => [name, relation]), [
    ['exact', 'direct'], ['partial', 'partial'], ['unsupported', 'partial'],
  ]);
});

test('counter-evidence excerpts are verbatim, topic-specific, and unique by source', () => {
  const post: Omit<RawSignal, 'id' | 'actor'> = {
    title: 'Slack issue digest workflow', text: 'I already use a built-in workflow for the daily digest. It works on its own.',
    platform: 'hn', url: 'https://news.ycombinator.com/item?id=12345', score: 1, postedAt: null,
  };
  const results = counterQuotesFrom(['slack issue digest'], [
    { ...post, url: 'https://news.ycombinator.com/item?id=1', title: 'My editor', text: 'There is no need for another text editor.' },
    { ...post, url: 'https://news.ycombinator.com/item?id=2', text: 'I already use a Slack workflow, but only when' },
    { ...post, url: 'https://news.ycombinator.com/item?id=3', text: 'I already use a different calendar to schedule appointments.' },
    post,
    post,
    { ...post, url: 'https://localhost/prd' },
  ]);
  assert.deepEqual(results, [{ platform: 'hn', quote: 'I already use a built-in workflow for the daily digest.', url: post.url }]);
});

test('search failures still render a report with counter-evidence first and three next interview questions', async () => {
  const demandQueries: string[] = [];
  const report = await buildValidationReport('Slack issue digest (daily)', [], { searchCounterEvidence: true, lang: 'en' }, {
    readEvidence: async () => { throw new Error('model unavailable'); },
    estimate: async () => null,
    supply: async () => [],
    demand: async (query) => { demandQueries.push(query); throw new Error('source unavailable'); },
    webSupply: async () => [],
    rivalAgent: () => false,
    askRivalQueries: async () => null,
  });
  assert.equal(demandQueries.length, 2);
  assert.ok(demandQueries.every((query) => query.startsWith('Slack issue digest')));
  assert.deepEqual(report.counterQuotes, []);
  assert.equal(report.verdict.level, 'no_signal');
  const markdown = renderReport(report, 'https://seedup.example.com', 'en');
  assert.match(markdown, /\n\n## Why it could fail\n/);
  assert.ok(markdown.indexOf('Why it could fail') < markdown.indexOf('**Verdict**'));
  assert.match(markdown, /\/profile\?tryIdea=Slack\+issue\+digest\+%28daily%29#idea-pages/);
  assert.equal(markdown.split('\n').filter((line) => /^\d\. /.test(line)).length, 3);
});

test('the explicit agent switch measures direct, total candidates and extra queries before display caps', async () => {
  let requests = 0;
  const sources = {
    readEvidence: async () => ({ phrases: ['slack issue digest'], quotes: [] }),
    estimate: async () => null,
    supply: async (query: string) => query === 'extra search' ? [tool('new', 'Slack issue digest')]
      : [tool('first', 'Slack issue digest'), tool('noise', 'Keyboard shortcut')],
    demand: async () => [],
    webSupply: async () => [],
    rivalAgent: () => true,
    askRivalQueries: async () => ({ queries: requests++ === 0 ? ['extra search'] : [] }),
  };
  const off = await buildValidationReport('Slack issue digest', [], { rivalAgent: false }, sources);
  assert.deepEqual(off.rivalStats, { candidates: 2, direct: 1, researchQueries: 0 });
  assert.equal(requests, 0);
  const on = await buildValidationReport('Slack issue digest', [], { rivalAgent: true }, sources);
  assert.deepEqual(on.rivalStats, { candidates: 3, direct: 2, researchQueries: 1 });
});

test('the model the person picked reaches every model call in the report', async () => {
  const seen: Array<string | undefined> = [];
  const note = (choice?: { model?: string }) => { seen.push(choice?.model); };
  const sources = {
    readEvidence: async (_idea: string, _budget?: number, choice?: { model?: string }) => { note(choice); return { phrases: ['slack issue digest'], quotes: [] }; },
    estimate: async (_item: unknown, choice?: { model?: string }) => { note(choice); return null; },
    supply: async () => [],
    demand: async () => [],
    webSupply: async () => [],
    rivalAgent: () => true,
    askRivalQueries: async (_prompt: string, choice?: { model?: string }) => { note(choice); return { queries: [] }; },
  };
  await buildValidationReport('Slack issue digest', [], { model: 'anthropic/claude-haiku-5.5' }, sources);
  assert.deepEqual(seen.sort(), ['anthropic/claude-haiku-5.5', 'anthropic/claude-haiku-5.5', 'anthropic/claude-haiku-5.5']);
});

test('raw supply starts before evidence resolves and keeps first place when listings overlap', async () => {
  const live = Promise.withResolvers<{ phrases: string[]; quotes: Evidence[] }>();
  const searches: string[] = [];
  const report = buildValidationReport('raw idea', [], { searchCounterEvidence: true, rivalAgent: false }, {
    readEvidence: () => live.promise,
    estimate: async () => null,
    supply: async (query) => {
      searches.push(`supply ${query}`);
      return [tool('shared', query === 'raw idea' ? 'Raw Slack issue digest listing' : 'Phrase Slack issue digest listing')];
    },
    demand: async (query) => { searches.push(`demand ${query}`); return []; },
    webSupply: async (query) => { searches.push(`web ${query}`); return []; },
    rivalAgent: () => false,
    askRivalQueries: async () => null,
  });
  const started = [...searches];
  live.resolve({ phrases: ['slack issue digest'], quotes: [] });
  const result = await report;
  assert.deepEqual(started, ['supply raw idea', 'web raw idea']);
  assert.deepEqual(searches.slice(2), [
    'demand slack issue digest "already use"', 'demand slack issue digest "no need"',
    'supply slack issue digest', 'web slack issue digest',
  ]);
  assert.deepEqual(result.rivals.map(({ description }) => description), ['Raw Slack issue digest listing']);
});

test('next-step criteria fit the case: missing quotes, a direct rival with a thin listing, and no counter-evidence', async () => {
  const report = await buildValidationReport('Slack issue digest', [], { lang: 'en', rivalAgent: false }, {
    readEvidence: async () => ({ phrases: ['slack issue digest'], quotes: [] }),
    estimate: async () => null,
    supply: async () => [tool('digestbot', 'Slack issue digest')],
    demand: async () => [],
    webSupply: async () => [],
    rivalAgent: () => false,
    askRivalQueries: async () => null,
  });
  const markdown = renderReport(report, 'https://seedup.example.com', 'en');
  assert.match(markdown, /### When to move on/);
  assert.match(markdown, /Evidence is below the bar \(0 quotes, 0 platforms\)/);
  assert.match(markdown, /This search found no counter-evidence\. That is not proof there is none/);
  if (report.rivals.some((row) => row.relation === 'direct')) {
    assert.match(markdown, /4\. Have you tried /);
    assert.match(markdown, /Direct competitors exist/);
  }
  assert.match(markdown, /The listing is too short to confirm its users and core features/);
});

test('a report links a related opportunity only on two shared words; search still takes one', async () => {
  const { matchOpportunities } = await import('../lib/opportunities/match');
  const items = [{ slug: 'papers', name: 'Paper backlog triage', keywords: ['사진', '기록'] }];
  assert.deepEqual(matchOpportunities('누수 사진과 연락 남기기', items).slugs, ['papers']);
  assert.deepEqual(matchOpportunities('누수 사진과 연락 남기기', items, 2).slugs, []);
  assert.deepEqual(matchOpportunities('누수 사진과 처리 기록을 남기기', items, 2).slugs, ['papers']);
});
