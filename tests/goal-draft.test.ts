import assert from 'node:assert/strict';
import test from 'node:test';
import { goalDraft, unlinkedItems } from '../components/goal/draft';
import type { Spec } from '../lib/opportunities/spec';

const spec = {
  summary: '1인 개발자가 배포 알림을 놓치지 않게 한다',
  targetUsers: [],
  requirements: [
    { id: 'R-01', title: '배포 실패 알림', detail: '실패하면 바로 알림을 보낸다', evidence: [1] },
    { id: 'R-02', title: 'Dark theme', detail: 'Settings page offers a dark theme', evidence: [2] },
  ],
  hypotheses: [],
  features: [
    { id: 'F-01', title: '슬랙 연동', detail: '채널로 보낸다', requirementIds: ['R-01'], slots: null },
    { id: 'F-02', title: '테마 전환', detail: '설정에서 바꾼다', requirementIds: ['R-02'], slots: null },
  ],
  screens: [],
  nonGoals: ['결제'],
  risks: [],
  metrics: ['실패 알림: 1분 안에 도착', '첫 주 재방문 30%'],
  draft: false,
} satisfies Spec;

test('goalDraft fills the goal from summary, metrics, features and non-goals', () => {
  const draft = goalDraft(spec, 'idea');
  assert.equal(draft.statement, spec.summary);
  assert.deepEqual(draft.criteria.map((row) => [row.id, row.text, row.measure]), [['G-1', '실패 알림', '1분 안에 도착'], ['G-2', '첫 주 재방문 30%', '']]);
  assert.deepEqual(draft.inScope, ['슬랙 연동', '테마 전환']);
  assert.deepEqual(draft.outOfScope, ['결제']);
  assert.equal(goalDraft({ ...spec, metrics: [] }, 'idea').criteria.length, 2);
});

test('unlinkedItems flags requirements and features no criterion covers', () => {
  const draft = goalDraft(spec, 'idea');
  assert.deepEqual(unlinkedItems(spec, draft.criteria).map((row) => row.id), ['R-02', 'F-02']);
  assert.deepEqual(unlinkedItems(spec, []), []);
});
