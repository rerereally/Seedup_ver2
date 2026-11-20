import assert from 'node:assert/strict';
import test from 'node:test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { flagBuildProgressForCommit } from '../lib/opportunities/build-progress';
import type { BuildProgress } from '../lib/opportunities/build-progress';
import { countUnlinkedCommits, readFeatureCommits, summarizeFeatureCommits, touchedDoneFeatures, unlinkedFeatureCommits, writeFeatureCommit } from '../lib/opportunities/feature-commits';

const row = (n: number, feature_id: string, files: string[], dismissed_at: string | null = null) => ({
  id: String(n), sha: String(n), feature_id, message: '', files, created_at: String(n), dismissed_at,
});

test('commit summaries count links and keep distinct files in newest-first order', () => {
  assert.deepEqual(summarizeFeatureCommits([
    row(4, 'F-01', ['new.ts', 'shared.ts']),
    row(3, '', ['unlinked.ts']),
    row(2, 'F-02', ['shared.ts']),
    row(1, 'F-01', ['old.ts', 'shared.ts']),
  ]), {
    'F-01': { count: 2, files: ['new.ts', 'shared.ts', 'old.ts'] },
    'F-02': { count: 1, files: ['shared.ts'] },
  });
});

test('only done features outside the commit’s own features are flagged for shared paths', () => {
  const progress = (status: BuildProgress[string]['status']) => ({ title: '', status, note: '', updatedAt: '', doneAt: null });
  assert.deepEqual(touchedDoneFeatures({
    'F-01': progress('done'),
    'F-02': progress('done'),
    'F-03': progress('in_progress'),
    'F-04': progress('done'),
    'F-05': progress('needs_recheck'),
  }, {
    'F-01': ['shared.ts', 'other.ts'],
    'F-02': ['shared.ts'],
    'F-03': ['shared.ts'],
    'F-04': ['other.ts'],
    'F-05': ['shared.ts'],
    'F-06': ['shared.ts'],
  }, ['shared.ts'], new Set(['F-02'])), [{ id: 'F-01', files: ['shared.ts'] }]);
});

test('the recheck write supplies the owner, feature, recorded commit and history note to the guarded RPC', async () => {
  const service = { rpc: async (name: string, args: unknown) => {
    assert.equal(name, 'flag_build_progress_for_commit');
    assert.deepEqual(args, { p_user_id: 'user', p_slug: 'memory', p_feature_id: 'F-02', p_sha: 'abc1234', p_note: 'Commit abc1234 touched src/notes.ts.' });
    return { data: true, error: null };
  } } as unknown as SupabaseClient;
  assert.equal(await flagBuildProgressForCommit(service, 'user', 'memory', 'F-02', 'abc1234', 'Commit abc1234 touched src/notes.ts.'), true);
});

test('the PRD list and checklist count exclude dismissed and linked commits', async () => {
  const rows = [row(3, '', ['active.ts']), row(2, '', ['dismissed.ts'], 'now'), row(1, 'F-01', ['linked.ts'])];
  assert.deepEqual(unlinkedFeatureCommits(rows), [rows[0]]);

  const client = createClient('https://example.test', 'test', { global: { fetch: async (url, init) => {
    const query = new URL(String(url));
    assert.equal(query.pathname, '/rest/v1/feature_commits');
    assert.equal(init?.method, 'HEAD');
    assert.equal(new Headers(init?.headers).get('prefer'), 'count=exact');
    assert.equal(query.searchParams.get('user_id'), 'eq.user');
    assert.equal(query.searchParams.get('slug'), 'eq.memory');
    assert.equal(query.searchParams.get('feature_id'), 'eq.');
    assert.equal(query.searchParams.get('dismissed_at'), 'is.null');
    return new Response(null, { headers: { 'content-range': '0-0/1' } });
  } } });
  assert.equal(await countUnlinkedCommits(client, 'user', 'memory'), 1);
});

test('commits without a feature are recorded with an empty id and retries ignore duplicates', async () => {
  const service = {
    from: (table: string) => {
      assert.equal(table, 'feature_commits');
      return {
        upsert: async (rows: unknown, options: unknown) => {
          assert.deepEqual(rows, [{ user_id: 'user', slug: 'memory', feature_id: '', sha: 'abc1234', message: 'Maintenance', files: [] }]);
          assert.deepEqual(options, { onConflict: 'user_id,slug,sha,feature_id', ignoreDuplicates: true });
          return { error: null };
        },
      };
    },
  } as unknown as SupabaseClient;
  await writeFeatureCommit(service, 'user', 'memory', { sha: 'abc1234', message: 'Maintenance', files: [], featureIds: [] });
});

test('writeFeatureCommit and readFeatureCommits persist and normalize per-file statuses', async () => {
  let inserted: unknown = null;
  const service = {
    from: () => ({
      upsert: async (rows: unknown) => {
        inserted = rows;
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient;
  await writeFeatureCommit(service, 'user', 'memory', {
    sha: 'def5678',
    message: 'F-01 add page',
    files: ['app/billing/page.tsx', 'lib/a.ts'],
    featureIds: ['F-01'],
    fileStatuses: { 'app/billing/page.tsx': 'added', 'lib/a.ts': 'modified' },
  });
  assert.deepEqual(inserted, [{
    user_id: 'user',
    slug: 'memory',
    feature_id: 'F-01',
    sha: 'def5678',
    message: 'F-01 add page',
    files: ['app/billing/page.tsx', 'lib/a.ts'],
    file_statuses: { 'app/billing/page.tsx': 'added', 'lib/a.ts': 'modified' },
  }]);

  const client = createClient('https://example.test', 'test', {
    global: {
      fetch: async () => Response.json([
        { id: '1', feature_id: 'F-01', sha: 'def5678', message: 'F-01 add page', files: ['app/billing/page.tsx'], file_statuses: { 'app/billing/page.tsx': 'added', bad: 'renamed' }, created_at: '2026-11-20T01:00:00Z', dismissed_at: null },
        { id: '2', feature_id: 'F-01', sha: 'old1234', message: 'legacy', files: ['lib/a.ts'], created_at: '2026-11-19T01:00:00Z', dismissed_at: null },
      ]),
    },
  });
  const loaded = await readFeatureCommits(client, 'user', 'memory');
  assert.deepEqual(loaded[0].file_statuses, { 'app/billing/page.tsx': 'added' });
  assert.deepEqual(loaded[1].file_statuses, {});
});
