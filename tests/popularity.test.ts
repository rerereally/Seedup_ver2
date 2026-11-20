import assert from 'node:assert/strict';
import test from 'node:test';
import { averagePerDay, daysBefore, growthRate, modelComposite, periodState, productPopularity, rankByRise, valuesAt, withinDays } from '../lib/popularity';

test('a period is offered only once the history reaches back that far', () => {
  const state = periodState('1m', '2026-11-11', '2026-11-19');
  assert.equal(state.historyDays, 8);
  assert.deepEqual(state.ready, { '1d': true, '1w': true, '1m': false, '1y': false });
  assert.equal(state.period, null, 'an unready period falls back to all');
  assert.equal(periodState('1w', '2026-11-11', '2026-11-19').period?.days, 7);
  assert.equal(periodState('1d', null, null).period, null);
  assert.equal(daysBefore('2026-03-01', 1), '2026-02-28');
});

test('the baseline is the latest value on or before the day', () => {
  const rows = [
    { key: 'a', date: '2026-11-10', value: 1 },
    { key: 'a', date: '2026-11-12', value: 5 },
    { key: 'a', date: '2026-11-14', value: 9 },
    { key: 'b', date: '2026-11-13', value: 3 },
  ];
  assert.deepEqual([...valuesAt(rows, '2026-11-12')], [['a', 5]]);
});

test('rise ranks topics new in the period by their whole value, and leaves out repos with no baseline', () => {
  const items = [{ id: 'old', now: 50 }, { id: 'up', now: 40 }, { id: 'new', now: 30 }];
  const before = new Map([['old', 48], ['up', 10]]);
  const ranked = (newCounts: boolean) => rankByRise(items, (item) => item.now, (item) => item.id, before, newCounts).map((row) => `${row.item.id}:${row.rise}`);
  assert.deepEqual(ranked(true), ['up:30', 'new:30', 'old:2'], 'equal rises: the larger current value first');
  assert.deepEqual(ranked(false), ['up:30', 'old:2']);
});

test('period windows and product interest', () => {
  const now = Date.parse('2026-11-20T00:00:00Z');
  assert.equal(withinDays('2026-11-19T12:00:00Z', 1, now), true);
  assert.equal(withinDays('2026-11-12T00:00:00Z', 7, now), false);
  assert.equal(withinDays('2026-11-21T00:00:00Z', 7, now), false, 'a future launch is not in the past week');
  assert.equal(withinDays(null, 365, now), false);
  assert.equal(productPopularity({}), 0);
  assert.ok(productPopularity({ rating_count: 2, user_rating_average: 5 }) > productPopularity({ rating_count: 2, user_rating_average: 1 }));
});

test('average per day counts missing days as zero', () => {
  const rows = [
    { key: 'steady', date: 'd1', value: 40 },
    { key: 'steady', date: 'd2', value: 40 },
    { key: 'spike', date: 'd2', value: 70 },
  ];
  const average = averagePerDay(rows);
  assert.equal(average.get('steady'), 40);
  assert.equal(average.get('spike'), 35);
  assert.equal(growthRate(50, 100), 0.5);
  assert.equal(growthRate(50, 0), null);
});

test('the overall model ranking needs usage and performance together to lead', () => {
  const ranked = modelComposite([
    { id: 'popular-only', popularity_rank: 1, intelligence_rank: null, arena_rank: null },
    { id: 'both', popularity_rank: 5, intelligence_rank: 3, arena_rank: null },
    { id: 'smart-only', popularity_rank: null, intelligence_rank: 1, arena_rank: 1 },
    { id: 'none', popularity_rank: null, intelligence_rank: null, arena_rank: null },
  ]);
  assert.deepEqual(ranked.map((row) => row.model.id), ['both', 'popular-only', 'smart-only']);
  assert.equal(ranked[1].score, 50);
});
