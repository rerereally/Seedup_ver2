import assert from 'node:assert/strict';
import test from 'node:test';
import { searchFilter, tagFilter } from '../lib/data';

// PostgREST drops the quotes around a value and one backslash per escaped character.
function postgrestValue(filter: string) {
  const quoted = filter.slice(filter.indexOf('.ilike.') + '.ilike.'.length);
  assert.ok(quoted.startsWith('"') && quoted.endsWith('"'), `not quoted: ${quoted}`);
  return quoted.slice(1, -1).replace(/\\(.)/g, '$1');
}

test('a plain query becomes a contains pattern on each column', () => {
  assert.equal(searchFilter(['title'], 'mcp'), 'title.ilike."%mcp%"');
  assert.equal(searchFilter(['title', 'summary'], 'mcp'), 'title.ilike."%mcp%",summary.ilike."%mcp%"');
});

test('LIKE wildcards, backslashes, quotes, commas and parentheses reach the database literally', () => {
  const pattern = postgrestValue(searchFilter(['title'], 'a,b(c)%_\\"'));
  assert.equal(pattern, String.raw`%a,b(c)\%\_\\"%`);
});

test('a tag query becomes an exact array-contains filter on each tag column', () => {
  assert.equal(tagFilter(['topics'], 'react'), 'topics.cs.{"react"}');
  assert.equal(tagFilter(['topic_tags', 'skill_tags'], 'react'), 'topic_tags.cs.{"react"},skill_tags.cs.{"react"}');
});

test('tag queries are trimmed and lower-cased', () => {
  assert.equal(tagFilter(['topic_tags'], '  React Native '), 'topic_tags.cs.{"react native"}');
});

test('a query longer than 40 characters gets no tag filter', () => {
  assert.equal(tagFilter(['topics'], 'a'.repeat(40)), `topics.cs.{"${'a'.repeat(40)}"}`);
  assert.equal(tagFilter(['topics'], 'a'.repeat(41)), '');
});

test('a query with a comma or parenthesis gets no tag filter', () => {
  assert.equal(tagFilter(['topics'], 'a,b'), '');
  assert.equal(tagFilter(['topics'], 'a(b)'), '');
});
