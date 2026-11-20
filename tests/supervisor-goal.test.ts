import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { normalizeSpec } from '../lib/opportunities/spec';
import { featureContribution, goalChange, goalSummary, linkSpecToGoal, unlinkedItems } from '../lib/supervisor/goal';
import { codexHookSettings, hookBundle, hookSettings } from '../lib/supervisor/hook-bundle';
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
  assert.deepEqual(links.confirmedFeatures[sender.id], []);
});

test('confirmed feature links override matching words and keep legacy requirement inheritance', () => {
  const confirmed = [{ ...criteria[0], featureIds: [csv.id, 'F-99'] }, criteria[1]];
  const links = linkSpecToGoal(spec, confirmed);
  assert.deepEqual(links.confirmedFeatures, { [sender.id]: [], [csv.id]: ['G-1'], [account.id]: [] });
  assert.deepEqual(links.features, { [sender.id]: [], [csv.id]: ['G-1'], [account.id]: ['G-2'] });
  assert.deepEqual(links.requirements, { [reminder.id]: [], [exportReq.id]: ['G-1'], [login.id]: ['G-2'] });
  assert.deepEqual(featureContribution(spec, confirmed).map((row) => row.featureId), [csv.id, account.id, sender.id]);
  assert.deepEqual(linkSpecToGoal(spec, [{ ...criteria[0], featureIds: [] }]).features[sender.id], []);
  const sibling = { ...sender, id: 'F-04' };
  const sharedRequirement = linkSpecToGoal({ ...spec, features: [...spec.features, sibling] }, [{ ...criteria[0], featureIds: [sender.id] }]);
  assert.deepEqual(sharedRequirement.requirements[reminder.id], ['G-1']);
  assert.deepEqual(sharedRequirement.features[sibling.id], []);
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

test('relocking rechecks the features whose links changed, including newly added confirmed links', () => {
  const previous = { criteria: [{ ...criteria[0], featureIds: [sender.id, account.id] }, criteria[1]] };
  const next = { criteria: [{ ...criteria[0], featureIds: [csv.id, account.id] }, criteria[1]] };
  assert.deepEqual(goalChange(spec, previous, next), { added: [], changed: ['G-1'], removed: [], recheckFeatureIds: [sender.id, csv.id] });
  const added = { criteria: [...next.criteria, { ...criteria[0], id: 'G-3', featureIds: [account.id] }] };
  assert.deepEqual(goalChange(spec, next, added), { added: ['G-3'], changed: [], removed: [], recheckFeatureIds: [account.id] });
  assert.deepEqual(goalChange(spec, goal, { criteria: [{ ...criteria[0], featureIds: [sender.id] }, criteria[1]] }).recheckFeatureIds, []);
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

function writeBundle(dir: string, projectKey = goal.projectKey, tasks = humanTasks(spec)) {
  const files = hookBundle(projectKey, goal, tasks);
  for (const file of files) {
    mkdirSync(join(dir, file.path, '..'), { recursive: true });
    writeFileSync(join(dir, file.path), file.content);
  }
  return files;
}

function initGitRepo(dir: string) {
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: dir });
}

function runHookCommand(command: string, opts: { cwd: string; input?: string; env?: NodeJS.ProcessEnv }) {
  const prefix = 'node -e "';
  assert.ok(command.startsWith(prefix) && command.endsWith('"'), `unexpected command shape: ${command}`);
  const code = command.slice(prefix.length, -1);
  return spawnSync(process.execPath, ['-e', code], {
    cwd: opts.cwd,
    input: opts.input ?? '',
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: '', ...opts.env },
  });
}

test('hook bundle: goal file, Node runner, Claude and Codex configs with full matchers, /hooks notice and key validation', () => {
  const files = hookBundle(goal.projectKey, goal, humanTasks(spec));
  assert.deepEqual(
    files.map((file) => file.path),
    ['.seedup/goal.md', '.seedup/hook.mjs', '.seedup/pre-commit.sh', '.seedup/audit.mjs', '.claude/settings.json', '.codex/hooks.json', '.seedup/usage.mjs'],
  );
  assert.match(files[0].content, /get_next_task/);
  assert.match(files[0].content, /SUPABASE_SECRET_KEY/);
  assert.match(files[0].content, /\/hooks/);
  assert.match(files[0].content, /Windows/);

  const claude = hookSettings();
  const codex = codexHookSettings();
  assert.equal(claude.hooks.SessionStart[0].matcher, 'startup|resume|clear|compact|fork');
  assert.equal(claude.hooks.PreCompact[0].matcher, 'manual|auto');
  assert.equal('matcher' in claude.hooks.Stop[0], false);
  assert.deepEqual(JSON.parse(files[4].content), claude);

  assert.equal(codex.hooks.SessionStart[0].matcher, 'startup|resume|clear|compact|fork');
  assert.equal(codex.hooks.PreCompact[0].matcher, 'manual|auto');
  assert.equal('matcher' in codex.hooks.Stop[0], false);
  assert.deepEqual(JSON.parse(files[5].content), codex);

  // Hook commands run via Node without sh or shell-dependent expansion characters so Windows cmd/PowerShell/sh share one command.
  for (const command of [
    claude.hooks.SessionStart[0].hooks[0].command,
    claude.hooks.PreCompact[0].hooks[0].command,
    claude.hooks.Stop[0].hooks[0].command,
    codex.hooks.SessionStart[0].hooks[0].command,
    codex.hooks.PreCompact[0].hooks[0].command,
    codex.hooks.Stop[0].hooks[0].command,
  ]) {
    assert.ok(command.startsWith('node -e "'));
    assert.doesNotMatch(command, /[$%`\\!]/);
  }
  assert.throws(() => hookBundle("x'; rm -rf ~", goal));
});

test('the generated SessionStart script asks the agent to resume the project after compaction or resuming', () => {
  const dir = mkdtempSync(join(tmpdir(), 'seedup-hook-compact-'));
  const [goalFile] = writeBundle(dir);
  const run = (input: string) => {
    const result = spawnSync(process.execPath, [join(dir, '.seedup/hook.mjs'), 'session-start'], {
      cwd: dir,
      input,
      encoding: 'utf8',
      env: { ...process.env, CLAUDE_PROJECT_DIR: '' },
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  const payload = (source?: string) => JSON.stringify({ source, cwd: dir });
  const instruction = `작업을 이어가기 전에 Seedup MCP의 resume_project(프로젝트 ${goal.projectKey})를 호출해 마지막 인계, 최근 결정, 진행 상태를 확인하세요.\n`;
  assert.equal(run(payload('compact')), goalFile.content + '대화가 압축되었습니다. ' + instruction);
  assert.equal(run(payload('resume')), goalFile.content + '대화가 재개되었습니다. ' + instruction);
  for (const input of [payload('startup'), payload('clear'), payload('fork'), payload('unknown'), payload(), '', '{broken']) {
    assert.equal(run(input), goalFile.content, input);
  }

  writeFileSync(join(dir, goalFile.path), '# Existing goal without a trailing newline');
  assert.equal(run(payload('compact')), '# Existing goal without a trailing newline\n대화가 압축되었습니다. ' + instruction);
  unlinkSync(join(dir, goalFile.path));
  const missing = 'Seedup 목표 파일(.seedup/goal.md)이 없습니다. Seedup에서 훅 묶음을 다시 받으세요.\n';
  assert.equal(run(payload('startup')), missing);
  assert.equal(run(payload('compact')), missing + '대화가 압축되었습니다. ' + instruction);
  const brief = `<!-- Seedup brief: project=${goal.projectKey} goal=2 prd=0123456789abcdef -->`;
  writeFileSync(join(dir, 'AGENTS.md'), `# Project rules\r\n${brief}\r\n`);
  assert.equal(run(payload('startup')), missing);
  assert.ok(run(payload('compact')).endsWith(`resume_project ${JSON.stringify({ project: goal.projectKey, brief })}\n`));
  assert.ok(run(payload('resume')).endsWith(`resume_project ${JSON.stringify({ project: goal.projectKey, brief })}\n`));
});

test('SessionStart and PreCompact resolve the project root from a subdirectory or stdin cwd without sh', () => {
  const dir = mkdtempSync(join(tmpdir(), 'seedup-hook-root-'));
  const outside = mkdtempSync(join(tmpdir(), 'seedup-hook-outside-'));
  const sub = join(dir, 'packages', 'web', 'src');
  mkdirSync(sub, { recursive: true });
  writeBundle(dir);
  initGitRepo(dir);

  const claude = hookSettings();
  const codex = codexHookSettings();

  // Launched from a nested subdirectory with no CLAUDE_PROJECT_DIR (Codex path).
  const startFromSub = runHookCommand(codex.hooks.SessionStart[0].hooks[0].command, {
    cwd: sub,
    input: JSON.stringify({ source: 'clear', cwd: sub, hook_event_name: 'SessionStart' }),
  });
  assert.equal(startFromSub.status, 0);
  assert.match(startFromSub.stdout, /Renters never miss rent/);
  const codexAfterCompact = runHookCommand(codex.hooks.SessionStart[0].hooks[0].command, {
    cwd: sub,
    input: JSON.stringify({ source: 'compact', cwd: sub, hook_event_name: 'SessionStart' }),
  });
  assert.equal(codexAfterCompact.status, 0);
  assert.match(codexAfterCompact.stdout, /대화가 압축되었습니다.*resume_project/);

  // Launched from outside the repo, locating root via stdin JSON cwd.
  const startFromOutside = runHookCommand(claude.hooks.SessionStart[0].hooks[0].command, {
    cwd: outside,
    input: JSON.stringify({ source: 'fork', cwd: sub, hook_event_name: 'SessionStart' }),
  });
  assert.equal(startFromOutside.status, 0);
  assert.match(startFromOutside.stdout, /Renters never miss rent/);

  // Missing .seedup/hook.mjs exits cleanly with a helpful notice on SessionStart.
  const missingHook = runHookCommand(claude.hooks.SessionStart[0].hooks[0].command, {
    cwd: outside,
    input: JSON.stringify({ source: 'startup', cwd: outside, hook_event_name: 'SessionStart' }),
  });
  assert.equal(missingHook.status, 0);
  assert.match(missingHook.stdout, /\.seedup\/hook\.mjs/);

  // Real shell invocation of the exact settings.json command string (verifies quoting end-to-end on Unix).
  if (process.platform !== 'win32') {
    const viaShell = spawnSync('sh', ['-c', claude.hooks.SessionStart[0].hooks[0].command], {
      cwd: sub,
      input: JSON.stringify({ source: 'compact', cwd: sub, hook_event_name: 'SessionStart' }),
      encoding: 'utf8',
    });
    assert.equal(viaShell.status, 0, viaShell.stderr);
    assert.match(viaShell.stdout, /Renters never miss rent/);
    assert.match(viaShell.stdout, /대화가 압축되었습니다.*resume_project/);
  }

  const claudePreCompact = runHookCommand(claude.hooks.PreCompact[0].hooks[0].command, {
    cwd: sub,
    input: JSON.stringify({ trigger: 'auto', custom_instructions: null, cwd: sub, hook_event_name: 'PreCompact' }),
  });
  assert.equal(claudePreCompact.status, 0, claudePreCompact.stderr);
  assert.match(claudePreCompact.stdout, /하던 일과 다음 할 일을 압축 요약에 남기세요/);
  assert.doesNotMatch(claudePreCompact.stdout, /^\{/);

  // Codex PreCompact accepts an informational warning as universal hook JSON.
  const preCompact = runHookCommand(codex.hooks.PreCompact[0].hooks[0].command, {
    cwd: sub,
    input: JSON.stringify({ trigger: 'auto', cwd: sub, hook_event_name: 'PreCompact' }),
  });
  assert.equal(preCompact.status, 0);
  const compactOut = JSON.parse(preCompact.stdout) as { continue: boolean; systemMessage: string };
  assert.equal(compactOut.continue, true);
  assert.match(compactOut.systemMessage, /save_handoff/);
  assert.match(compactOut.systemMessage, new RegExp(goal.projectKey));
});

test('Stop hook parses stop_hook_active structurally, catches upstream-less commits, and stays silent when pushed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'seedup-hook-stop-'));
  const remote = mkdtempSync(join(tmpdir(), 'seedup-hook-remote-'));
  const sub = join(dir, 'apps', 'api');
  mkdirSync(sub, { recursive: true });
  writeBundle(dir);
  initGitRepo(dir);
  execFileSync('git', ['init', '--bare', '-q'], { cwd: remote });
  execFileSync('git', ['remote', 'add', 'origin', remote], { cwd: dir });

  const stopCmd = hookSettings().hooks.Stop[0].hooks[0].command;
  const runStop = (input: string, cwd = sub) => runHookCommand(stopCmd, { cwd, input });

  // 1. Dirty worktree blocks once; a string mention inside last_assistant_message must NOT bypass structural parsing.
  const spoofed = JSON.stringify({
    cwd: sub,
    stop_hook_active: false,
    last_assistant_message: 'Earlier text mentioned "stop_hook_active":true as an example.',
  });
  const first = JSON.parse(runStop(spoofed).stdout) as { decision: string; reason: string };
  assert.equal(first.decision, 'block');
  assert.match(first.reason, /save_handoff/);

  // 2. Formatted multiline JSON with stop_hook_active: true allows the retry through without looping.
  const multilineActive = '{\n  "cwd": ' + JSON.stringify(sub) + ',\n  "stop_hook_active" :\n    true\n}';
  assert.equal(runStop(multilineActive).stdout, '');

  // 3. Clean tree with a local commit on a branch that has NO upstream is still treated as unpushed.
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'local only commit'], { cwd: dir });
  const unpushedNoUpstream = JSON.parse(runStop(JSON.stringify({ cwd: sub, stop_hook_active: false })).stdout) as { decision: string; reason: string };
  assert.equal(unpushedNoUpstream.decision, 'block');
  assert.match(unpushedNoUpstream.reason, /save_handoff/);

  // 4. Once pushed to origin with upstream tracking, a clean branch passes silently.
  const branch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim();
  execFileSync('git', ['push', '-q', '-u', 'origin', branch], { cwd: dir });
  assert.equal(runStop(JSON.stringify({ cwd: sub, stop_hook_active: false })).stdout, '');

  // 5. A fresh local branch without upstream at the same commit as origin/<branch> does NOT false-alarm; one new commit DOES block.
  execFileSync('git', ['checkout', '-q', '-b', 'feat/no-upstream'], { cwd: dir });
  assert.equal(runStop(JSON.stringify({ cwd: sub, stop_hook_active: false })).stdout, '');
  writeFileSync(join(dir, 'extra.txt'), 'work\n');
  execFileSync('git', ['add', 'extra.txt'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'unpushed feature commit'], { cwd: dir });
  const featureUnpushed = JSON.parse(runStop(JSON.stringify({ cwd: sub, stop_hook_active: false })).stdout) as { decision: string };
  assert.equal(featureUnpushed.decision, 'block');
});
