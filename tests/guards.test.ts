import assert from 'node:assert/strict';
import test from 'node:test';
import { enforceFreeOnlyModels, isFreeOpenRouterModel } from '../lib/ingest/openrouter-models';
import { assertIngestAuth } from '../lib/ingest/auth';

test('ingest auth accepts only headers, rejects query secrets, and fails closed without a secret', () => {
  const previous = { ingest: process.env.INGEST_SECRET, cron: process.env.CRON_SECRET };
  process.env.INGEST_SECRET = 'test-ingest-secret';
  delete process.env.CRON_SECRET;
  const at = (path: string, headers: Record<string, string> = {}) => new Request(`https://seedup.test${path}`, { method: 'POST', headers });
  try {
    assert.equal(assertIngestAuth(at('/api/ingest/rss', { 'x-ingest-secret': 'test-ingest-secret' })), null);
    assert.equal(assertIngestAuth(at('/api/ingest/rss', { authorization: 'Bearer test-ingest-secret' })), null);
    assert.equal(assertIngestAuth(at('/api/ingest/rss?secret=test-ingest-secret'))?.status, 401);
    assert.equal(assertIngestAuth(at('/api/ingest/rss', { 'x-ingest-secret': 'wrong-secret!' }))?.status, 401);
    assert.equal(assertIngestAuth(at('/api/ingest/rss', { 'x-ingest-secret': 'short' }))?.status, 401);
    delete process.env.INGEST_SECRET;
    assert.equal(assertIngestAuth(at('/api/ingest/rss', { 'x-ingest-secret': 'test-ingest-secret' }))?.status, 503);
  } finally {
    if (previous.ingest === undefined) delete process.env.INGEST_SECRET;
    else process.env.INGEST_SECRET = previous.ingest;
    if (previous.cron === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = previous.cron;
  }
});

test('recognizes free model ids', () => {
  assert.equal(isFreeOpenRouterModel('nvidia/nemotron-3.5-super-vl:free'), true);
  assert.equal(isFreeOpenRouterModel('openrouter/free'), true);
  assert.equal(isFreeOpenRouterModel('anthropic/claude-sonnet-5'), false);
});

test('free-only mode removes paid models and refuses an all-paid list', () => {
  const previous = process.env.OPENROUTER_FREE_ONLY;
  process.env.OPENROUTER_FREE_ONLY = 'true';
  try {
    assert.deepEqual(enforceFreeOnlyModels(['a/b', 'c/d:free']), ['c/d:free']);
    assert.throws(() => enforceFreeOnlyModels(['a/b']));
  } finally {
    if (previous === undefined) delete process.env.OPENROUTER_FREE_ONLY;
    else process.env.OPENROUTER_FREE_ONLY = previous;
  }
});

test('paid models pass through when free-only mode is off', () => {
  const previous = process.env.OPENROUTER_FREE_ONLY;
  delete process.env.OPENROUTER_FREE_ONLY;
  try {
    assert.deepEqual(enforceFreeOnlyModels(['a/b']), ['a/b']);
  } finally {
    if (previous !== undefined) process.env.OPENROUTER_FREE_ONLY = previous;
  }
});

import { latestEngineActors, summarizeSourceHealth } from '../lib/ingest/health';

test('source health puts failing and stale sources first', () => {
  const now = new Date('2026-11-10T00:00:00Z').getTime();
  const run = (source: string, status: string, at: string, detail?: Record<string, unknown>) => ({ source, status, created_at: at, detail });
  const health = summarizeSourceHealth([
    run('rss', 'success', '2026-11-09T21:00:00Z'), run('rss', 'success', '2026-11-08T21:00:00Z'),
    run('github', 'failed', '2026-11-09T21:00:00Z'), run('github', 'failed', '2026-11-08T21:00:00Z'), run('github', 'success', '2026-11-07T21:00:00Z'),
    run('research', 'success', '2026-11-05T21:00:00Z'),
    run('trends', 'partial', '2026-11-09T21:00:00Z'),
    run('opportunity-engine', 'success', '2026-11-09T22:00:00Z', { actors: [{ id: 'hn-ask', status: 'ok', items: 40, errors: 0 }, { nope: 1 }] }),
  ], now);
  assert.deepEqual(health.map((row) => `${row.source}:${row.state}`), ['github:failing', 'research:stale', 'trends:unstable', 'opportunity-engine:ok', 'rss:ok']);
  assert.equal(health[0].failures, 2);
  assert.deepEqual(latestEngineActors([run('opportunity-engine', 'success', '2026-11-09T22:00:00Z', { actors: [{ id: 'hn-ask', status: 'ok', items: 40, errors: 0 }, { nope: 1 }] })]), [{ id: 'hn-ask', status: 'ok', items: 40, errors: 0 }]);
});
