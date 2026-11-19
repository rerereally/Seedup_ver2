import assert from 'node:assert/strict';
import test from 'node:test';
import { parseInsightPath } from '../lib/newsletter/insight-path';

test('insight opens the new-product path by default', () => {
  assert.equal(parseInsightPath(undefined), 'new');
  assert.equal(parseInsightPath('new'), 'new');
  assert.equal(parseInsightPath('project'), 'project');
});

test('insight falls back to new for invalid and repeated paths', () => {
  for (const value of ['', 'unknown', 'Project', ['project', 'new'], ['project', 'project']]) {
    assert.equal(parseInsightPath(value), 'new');
  }
});
