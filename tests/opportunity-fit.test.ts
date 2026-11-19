import assert from 'node:assert/strict';
import test from 'node:test';
import { fitParams, normalizeFitStack, parseFitChoice, rankOpportunities, scoreOpportunityFit } from '../lib/opportunities/fit';
import type { BuildEstimate, Evidence } from '../lib/opportunities/types';
import { savedRepoLanguages } from '../lib/seeds/saved';

const build = (stack: string[], days = 2, size: BuildEstimate['size'] = 'weekend'): BuildEstimate => ({ stack, days, size, hard: [] });
const weekend = parseFitChoice({ fit: '1', stack: 'next,supabase', time: 'weekend' });

test('stack overlap matches aliases and counts each technology once', () => {
  assert.deepEqual(scoreOpportunityFit({ build: build(['Next.js', 'NEXTJS', 'Supabase', 'Stripe']) }, weekend), { overlap: 2, timeFit: 'fits' });
  assert.equal(scoreOpportunityFit({ build: build(['React Native', 'C++']) }, parseFitChoice({ stack: 'React,C' })).overlap, 0);
});

test('time fit respects days and build size', () => {
  assert.equal(scoreOpportunityFit({ build: build([], 3) }, weekend).timeFit, 'longer');
  assert.equal(scoreOpportunityFit({ build: build([], 2) }, { ...weekend, time: 'day' }).timeFit, 'longer');
  assert.equal(scoreOpportunityFit({ build: build([], 2, 'weeks') }, weekend).timeFit, 'longer');
  assert.equal(scoreOpportunityFit({ build: build([], 7, 'weeks') }, { ...weekend, time: 'week' }).timeFit, 'fits');
  assert.equal(scoreOpportunityFit({ build: build([], 31, 'team') }, { ...weekend, time: 'longer' }).timeFit, 'team');
  assert.equal(scoreOpportunityFit({}, weekend).timeFit, 'unknown');
});

test('ranks by time, overlap, verification and quote count without dropping rows', () => {
  const item = (slug: string, estimate: BuildEstimate | undefined, qualified: boolean, quotes: number) => ({
    slug, build: estimate, qualified, evidence: Array<Evidence>(quotes).fill({ id: slug, platform: 'hn', quote: '', quoteKo: '', url: '', score: 0, postedAt: null }),
  });
  const input = [
    item('strongest-but-long', build(['Next.js', 'Supabase'], 4, 'weeks'), true, 10),
    item('tie-fewer-quotes', build(['Next.js']), true, 3),
    item('missing-estimate', undefined, false, 1),
    item('more-overlap', build(['Next.js', 'Supabase']), true, 6),
    item('tie-more-quotes', build(['Next.js']), true, 5),
    item('unverified', build(['Next.js']), false, 8),
    item('no-overlap', build(['Python']), true, 4),
  ];
  const order = (choice: typeof weekend) => rankOpportunities(input, choice).map(({ item }) => item.slug);
  assert.deepEqual(order(weekend), ['more-overlap', 'tie-more-quotes', 'tie-fewer-quotes', 'unverified', 'no-overlap', 'strongest-but-long', 'missing-estimate']);
  assert.deepEqual(order({ ...weekend, stack: [] }), ['strongest-but-long', 'more-overlap', 'tie-more-quotes', 'no-overlap', 'tie-fewer-quotes', 'unverified', 'missing-estimate']);
  assert.deepEqual(order({ ...weekend, stack: [] }), order({ ...weekend, enabled: false }));
  assert.equal(input[0].slug, 'strongest-but-long');
});

test('reads and writes the shareable choice, including an explicitly cleared stack', () => {
  const url = new URLSearchParams('fit=1&stack=Next.js%2C+next%2C+C%2B%2B&time=week');
  const parsed = parseFitChoice(Object.fromEntries(url));
  assert.deepEqual(parsed, { enabled: true, stack: ['Next.js', 'C++'], time: 'week' });
  assert.deepEqual(parseFitChoice(Object.fromEntries(fitParams(parsed))), parsed);
  assert.deepEqual(parseFitChoice({ fit: ['0', '1'], time: 'invalid' }, ['아직 모르겠음', 'Python']), { enabled: false, stack: ['Python'], time: 'weekend' });
  assert.deepEqual(parseFitChoice({ fit: '1', stack: '' }, ['Next.js']).stack, []);
  assert.deepEqual(parseFitChoice({ stack: ['Rust', 'Go'] }).stack, ['Rust']);
});

test('reads stored repository languages as editable stack values', () => {
  const raw = JSON.stringify({ login: 'example', repos: [{ language: 'TypeScript', topics: ['web'] }, { language: 'Rust' }, { language: 'typescript' }, { language: '' }, null] });
  assert.deepEqual(normalizeFitStack(savedRepoLanguages(raw)), ['TypeScript', 'Rust']);
  assert.deepEqual(savedRepoLanguages(null), []);
});
