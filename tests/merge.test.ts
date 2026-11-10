import assert from 'node:assert/strict';
import test from 'node:test';
import { painSignalCount, signalRank } from '../lib/opportunities/actors';
import { describeChange, mergeRuns } from '../lib/opportunities/merge';
import type { Evidence, Opportunity } from '../lib/opportunities/types';

const ev = (n: number, platform: Evidence['platform'] = 'hn', quoteKo = ''): Evidence => ({ id: `ev${n}`, platform, quote: `quote ${n}`, quoteKo, url: `https://example.com/${n}`, score: n, postedAt: `2026-01-0${(n % 9) + 1}T00:00:00Z` });
const opp = (slug: string, evidence: Evidence[], extra: Partial<Opportunity> = {}): Opportunity => ({ slug, name: slug, problem: `${slug} problem`, gap: '', keywords: [slug], status: 'open', qualified: false, platforms: [...new Set(evidence.map((item) => item.platform))], evidence, supply: [], directCount: 0, firstSeenAt: null, followersAfterSignal: 0, ...extra });
const vec = (x: number, y: number) => [x, y, 0];
const DAY1 = '2026-11-10T00:00:00.000Z';
const DAY2 = '2026-11-11T00:00:00.000Z';

test('the first run is kept as is, with one history point each', () => {
  const { opportunities, summary } = mergeRuns(null, { opportunities: [opp('a', [ev(1)])], embeddings: {} }, DAY1);
  assert.equal(opportunities[0].lastSeenAt, DAY1);
  assert.equal(opportunities[0].history?.length, 1);
  assert.deepEqual(summary.added, []);
});

test('the same problem found again gains evidence and keeps its link and name', () => {
  const previous = { generatedAt: DAY1, opportunities: [opp('first-name', [ev(1, 'hn', '번역'), ev(2)])], embeddings: { 'first-name': vec(1, 0) } };
  const next = { opportunities: [opp('second-name', [ev(1), ev(3, 'github')], { status: 'narrowing', directCount: 3 })], embeddings: { 'second-name': vec(0.9, 0.3) } };
  const { opportunities, embeddings, summary } = mergeRuns(previous, next, DAY2);
  assert.equal(opportunities.length, 1);
  const merged = opportunities[0];
  assert.equal(merged.slug, 'first-name');
  assert.equal(merged.evidence.length, 3);
  assert.equal(merged.evidence.find((item) => item.url.endsWith('/1'))?.quoteKo, '번역');
  assert.equal(merged.qualified, true);
  assert.equal(merged.status, 'narrowing');
  assert.equal(merged.history?.length, 2);
  assert.deepEqual(Object.keys(embeddings), ['first-name']);
  assert.equal(summary.grown.length, 1);
  assert.equal(summary.statusChanged.length, 1);
});

test('different problems are never merged', () => {
  const previous = { generatedAt: DAY1, opportunities: [opp('a', [ev(1)])], embeddings: { a: vec(1, 0) } };
  const { opportunities, summary } = mergeRuns(previous, { opportunities: [opp('b', [ev(2)])], embeddings: { b: vec(0.4, 0.9) } }, DAY2);
  assert.deepEqual(opportunities.map((item) => item.slug).sort(), ['a', 'b']);
  assert.deepEqual(summary.added, ['b']);
  assert.equal(summary.carried, 1);
});

test('a run that could not review supply does not erase an earlier status', () => {
  const previous = { generatedAt: DAY1, opportunities: [opp('a', [ev(1)], { status: 'closed', directCount: 9 })], embeddings: {} };
  const { opportunities } = mergeRuns(previous, { opportunities: [opp('a', [ev(1)], { status: 'unknown' })], embeddings: {} }, DAY2);
  assert.equal(opportunities[0].status, 'closed');
  assert.equal(opportunities[0].directCount, 9);
  assert.equal(opportunities[0].history?.length, 1);
});

test('an opportunity not seen for three weeks is dropped', () => {
  const previous = { generatedAt: DAY1, opportunities: [opp('old', [ev(1)], { lastSeenAt: '2026-10-01T00:00:00.000Z' }), opp('recent', [ev(2)], { lastSeenAt: DAY1 })], embeddings: {} };
  const { opportunities, summary } = mergeRuns(previous, { opportunities: [opp('new', [ev(3)])], embeddings: {} }, DAY2);
  assert.deepEqual(opportunities.map((item) => item.slug).sort(), ['new', 'recent']);
  assert.deepEqual(summary.expired, ['old']);
});

test('changes are described in the words shown on the page', () => {
  const before = { at: DAY1, evidence: 2, platforms: 1, direct: 0, status: 'open' as const, qualified: false };
  const after = { at: DAY2, evidence: 4, platforms: 2, direct: 0, status: 'open' as const, qualified: true };
  assert.deepEqual(describeChange(before, after), ['증언 2건 → 4건', '플랫폼 1종 → 2종', '근거 기준 통과']);
});

test('posts that say a tool is missing are read first', () => {
  assert.equal(painSignalCount('Fixed a crash in the parser when the file is empty.'), 0);
  assert.ok(painSignalCount('Is there a tool for this? We ended up building our own and it is painful.') >= 3);
  const now = Date.parse(DAY2);
  const quiet = { title: 'Release notes', text: 'Version 2 is out.', score: 500, postedAt: DAY1 };
  const pain = { title: 'Ask', text: 'I wish there was a way to diff prompts. No good way exists.', score: 0, postedAt: DAY1 };
  assert.ok(signalRank(pain, now) > signalRank(quiet, now));
});
