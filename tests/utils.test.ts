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
