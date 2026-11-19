import assert from 'node:assert/strict';
import test from 'node:test';
import { EMBEDDING_DIMENSIONS, fitEmbedding } from '../lib/llm';

test('fitEmbedding cuts a longer vector to the column size and keeps it at length 1', () => {
  const vector = fitEmbedding(Array.from({ length: 2048 }, (_, index) => (index % 7) - 3));
  assert.equal(vector.length, EMBEDDING_DIMENSIONS);
  assert.ok(Math.abs(Math.hypot(...vector) - 1) < 1e-9);
});

test('fitEmbedding rejects vectors too short or empty instead of storing a wrong size', () => {
  assert.deepEqual(fitEmbedding(Array(1024).fill(1)), []);
  assert.deepEqual(fitEmbedding(Array(EMBEDDING_DIMENSIONS).fill(0)), []);
  assert.deepEqual(fitEmbedding(undefined), []);
});
