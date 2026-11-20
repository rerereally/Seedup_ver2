import assert from 'node:assert/strict';
import test from 'node:test';
import { auditP0Evidence } from '../lib/opportunities/prd-audit';
import { withAuditNote } from '../lib/opportunities/prd';
import { normalizeSpec, type RawSpec, type Spec, type SpecInput } from '../lib/opportunities/spec';

const input: SpecInput = {
  title: 'Export alerts',
  problem: 'Alerts are hard to share with the team.',
  gap: 'No export.',
  evidence: [{ quote: 'I export the selected alerts to a CSV file every Monday.' }] as SpecInput['evidence'],
  competitors: [],
};

const raw = {
  summary: 'Export selected alerts as a local CSV file.',
  requirements: [{ title: '사용자는 선택한 알림을 CSV로 내보낼 수 있어야 한다', detail: '선택한 알림 목록을 CSV 파일 하나로 내려받는다', evidence: [1] }],
} as unknown as RawSpec;

const specOf = (lang: 'ko' | 'en' = 'ko'): Spec => normalizeSpec(raw, input.evidence, true, { lang });

test('withAuditNote leaves the spec as it is when the audit is done or had nothing to check', () => {
  const spec = specOf();
  assert.equal(withAuditNote(spec, 'done'), spec);
  assert.equal(withAuditNote(spec, 'nothing'), spec);
});

test('withAuditNote adds the Korean and English skipped line by spec language', () => {
  const ko = withAuditNote({ ...specOf(), lang: 'ko' }, 'skipped');
  assert.deepEqual(ko.reviewNotes, ['P0 근거 감사를 시간 안에 마치지 못해 건너뛰었습니다. P0 요구사항과 원문의 연결은 아직 검증되지 않았습니다.']);
  const en = withAuditNote({ ...specOf(), lang: 'en' }, 'skipped');
  assert.deepEqual(en.reviewNotes, ['The P0 evidence audit was skipped for lack of time. Links between P0 requirements and quotes are not verified yet.']);
});

test('withAuditNote keeps existing review notes and never adds the same line twice', () => {
  const base = { ...specOf(), lang: 'en' as const, reviewNotes: ['Check pricing.'] };
  const once = withAuditNote(base, 'overruled');
  const twice = withAuditNote(once, 'overruled');
  assert.equal(once.reviewNotes?.length, 2);
  assert.equal(once.reviewNotes?.[0], 'Check pricing.');
  assert.equal(twice, once);
  assert.equal(base.reviewNotes?.length, 1);
});

test('auditP0Evidence returns status nothing without calling a model when no requirement is P0', async () => {
  // normalizeSpec always keeps one P0 row, so the no-P0 case is made by hand.
  const base = specOf();
  const spec: Spec = { ...base, requirements: base.requirements.map((row) => ({ ...row, priority: 'P1' as const })) };
  const result = await auditP0Evidence(input, spec, { model: 'unused-model', timeoutMs: 1 });
  assert.equal(result.status, 'nothing');
  assert.equal(result.audited, false);
  assert.equal(result.spec, spec);
  assert.deepEqual(result.changes, []);
});
