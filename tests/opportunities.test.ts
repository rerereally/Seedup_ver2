import assert from 'node:assert/strict';
import test from 'node:test';
import { matchOpportunities, quoteMentions, rankBySimilarity } from '../lib/opportunities/match';
import { mermaidFlow, normalizeSlots, normalizeSpec, renderAgentBrief, renderSpecMarkdown, traceOf } from '../lib/opportunities/spec';
import { specInputFor } from '../lib/opportunities/context';
import { classifySupply, cosineSimilarity, countFollowers, isVerbatimQuote, meetsEvidenceBar, toSlug } from '../lib/opportunities/rules';
import type { Evidence, SupplyItem } from '../lib/opportunities/types';

const supply = (relation: SupplyItem['relation'], popularity = 0, createdAt: string | null = null): SupplyItem => ({ kind: 'github', name: 'x', description: '', popularity, url: 'u', createdAt, relation });
const evidence = (n: number): Evidence => ({ id: `ev${n}`, platform: 'hn', quote: `quote ${n}`, quoteKo: '', url: `https://example.com/${n}`, score: 0, postedAt: null });

test('accepts a quote only when it appears in the source', () => {
  const source = 'We ended up building our own “deploy” tool because nothing fit.';
  assert.equal(isVerbatimQuote('ended up building our own deploy tool', source), true);
  assert.equal(isVerbatimQuote('we wrote a custom deployment product', source), false);
  assert.equal(isVerbatimQuote('short', source), false);
});

test('evidence bar needs both volume and platform diversity', () => {
  assert.equal(meetsEvidenceBar(3, 2), true);
  assert.equal(meetsEvidenceBar(9, 1), false);
  assert.equal(meetsEvidenceBar(2, 2), false);
});

test('classifies how crowded a market is', () => {
  assert.equal(classifySupply([], false), 'unknown');
  assert.equal(classifySupply([supply('partial')], true), 'open');
  assert.equal(classifySupply([supply('direct', 2_500)], true), 'narrowing');
  assert.equal(classifySupply([supply('direct', 48_000)], true), 'closed');
  assert.equal(classifySupply(Array.from({ length: 8 }, () => supply('direct')), true), 'closed');
});

test('counts only related tools that appeared after the first complaint', () => {
  const items = [supply('direct', 0, '2026-06-01'), supply('partial', 0, '2025-01-01'), supply('unrelated', 0, '2026-07-01'), supply('direct')];
  assert.equal(countFollowers(items, '2026-01-01'), 1);
  assert.equal(countFollowers(items, null), 0);
});

test('slug falls back when the model gives nothing usable', () => {
  assert.equal(toSlug('Agent Memory!', 'x'), 'agent-memory');
  assert.equal(toSlug('한글만', 'fallback'), 'fallback');
});

test('cosine similarity rejects mismatched vectors', () => {
  assert.equal(cosineSimilarity([1, 0], [1, 0]), 1);
  assert.equal(cosineSimilarity([1, 0], [1]), 0);
});

const items = [
  { slug: 'rules', name: '코딩 에이전트 규칙 강제', keywords: ['규칙', 'rule', '가이드'] },
  { slug: 'ci', name: '홈랩용 로컬 CI', keywords: ['ci', '빌드', 'deploy'] },
];

test('matches Korean words that carry particles', () => {
  assert.deepEqual(matchOpportunities('규칙을 지키게 하는 것', items).slugs, ['rules']);
});

test('short Latin keywords need an exact word', () => {
  assert.deepEqual(matchOpportunities('ci', items).slugs, ['ci']);
  assert.deepEqual(matchOpportunities('social', items).slugs, []);
});

test('generic words do not select a candidate alone', () => {
  assert.deepEqual(matchOpportunities('도구', items).slugs, []);
  assert.equal(quoteMentions(['agent'], 'an agent failed'), false);
  assert.equal(quoteMentions(['rollback'], 'we need rollback'), true);
});

test('unfinished Hangul composition is ignored', () => {
  assert.equal(matchOpportunities('ㄱㅠ', items).active, false);
});

