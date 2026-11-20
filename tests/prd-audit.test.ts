import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { evalQualitySummary, PROBLEM_CASES } from '../lib/opportunities/eval';
import { specIssues } from '../lib/opportunities/prd';
import { applyP0Audit, isTestableCriterion, preExportGaps, summarizeSpecQuality } from '../lib/opportunities/prd-audit';
import { normalizeSpec } from '../lib/opportunities/spec';
import type { OpportunitySnapshot } from '../lib/opportunities/types';

const sampleInput = {
  title: 'Schema Bridge',
  problem: 'Different LLM providers return incompatible tool-call schemas',
  gap: 'Teams hand-write wrappers for each provider',
  competitors: [],
  evidence: [
    { id: 'ev_1', platform: 'hn' as const, quote: 'We keep rewriting JSON schema wrappers whenever we switch providers', quoteKo: '', url: 'https://example.com/1', score: 10, postedAt: null },
    { id: 'ev_2', platform: 'github' as const, quote: 'Strict mode rejects optional fields on one API and accepts them on another', quoteKo: '', url: 'https://example.com/2', score: 8, postedAt: null },
  ],
};

test('every fixed PROBLEM_CASE exists in committed snapshot.json with at least 2 verified quotes', () => {
  const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), 'lib/opportunities/data/snapshot.json'), 'utf8')) as OpportunitySnapshot;
  const bySlug = new Map(snapshot.opportunities.map((item) => [item.slug, item]));
  assert.equal(PROBLEM_CASES.length, 12);
  for (const slug of PROBLEM_CASES) {
    const opp = bySlug.get(slug);
    assert.ok(opp, `missing PROBLEM_CASE in snapshot.json: ${slug}`);
    assert.ok(opp.evidence.length >= 2, `PROBLEM_CASE ${slug} has fewer than 2 quotes (${opp.evidence.length})`);
  }
});

test('specIssues requires testable acceptance criteria on P0 requirements', () => {
  const missingP0Acceptance = normalizeSpec({
    summary: 'Schema normalizer for LLM tool calls',
    requirements: [
      { title: '스키마 변환', detail: 'OpenAI와 Anthropic의 도구 스키마를 1개의 JSON 입력으로 변환한다', evidence: [1], priority: 'P0', acceptance: ['빠르게 동작한다'] },
      { title: '오류 표시', detail: '지원하지 않는 필드가 있으면 필드 경로와 이유를 JSON으로 반환한다', evidence: [2], priority: 'P1' },
      { title: '버전 고정', detail: '설정 파일에서 제공사 API 버전을 1줄로 지정하면 요청 헤더에 반영한다', evidence: [1], priority: 'P2' },
    ],
    features: [{ title: '변환기', detail: '입력 스키마를 대상 제공사 형식으로 변환해 반환한다', requirements: [1, 2, 3] }],
    metrics: ['3개 제공사 스키마 테스트 100% 통과. 측정: 제공사별 변환 테스트를 실행하고 성공을 집계한다.'],
  }, 2);

  const issues = specIssues(missingP0Acceptance, sampleInput);
  assert.ok(issues.some((line) => line.includes('R-01') && line.includes('수락 기준')), `expected P0 acceptance issue, got: ${issues.join(' | ')}`);

  const validP0 = normalizeSpec({
    summary: 'Schema normalizer for LLM tool calls',
    requirements: [
      { title: '스키마 변환', detail: 'OpenAI와 Anthropic의 도구 스키마를 1개의 JSON 입력으로 변환한다', evidence: [1], priority: 'P0', acceptance: ['OpenAI 스키마를 넣으면 200ms 안에 Anthropic 호환 JSON을 반환한다'] },
      { title: '오류 표시', detail: '지원하지 않는 필드가 있으면 필드 경로와 이유를 JSON으로 반환한다', evidence: [2], priority: 'P1' },
      { title: '버전 고정', detail: '설정 파일에서 제공사 API 버전을 1줄로 지정하면 요청 헤더에 반영한다', evidence: [1], priority: 'P2' },
    ],
    features: [{ title: '변환기', detail: '입력 스키마를 대상 제공사 형식으로 변환해 반환한다', requirements: [1, 2, 3] }],
    metrics: ['3개 제공사 스키마 테스트 100% 통과. 측정: 제공사별 변환 테스트를 실행하고 성공을 집계한다.'],
  }, 2);

  assert.deepEqual(specIssues(validP0, sampleInput), []);
});

