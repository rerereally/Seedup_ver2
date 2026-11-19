import assert from 'node:assert/strict';
import test from 'node:test';
import { dailyResearch } from '../lib/opportunities/research';
import type { Opportunity, OpportunityPoint } from '../lib/opportunities/types';

const NOW = Date.parse('2026-11-19T12:00:00Z');
const CUTOFF = '2026-11-18T12:00:00Z';
const RECENT = '2026-11-19T06:00:00Z';

function point(at: string, fields: Partial<Omit<OpportunityPoint, 'at'>> = {}): OpportunityPoint {
  return { at, evidence: 2, platforms: 2, direct: 0, status: 'open', qualified: false, ...fields };
}

function problem(slug: string, history?: OpportunityPoint[], fields: Partial<Opportunity> = {}): Opportunity {
  return {
    slug, name: slug, history, problem: '', gap: '', keywords: [], status: 'open', qualified: false,
    platforms: [], evidence: [], supply: [], directCount: 0, firstSeenAt: '2026-10-01T00:00:00Z', followersAfterSignal: 0,
    ...fields,
  };
}

test('counts new problems, ranks quote growth, and finds both kinds of gap closure', () => {
  const research = dailyResearch([
    problem('new', [point(RECENT, { evidence: 3, qualified: true })]),
    problem('smaller', [point(CUTOFF, { qualified: true, evidence: 4 }), point(RECENT, { qualified: true, evidence: 5, direct: 2 })]),
    problem('larger', [point('2026-11-16T06:00:00Z'), point(RECENT, { evidence: 6, qualified: true, status: 'narrowing' })]),
    problem('decline', [point(CUTOFF, { evidence: 4, qualified: true, direct: 1 }), point(RECENT)]),
  ], NOW);

  assert.equal(research.windowDays, 1);
  assert.equal(research.changeCount, 6);
  assert.deepEqual(research.newProblems.map(({ slug, evidence }) => [slug, evidence]), [['new', 3]]);
  assert.deepEqual(research.demandRising.map(({ slug, growth }) => [slug, growth]), [['larger', 4], ['smaller', 1]]);
  assert.deepEqual(research.newlyQualified.map(({ slug, evidence, platforms }) => [slug, evidence, platforms]), [['larger', 6, 2]]);
  assert.deepEqual(research.gapClosing.map(({ slug, narrowed, directGrowth }) => [slug, narrowed, directGrowth]), [['smaller', false, 2], ['larger', true, 0]]);
});

test('adds each problem’s growth once per keyword or audience and ignores future points', () => {
  const research = dailyResearch([
    problem('first', [point(CUTOFF), point(RECENT, { evidence: 4, qualified: true }), point('2026-11-20T06:00:00Z', { evidence: 12 })], {
      keywords: [' DB ', 'db', '개발자', ' '], audience: '개발자', audienceEn: 'Developers',
    }),
    problem('second', [point(CUTOFF), point(RECENT, { evidence: 5 })], { keywords: ['db', 'SQL'], audience: '개발자' }),
  ], NOW);

  assert.equal(research.windowDays, 1);
  assert.deepEqual(research.fieldTrend.map(({ label, growth }) => [label, growth]), [['개발자', 5], ['DB', 5], ['SQL', 3]]);
  assert.equal(research.fieldTrend[0].labelEn, 'Developers');
});

test('widens with two daily signals and compares against the week’s baseline', () => {
  const research = dailyResearch([
    problem('growing', [
      point('2026-11-12T12:00:00Z'),
      point('2026-11-15T06:00:00Z', { evidence: 4, qualified: true }),
      point(RECENT, { evidence: 5, qualified: true }),
    ], { keywords: ['db'] }),
    problem('today', [point(RECENT)]),
    problem('earlier', [point('2026-11-15T06:00:00Z')]),
    problem('old', [point('2026-11-12T12:00:00Z')]),
  ], NOW);

  assert.equal(research.windowDays, 7);
  assert.deepEqual(research.newProblems.map(({ slug }) => slug), ['today', 'earlier']);
  assert.deepEqual(research.newlyQualified.map(({ slug }) => slug), ['growing']);
  assert.deepEqual(research.demandRising.map(({ growth }) => growth), [3]);
  assert.deepEqual(research.fieldTrend.map(({ growth }) => growth), [3]);
});

test('reports no signals for missing, empty, stale, or future history', () => {
  const research = dailyResearch([
    problem('missing', undefined, { firstSeenAt: RECENT, qualified: true, directCount: 4 }),
    problem('empty', []),
    problem('stale', [point('2026-11-10T06:00:00Z')]),
    problem('future', [point('2026-11-20T06:00:00Z')]),
  ], NOW);

  assert.deepEqual(research, {
    windowDays: 7, changeCount: 0, newProblems: [], demandRising: [], newlyQualified: [], gapClosing: [], fieldTrend: [],
  });
});
