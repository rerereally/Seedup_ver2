// Layer 3 of the agent link (docs/supervisor-plan.md 3-2): Claude Code and Codex hooks that run whether or not the
// agent thinks to call Seedup. Session start (and resume/clear/compact/fork) puts the locked goal and the next-task
// instruction back into context; pre-compact asks Claude to preserve the handoff in its summary or warns in Codex;
// stopping with unsaved, unpushed, or blocked work asks once for a handoff note; pre-commit runs the stage-1 static
// check (plan 3-4) on staged lines and stops a commit with a blocker. Usage uploads are opt-in:
// the goal is a snapshot of the locked version, and the agent asks the MCP server for anything live.
// Hook commands run through Node (.seedup/hook.mjs) so macOS, Linux and Windows share one bundle without needing sh.
import { claudeCodeUsage } from '../../scripts/usage/claude-code';
import { codexUsage } from '../../scripts/usage/codex';
import { goalSummary } from './goal';
import { localAuditScript } from './local-audit';
import type { HumanTask, ProjectGoal, ProjectKey } from './types';

export type BundleFile = { path: string; content: string; executable?: boolean };

const GOAL_FILE = '.seedup/goal.md';
const HOOK_SCRIPT = '.seedup/hook.mjs';
const SESSION_START_MATCHER = 'startup|resume|clear|compact|fork';
const PRE_COMPACT_MATCHER = 'manual|auto';

// Keys go into generated scripts and JSON as is, so only the two key shapes of plan 3-3 are accepted.
const SAFE_KEY = /^(prd:[0-9a-f-]{36}|[a-z0-9][a-z0-9-]{0,119})$/i;

type HookEvent = 'session-start' | 'pre-compact' | 'stop';

/**
 * Cross-shell Node bootstrap command (no $, %, backticks, backslashes, ! or inner double quotes) so Claude Code and
 * Codex can launch .seedup/hook.mjs from any subdirectory on macOS, Linux and Windows (cmd, PowerShell, sh) without sh.
 */
function hookCommand(event: HookEvent, useClaudeDir: boolean) {
  const roots = useClaudeDir
    ? '[process.env.CLAUDE_PROJECT_DIR,c,process.cwd()]'
    : '[c,process.cwd()]';
  const missing = event === 'session-start'
    ? "else{console.log('Seedup 훅 파일(.seedup/hook.mjs)이 없습니다. Seedup에서 훅 묶음을 다시 받으세요.')}"
    : '';
  const eventArg = !useClaudeDir ? '' : event === 'stop' ? ",'--claude'" : event === 'pre-compact' ? ",'--summary'" : '';
  const body = [
    "const fs=require('fs'),p=require('path'),cp=require('child_process');",
    "let s='';try{s=process.stdin.isTTY?'':fs.readFileSync(0,'utf8')}catch{}",
    "let c='';try{const j=JSON.parse(s);if(j&&typeof j.cwd==='string')c=j.cwd}catch{}",
    `let f='';for(const b of ${roots}.filter(Boolean)){`,
    "for(let d=p.resolve(b);;){const t=p.join(d,'.seedup','hook.mjs');if(fs.existsSync(t)){f=t;break}const u=p.dirname(d);if(u===d)break;d=u}",
    'if(f)break}',
    `if(f){process.exit(cp.spawnSync(process.execPath,[f,'${event}'${eventArg}],{input:s,stdio:['pipe','inherit','inherit']}).status??0)}${missing}`,
  ].join('');
  return `node -e "${body}"`;
}

