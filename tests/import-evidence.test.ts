import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test, { type TestContext } from 'node:test';
import type { quotesFromLink } from '../lib/opportunities/live-evidence';
import { importEvidence } from '../scripts/import-evidence';

const quote = 'I still copy invoice totals by hand every month.';
const row = (path: string, overrides = {}) => ({
  url: `https://forum.example/${path}`, platform: 'forum', quote, posted_at: '2026-03-01T00:00:00Z', terms: ['invoices'], ...overrides,
});
const verified = (url: string, quote: string) => ({
  status: 'ok' as const,
  quotes: [{ id: `lv_${new URL(url).pathname.slice(1)}`, platform: 'web' as const, url, quote, quoteKo: '', score: 0, postedAt: null }],
});

async function inputDir(t: TestContext, files: Record<string, unknown[]>) {
  const dir = await mkdtemp(join(tmpdir(), 'import-evidence-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await Promise.all(Object.entries(files).map(([name, rows]) => writeFile(join(dir, name), rows.map((value) => (
    typeof value === 'string' ? value : JSON.stringify(value)
  )).join('\n'))));
  return dir;
}

test('validates JSONL before rechecking sources, skips duplicate URLs and reports final outcomes without writing', async (t) => {
  const dir = await inputDir(t, {
    'evidence-2026-01.jsonl': [
      row('ok', { posted_at: '2026-01-01T00:00:00Z' }),
      row('before', { posted_at: '2025-12-31T23:59:59Z' }),
      row('after', { posted_at: '2026-11-21T23:59:59.001Z' }),
      row('impossible', { posted_at: '2026-02-31T00:00:00Z' }),
      row('unfinished', { quote: 'I still copy invoice totals by hand:' }),
      row('short', { quote: 'Too short' }),
      row('long', { quote: 'x'.repeat(401) }),
      row('private', { url: 'http://127.0.0.1/source' }),
      row('localhost', { url: 'http://localhost./source' }),
      row('file', { url: 'file:///example' }),
      row('missing', { platform: undefined }),
      row('wrong-terms', { terms: ['invoice', 1] }),
      '{bad json', '',
    ],
    'evidence-2026-11.jsonl': [
      row('duplicate', { url: 'https://FORUM.example:443/ok' }),
      row('absent', { verified: true }),
      row('unreadable'),
      row('recovers', { posted_at: '2026-11-21T23:59:59Z' }),
    ],
    'report.md': [row('ignored')],
  });
  const calls = new Map<string, number>();
  const verify: typeof quotesFromLink = async (url, idea, given) => {
    assert.equal(idea, '');
    assert.equal(given, quote);
    const path = new URL(url).pathname;
    const attempt = (calls.get(path) ?? 0) + 1;
    calls.set(path, attempt);
    if (path === '/absent') return { status: 'not_found', quotes: [] };
    if (path === '/unreadable') throw new Error('fake fetch failure');
    if (path === '/recovers' && attempt < 3) return { status: 'unreadable', quotes: [] };
    return verified(url, given);
  };

  const result = await importEvidence({ dir, dryRun: true }, { verify, save: async () => assert.fail('dry run wrote to DB') });
  assert.deepEqual(Object.fromEntries(calls), { '/ok': 1, '/absent': 3, '/unreadable': 3, '/recovers': 3 });
  assert.deepEqual(result, {
    read: 17,
    passed: [{ platform: 'web', month: '2026-01', count: 1 }, { platform: 'web', month: '2026-11', count: 1 }],
    discarded: { bad_url: 3, date: 3, duplicate_url: 1, fields: 2, incomplete_quote: 1, json: 1, not_found: 1, quote_length: 2, unreadable: 1 },
  });
});