test('isTestableCriterion accepts concrete conditions/numbers and rejects vague lines', () => {
  assert.equal(isTestableCriterion('빠르게 동작한다'), false);
  assert.equal(isTestableCriterion('easy and fast'), false);
  assert.equal(isTestableCriterion('짧음'), false);
  assert.equal(isTestableCriterion('잘못된 토큰을 보내면 HTTP 401과 오류 메시지를 반환한다'), true);
  assert.equal(isTestableCriterion('Returns normalized JSON within 500ms for valid input'), true);
});

test('preExportGaps flags missing P0 acceptance and unfilled or open critical slots on P0 features only', () => {
  const spec = normalizeSpec({
    summary: 's',
    requirements: [
      { title: 'P0 req', detail: '입력 JSON을 검증하고 변환 결과를 반환한다', evidence: [1], priority: 'P0' },
      { title: 'P1 req', detail: '변환 이력을 최근 10건까지 보여 준다', evidence: [2], priority: 'P1' },
    ],
    features: [
      { title: 'Core converter', detail: 'P0 feature', requirements: [1] },
      { title: 'History viewer', detail: 'P1 feature', requirements: [2] },
    ],
    metrics: ['1초 안에 응답한다'],
  }, 2);

  // P0 feature has null slots and P0 requirement has no acceptance criteria; P1 feature is ignored.
  const gapsBefore = preExportGaps(spec);
  assert.equal(gapsBefore.some((gap) => gap.kind === 'acceptance' && gap.itemId === 'R-01'), true);
  assert.equal(gapsBefore.some((gap) => gap.kind === 'slot' && gap.itemId === 'F-01'), true);
  assert.equal(gapsBefore.some((gap) => gap.itemId === 'F-02'), false);

  // Fill slots on F-01, leaving one open question in `access` and empty `errors`.
  spec.features[0].slots = {
    inputs: ['JSON schema payload'],
    rules: ['Strict mode strips unsupported keywords'],
    errors: [],
    access: ['확인 필요: API 키 권한 범위'],
    data: ['conversions table with user_id'],
    done: ['Unit tests pass for 3 providers'],
  };
  const gapsAfter = preExportGaps(spec);
  assert.equal(gapsAfter.some((gap) => gap.itemId === 'F-01' && gap.slot === 'errors'), true);
  assert.equal(gapsAfter.some((gap) => gap.itemId === 'F-01' && gap.slot === 'access'), true);
  assert.equal(gapsAfter.some((gap) => gap.itemId === 'F-01' && gap.slot === 'rules'), false);
});

test('applyP0Audit narrows partial P0s and demotes unsupported P0s to hypotheses while maintaining trace links', () => {
  const spec = normalizeSpec({
    summary: 's',
    requirements: [
      { title: 'Supported P0', detail: 'JSON 스키마를 대상 제공사 형식으로 변환한다', evidence: [1], priority: 'P0', acceptance: ['변환 결과에 필수 필드가 유지된다'] },
      { title: 'Partial P0', detail: '모든 제공사의 스트리밍과 멀티모달 요청을 자동 변환한다', evidence: [2], priority: 'P0', acceptance: ['오류 없이 200 응답을 반환한다'] },
      { title: 'Unsupported P0', detail: '팀 단위 청구서와 결제 대시보드를 제공한다', evidence: [1], priority: 'P0', acceptance: ['월별 청구 PDF를 3초 안에 생성한다'] },
    ],
    features: [
      { title: 'Core', detail: 'd', requirements: [1, 2] },
      { title: 'Billing', detail: 'd', requirements: [3] },
    ],
    screens: [
      { name: 'Converter', does: 'Converts schemas', features: [1] },
      { name: 'Billing', does: 'Shows invoices', features: [2] },
    ],
    technicalDesign: { milestones: [
      { title: 'Build core and billing', featureIds: [1, 2] },
      { title: 'Validate invoices', featureIds: [2] },
    ] },
    metrics: ['3개 제공사 테스트 통과'],
  }, 2);

  const { spec: audited, changes } = applyP0Audit(spec, [
    { id: 'R-01', verdict: 'supported', reason: 'Direct quote match' },
    {
      id: 'R-02',
      verdict: 'partial',
      reason: '원문은 strict mode optional 필드만 언급함',
      narrowedDetail: 'strict mode에서 optional 필드 불일치만 변환하고 멀티모달은 제외한다',
      openQuestion: '첫 버전에 멀티모달 스키마 변환을 포함할 것인가?',
    },
    {
      id: 'R-03',
      verdict: 'unsupported',
      reason: '인용 원문에 청구서나 결제 요구가 없음',
      check: '파일럿 사용자 5명에게 결제 대시보드 필요 여부를 인터뷰한다',
    },
  ]);

  assert.equal(changes.length, 2);
  assert.equal(audited.requirements.length, 2);
  assert.equal(audited.requirements[1].detail, 'strict mode에서 optional 필드 불일치만 변환하고 멀티모달은 제외한다');
  assert.ok(audited.openQuestions?.includes('첫 버전에 멀티모달 스키마 변환을 포함할 것인가?'));

  // R-03 demoted to H-01 with empty evidence and check; orphaned Billing feature & screen dropped on problem PRD.
  assert.equal(audited.hypotheses.length, 1);
  assert.equal(audited.hypotheses[0].id, 'H-01');
  assert.deepEqual(audited.hypotheses[0].evidence, []);
  assert.match(audited.hypotheses[0].check ?? '', /파일럿 사용자 5명/);
  assert.equal(audited.features.length, 1);
  assert.deepEqual(audited.features[0].requirementIds, ['R-01', 'R-02']);
  assert.equal(audited.screens.length, 1);
  assert.equal(audited.screens[0].name, 'Converter');
  assert.deepEqual(audited.technicalDesign?.milestones, [{ title: 'Build core and billing', featureIds: ['F-01'] }]);
});