test('semantic ranking keeps only strong, nearby matches', () => {
  const scores = [{ slug: 'a', score: 0.6 }, { slug: 'b', score: 0.57 }, { slug: 'c', score: 0.4 }];
  assert.deepEqual(rankBySimilarity(scores, 0.3, 0.06, 5), ['a', 'b']);
  assert.deepEqual(rankBySimilarity(scores, 0.7, 0.06, 5), []);
});

test('PRD requirements without valid citations become hypotheses', () => {
  const spec = normalizeSpec({
    summary: 's',
    requirements: [
      { title: 'cited', detail: 'd', evidence: [1, 1, 2] },
      { title: 'invented citation', detail: 'd', evidence: [99] },
      { title: 'no citation', detail: 'd', evidence: [] },
      { title: '', detail: 'dropped', evidence: [1] },
    ],
  }, 3);
  assert.deepEqual(spec.requirements.map((row) => [row.id, row.title]), [['R-01', 'cited']]);
  assert.deepEqual(spec.requirements[0].evidence, [1, 2]);
  assert.deepEqual(spec.hypotheses.map((row) => [row.id, row.title]), [['H-01', 'invented citation'], ['H-02', 'no citation']]);
});

test('features must serve a kept requirement and screens a kept feature, so nothing floats free of the evidence', () => {
  const spec = normalizeSpec({
    summary: 's',
    requirements: [{ title: 'real', detail: 'd', evidence: [1] }, { title: 'guess', detail: 'd', evidence: [] }],
    features: [
      { title: 'serves real', requirements: [1] },
      { title: 'serves only a hypothesis', requirements: [2] },
      { title: 'serves nothing', requirements: [7] },
    ],
    screens: [
      { name: 'home', features: [1] },
      { name: 'orphan', features: [2] },
      { name: 'no features' },
    ],
  }, 1);
  assert.deepEqual(spec.features.map((row) => [row.id, row.title, row.requirementIds]), [['F-01', 'serves real', ['R-01']]]);
  assert.deepEqual(spec.screens.map((row) => [row.id, row.name, row.featureIds]), [['S-01', 'home', ['F-01']]]);
});

test('tracing an item lights up its whole chain both ways', () => {
  const spec = normalizeSpec({
    summary: 's',
    requirements: [{ title: 'a', evidence: [1] }, { title: 'b', evidence: [2] }],
    features: [{ title: 'fa', requirements: [1] }, { title: 'fb', requirements: [2] }],
    screens: [{ name: 'sa', features: [1] }, { name: 'sb', features: [2] }],
  }, 2);
  const fromScreen = traceOf(spec, 'S-01');
  assert.deepEqual([...fromScreen.ids].sort(), ['F-01', 'R-01', 'S-01']);
  assert.deepEqual([...fromScreen.evidence], [1]);
  const fromQuote = traceOf(spec, 'E-2');
  assert.ok(fromQuote.ids.has('R-02') && fromQuote.ids.has('F-02') && fromQuote.ids.has('S-02'));
  assert.ok(!fromQuote.ids.has('R-01'));
});

test('readiness slots keep only the six known keys and reject empty answers', () => {
  assert.equal(normalizeSlots(null), null);
  assert.equal(normalizeSlots({ inputs: [], rules: '' }), null);
  const slots = normalizeSlots({ inputs: ['a'], done: ['b', ''], extra: ['x'] });
  assert.deepEqual(slots, { inputs: ['a'], rules: [], errors: [], access: [], data: [], done: ['b'] });
});

