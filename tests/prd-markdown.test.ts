import assert from 'node:assert/strict';
import test from 'node:test';
import { ownEvidence } from '../lib/opportunities/idea';
import { citedQuotes, parsePrdMarkdown, prdGlance } from '../lib/opportunities/prd-markdown';
import { prdSystemPrompt, prdUserPrompt } from '../lib/opportunities/prd-prompt';
import { normalizeQuestions } from '../lib/opportunities/questions';
import { normalizeSpec, renderSpecMarkdown } from '../lib/opportunities/spec';
import { publicEvidence } from '../lib/opportunities/types';

const example = (() => {
  const prompt = prdSystemPrompt();
  return prompt.slice(prompt.indexOf('<예시 PRD>') + '<예시 PRD>'.length, prompt.indexOf('</예시 PRD>'));
})();

test('the worked example in the prompt parses into the structure it teaches', () => {
  const raw = parsePrdMarkdown(example);
  assert.ok(raw);
  const spec = normalizeSpec(raw, 3, false, { idea: true });
  assert.equal(spec.requirements.length, 3);
  assert.equal(spec.hypotheses.length, 1);
  assert.deepEqual(spec.requirements[0].evidence, [1, 2]);
  assert.equal(spec.requirements[0].priority, 'P0');
  assert.equal(spec.requirements[0].acceptance?.length, 2);
  assert.match(spec.hypotheses[0].check ?? '', /메인테이너 5명/);
  assert.deepEqual(spec.features.map((row) => row.requirementIds), [['R-01'], ['R-02'], ['R-03'], ['H-01']]);
  assert.match(spec.background ?? '', /\[E1\]/);
  assert.ok(spec.scenario && spec.goals?.length && spec.assumptions?.length && spec.openQuestions?.length);
});

test('a requirement line written as a heading is never read as the users section', () => {
  const raw = parsePrdMarkdown('# 한 줄 요약\n도구.\n## 요구사항\n### R1. [P0] 사용자는 로그를 볼 수 있어야 한다 [E1]\n- 수락 기준: 3초 안에 보인다\n## 대상 사용자\n- 개발자');
  assert.ok(raw);
  assert.deepEqual(raw.target_users, ['개발자']);
  assert.equal((raw.requirements as unknown[]).length, 1);
});

test('drifted formats still parse: bold ids, bullets, citations in the body, English headings', () => {
  const raw = parsePrdMarkdown(`## Summary
A CLI that finds the broken package.
## Requirements
- **R1.** [P1] Users can see the cause
  Shows the package name (E2).
  - Acceptance: shows it within 5 minutes
## Features
**F1. Bisect (R1)**
Takes two lockfiles and returns one package.`);
  assert.ok(raw);
  assert.equal((raw.requirements as Array<{ priority?: string }>)[0].priority, 'P1');
  const spec = normalizeSpec(raw, 3, false);
  assert.equal(spec.summary, 'A CLI that finds the broken package.');
  assert.deepEqual(spec.requirements[0].evidence, [2]);
  assert.equal(spec.requirements[0].priority, 'P0');
  assert.deepEqual(spec.requirements[0].acceptance, ['shows it within 5 minutes']);
  assert.deepEqual(spec.features[0].requirementIds, ['R-01']);
});

test('no readable requirement means null, so the caller asks for JSON instead of guessing', () => {
  assert.equal(parsePrdMarkdown('Here is your PRD! It is about a CLI.'), null);
});

test('citedQuotes reads every citation style and ignores numbers that are not citations', () => {
  assert.deepEqual(citedQuotes('a [E1, E3] b (E-2) c [E4][E5] 10개'), [1, 3, 2, 4, 5]);
  assert.deepEqual(citedQuotes('3초 안에 [링크]'), []);
});

test('quotes past the evidence list are dropped, never kept as citations', () => {
  const raw = parsePrdMarkdown('# 한 줄 요약\n도구.\n## 요구사항\n### R1. 사용자는 볼 수 있어야 한다 [E1, E9]');
  const spec = normalizeSpec(raw!, 2, false);
  assert.deepEqual(spec.requirements[0].evidence, [1]);
});

