import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { normalizeSpec } from '../lib/opportunities/spec';
import { featureContribution, goalChange, goalSummary, linkSpecToGoal, unlinkedItems } from '../lib/supervisor/goal';
import { hookBundle, hookSettings } from '../lib/supervisor/hook-bundle';
import { humanTasks } from '../lib/supervisor/human-queue';
import type { ProjectGoal, SuccessCriterion } from '../lib/supervisor/types';

const spec = normalizeSpec({
  summary: 'Reminders for renters',
  requirements: [
    { title: '마감 알림', detail: '월세 마감 전에 알림을 보낸다', evidence: [1] },
    { title: 'Export history', detail: 'Download payments as CSV', evidence: [2] },
    { title: 'Login', detail: 'G-2 covers this: renters sign in with Supabase', evidence: [3] },
  ],
  features: [
    { title: 'Reminder sender', detail: 'Sends reminders', requirements: [1] },
    { title: 'CSV export', detail: 'Writes a file', requirements: [2] },
    { title: 'Account', detail: 'Supabase login and Stripe billing', requirements: [3] },
  ],
}, 3);
spec.openQuestions = ['Monthly or yearly plan?'];
const [reminder, exportReq, login] = spec.requirements;
const [sender, csv, account] = spec.features;

const criteria: SuccessCriterion[] = [
  { id: 'G-1', text: '마감 알림을 받은 사용자 비율', measure: '알림 발송 로그 / 활성 사용자', status: 'open' },
  { id: 'G-2', text: 'Renters stay signed in', measure: 'weekly active sessions', status: 'met' },
];
const goal: ProjectGoal = {
  projectKey: 'prd:00000000-0000-0000-0000-000000000001', version: 2, track: 'personal', statement: 'Renters never miss rent',
  criteria, inScope: [], outOfScope: ['Bank transfers'], lockedAt: '2026-11-20T00:00:00Z', changeReason: 'narrowed',
};

test('links by shared words (Korean particles included) and by naming G-n; features inherit from requirements', () => {
  const links = linkSpecToGoal(spec, criteria);
  assert.deepEqual(links.requirements[reminder.id], ['G-1']);
  assert.deepEqual(links.requirements[exportReq.id], []);
  assert.deepEqual(links.requirements[login.id], ['G-2']);
  assert.deepEqual(links.features[sender.id], ['G-1']);
  assert.deepEqual(links.features[account.id], ['G-2']);
});

test('lists what serves no criterion, and nothing when there are no criteria', () => {
  assert.deepEqual(unlinkedItems(spec, criteria).map((row) => [row.kind, row.id]), [['requirement', exportReq.id], ['feature', csv.id]]);
  assert.deepEqual(unlinkedItems(spec, []), []);
});

test('orders features by open criteria served, unlinked ones last', () => {
  assert.deepEqual(featureContribution(spec, criteria).map((row) => row.featureId), [sender.id, account.id, csv.id]);
});

test('a goal change sends features of edited or removed criteria to recheck, not a status change', () => {
  const statusOnly = goalChange(spec, goal, { criteria: criteria.map((row) => ({ ...row, status: 'met' })) });
  assert.deepEqual(statusOnly, { added: [], changed: [], removed: [], recheckFeatureIds: [] });
  const edited = goalChange(spec, goal, { criteria: [{ ...criteria[0], measure: 'opened reminders' }, { id: 'G-3', text: 'new', measure: 'x', status: 'open' }] });
  assert.deepEqual(edited.changed, ['G-1']);
  assert.deepEqual(edited.removed, ['G-2']);
  assert.deepEqual(edited.added, ['G-3']);
  assert.deepEqual(edited.recheckFeatureIds, [sender.id, account.id]);
});

test('summary carries version, criteria status and non-goals', () => {
  const summary = goalSummary(goal, 'en');
  assert.match(summary, /^Goal v2 \(A personal\): Renters never miss rent/);
  assert.match(summary, /🟢 G-2 Renters stay signed in/);
  assert.match(summary, /Not doing: Bank transfers/);
});

test('human tasks come first with key names only, then open decisions', () => {
  const tasks = humanTasks(spec);
  // Supabase and Stripe are named; the login need gets its own setup task since no auth provider is named.
  assert.deepEqual(tasks.map((task) => task.category), ['database', 'payment', 'auth', 'decision']);
  assert.deepEqual(tasks[0].unblocksFeatureIds, [account.id]);
  assert.ok(tasks[0].envVars.every((name) => /^[A-Z][A-Z0-9_]*$/.test(name)));
  assert.equal(tasks[3].title, 'Monthly or yearly plan?');
  assert.deepEqual(tasks.map((task) => task.id), ['H-1', 'H-2', 'H-3', 'H-4']);
});

test('hook bundle: goal file, settings for start/resume/compact and stop, and refuses an unsafe key', () => {
  const files = hookBundle(goal.projectKey, goal, humanTasks(spec));
  assert.deepEqual(files.map((file) => file.path), ['.seedup/goal.md', '.seedup/session-start.sh', '.seedup/stop.sh', '.claude/settings.json']);
  assert.match(files[0].content, /get_next_task/);
  assert.match(files[0].content, /SUPABASE_SECRET_KEY/);
  assert.equal(hookSettings().hooks.SessionStart[0].matcher, 'startup|resume|compact');
  assert.throws(() => hookBundle("x'; rm -rf ~", goal));
});

test('stop hook blocks once on uncommitted work, then lets the stop through', { skip: process.platform === 'win32' }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'seedup-hook-'));
  const stop = hookBundle(goal.projectKey, goal).find((file) => file.path === '.seedup/stop.sh')!;
  writeFileSync(join(dir, 'stop.sh'), stop.content);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  const run = (input: string) => execFileSync('sh', ['stop.sh'], { cwd: dir, input }).toString();
  const first = JSON.parse(run('{"stop_hook_active":false}')) as { decision: string; reason: string };
  assert.equal(first.decision, 'block');
  assert.match(first.reason, /save_handoff/);
  assert.equal(run('{"stop_hook_active":true}'), '');
});