test('writes separate terms per row in batches of 100 and respects the global input limit', async (t) => {
  const dir = await inputDir(t, {
    'evidence-2026-02.jsonl': [row('first', {
      quote_ko: '매달 합계를 손으로 옮겨요.', score: 14, domain: ' MONEY ', kind: ' Pain ',
      terms: [' Manual\tEntry ', 'manual entry', '   ', ...Array.from({ length: 12 }, (_, index) => `Term ${index}`)],
    }), ...Array.from({ length: 99 }, (_, index) => row(`post-${index}`))],
    'evidence-2026-03.jsonl': [row('last', { terms: ['  월말  정산 '] }), row('over-limit')],
  });
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.invalid',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-public-key',
    SUPABASE_SECRET_KEY: 'test-secret-key',
  };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[key];
      else process.env[key] = previous;
    });
  }
  const rpc = t.mock.method(globalThis, 'fetch', async (url: string, request: RequestInit) => {
    assert.equal(url, 'https://supabase.invalid/rest/v1/rpc/save_found_evidence');
    assert.equal(request.method, 'POST');
    return new Response(null, { status: 204 });
  });
  const verify: typeof quotesFromLink = async (url, _idea, given) => {
    assert.notEqual(new URL(url).pathname, '/over-limit');
    assert.equal(given, quote);
    const result = verified(url, given);
    if (url.endsWith('/first')) Object.assign(result.quotes[0], {
      url: 'https://forum.example/canonical', id: 'lv_canonical', platform: 'stackexchange', quote: `“${given}”`,
    });
    return result;
  };

  const result = await importEvidence({ dir, limit: 101, concurrency: 1 }, { verify });
  const batches = rpc.mock.calls.map(({ arguments: [, request] }) => JSON.parse(String(request?.body)).p_rows as Array<Record<string, unknown>>);
  assert.deepEqual(batches.map((batch) => batch.length), [100, 1]);
  assert.deepEqual(batches[0][0], {
    id: 'lv_canonical', platform: 'stackexchange', url: 'https://forum.example/canonical', quote: `“${quote}”`,
    quote_ko: '매달 합계를 손으로 옮겨요.', score: 14, posted_at: '2026-03-01T00:00:00Z',
    terms: ['manual entry', ...Array.from({ length: 11 }, (_, index) => `term ${index}`), 'domain:money', 'kind:pain'],
  });
  assert.deepEqual(batches[1][0].terms, ['월말 정산']);
  assert.equal(result.read, 101);
});

test('spaces actual GitHub API starts, including parallel replies and redirects, while other sites proceed', async (t) => {
  const dir = await inputDir(t, {
    'evidence-2026-03.jsonl': [
      row('github', { url: 'https://github.com/owner/repo/issues/1' }),
      row('first-page'), row('second-page'),
    ],
  });
  const starts = new Map<string, number[]>();
  const fetch = t.mock.method(globalThis, 'fetch', async (request: Request, init?: RequestInit) => {
    const { hostname, pathname } = new URL(request.url);
    const times = starts.get(hostname) ?? [];
    times.push(performance.now());
    starts.set(hostname, times);
    if (hostname === 'forum.example') return new Response(quote);
    assert.equal(hostname, 'api.github.com');
    assert.equal(init?.redirect, 'manual');
    if (pathname.endsWith('/comments')) return Response.json([{ body: quote }]);
    if (pathname.startsWith('/repos/new-owner/')) return Response.json({ body: quote });
    return new Response(null, { status: 301, headers: { location: '/repos/new-owner/repo/issues/1' } });
  });

  const result = await importEvidence({ dir, dryRun: true });
  assert.deepEqual(result.passed, [{ platform: 'github', month: '2026-03', count: 1 }, { platform: 'web', month: '2026-03', count: 2 }]);
  const github = starts.get('api.github.com') ?? [];
  const forum = starts.get('forum.example') ?? [];
  assert.equal(github.length, 3);
  assert.equal(forum.length, 2);
  assert.ok(forum[0] < github[1], 'the forum should proceed while the GitHub API requests wait');
  for (const times of [github, forum]) {
    assert.ok(times.slice(1).every((at, index) => at - times[index] >= 1_000), `requests started at ${times.join(', ')}`);
  }
  assert.equal(globalThis.fetch, fetch);
});
