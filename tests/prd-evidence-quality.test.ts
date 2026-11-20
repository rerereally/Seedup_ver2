import assert from 'node:assert/strict';
import test from 'node:test';
import { specIssues } from '../lib/opportunities/prd';
import { isTestableCriterion } from '../lib/opportunities/prd-audit';
import { parsePrdMarkdown } from '../lib/opportunities/prd-markdown';
import { evidenceStrengthFor, normalizeSpec, prdSentenceKinds, renderSpecMarkdown } from '../lib/opportunities/spec';
import type { SpecInput } from '../lib/opportunities/spec';
import type { Evidence } from '../lib/opportunities/types';

const source = (id: string, platform: Evidence['platform']): Evidence => ({
  id, platform, url: `https://example.test/${id}`, quote: 'We need a history that persists after restart.', quoteKo: '', score: 0, postedAt: null,
});
const input: SpecInput = {
  title: 'History', problem: 'The history is lost.', gap: '', competitors: ['Notes'],
  competitorNotes: ['Notes: The service stores seven days of activity.'],
  evidence: [source('a', 'github'), source('b', 'hn'), source('c', 'github'), source('d', 'github'), source('e', 'own')],
};

test('strong evidence needs three public quotes or two public platforms, and only distinct valid sources count', () => {
  assert.equal(evidenceStrengthFor([1, 3, 4], input.evidence), 'strong');
  assert.equal(evidenceStrengthFor([1, 2], input.evidence), 'strong');
  assert.equal(evidenceStrengthFor([1, 1, 3, 5, 99], input.evidence), 'some');
  assert.equal(evidenceStrengthFor([5], input.evidence), 'some');
  assert.equal(evidenceStrengthFor([0, 99], input.evidence), 'none');
  const rows = normalizeSpec({ requirements: [
    { title: 'History', evidence: [1, 2], evidenceStrength: 'none' },
    { title: 'Sharing', evidence: [], evidenceStrength: 'strong' },
  ] }, input.evidence);
  assert.equal(rows.requirements[0].evidenceStrength, 'strong');
  assert.equal(rows.hypotheses[0].evidenceStrength, 'none');
});

test('the repair pass flags a bad P0 criterion even beside a good one and distinguishes the metric from its method', () => {
  const good = 'Given a valid entry, the API returns the entry ID within 1 second.';
  assert.equal(isTestableCriterion(good), true);
  assert.equal(isTestableCriterion('사용자는 2초 안에 이어서 다음 단계를 진행한다.'), false);
  assert.equal(isTestableCriterion('When the user feels satisfied, the app saves the note.'), false);
  assert.equal(isTestableCriterion('When a post opens, the app shows the number of likes.'), true);
  const spec = normalizeSpec({
    requirements: [{ title: 'Save history', priority: 'P0', evidence: [1], acceptance: [good, '사용자가 내용을 읽으면 이어서 진행한다.'] }],
    metrics: ['95% of requests finish in 1s.', '10 errors. Measure: TBD.', '100% of valid requests return an ID. Measure: Run fixtures and count responses with IDs.'],
  }, input.evidence);
  const issues = specIssues(spec, input).join('\n');
  assert.match(issues, /R-01.*수락 기준 2번/);
  assert.match(issues, /metrics 1, 2번에 측정 방법이 없습니다/);
  assert.doesNotMatch(issues, /metrics .*3번에 측정/);
});

test('document labels are grounded, keep valid citations, and can be read back without becoming prose', () => {
  const background = 'History disappears after a restart. [E-1] The service stores seven days of activity. Developers may prefer exports.';
  assert.deepEqual(prdSentenceKinds(background, input), [
    { kind: 'testimony', text: 'History disappears after a restart. [E-1]' },
    { kind: 'fact', text: 'The service stores seven days of activity.' },
    { kind: 'inference', text: 'Developers may prefer exports.' },
  ]);
  assert.equal(prdSentenceKinds('The market doubled [E-99].', input)[0].kind, 'inference');
  const spec = normalizeSpec({
    summary: 'Persist history', background, assumptions: ['Developers may prefer exports.'],
    risks: ['The service stores seven days of activity.'],
    requirements: [{ title: 'History', evidence: [1, 2] }],
  }, input.evidence);
  const markdown = renderSpecMarkdown(input, { ...spec, lang: 'en' });
  assert.match(markdown, /Evidence: E-1, E-2 · Strong evidence/);
  assert.match(markdown, /\[Testimony\] History disappears after a restart\. \[E-1\] \[Fact\] The service stores/);
  assert.match(markdown, /## Assumptions\n- \[Inference\] Developers may prefer exports\./);
  assert.match(markdown, /## Risks\n- \[Fact\] The service stores seven days of activity\./);
  const parsed = parsePrdMarkdown(markdown);
  assert.equal(parsed?.background, background);
  assert.deepEqual(parsed?.assumptions, ['Developers may prefer exports.']);
  assert.deepEqual(normalizeSpec(parsed ?? {}, input.evidence).requirements[0].evidence, [1, 2]);
});
