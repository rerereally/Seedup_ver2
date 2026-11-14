import assert from 'node:assert/strict';
import test from 'node:test';
import { selectInChunks } from '../lib/supabase/chunks';

// Stands in for a Supabase .in() call: records the id list it was asked for and returns matching rows.
function fakeInQuery(rows: Array<{ user_id: string }>, calls: string[][]) {
  return async (chunk: string[]) => {
    calls.push(chunk);
    return { data: rows.filter((row) => chunk.includes(row.user_id)), error: null };
  };
}

test('selectInChunks splits 320 ids into 3 calls and returns every matching row', async () => {
  const ids = Array.from({ length: 320 }, (_, index) => `user-${index}`);
  const rows = ids.flatMap((id) => [{ user_id: id }, { user_id: id }]);
  const calls: string[][] = [];
  const result = await selectInChunks(ids, fakeInQuery(rows, calls));
  assert.deepEqual(calls.map((chunk) => chunk.length), [150, 150, 20]);
  assert.equal(new Set(calls.flat()).size, 320);
  assert.equal(result.length, 640);
});

test('selectInChunks skips a failing chunk and keeps the rows from the others', async () => {
  const ids = Array.from({ length: 300 }, (_, index) => `user-${index}`);
  const originalError = console.error;
  console.error = () => {};
  try {
    let call = 0;
    const result = await selectInChunks(ids, async (chunk) => {
      call += 1;
      if (call === 2) return { data: null, error: { message: 'boom' } };
      return { data: chunk.map((user_id) => ({ user_id })), error: null };
    });
    assert.equal(result.length, 150);
  } finally {
    console.error = originalError;
  }
});

test('selectInChunks makes no calls for an empty id list', async () => {
  const calls: string[][] = [];
  assert.deepEqual(await selectInChunks([], fakeInQuery([], calls)), []);
  assert.equal(calls.length, 0);
});
