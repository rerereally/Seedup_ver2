import assert from 'node:assert/strict';
import test from 'node:test';
import { handleSectionView } from '../app/api/engagement/section-view/handler';
import { sectionOf } from '../lib/sections';
import { sectionUsageReport } from '../scripts/section-usage';

test('section mapping covers menu aliases, subpages, and route boundaries', () => {
  for (const [pathname, section] of [
    ['/', 'home'], ['/newsletter-preview/2026-11', 'insights'], ['/opportunities', 'insights'],
    ['/news/123', 'articles'], ['/papers/123', 'papers'], ['/trends', 'trends'],
    ['/github-trends/123', 'github-trends'], ['/ai-products/123', 'ai-products'], ['/projects/123', 'projects'],
    ['/prd/validate', 'validate'], ['/prd/validate/', 'validate'], ['/prd/validate-example', 'prd'],
    ['/prd/repo', 'prd'], ['/spec/123', 'prd'], ['/ideas', 'prd'], ['/seeds', 'prd'],
    ['/agents', 'mcp'], ['/predictions', 'predictions'], ['/profile', 'profile'], ['/scrap/123', 'scrap'], ['/search', 'search'],
    ['/api/engagement/view', null], ['/newsroom', null], ['//news', null], ['https://seedup.test/news', null], ['/search?q=idea', null],
  ] as const) {
    assert.equal(sectionOf(pathname), section, pathname);
  }
});

function request(body: object, ip = '192.0.2.1') {
  return new Request('https://seedup.test/api/engagement/section-view', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip },
    body: JSON.stringify(body),
  });
}

test('section endpoint rejects unknown paths and client-supplied identity before accessing the session', async () => {
  const unexpected = async () => assert.fail('invalid requests must not get this far');
  for (const body of [
    { pathname: '/outside' }, { pathname: '/prd', user_id: 'forged' },
    { pathname: '/prd', userId: 'forged' }, { pathname: '/prd', signed_in: true },
  ]) {
    const response = await handleSectionView(request(body), { getUserId: unexpected, record: unexpected });
    assert.equal(response.status, 400);
  }
});

test('section endpoint records a validated section and uses only the server session', async () => {
  const rows: unknown[] = [];
  const record = async (section: string, userId: string | null) => { rows.push([section, userId]); };
  const signedIn = await handleSectionView(request({ pathname: '/prd/validate' }), { getUserId: async () => 'verified', record });
  const anonymous = await handleSectionView(request({ pathname: '/news/123' }), { getUserId: async () => null, record });
  assert.equal(signedIn.status, 204);
  assert.equal(anonymous.status, 204);
  assert.deepEqual(rows, [['validate', 'verified'], ['articles', null]]);
});

test('section endpoint limits bursts before accessing the session and hides storage failures', async (t) => {
  const getUserId = t.mock.fn(async () => null);
  const record = t.mock.fn(async () => {});
  for (let i = 0; i < 60; i++) {
    assert.equal((await handleSectionView(request({ pathname: '/' }, '192.0.2.2'), { getUserId, record })).status, 204);
  }
  assert.equal((await handleSectionView(request({ pathname: '/' }, '192.0.2.2'), { getUserId, record })).status, 429);
  assert.equal(getUserId.mock.callCount(), 60);
  assert.equal(record.mock.callCount(), 60);

  const log = t.mock.method(console, 'error', () => {});
  const response = await handleSectionView(request({ pathname: '/' }), {
    getUserId,
    record: async () => { throw new Error('missing table'); },
  });
  assert.equal(response.status, 204);
  assert.equal(log.mock.callCount(), 1);
});

const NOW = Date.parse('2026-11-20T09:00:00Z');
const ago = (days: number, offsetMs = 0) => new Date(NOW - days * 86_400_000 + offsetMs).toISOString();

test('usage report counts unique users and PRD conversions at the window boundaries', () => {
  const view = (created_at: string, user_id: string | null) => ({ section: 'articles', created_at, user_id });
  const prd = (created_at: string, user_id: string, ok = true, kind = 'prd') => ({ created_at, user_id, ok, kind });
  const ingest = (created_at: string, source: string, status: string, duration_ms: number) => ({ created_at, source, status, duration_ms });
  const report = sectionUsageReport({
    firstViewAt: ago(28, -1),
    views: [view(ago(28, -1), 'old'), view(ago(28), 'a'), view(ago(26), 'b'), view(ago(7, -1), 'b'),
      view(ago(7), 'a'), view(ago(4), 'c'), view(ago(4), 'd'), view(ago(1), null), view(ago(0, 1), 'future')],
    prdRuns: [prd(ago(21), 'a'), prd(ago(19, 1), 'b'), prd(ago(8), 'b'),
      prd(ago(2), 'b', true, 'revise'), prd(ago(2), 'c', false), prd(ago(4, -1), 'd'), prd(ago(0, 1), 'd')],
    ingestRuns: [ingest(ago(14, -1), 'rss', 'failed', 99000), ingest(ago(14), 'rss', 'success', 1000),
      ingest(ago(1), 'article-drafts', 'failed', 4000), ingest(ago(1), 'rss', 'partial', 1000),
      ingest(ago(0, 1), 'rss', 'failed', 99000), ingest(ago(1), 'research', 'failed', 40000)],
    legacyViews: { articles: 123, papers: 0 },
  }, NOW);
  assert.ok(report.startsWith('| 섹션 |'));
  assert.ok(report.includes('| articles | 4 | 7 | 3 | 4 | 25.0% (1/4) | 123 | 2.0 | 1 |'));
  assert.ok(report.includes('| papers | 0 | 0 | 0 | 0 | — | 0 | 40.0 | 1 |'));
  assert.ok(report.includes('| profile | 0 | 0 | 0 | 0 | — | — | — | — |'));
});

test('usage report marks missing or short history and accepts exactly seven days', () => {
  const render = (firstViewAt: string | null) => sectionUsageReport({ firstViewAt, views: [], prdRuns: [], ingestRuns: [], legacyViews: {} }, NOW);
  assert.match(render(null), /^기록이 아직 짧습니다\.\n\n\|/);
  assert.match(render(ago(7, 1)), /^기록이 아직 짧습니다\./);
  assert.match(render(ago(7)), /^\| 섹션 \|/);
});