test('exports keep source links, carry slots, and keep hypotheses out of the build list', () => {
  const input = { title: 'T', problem: 'P', gap: 'G', evidence: [evidence(1)], competitors: ['c'] };
  const spec = normalizeSpec({ summary: 's', requirements: [{ title: 'real', detail: 'd', evidence: [1] }, { title: 'guess', detail: 'd', evidence: [] }], features: [{ title: 'build it', requirements: [1] }], screens: [{ name: 'Home "page"', features: [1] }] }, 1);
  spec.features[0].slots = { inputs: ['email'], rules: [], errors: [], access: [], data: [], done: ['test passes'] };
  const markdown = renderSpecMarkdown(input, spec);
  assert.match(markdown, /근거: E-1/);
  assert.match(markdown, /https:\/\/example\.com\/1/);
  assert.match(markdown, /```mermaid/);
  for (const format of ['agents', 'claude', 'cursor'] as const) {
    const brief = renderAgentBrief(input, spec, format);
    assert.match(brief, /- \[ \] F-01\. build it/);
    assert.match(brief, /inputs: email/);
    assert.match(brief, /data: \(open question\)/);
    assert.doesNotMatch(brief, /- \[ \] .*guess/);
  }
  assert.doesNotMatch(mermaidFlow(spec), /"Home "page""/);
});

test('a draft spec is labeled as a hypothesis draft in every export', () => {
  const input = { title: 'T', problem: 'P', gap: '', evidence: [evidence(1)], competitors: [] };
  const spec = normalizeSpec({ summary: 's', requirements: [{ title: 'r', evidence: [1] }] }, 1, true);
  assert.match(renderSpecMarkdown(input, spec), /가설 초안/);
  assert.match(renderAgentBrief(input, spec), /HYPOTHESIS DRAFT/);
});

import { dossierChanges, koreaLens, scoreOpportunity, stackFit, trackRecord, whyNow } from '../lib/opportunities/insight';
import { describeChange } from '../lib/opportunities/merge';
import type { Opportunity } from '../lib/opportunities/types';

const NOW = new Date('2026-11-01T00:00:00Z').getTime();
const sample = (over: Partial<Opportunity> = {}): Opportunity => ({
  slug: 's', name: '스키마 정규화', problem: 'LLM 제공자마다 스키마가 다르다', gap: '', keywords: ['llm', '스키마', 'openai'], status: 'open', qualified: true,
  platforms: ['hn', 'github'],
  evidence: [
    { id: 'a', platform: 'hn', quote: 'no good way to normalize schemas across providers', quoteKo: '', url: 'u1', score: 40, postedAt: '2026-09-01T00:00:00Z' },
    { id: 'b', platform: 'github', quote: 'we had to write our own postgres adapter', quoteKo: '', url: 'u2', score: 10, postedAt: '2026-01-01T00:00:00Z' },
    { id: 'c', platform: 'hn', quote: 'tired of manually patching this', quoteKo: '', url: 'u3', score: 0, postedAt: null },
  ],
  supply: [
    { kind: 'github', name: 'late/tool', description: '', popularity: 50, url: 't1', createdAt: '2026-03-01T00:00:00Z', relation: 'direct' },
    { kind: 'github', name: 'early/tool', description: '', popularity: 50, url: 't2', createdAt: '2025-01-01T00:00:00Z', relation: 'partial' },
  ],
  directCount: 1, firstSeenAt: '2026-01-01T00:00:00Z', followersAfterSignal: 1, ...over,
});

test('score parts add up to the total and stay within their maximums', () => {
  const score = scoreOpportunity(sample(), NOW);
  assert.equal(score.total, score.parts.reduce((sum, part) => sum + part.points, 0));
  assert.ok(score.parts.every((part) => part.points >= 0 && part.points <= part.max));
  assert.equal(score.parts.reduce((sum, part) => sum + part.max, 0), 100);
  assert.ok(scoreOpportunity(sample({ status: 'closed' }), NOW).total < score.total);
  assert.equal(scoreOpportunity(sample({ evidence: [], platforms: [] }), NOW).parts.find((part) => part.key === 'recency')?.points, 0);
});

test('why-now puts voices and tools on one axis and counts what came after', () => {
  const timing = whyNow(sample(), NOW);
  assert.deepEqual(timing.events.map((event) => event.url), ['t2', 'u2', 't1', 'u1']);
  assert.equal(timing.recentVoices, 1);
  assert.equal(timing.toolsAfterFirstVoice, 1);
});

test('track record lists only tools made after the first complaint', () => {
  const rows = trackRecord([sample(), sample({ slug: 'none', supply: [] }), sample({ slug: 'undated', firstSeenAt: null })]);
  assert.equal(rows.length, 1);
  assert.deepEqual(rows[0].followers.map((tool) => tool.name), ['late/tool']);
  assert.equal(rows[0].followers[0].leadDays, 59);
});

test('stack fit matches profile choices against the opportunity text', () => {
  const fit = stackFit(sample(), ['LLM API', 'PostgreSQL', 'Spring', '아직 모르겠음']);
  assert.deepEqual(fit.matched, ['LLM API', 'PostgreSQL']);
  assert.equal(fit.chosen, 3);
  assert.equal(stackFit(sample(), []).level, 'none');
});

test('korea lens searches with one English and one Korean keyword', () => {
  const lens = koreaLens(sample());
  assert.equal(lens.query, 'llm 스키마');
  assert.ok(lens.places.every((place) => place.href.includes(encodeURIComponent('llm 스키마'))));
});

test('dossier changes report added and removed evidence and later status moves', () => {
  const history = [
    { at: '2026-10-01T00:00:00Z', evidence: 2, platforms: 2, direct: 0, status: 'open' as const, qualified: false },
    { at: '2026-10-20T00:00:00Z', evidence: 3, platforms: 2, direct: 3, status: 'narrowing' as const, qualified: true },
  ];
  const changes = dossierChanges(['a', 'gone'], '2026-10-05T00:00:00Z', sample({ history }), describeChange);
  assert.equal(changes.added.length, 2);
  assert.equal(changes.removed, 1);
  assert.equal(changes.notes.length, 3);
  assert.equal(dossierChanges(['a', 'b', 'c'], '2026-10-25T00:00:00Z', sample({ history }), describeChange).notes.length, 0);
});

test('a PRD built from quotes of several opportunities carries all of their context, led by the most-picked one', () => {
  const one = sample({ slug: 'one', name: 'One', problem: 'problem one', gap: 'gap one' });
  const two = sample({
    slug: 'two', name: 'Two', problem: 'problem two', gap: 'gap two',
    supply: [{ kind: 'npm', name: 'rival', description: '', popularity: 1, url: 'r', createdAt: null, relation: 'direct' }, { kind: 'github', name: 'late/tool', description: '', popularity: 1, url: 't1', createdAt: null, relation: 'direct' }],
  });
  const picked = [
    { evidence: two.evidence[0], slug: 'two' },
    { evidence: one.evidence[0], slug: 'one' },
    { evidence: two.evidence[1], slug: 'two' },
  ];
  const input = specInputFor([one, two], picked);
  assert.ok(input);
  assert.equal(input!.title, 'Two');
  assert.match(input!.problem, /^problem two/);
  assert.match(input!.problem, /problem one/);
  assert.match(input!.gap, /gap two/);
  assert.match(input!.gap, /gap one/);
  assert.deepEqual(input!.competitors, ['rival', 'late/tool']);
  assert.equal(input!.evidence.length, 3);
  assert.equal(specInputFor([one, two], []), null);
});

import { buildOpportunityDigest, readerInterest } from '../lib/newsletter/opportunity-digest';

test('each reader sees their own opportunities first in the digest', () => {
  const history = [
    { at: '2026-10-01T00:00:00Z', evidence: 1, platforms: 1, direct: 0, status: 'open' as const, qualified: false },
    { at: '2026-11-13T00:00:00Z', evidence: 4, platforms: 2, direct: 0, status: 'open' as const, qualified: true },
  ];
  const a = sample({ slug: 'a', name: 'Alpha', keywords: ['rust'], history });
  const b = sample({ slug: 'b', name: 'Beta', keywords: ['postgres'], history });
  const since = '2026-11-01T00:00:00Z';
  const plain = buildOpportunityDigest([a, b], since, 'https://x.test', 'changes')!;
  assert.equal(plain.lines[0].slug, 'a');
  const saved = buildOpportunityDigest([a, b], since, 'https://x.test', 'changes', Date.now(), { slugs: ['b'], keywords: [] })!;
  assert.equal(saved.lines[0].slug, 'b');
  assert.match(saved.lines[0].note, /^관심 기회/);
  assert.match(saved.subject, /Beta/);
  const interest = readerInterest([a, b], { slugs: [], keywords: ['Postgres'] });
  assert.equal(interest('b'), 1);
  assert.equal(interest('a'), 0);
});