/** The goal snapshot the session-start hook prints. Plain text, safe to commit: it holds no secret. */
function goalFile(projectKey: ProjectKey, goal: ProjectGoal, tasks: HumanTask[]) {
  const pending = tasks.filter((task) => !task.done);
  return [
    `# Seedup 목표 (프로젝트 ${projectKey})`,
    '',
    goalSummary(goal),
    '',
    `세션을 시작하면 Seedup MCP의 get_next_task를 slug ${JSON.stringify(projectKey)}로 먼저 부르고, 그 기능 하나만 만드세요.`,
    '하지 않는 것에 해당하거나 성공 기준과 무관한 작업이면 시작하기 전에 사용자에게 물어보세요.',
    `이 파일은 목표 v${goal.version}의 사본입니다. 목표가 바뀌면 Seedup에서 훅 묶음을 다시 받으세요.`,
    ...(pending.length ? ['', '## 사람이 먼저 할 일', ...pending.map((task) => `- ${task.id} ${task.title}${task.envVars.length ? ` (키 이름: ${task.envVars.join(', ')})` : ''}`)] : []),
    '',
    '## 에이전트 훅 켜기 (Claude Code · Codex · Windows)',
    '훅은 sh 없이 Node로 `.seedup/hook.mjs`를 실행하므로 macOS · Linux · Windows에서 같은 묶음을 씁니다(Node 필요).',
    '- Claude Code: `.claude/settings.json`을 저장소에 넣거나 기존 `hooks`에 합치세요.',
    '- Codex CLI: `.codex/hooks.json`을 저장소에 넣은 뒤, 세션에서 `/hooks`를 열어 현재 훅 정의를 검토하고 신뢰해야 실행됩니다.',
    '',
    '## 사용량 업로드 (선택) / Usage upload (optional)',
    '업로드하려면 터미널 환경 변수 `SEEDUP_USAGE_TOKEN`에 본인의 Seedup MCP 토큰을 설정하세요. 토큰은 묶음에 들어 있지 않습니다.',
    'To opt in, set `SEEDUP_USAGE_TOKEN` to your personal Seedup MCP token in your shell. The bundle contains no token.',
    '- Claude Code: 위 설정을 넣으면 Stop 훅에서 업로드합니다. / With the settings above, the Stop hook uploads usage.',
    '- Codex: 프로젝트 루트에서 `node .seedup/usage.mjs codex`를 실행하세요. / Run `node .seedup/usage.mjs codex` at the project root.',
    '토큰 수, 모델, 집계에 필요한 프로젝트 · 세션 ID와 시각만 보냅니다. 대화 내용, 파일 경로, 코드는 보내지 않습니다.',
    'Only token counts, model, project and session IDs, and timestamps are uploaded. Conversation content, file paths, and code stay local.',
    '',
    '## 커밋 전 검사 켜기',
    '커밋하기 전에 추가된 줄을 검사합니다(시크릿, 건너뛴 테스트, not implemented 예외는 커밋을 막고, 나머지는 경고만). Node가 있어야 합니다.',
    '이미 pre-commit 훅이 없다면 한 번만 실행하세요: `cp .seedup/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`',
    '이미 있거나(husky 등) sh가 없는 Windows 환경이라면 커밋 전 훅에 `node .seedup/hook.mjs pre-commit` 한 줄을 더하세요.',
    '의도한 예외는 그 줄이나 바로 윗줄에 `// seedup-allow: <코드> <이유>`를 적습니다.',
    '',
  ].join('\n');
}

const PRE_COMMIT = `#!/bin/sh
# Seedup stage-1 local check: staged added lines only. Blockers stop the commit, warnings only print.
command -v node >/dev/null 2>&1 || { echo "Seedup: node가 없어 커밋 전 검사를 건너뜁니다."; exit 0; }
root=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
[ -f "$root/.seedup/audit.mjs" ] || { echo "Seedup: $root/.seedup/audit.mjs가 없어 커밋 전 검사를 건너뜁니다."; exit 0; }
git -C "$root" diff --cached -U0 --no-color | node "$root/.seedup/audit.mjs"
`;

