import assert from 'node:assert/strict';
import test from 'node:test';
import { rateLimited } from '../lib/throttle';

test('without a Cloudflare binding, rateLimited counts in memory: the first requests pass, the rest stop', async () => {
  const key = `test:${Math.random()}`;
  assert.equal(await rateLimited(key, 2), false);
  assert.equal(await rateLimited(key, 2), false);
  assert.equal(await rateLimited(key, 2), true);
  // Another key has its own count.
  assert.equal(await rateLimited(`${key}:other`, 2), false);
});

test("with a binding, either count can stop a request, and a binding that fails falls back to memory", async () => {
  const asked: string[] = [];
  const allow = { limit: async ({ key }: { key: string }) => (asked.push(key), { success: true }) };
  const deny = { limit: async () => ({ success: false }) };
  assert.equal(await rateLimited('bound:a', 2, allow), false);
  assert.equal(await rateLimited('bound:a', 2, allow), false);
  assert.deepEqual(asked, ['bound:a', 'bound:a']);
  // The binding is approximate, so this instance's exact count still stops a burst it let through.
  assert.equal(await rateLimited('bound:a', 2, allow), true);
  assert.equal(await rateLimited('bound:b', 99, deny), true);
  const broken = { limit: async () => { throw new Error('down'); } };
  assert.equal(await rateLimited('bound:c', 1, broken), false);
  assert.equal(await rateLimited('bound:c', 1, broken), true);
});
