import assert from 'node:assert/strict';
import test from 'node:test';
import { pickStackSites, stackSitesPrompt } from '../lib/opportunities/stack-sites';

test('pickStackSites keeps allowed names, trimmed and lowercased', () => {
  assert.deepEqual(pickStackSites([' Money ', 'cooking']), ['money', 'cooking']);
});

test('pickStackSites drops unknown names and duplicates', () => {
  assert.deepEqual(pickStackSites(['stackoverflow', 'money', 'money', 'nope', 'travel']), ['money', 'travel']);
});

test('pickStackSites respects max', () => {
  assert.deepEqual(pickStackSites(['money', 'cooking', 'travel'], 2), ['money', 'cooking']);
  assert.deepEqual(pickStackSites(['money', 'cooking', 'travel']), ['money', 'cooking']);
  assert.deepEqual(pickStackSites(['money', 'cooking'], 0), []);
});

test('pickStackSites returns [] for non-arrays and arrays of non-strings', () => {
  assert.deepEqual(pickStackSites('money'), []);
  assert.deepEqual(pickStackSites(undefined), []);
  assert.deepEqual(pickStackSites({ 0: 'money' }), []);
  assert.deepEqual(pickStackSites([1, null, { name: 'money' }]), []);
});

test('stackSitesPrompt lists each site as name (description)', () => {
  const prompt = stackSitesPrompt();
  assert.ok(prompt.includes('money ('));
  assert.ok(prompt.includes('; '));
});
