import assert from 'node:assert/strict';
import test from 'node:test';
import { parsePrdMarkdown } from '../lib/opportunities/prd-markdown';
import { specIssues } from '../lib/opportunities/prd';
import { prdUserPrompt } from '../lib/opportunities/prd-prompt';
import { normalizeSpec, renderSpecMarkdown, unservedFirstReleaseRequirements, withPrdReadiness } from '../lib/opportunities/spec';
import type { Evidence } from '../lib/opportunities/types';

const evidence: Evidence[] = [
  { id: '1', platform: 'hn', quote: 'I’ve repeatedly hit the same failure mode: at any moment, it’s hard to answer', quoteKo: '', url: 'https://news.ycombinator.com/item?id=46725196', score: 0, postedAt: null },
  { id: '2', platform: 'hn', quote: 'Requirements change when the scope evolves.', quoteKo: '', url: 'https://news.ycombinator.com/item?id=48128583', score: 0, postedAt: null },
];
const input = { title: '요구사항 관리', problem: '변경 이력을 찾기 어렵다', gap: '', evidence, competitors: [] };
const raw = {
  summary: '팀의 요구사항과 변경 이력',
  requirements: [
    { title: '변경 이력', detail: '변경할 때 이전 상태와 작성자를 기록한다.', evidence: [2], priority: 'P1' },
    { title: '이력 필터', detail: '작성자나 날짜로 이력 목록을 좁힌다.', evidence: [1], priority: 'P1' },
    { title: '항목 만들기', detail: '이력을 남기려면 먼저 요구사항 항목을 생성한다.', evidence: [], priority: 'P1', foundation: true },
  ],
  features: [{ title: '변경 기록', requirements: [1] }],
};

test('missing P0 and P1 links go to repair and remain open until a feature serves them', () => {
  const before = normalizeSpec(raw, evidence, true);
  assert.deepEqual(unservedFirstReleaseRequirements(before).map((row) => row.id), ['H-01', 'H-02']);
  assert.match(specIssues(before, input)[0], /H-01.*기능이 없습니다/);
  assert.equal(withPrdReadiness(before).openQuestions?.filter((line) => line.startsWith('기능 연결 필요')).length, 2);
  const repaired = normalizeSpec({ ...raw, features: [...raw.features, { title: '이력 필터', requirements: [2] }, { title: '항목 생성', requirements: [3] }] }, evidence, true);
  assert.deepEqual(unservedFirstReleaseRequirements(repaired), []);
  assert.deepEqual(repaired.features.map((row) => row.requirementIds), [['R-01'], ['H-01'], ['H-02']]);
});

test('foundation is a P0 inference, round-trips as H, and rejects the old cut-off citation without renumbering', () => {
  const spec = normalizeSpec(raw, evidence, true);
  assert.deepEqual(spec.requirements.map((row) => row.evidence), [[2]]);
  assert.deepEqual(spec.hypotheses.map((row) => [row.priority, row.foundation, row.evidence]), [['P1', undefined, []], ['P0', true, []]]);
  const markdown = renderSpecMarkdown(input, spec);
  assert.match(markdown, /## 기반 요구사항\n### H-02\. \[P0\] \[기반 요구사항\] \[추정\]/);
  assert.ok(markdown.indexOf('## 기반 요구사항') < markdown.indexOf('## 요구사항 (원문 → R)'));
  assert.doesNotMatch(markdown, /hard to answer/);
  assert.doesNotMatch(prdUserPrompt(input), /hard to answer/);
  assert.match(prdUserPrompt(input), /E2 \[.*Requirements change/);
  const parsed = parsePrdMarkdown(markdown);
  assert.ok(parsed);
  assert.equal(normalizeSpec(parsed, evidence, true).hypotheses[1].foundation, true);
});

test('a rejected requirement row does not shift the original feature link', () => {
  const spec = normalizeSpec({ ...raw, requirements: [null, raw.requirements[0]], features: [{ title: 'Record a change', requirements: [2] }] }, evidence, true);
  assert.deepEqual(spec.features[0]?.requirementIds, ['R-01']);
});
