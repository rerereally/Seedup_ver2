import assert from 'node:assert/strict';
import test from 'node:test';
import type { SupabaseClient } from '@supabase/supabase-js';
import { summarizeFeatureCommits, writeFeatureCommit } from '../lib/opportunities/feature-commits';

test('commit summaries count links and keep distinct files in newest-first order', () => {
  const row = (n: number, feature_id: string, files: string[]) => ({
    id: String(n), sha: String(n), feature_id, message: '', files, created_at: String(n),
  });
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