test('applyP0Audit keeps feature links to demoted hypotheses on idea PRDs', () => {
  const ideaSpec = normalizeSpec({
    summary: 's',
    requirements: [
      { title: 'Unsupported P0', detail: '이메일 요약을 매일 오전 9시에 발송한다', evidence: [1], priority: 'P0' },
    ],
    features: [{ title: 'Daily mailer', detail: 'd', requirements: [1] }],
    metrics: ['매일 9시 발송'],
  }, 1, false, { idea: true });

  const { spec: audited } = applyP0Audit(ideaSpec, [
    { id: 'R-01', verdict: 'unsupported', reason: 'Quote does not mention email timing' },
  ]);
  assert.equal(audited.requirements.length, 0);
  assert.equal(audited.hypotheses.length, 1);
  assert.equal(audited.features.length, 1);
  assert.deepEqual(audited.features[0].requirementIds, ['H-01']);
});

test('summarizeSpecQuality and evalQualitySummary aggregate P0 testability, weak P0s, and open decisions', () => {
  const spec = normalizeSpec({
    summary: 's',
    requirements: [
      { title: 'Good P0', detail: '입력 JSON을 검증하고 500ms 안에 결과를 반환한다', evidence: [1], priority: 'P0', acceptance: ['유효 JSON 입력 시 500ms 안에 변환 결과를 반환한다'] },
      { title: 'Weak P0', detail: '빠르게 처리한다', evidence: [2], priority: 'P0' },
    ],
    features: [{ title: 'F', detail: 'd', requirements: [1, 2] }],
    metrics: ['1초 안에 완료'],
    open_questions: ['초기 지원 제공사 목록은?'],
  }, 2);

  const metrics = summarizeSpecQuality(spec, sampleInput);
  assert.equal(metrics.p0Total, 2);
  assert.equal(metrics.p0Testable, 1);
  assert.equal(metrics.testableP0Rate, 50);
  assert.equal(metrics.weakP0, 1);
  assert.ok(metrics.openDecisions >= 3); // 1 missing P0 acceptance + 1 missing P0 feature slots + 1 open question

  const summary = evalQualitySummary([
    { id: 'c1', kind: 'problem', ok: true, seconds: 40, issues: 0, requirements: 4, cited: 4, firstIssue: '', p0Total: 2, p0Testable: 2, weakP0: 0, openDecisions: 1, auditChanges: 1 },
    { id: 'c2', kind: 'problem', ok: true, seconds: 60, issues: 1, requirements: 4, cited: 2, firstIssue: 'R-01', p0Total: 2, p0Testable: 1, weakP0: 1, openDecisions: 3, auditChanges: 0 },
  ]);
  assert.equal(summary.testableP0Rate, 75);
  assert.equal(summary.meanWeakP0, 0.5);
  assert.equal(summary.meanOpenDecisions, 2);
  assert.equal(summary.totalAuditChanges, 1);
});