test('normalizeQuestions keeps well-formed questions and rejects a failed answer', () => {
  const questions = normalizeQuestions([
    { key: 'First Users!', question: '누가 쓰나요?', why: '대상', options: ['개발자', '개발자', '디자이너'] },
    { key: 'extra', question: '어디서 쓰나요?', options: ['웹', 'CLI'] },
    { question: '', options: ['a', 'b'] },
    { key: 'x', question: '보기 하나', options: ['하나'] },
  ]);
  assert.ok(questions);
  assert.equal(questions.length, 2);
  assert.equal(questions[0].key, 'firstusers');
  assert.deepEqual(questions[0].options, ['개발자', '디자이너']);
  // "extra" is the page's own closing question, so a model question never takes that key.
  assert.notEqual(questions[1].key, 'extra');
  assert.equal(normalizeQuestions([{ question: '하나뿐', options: ['a', 'b'] }]), null);
  assert.equal(normalizeQuestions('nope'), null);
});

test("the maker's own notes become labeled evidence that never counts toward the bar", () => {
  const own = ownEvidence(['  매주 월요일마다 빌드가 깨져요  ', '짧음', 42, 'x'.repeat(500)]);
  assert.equal(own.length, 2);
  assert.equal(own[0].platform, 'own');
  assert.equal(own[0].quote, '매주 월요일마다 빌드가 깨져요');
  assert.equal(own[1].quote.length, 400);
  assert.equal(publicEvidence([...own, { platform: 'github' as const }]).length, 1);
});

test('the user prompt says what to do when there is no quote, and the export shows the new sections', () => {
  const input = { title: '빌드 원인 찾기', problem: '빌드가 깨진다', gap: '', evidence: [], competitors: [] };
  assert.match(prdUserPrompt(input, { idea: true }), /원문 없음/);
  const raw = parsePrdMarkdown(example)!;
  const markdown = renderSpecMarkdown({ ...input, evidence: [] }, { ...normalizeSpec(raw, 3, false, { idea: true }), lang: 'ko' });
  assert.match(markdown, /## 배경[\s\S]*\[E-1\]/);
  assert.match(markdown, /수락 기준/);
  assert.match(markdown, /확인 방법/);
  assert.match(markdown, /## 열린 질문/);
});

test('a revision that leaves fields out keeps them from the version before', async () => {
  const { keepUnchanged } = await import('../lib/opportunities/prd');
  const before = normalizeSpec(parsePrdMarkdown(example)!, 3, false, { idea: true });
  // What a JSON revision typically returns: the asked-for change, bare rows and no prose.
  const revised = { ...before, background: undefined, scenario: undefined, openQuestions: undefined, hypotheses: before.hypotheses.map((row) => ({ ...row, check: undefined, acceptance: undefined })), requirements: before.requirements.map((row, index) => (index === 0 ? { ...row, acceptance: ['새 기준'] } : { ...row, priority: undefined })) };
  const kept = keepUnchanged(before, revised);
  assert.equal(kept.background, before.background);
  assert.equal(kept.scenario, before.scenario);
  assert.deepEqual(kept.openQuestions, before.openQuestions);
  assert.deepEqual(kept.requirements[0].acceptance, ['새 기준']);
  assert.equal(kept.requirements[1].priority, before.requirements[1].priority);
  assert.equal(kept.hypotheses[0].check, before.hypotheses[0].check);
});

test('the end-to-end fixture PRD parses cleanly, so the test never depends on a repair call', async () => {
  const { fixtureProse } = await import('../lib/llm-fixtures');
  const { specIssues } = await import('../lib/opportunities/prd');
  const spec = normalizeSpec(parsePrdMarkdown(fixtureProse())!, 0, true, { idea: true });
  assert.equal(spec.hypotheses.length, 3);
  assert.equal(spec.features.length, 3);
  assert.deepEqual(specIssues(spec, { title: '', problem: '', gap: '', evidence: [], competitors: [] }), []);
});

test('a saved PRD reads back as requirement lines and a feature count for its thumbnail', () => {
  const glance = prdGlance('## 요구사항\n### R1. [P0] 사용자는 원인 패키지를 찾을 수 있어야 한다 [E1]\n### R2. [P1] 사용자는 변경 기록을 볼 수 있어야 한다\n\n## 기능\n### F1. lock 파일 비교 (R1)\n### F2. 변경 기록 링크 (R2)\n');
  assert.equal(glance?.requirements.length, 2);
  assert.equal(glance?.requirements[0].priority, 'P0');
  assert.equal(glance?.features, 2);
  assert.equal(prdGlance(null), null);
  assert.equal(prdGlance('그냥 메모'), null);
});
