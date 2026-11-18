import assert from 'node:assert/strict';
import test from 'node:test';
import { inBatches } from '../lib/utils';

test('inBatches runs every item once, never more than the limit at a time, in start order', async () => {
  const started: number[] = [];
  let running = 0;
  let peak = 0;
  await inBatches([1, 2, 3, 4, 5, 6, 7], 3, async (item) => {
    started.push(item);
    running += 1;
    peak = Math.max(peak, running);
    await new Promise((resolve) => setTimeout(resolve, 5 + (item % 3)));
    running -= 1;
  });
  assert.deepEqual(started, [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(peak, 3);
});

test('inBatches with no items finishes without calling run', async () => {
  let calls = 0;
  await inBatches([], 3, async () => { calls += 1; });
  assert.equal(calls, 0);
});

import { newPageSlug, normalizeEmail, pageCopy, signupsCsv } from '../lib/idea-pages';

test('idea page helpers: slug shape, email check, default headline, safe CSV', () => {
  assert.match(newPageSlug(), /^[a-z0-9]{10}$/);
  assert.notEqual(newPageSlug(), newPageSlug());
  assert.equal(normalizeEmail(' Me@Example.COM '), 'me@example.com');
  for (const bad of ['', 'no-at', 'a@b', 'a b@c.de', `${'x'.repeat(200)}@a.co`]) assert.equal(normalizeEmail(bad), null, bad);
  assert.equal(pageCopy('API 키 유출을 바로 알려 주는 도구', '', '').headline, 'API 키 유출을 바로 알려 주는 도구');
  assert.equal(pageCopy('idea', '키 유출 알림', 'pitch').headline, '키 유출 알림');
  assert.equal(signupsCsv([{ email: '=cmd@x.io', created_at: '2026-11-18' }]), 'email,signed_up_at\n"\'=cmd@x.io","2026-11-18"');
});