/**
 * Standalone Node hook runner for SessionStart, PreCompact, Stop and pre-commit.
 * - Parses stdin JSON structurally (stop_hook_active === true stops retries cleanly).
 * - Resolves the project root from hook payload cwd / CLAUDE_PROJECT_DIR / git toplevel / parent directories.
 * - Treats commits on branches without an upstream (not reachable from any remote) as unpushed.
 */
function hookScript(projectKey: ProjectKey) {
  return `#!/usr/bin/env node
// Seedup local hooks (session-start, pre-compact, stop, pre-commit). Usage upload requires explicit opt-in.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT_KEY = ${JSON.stringify(projectKey)};
const GOAL_REL = ${JSON.stringify(GOAL_FILE)};
const AUDIT_REL = '.seedup/audit.mjs';

function readStdin() {
  if (process.stdin.isTTY) return '';
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function parsePayload(raw) {
  if (!raw || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function gitRun(cwd, args) {
  return spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
}

function gitTop(dir) {
  if (!dir || !existsSync(dir)) return '';
  const res = gitRun(dir, ['rev-parse', '--show-toplevel']);
  return res.status === 0 ? res.stdout.trim() : '';
}

function walkSeedup(start) {
  if (!start || !existsSync(start)) return '';
  for (let dir = resolve(start); ; ) {
    if (existsSync(join(dir, GOAL_REL)) || existsSync(join(dir, '.seedup', 'hook.mjs'))) return dir;
    const parent = dirname(dir);
    if (parent === dir) return '';
    dir = parent;
  }
}

function resolveRoot(payload) {
  const fromPayload = typeof payload.cwd === 'string' && payload.cwd && existsSync(payload.cwd) ? payload.cwd : '';
  if (fromPayload) return gitTop(fromPayload) || walkSeedup(fromPayload) || resolve(fromPayload);
  const fromEnv = process.env.CLAUDE_PROJECT_DIR && existsSync(process.env.CLAUDE_PROJECT_DIR) ? process.env.CLAUDE_PROJECT_DIR : '';
  if (fromEnv) return gitTop(fromEnv) || walkSeedup(fromEnv) || resolve(fromEnv);
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  if (basename(scriptDir) === '.seedup') {
    const projectDir = dirname(scriptDir);
    return gitTop(projectDir) || projectDir;
  }
  const cwd = process.cwd();
  return gitTop(cwd) || walkSeedup(cwd) || cwd;
}

function isGitWorkTree(root) {
  const res = gitRun(root, ['rev-parse', '--is-inside-work-tree']);
  return res.status === 0 && res.stdout.trim() === 'true';
}

function hasHead(root) {
  return gitRun(root, ['rev-parse', '--verify', 'HEAD']).status === 0;
}

function hasDirty(root) {
  const res = gitRun(root, ['status', '--porcelain']);
  return res.status === 0 && res.stdout.trim().length > 0;
}

function hasUnpushed(root) {
  if (!hasHead(root)) return false;
  const upstream = gitRun(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}']);
  if (upstream.status === 0 && upstream.stdout.trim()) {
    const ahead = gitRun(root, ['log', '--oneline', '@{u}..HEAD', '-n', '1']);
    return ahead.status === 0 && ahead.stdout.trim().length > 0;
  }
  const localOnly = gitRun(root, ['log', '--oneline', 'HEAD', '--not', '--remotes', '-n', '1']);
  return localOnly.status === 0 && localOnly.stdout.trim().length > 0;
}

function auditBlockerCount(root) {
  const auditPath = join(root, AUDIT_REL);
  if (!existsSync(auditPath)) return 0;
  const diffArgs = hasHead(root) ? ['diff', 'HEAD', '-U0', '--no-color'] : ['diff', '--cached', '-U0', '--no-color'];
  const diff = gitRun(root, diffArgs);
  if (diff.status !== 0 || !diff.stdout) return 0;
  const res = spawnSync(process.execPath, [auditPath, '--count'], { input: diff.stdout, encoding: 'utf8' });
  const count = Number.parseInt((res.stdout || '').trim(), 10);
  return Number.isFinite(count) && count > 0 ? count : 0;
}

function runSessionStart(root, payload) {
  const goalPath = join(root, GOAL_REL);
  const context = existsSync(goalPath)
    ? readFileSync(goalPath, 'utf8')
    : \`Seedup 목표 파일(\${GOAL_REL})이 없습니다. Seedup에서 훅 묶음을 다시 받으세요.\\n\`;
  process.stdout.write(context);
  if (payload.source === 'compact' || payload.source === 'resume') {
    const reason = payload.source === 'compact' ? '대화가 압축되었습니다.' : '대화가 재개되었습니다.';
    const newline = context.endsWith('\\n') ? '' : '\\n';
    process.stdout.write(\`\${newline}\${reason} 작업을 이어가기 전에 Seedup MCP의 resume_project(프로젝트 \${PROJECT_KEY})를 호출해 마지막 인계, 최근 결정, 진행 상태를 확인하세요.\\n\`);
    try {
      const brief = readFileSync(join(root, 'AGENTS.md'), 'utf8').match(/^<!-- Seedup brief: project=[a-z0-9:-]{1,120} goal=(?:[0-9]+|none) prd=[a-f0-9]{16} -->$/im)?.[0];
      if (brief) process.stdout.write(\`버전 확인을 위해 이 인자로 호출하세요. resume_project \${JSON.stringify({ project: PROJECT_KEY, brief })}\\n\`);
    } catch { /* Older setups may have no AGENTS.md yet. */ }
  }
}

// shortcut: Codex PreCompact only surfaces the warning, add summary instructions when Codex supports them.
function runPreCompact(root, summary) {
  const notes = [];
  if (isGitWorkTree(root)) {
    if (hasDirty(root)) notes.push('커밋하지 않은 변경');
    if (hasUnpushed(root)) notes.push('push하지 않은 커밋');
    const blockers = auditBlockerCount(root);
    if (blockers > 0) notes.push(\`정적 검사 차단 항목 \${blockers}개\`);
  }
  const prefix = notes.length ? \`현재 \${notes.join(', ')}이 남아 있습니다. \` : '';
  if (summary) {
    process.stdout.write(\`\${prefix}하던 일과 다음 할 일을 압축 요약에 남기세요(프로젝트 \${PROJECT_KEY}).\\n\`);
    return;
  }
  const message = \`\${prefix}대화 압축 전에 Seedup MCP의 save_handoff로 하던 일, 다음 할 일, 주의할 점, 검증 안 된 커밋을 남기세요(프로젝트 \${PROJECT_KEY}). 압축 뒤에는 \${GOAL_REL}이 다시 주입됩니다.\`;
  process.stdout.write(\`\${JSON.stringify({ continue: true, systemMessage: message })}\\n\`);
}

function runStop(root, payload) {
  if (payload.stop_hook_active === true) return;
  if (!isGitWorkTree(root)) return;
  if (process.argv[3] === '--claude' && process.env.SEEDUP_USAGE_TOKEN && typeof payload.transcript_path === 'string') {
    const collector = join(root, '.seedup', 'usage.mjs');
    if (existsSync(collector)) spawnSync(process.execPath, [collector, 'claude-code'], {
      input: JSON.stringify({ transcript_path: payload.transcript_path, session_id: payload.session_id }),
      stdio: ['pipe', 'ignore', 'inherit'], timeout: 20_000,
    });
  }
  const dirty = hasDirty(root);
  const unpushed = hasUnpushed(root);
  const blockers = auditBlockerCount(root);
  if (!dirty && !unpushed && blockers === 0) return;
  const audit = blockers > 0
    ? \`커밋 전 검사에서 차단 항목 \${blockers}개가 나왔습니다(git diff HEAD | node .seedup/audit.mjs로 확인). 먼저 고치세요. \`
    : '';
  const reason = \`\${audit}커밋하지 않았거나 push하지 않은 변경이 있으면 끝내기 전에 Seedup MCP의 save_handoff로 하던 일, 다음 할 일, 주의할 점, 검증 안 된 커밋을 남기세요(프로젝트 \${PROJECT_KEY}). 도구가 없으면 사용자에게 요약해 주세요.\`;
  process.stdout.write(\`\${JSON.stringify({ decision: 'block', reason })}\\n\`);
}

function runPreCommit(root) {
  const auditPath = join(root, AUDIT_REL);
  if (!existsSync(auditPath)) {
    console.log(\`Seedup: \${auditPath}가 없어 커밋 전 검사를 건너뜁니다.\`);
    return;
  }
  const diff = gitRun(root, ['diff', '--cached', '-U0', '--no-color']);
  if (diff.status !== 0) {
    process.exitCode = diff.status ?? 1;
    return;
  }
  const res = spawnSync(process.execPath, [auditPath], { input: diff.stdout, stdio: ['pipe', 'inherit', 'inherit'] });
  process.exitCode = res.status ?? 0;
}

const command = process.argv[2] || '';
if (command === 'pre-commit') {
  runPreCommit(resolveRoot({}));
} else {
  const payload = parsePayload(readStdin());
  const root = resolveRoot(payload);
  if (command === 'session-start') runSessionStart(root, payload);
  else if (command === 'pre-compact') runPreCompact(root, process.argv[3] === '--summary');
  else if (command === 'stop') runStop(root, payload);
}
`;
}

