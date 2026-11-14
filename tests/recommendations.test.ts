import assert from 'node:assert/strict';
import test from 'node:test';
import { fuzzyOverlap } from '../lib/recommendations';

test('a short English token does not match inside a longer word', () => {
  assert.equal(fuzzyOverlap(['ai'], ['domain']), 0);
  assert.equal(fuzzyOverlap(['ui'], ['guide']), 0);
  assert.equal(fuzzyOverlap(['ui'], ['build']), 0);
});

test('a short English token matches as a whole word', () => {
  assert.equal(fuzzyOverlap(['ai'], ['ai agents']), 1);
  assert.equal(fuzzyOverlap(['ai agents'], ['ai']), 1);
});

test('longer English values keep substring matching', () => {
  assert.equal(fuzzyOverlap(['react'], ['react native']), 1);
});

test('Korean values keep substring matching', () => {
  assert.equal(fuzzyOverlap(['프론트엔드'], ['프론트엔드 개발']), 1);
});
