import assert from 'node:assert/strict';
import test from 'node:test';
import { selectCompareOpportunities, similarCompareSlugs } from '../lib/opportunities/compare';
import type { Opportunity } from '../lib/opportunities/types';

function opportunity(slug: string, keywords: string[] = [], qualified = true): Opportunity {
  return {
    slug, keywords, qualified, name: slug, problem: '', gap: '', status: 'unknown',
    platforms: [], evidence: [], supply: [], directCount: 0, firstSeenAt: null, followersAfterSignal: 0,
  };
}

const a = opportunity('a');
const b = opportunity('b', [], false);
const c = opportunity('c');
const d = opportunity('d');

test('compare selection keeps requested order, including unverified candidates, and reports unknown slugs', () => {
  assert.deepEqual(selectCompareOpportunities([' b,missing,a', 'b,,c '], [a, b, c]), {
    candidates: [b, a, c], hasUnknownSlugs: true, hasExtraSlugs: false,
  });
});

test('compare selection ignores duplicates and keeps the first three known candidates', () => {
  assert.deepEqual(selectCompareOpportunities('d,b,a,d,c,missing', [a, b, c, d]), {
    candidates: [d, b, a], hasUnknownSlugs: true, hasExtraSlugs: true,
  });
});

test('missing queries and too few known candidates do not add defaults', () => {
  assert.deepEqual(selectCompareOpportunities(undefined, [a, b]), {
    candidates: [], hasUnknownSlugs: false, hasExtraSlugs: false,
  });
  assert.deepEqual(selectCompareOpportunities('a,a,missing', [a, b]), {
    candidates: [a], hasUnknownSlugs: true, hasExtraSlugs: false,
  });
});

test('similar candidates rank by distinct shared keywords and retain source order on ties', () => {
  const anchor = opportunity('anchor', ['Agent', ' agent ', 'sql'], false);
  const items = [
    anchor,
    opportunity('tie-first', [' AGENT ', 'agent']),
    opportunity('unverified', ['agent', 'sql'], false),
    opportunity('closest', ['agent', 'SQL']),
    opportunity('tie-last', ['sql']),
    opportunity('unrelated', ['other']),
  ];
  assert.deepEqual(similarCompareSlugs(anchor, items), ['anchor', 'closest', 'tie-first']);
});

test('similar candidates only fill available slots with qualified keyword matches', () => {
  const anchor = opportunity('anchor', ['sql']);
  const match = opportunity('match', ['sql']);
  assert.deepEqual(similarCompareSlugs(anchor, [anchor, a, match]), ['anchor', 'match']);
  assert.deepEqual(similarCompareSlugs(anchor, [anchor, a, c]), ['anchor']);
});
