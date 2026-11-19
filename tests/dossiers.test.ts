import assert from 'node:assert/strict';
import test from 'node:test';
import { builtExampleCounts } from '../lib/db/dossiers';

test('loads the public maker counts for all visible opportunities in one request', async (t) => {
  const env = {
    NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.invalid',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-public-key',
    SUPABASE_SECRET_KEY: 'test-secret-key',
  };
  for (const [name, value] of Object.entries(env)) {
    const previous = process.env[name];
    process.env[name] = value;
    t.after(() => {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    });
  }
  const fetch = t.mock.method(globalThis, 'fetch', async (url: string, request: RequestInit) => {
    assert.equal(url, 'https://supabase.invalid/rest/v1/rpc/built_example_counts');
    assert.equal(request.method, 'POST');
    assert.deepEqual(JSON.parse(String(request.body)), { p_slugs: ['deploy', 'monitor', 'no-public-builds'] });
    return Response.json([{ opportunity_slug: 'monitor', maker_count: 1 }, { opportunity_slug: 'deploy', maker_count: 2 }]);
  });

  const counts = await builtExampleCounts(['deploy', 'monitor', 'no-public-builds']);
  assert.equal(counts.get('deploy'), 2);
  assert.equal(counts.get('monitor'), 1);
  assert.equal(counts.has('no-public-builds'), false);
  assert.equal((await builtExampleCounts([])).size, 0);
  assert.equal(fetch.mock.callCount(), 1);
});