/** The hooks block to merge into the project's .claude/settings.json (existing hooks there stay; merge by hand). */
export function hookSettings() {
  return {
    hooks: {
      SessionStart: [{ matcher: SESSION_START_MATCHER, hooks: [{ type: 'command', command: hookCommand('session-start', true) }] }],
      PreCompact: [{ matcher: PRE_COMPACT_MATCHER, hooks: [{ type: 'command', command: hookCommand('pre-compact', true) }] }],
      Stop: [{ hooks: [{ type: 'command', command: hookCommand('stop', true) }] }],
    },
  };
}

/** The hooks config for trusted Codex CLI projects (.codex/hooks.json). Users must review and trust hooks in /hooks. */
export function codexHookSettings() {
  return {
    hooks: {
      SessionStart: [{ matcher: SESSION_START_MATCHER, hooks: [{ type: 'command', command: hookCommand('session-start', false) }] }],
      PreCompact: [{ matcher: PRE_COMPACT_MATCHER, hooks: [{ type: 'command', command: hookCommand('pre-compact', false) }] }],
      Stop: [{ hooks: [{ type: 'command', command: hookCommand('stop', false) }] }],
    },
  };
}

/** Files for the starter pack (/agents, stage 2 B2): goal snapshot, Node hook runner, pre-commit wrapper, local check, and Claude/Codex hook configs. */
export function hookBundle(projectKey: ProjectKey, goal: ProjectGoal, tasks: HumanTask[] = []): BundleFile[] {
  if (!SAFE_KEY.test(projectKey)) throw new Error(`Not a project key: ${projectKey}`);
  return [
    { path: GOAL_FILE, content: goalFile(projectKey, goal, tasks) },
    { path: HOOK_SCRIPT, content: hookScript(projectKey), executable: true },
    { path: '.seedup/pre-commit.sh', content: PRE_COMMIT, executable: true },
    { path: '.seedup/audit.mjs', content: localAuditScript() },
    { path: '.claude/settings.json', content: `${JSON.stringify(hookSettings(), null, 2)}\n` },
    { path: '.codex/hooks.json', content: `${JSON.stringify(codexHookSettings(), null, 2)}\n` },
    { path: '.seedup/usage.mjs', content: usageScript(projectKey) },
  ];
}

