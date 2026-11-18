import assert from 'node:assert/strict';
import test from 'node:test';
import { rateLimited } from '../lib/throttle';

test('rateLimited lets the first requests through and stops the rest within a minute', () => {
  const key = `test:${Math.random()}`;
  assert.equal(rateLimited(key, 2), false);
  assert.equal(rateLimited(key, 2), false);
  assert.equal(rateLimited(key, 2), true);
  // Another key has its own count.
  assert.equal(rateLimited(`${key}:other`, 2), false);
});
