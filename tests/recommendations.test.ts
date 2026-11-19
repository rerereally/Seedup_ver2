import assert from 'node:assert/strict';
import test from 'node:test';
import { fuzzyOverlap } from '../lib/recommendations';

test('a short English token does not match inside a longer word', () => {
  assert.equal(fuzzyOverlap(['ai'], ['domain']), 0);
  assert.equal(fuzzyOverlap(['ui'], ['guide']), 0);
  assert.equal(fuzzyOverlap(['ui'], ['build']), 0);
});

test('a short English token matches as a whole word', () => {
  assert.equal(fuzzyOverlap(['ai'], ['ai agents']), 1);
  assert.equal(fuzzyOverlap(['ai agents'], ['ai']), 1);
});

test('longer English values match on whole tokens, avoiding partial-word false positives', () => {
  assert.equal(fuzzyOverlap(['react'], ['react native']), 1);
  assert.equal(fuzzyOverlap(['react'], ['reaction']), 0);
  assert.equal(fuzzyOverlap(['java'], ['javascript']), 0);
  assert.equal(fuzzyOverlap(['java'], ['java spring']), 1);
  assert.equal(fuzzyOverlap(['next.js'], ['next.js 16']), 1);
});

test('Korean values keep substring matching', () => {
  assert.equal(fuzzyOverlap(['프론트엔드'], ['프론트엔드 개발']), 1);
});

import { behaviorSignals, freshnessPoints, scoreContentBreakdown, scoreNewsletterItems } from '../lib/recommendations';
import type { NewsletterContentItem, RecommendationMetadata, RecommendationProfile } from '../lib/recommendations';

const meta = (over: Partial<RecommendationMetadata> = {}): RecommendationMetadata => ({
  content_type: 'news', newsletter_section: 'daily_briefing', newsletter_priority: 50, short_summary: '', topic_tags: [], skill_tags: [],
  intent_tags: [], audience_tags: [], related_roles: [], target_levels: [], target_goals: [], target_interests: [], learning_topics: [],
  project_convertible: false, personalization_hooks: [], source_quality_score: 50, novelty_score: 50, buildability_score: 50, project_connect_score: 50,
  recommendation_reasons: [], ...over,
} as RecommendationMetadata);
const item = (id: string, over: Partial<RecommendationMetadata> = {}, publishedAt: string | null = null): NewsletterContentItem => ({
  id, title: id, href: '/', sourceLabel: '', publishedAt, metadata: meta(over), raw: {} as NewsletterContentItem['raw'],
});
const profile = (over: Partial<RecommendationProfile> = {}): RecommendationProfile => ({ tokens: [], levels: [], goals: [], interests: [], tracks: [], ...over });

test('two readers with different roles and stacks get different top items', () => {
  const items = [
    item('news:fe', { skill_tags: ['react'], related_roles: ['frontend'] }),
    item('news:be', { skill_tags: ['postgres'], related_roles: ['backend'] }),
  ];
  const frontend = scoreNewsletterItems(items, profile({ roles: ['frontend'], stack: ['react'] }));
  const backend = scoreNewsletterItems(items, profile({ roles: ['backend'], stack: ['postgres'] }));
  assert.equal(frontend[0].content.id, 'news:fe');
  assert.equal(backend[0].content.id, 'news:be');
});

test('newer items score higher, all else equal', () => {
  const now = new Date('2026-11-14T00:00:00Z').getTime();
  assert.ok(freshnessPoints('2026-11-13T12:00:00Z', now) > freshnessPoints('2026-10-01T00:00:00Z', now));
  const ranked = scoreNewsletterItems([item('news:old', {}, '2026-09-01T00:00:00Z'), item('news:new', {}, '2026-11-13T20:00:00Z')], profile(), now);
  assert.equal(ranked[0].content.id, 'news:new');
});

test('saved and disliked items are not mailed again, and liked topics lift similar items', () => {
  const candidates = [item('news:1', { topic_tags: ['agents'] }), item('repo:2', { topic_tags: ['rust'] }), item('news:3', { topic_tags: ['agents'] }), item('news:4', { topic_tags: ['css'] })];
  const behavior = behaviorSignals(
    [{ item_type: 'news', item_id: '1', title: 't', tag: null }],
    [{ item_type: 'github', item_id: '2', reaction: 'dislike' }],
    candidates,
  );
  assert.deepEqual(behavior.excluded.sort(), ['news:1', 'repo:2']);
  assert.ok(behavior.liked.includes('agents'));
  const ranked = scoreNewsletterItems(candidates, profile(behavior));
  assert.deepEqual(ranked.map((row) => row.content.id), ['news:3', 'news:4']);
});

import { ruleItem } from '../lib/personal';

test('rule picks name the matching interest, and never claim one the reader has not given', () => {
  const next = item('news:next', { topic_tags: ['Next.js'], short_summary: 'Next.js 16 캐시 변경' });
  const picked = ruleItem({ content: next, score: 30, reasons: ['관심 분야와 일치'] }, ['Next.js'], false);
  assert.equal(picked.kind, '글');
  assert.equal(picked.reason, '관심 분야 Next.js');
  // A new reader with no interests and nothing kept gets the scorer's own reason, not "close to your interests".
  const cold = ruleItem({ content: item('repo:x'), score: 10, reasons: ['프로젝트로 확장 가능'] }, [], false);
  assert.equal(cold.kind, '저장소');
  assert.equal(cold.reason, '프로젝트로 확장 가능');
});

import { leadRead } from '../lib/personal';

