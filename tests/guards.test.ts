import assert from 'node:assert/strict';
import test from 'node:test';
import { enforceFreeOnlyModels, isFreeOpenRouterModel } from '../lib/ingest/openrouter-models';

test('recognizes free model ids', () => {
  assert.equal(isFreeOpenRouterModel('nvidia/nemotron-3.5-super-vl:free'), true);
  assert.equal(isFreeOpenRouterModel('openrouter/free'), true);
  assert.equal(isFreeOpenRouterModel('anthropic/claude-sonnet-5'), false);
});

test('free-only mode removes paid models and refuses an all-paid list', () => {
  const previous = process.env.OPENROUTER_FREE_ONLY;
  process.env.OPENROUTER_FREE_ONLY = 'true';
  try {
    assert.deepEqual(enforceFreeOnlyModels(['a/b', 'c/d:free']), ['c/d:free']);
    assert.throws(() => enforceFreeOnlyModels(['a/b']));
  } finally {
    if (previous === undefined) delete process.env.OPENROUTER_FREE_ONLY;
    else process.env.OPENROUTER_FREE_ONLY = previous;
  }
});

test('paid models pass through when free-only mode is off', () => {
  const previous = process.env.OPENROUTER_FREE_ONLY;
  delete process.env.OPENROUTER_FREE_ONLY;
  try {
    assert.deepEqual(enforceFreeOnlyModels(['a/b']), ['a/b']);
  } finally {
    if (previous !== undefined) process.env.OPENROUTER_FREE_ONLY = previous;
  }
});
