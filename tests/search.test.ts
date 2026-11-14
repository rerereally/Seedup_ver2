import assert from 'node:assert/strict';
import test from 'node:test';
import { searchFilter } from '../lib/data';

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