test('the banner is the best-scored pick that is in the article list, with its reason', () => {
  const items = [{ type: 'news', id: 'a' }, { type: 'paper', id: 'b' }];
  const row = (id: string, score: number, reason: string) => ({ content: { id }, score, reasons: [reason] }) as unknown as Parameters<typeof leadRead>[1][number];
  const picked = leadRead(items, [row('repo:x', 99, '저장소'), row('news:a', 40, '관심 분야: AI'), row('paper:b', 70, '킵한 것과 비슷함')]);
  assert.equal(picked?.item.id, 'b');
  assert.equal(picked?.reason, '킵한 것과 비슷함');
  assert.equal(leadRead(items, [row('repo:x', 99, '저장소')]), null);
  // A reason about the article itself is not a personal one.
  assert.equal(leadRead(items, [row('news:a', 40, '프로젝트로 확장 가능')])?.reason, undefined);
});

import { pickBannerReads, pickReads, reasonFor } from '../lib/personal';

test('the banner takes the top reads in score order without two from the same source in a row', () => {
  const items = [{ type: 'news', id: 'a', source: 'HN' }, { type: 'news', id: 'b', source: 'HN' }, { type: 'news', id: 'c', source: 'arXiv' }];
  const row = (id: string, score: number) => ({ content: { id }, score, reasons: ['관심 분야와 일치'] }) as unknown as Parameters<typeof pickReads>[1][number];
  const picked = pickReads(items, [row('news:a', 90), row('news:b', 80), row('news:c', 10)], 3);
  assert.deepEqual(picked.map((pick) => pick.item.id), ['a', 'c', 'b']);
  assert.equal(pickReads(items, [row('news:a', 90)], 3).length, 1);
});

test('personal relevance beats higher shared editorial and freshness scores', () => {
  const now = new Date('2026-11-19T00:00:00Z').getTime();
  const matching = item(
    'news:rust',
    { topic_tags: ['Rust'], newsletter_priority: 45, novelty_score: 45, source_quality_score: 45 },
    '2026-11-10T00:00:00Z',
  );
  const unrelatedHighEditorial = item(
    'news:general',
    { topic_tags: ['CSS'], newsletter_priority: 98, novelty_score: 95, source_quality_score: 95 },
    '2026-11-18T22:00:00Z',
  );
  const reader = profile({ interests: ['Rust'] });
  const matchBreakdown = scoreContentBreakdown(matching.metadata, reader, matching.publishedAt, now);
  const generalBreakdown = scoreContentBreakdown(unrelatedHighEditorial.metadata, reader, unrelatedHighEditorial.publishedAt, now);
  assert.ok(matchBreakdown.personal > generalBreakdown.personal);
  assert.ok(matchBreakdown.total > generalBreakdown.total, `expected ${matchBreakdown.total} > ${generalBreakdown.total}`);

  const ranked = scoreNewsletterItems([unrelatedHighEditorial, matching], reader, now);
  assert.equal(ranked[0].content.id, 'news:rust');
});

test('disliked items penalize unread items sharing those topics unless explicitly liked', () => {
  const candidates = [
    item('news:disliked', { topic_tags: ['crypto', 'web3'] }),
    item('news:similar-disliked', { topic_tags: ['crypto'], newsletter_priority: 75 }),
    item('news:neutral', { topic_tags: ['postgres'], newsletter_priority: 50 }),
  ];
  const behavior = behaviorSignals(
    [],
    [{ item_type: 'news', item_id: 'disliked', reaction: 'dislike' }],
    candidates,
  );
  assert.ok(behavior.disliked.includes('crypto'));
  assert.ok(behavior.excluded.includes('news:disliked'));
  const ranked = scoreNewsletterItems(candidates, profile(behavior));
  assert.deepEqual(ranked.map((row) => row.content.id), ['news:neutral', 'news:similar-disliked']);
});

test('reasonFor avoids partial-word false positives for English interests', () => {
  assert.equal(reasonFor('JavaScript runtime benchmarks', ['Java'], false), '관심사와 가까움');
  assert.equal(reasonFor('Chain reaction in distributed queues', ['React'], false), '관심사와 가까움');
  // No interests and nothing kept: the match came from the reader's PRD titles.
  assert.equal(reasonFor('Queue worker monitoring', [], false), '만들고 있는 PRD와 가까움');
  assert.equal(reasonFor('React Native architecture notes', ['React'], false), '관심 분야 React');
});

test('pickBannerReads prefers embedded article picks first and tops up from rule reads with source diversity', () => {
  const articles = [
    { type: 'news', id: 'e1', source: 'HN' },
    { type: 'paper', id: 'e2', source: 'arXiv' },
    { type: 'news', id: 'r1', source: 'HN' },
    { type: 'news', id: 'r2', source: 'DEV' },
  ];
  const embedded = [
    { key: 'news:e1', kind: '글', title: 'E1', href: '/news/e1', source: 'HN', reason: '관심 분야 AI', score: 0.85, target: { type: 'news', id: 'e1' } },
    { key: 'paper:e2', kind: '논문', title: 'E2', href: '/papers/e2', source: 'arXiv', reason: '킵한 것과 비슷함', score: 0.72, target: { type: 'paper', id: 'e2' } },
    { key: 'github:g1', kind: '저장소', title: 'G1', href: '/github-trends/g1', source: 'GitHub', reason: '관심 분야 AI', score: 0.9, target: { type: 'github', id: 'g1' } },
  ];
  const ruleRow = (id: string, score: number) => ({ content: { id }, score, reasons: ['관심 분야와 일치'] }) as unknown as Parameters<typeof pickReads>[1][number];
  const picked = pickBannerReads(articles, embedded, [ruleRow('news:r1', 80), ruleRow('news:r2', 70), ruleRow('news:e1', 60)], 4);
  assert.deepEqual(picked.map((row) => row.item.id), ['e1', 'e2', 'r1', 'r2']);
  assert.equal(picked[0].reason, '관심 분야 AI');
});