function usageScript(projectKey: ProjectKey) {
  const site = URL.parse(process.env.NEXT_PUBLIC_SITE_URL || '')?.origin ?? 'https://seedup.rerereally.com';
  return `#!/usr/bin/env node
// Opt-in upload. Only token counts, model, project/session IDs and timestamps leave this machine.
// Conversation content, file paths and code stay local. The bundle contains no credentials.
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PROJECT = ${JSON.stringify(projectKey)};
const SITE = ${JSON.stringify(site)};
` + String.raw`
const configuredToken = process.env.SEEDUP_USAGE_TOKEN;
const token = /^sdp_[a-f0-9]{48}$/i.test(configuredToken || '') ? configuredToken : null;
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const CHECKPOINT_DIR = join(homedir(), '.seedup', 'usage');
const isSession = (value) => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
const isModel = (value) => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,123}(?:\[1m\])?$/.test(value);
const count = (value) => Number.isInteger(value) && value >= 0 && value <= 2_147_483_647;

function* jsonLines(file) {
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    try {
      const value = JSON.parse(line);
      if (value && typeof value === 'object') yield value;
    } catch { /* A log can end with an incomplete line while the client is writing. */ }
  }
}

function usageRow(ts, model, input, output, reads = 0, writes = 0) {
  if (typeof ts !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/.test(ts)
    || !Number.isFinite(Date.parse(ts)) || !isModel(model) || ![input, output, reads, writes].every(count)) return null;
  const instant = ts.slice(0, 19) + '.' + (ts.slice(19, -1).replace(/^\./, '')).slice(0, 6).padEnd(6, '0') + 'Z';
  return { ts: instant, model, input_tokens: input, output_tokens: output, cache_read_tokens: reads, cache_write_tokens: writes };
}
` + claudeCodeUsage + codexUsage + String.raw`
async function upload(source, session) {
  const url = new URL('/api/usage', SITE);
  if (url.protocol !== 'https:') throw new Error('invalid endpoint');
  const id = createHash('sha256').update(JSON.stringify([url.origin, token, PROJECT, source, session.id])).digest('hex');
  const state = join(CHECKPOINT_DIR, id + '.json');
  const acknowledged = new Set(existsSync(state) ? JSON.parse(readFileSync(state, 'utf8')) : []);
  const keyOf = (row) => row.ts + '/' + row.model;
  const pending = session.rows.filter((row) => !acknowledged.has(keyOf(row)));
  for (let index = 0; index < pending.length; index += 500) {
    const rows = pending.slice(index, index + 500);
    const response = await fetch(url, {
      method: 'POST', redirect: 'manual', signal: AbortSignal.timeout(8000),
      headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
      body: JSON.stringify({ project: PROJECT, source, session_id: session.id, rows }),
    });
    if (!response.ok) throw new Error('upload failed');
    for (const row of rows) acknowledged.add(keyOf(row));
    mkdirSync(CHECKPOINT_DIR, { recursive: true, mode: 0o700 });
    const tmp = state + '.' + randomUUID();
    writeFileSync(tmp, JSON.stringify([...acknowledged]), { mode: 0o600 });
    renameSync(tmp, state);
  }
}

try {
  if (token && process.argv[2] === 'claude-code') {
    const session = claudeSession(JSON.parse(readFileSync(0, 'utf8')));
    if (session?.rows.length) await upload('claude_code', session);
  } else if (token && process.argv[2] === 'codex') {
    const logs = join(process.env.CODEX_HOME || join(homedir(), '.codex'), 'sessions');
    if (existsSync(logs)) {
      for (const file of codexLogs(logs)) {
        const session = codexSession(file, ROOT);
        if (session?.rows.length) await upload('codex', session);
      }
    }
  }
} catch {
  console.error('Seedup: 사용량을 보내지 못했습니다. 다음 실행에서 다시 시도합니다. / Usage upload failed. The next run will retry.');
  process.exitCode = 1;
}
`;
}
