import assert from 'node:assert/strict';
import test from 'node:test';
import { liveStepsAfter, type LiveStep } from '../lib/opportunities/live-steps';

const after = (steps: LiveStep[], phase: Parameters<typeof liveStepsAfter>[1]['phase'], text = '', at = 0, restarted = false) => liveStepsAfter(steps, { phase, text, restarted, at });

test('the live step list adds a step per phase change and per new section heading, never twice', () => {
  let steps = after([], 'waiting');
  steps = after(steps, 'thinking', '', 3);
  steps = after(steps, 'writing', '# 한 줄 요약\n도구', 9);
  steps = after(steps, 'writing', '# 한 줄 요약\n도구\n\n## 배', 12);
  steps = after(steps, 'writing', '# 한 줄 요약\n도구\n\n## 배경\n개발자는', 14);
  const same = after(steps, 'writing', '# 한 줄 요약\n도구\n\n## 배경\n개발자는 매일', 15);
  assert.equal(same, steps);
  steps = after(steps, 'auditing', '', 40);
  assert.deepEqual(steps.map((step) => (step.kind === 'section' ? step.title : step.kind === 'phase' ? step.phase : 'restart')), ['waiting', 'thinking', 'writing', '한 줄 요약', '배경', 'auditing']);
  assert.deepEqual(steps.map((step) => step.at), [0, 3, 9, 9, 14, 40]);
});

test('a model restart is recorded and its sections count again from the start', () => {
  let steps = after([], 'writing', '# 요약\n가', 5);
  steps = after(steps, 'waiting', '', 20, true);
  steps = after(steps, 'writing', '# 요약\n나', 25);
  assert.deepEqual(steps.map((step) => step.kind), ['phase', 'section', 'restart', 'phase', 'phase', 'section']);
});
