import assert from 'node:assert/strict';
import test from 'node:test';
import { cached } from '../lib/cache';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

test('a fresh value is loaded once and shared', async () => {
  let loads = 0;
  const load = async () => (loads += 1);
  assert.equal(await cached('t-fresh', load, 1_000), 1);
  assert.equal(await cached('t-fresh', load, 1_000), 1);
  assert.equal(loads, 1);
});

test('a stale value is served while a new one loads', async () => {
  let loads = 0;
  const load = async () => (loads += 1);
  await cached('t-stale', load, 5);
  await wait(15);
  assert.equal(await cached('t-stale', load, 5), 1);
  await wait(5);
  assert.equal(await cached('t-stale', load, 1_000), 2);
});

test('a failed refresh keeps the previous value, and a failed first load is not kept', async () => {
  let fail = false;
  const load = async () => {
    if (fail) throw new Error('down');
    return 'ok';
  };
  await cached('t-fail', load, 5);
  fail = true;
  await wait(15);
  assert.equal(await cached('t-fail', load, 5), 'ok');
  await wait(5);
  assert.equal(await cached('t-fail', load, 5), 'ok');
  await assert.rejects(cached('t-first', load, 5));
  fail = false;
  assert.equal(await cached('t-first', load, 5), 'ok');
});
