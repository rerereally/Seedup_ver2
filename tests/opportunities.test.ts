import assert from 'node:assert/strict';
import test from 'node:test';
import { matchOpportunities, quoteMentions, rankBySimilarity } from '../lib/opportunities/match';
import { normalizePrd, renderAgentBrief, renderPrdMarkdown } from '../lib/opportunities/prd';
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
  const draft = normalizePrd({
    summary: 's',
    requirements: [
      { title: 'cited', detail: 'd', evidence: [1, 1, 2] },
      { title: 'invented citation', detail: 'd', evidence: [99] },
      { title: 'no citation', detail: 'd', evidence: [] },
      { title: '', detail: 'dropped', evidence: [1] },
    ],
  }, 3);
  assert.deepEqual(draft.requirements.map((row) => row.title), ['cited']);
  assert.deepEqual(draft.requirements[0].evidence, [1, 2]);
  assert.deepEqual(draft.hypotheses.map((row) => row.title), ['invented citation', 'no citation']);
});

test('exports keep source links and keep hypotheses out of the build list', () => {
  const input = { title: 'T', problem: 'P', gap: 'G', evidence: [evidence(1)], competitors: ['c'] };
  const draft = normalizePrd({ summary: 's', requirements: [{ title: 'real', detail: 'd', evidence: [1] }, { title: 'guess', detail: 'd', evidence: [] }] }, 1);
  const markdown = renderPrdMarkdown(input, draft);
  assert.match(markdown, /\[근거 1\]/);
  assert.match(markdown, /https:\/\/example\.com\/1/);
  const brief = renderAgentBrief(input, draft);
  assert.match(brief, /- \[ \] R1\. real/);
  assert.doesNotMatch(brief, /- \[ \] .*guess/);
});
