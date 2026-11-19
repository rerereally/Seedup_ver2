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

test('longer English values keep substring matching', () => {
  assert.equal(fuzzyOverlap(['react'], ['react native']), 1);
});

test('Korean values keep substring matching', () => {
  assert.equal(fuzzyOverlap(['프론트엔드'], ['프론트엔드 개발']), 1);
});

import { behaviorSignals, freshnessPoints, scoreNewsletterItems } from '../lib/recommendations';
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
});
