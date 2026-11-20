// Layer 3 of the agent link (docs/supervisor-plan.md 3-2): Claude Code hooks that run whether or not the agent thinks
// to call Seedup. Session start (and after a compaction) puts the locked goal and the next-task instruction back into
// context; stopping with unsaved or unpushed work asks once for a handoff note; pre-commit runs the stage-1 static check
// (plan 3-4) on the staged lines and stops a commit with a blocker. Files only, no network and no token:
// the goal is a snapshot of the locked version, and the agent asks the MCP server for anything live.
// shortcut: Claude Code only; Codex reads AGENTS.md (A2) until its hook format is confirmed (plan 9).
import { goalSummary } from './goal';
import { localAuditScript } from './local-audit';
import type { HumanTask, ProjectGoal, ProjectKey } from './types';

export type BundleFile = { path: string; content: string; executable?: boolean };

const GOAL_FILE = '.seedup/goal.md';

// Keys go into shell scripts and JSON as is, so only the two key shapes of plan 3-3 are accepted.
const SAFE_KEY = /^(prd:[0-9a-f-]{36}|[a-z0-9][a-z0-9-]{0,119})$/i;

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
    '## 커밋 전 검사 켜기',
    '커밋하기 전에 추가된 줄을 검사합니다(시크릿, 건너뛴 테스트, not implemented 예외는 커밋을 막고, 나머지는 경고만). Node가 있어야 합니다.',
    '이미 pre-commit 훅이 없다면 한 번만 실행하세요: `cp .seedup/pre-commit.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`',
    '이미 있다면(husky 등) 그 훅 끝에 `sh .seedup/pre-commit.sh` 한 줄을 더하세요.',
    '의도한 예외는 그 줄이나 바로 윗줄에 `// seedup-allow: <코드> <이유>`를 적습니다.',
    '',
  ].join('\n');
}

const SESSION_START = `#!/bin/sh
# Seedup: prints the locked goal into the session (start, resume, after compaction).
cat ${GOAL_FILE} 2>/dev/null || echo "Seedup 목표 파일(${GOAL_FILE})이 없습니다. Seedup에서 훅 묶음을 다시 받으세요."
exit 0
`;

const PRE_COMMIT = `#!/bin/sh
# Seedup stage-1 local check: staged added lines only. Blockers stop the commit, warnings only print.
command -v node >/dev/null 2>&1 || { echo "Seedup: node가 없어 커밋 전 검사를 건너뜁니다."; exit 0; }
git diff --cached -U0 --no-color | node .seedup/audit.mjs
`;

/**
 * Stop hook: when work is uncommitted or unpushed, block the stop once and ask for a handoff note. Claude Code sets
 * stop_hook_active on the retry, so the second stop always goes through and the session cannot loop.
 */
const stopScript = (projectKey: ProjectKey) => `#!/bin/sh
# Seedup: asks for a handoff before a session ends with work the server has not seen.
input=$(cat)
case "$input" in *'"stop_hook_active":true'*|*'"stop_hook_active": true'*) exit 0 ;; esac
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
dirty=$(git status --porcelain 2>/dev/null | head -n 1)
unpushed=$(git log --oneline @{u}..HEAD 2>/dev/null | head -n 1)
blockers=0
if command -v node >/dev/null 2>&1 && [ -f .seedup/audit.mjs ]; then
  blockers=$(git diff HEAD -U0 --no-color 2>/dev/null | node .seedup/audit.mjs --count 2>/dev/null)
  case "$blockers" in ''|*[!0-9]*) blockers=0 ;; esac
fi
[ -z "$dirty" ] && [ -z "$unpushed" ] && [ "$blockers" = 0 ] && exit 0
audit=''
[ "$blockers" != 0 ] && audit="커밋 전 검사에서 차단 항목 $blockers개가 나왔습니다(git diff HEAD | node .seedup/audit.mjs로 확인). 먼저 고치세요. "
printf '{"decision":"block","reason":"%s커밋하지 않았거나 push하지 않은 변경이 있으면 끝내기 전에 Seedup MCP의 save_handoff로 하던 일, 다음 할 일, 주의할 점, 검증 안 된 커밋을 남기세요(프로젝트 ${projectKey}). 도구가 없으면 사용자에게 요약해 주세요."}\\n' "$audit"
exit 0
`;

/** The hooks block to merge into the project's .claude/settings.json (existing hooks there stay; merge by hand). */
export function hookSettings() {
  return {
    hooks: {
      SessionStart: [{ matcher: 'startup|resume|compact', hooks: [{ type: 'command', command: 'sh .seedup/session-start.sh' }] }],
      Stop: [{ hooks: [{ type: 'command', command: 'sh .seedup/stop.sh' }] }],
    },
  };
}

/** Files for the starter pack (/agents, stage 2 B2): the goal snapshot, the hook scripts, the local check and the settings block. */
export function hookBundle(projectKey: ProjectKey, goal: ProjectGoal, tasks: HumanTask[] = []): BundleFile[] {
  if (!SAFE_KEY.test(projectKey)) throw new Error(`Not a project key: ${projectKey}`);
  return [
    { path: GOAL_FILE, content: goalFile(projectKey, goal, tasks) },
    { path: '.seedup/session-start.sh', content: SESSION_START, executable: true },
    { path: '.seedup/stop.sh', content: stopScript(projectKey), executable: true },
    { path: '.seedup/pre-commit.sh', content: PRE_COMMIT, executable: true },
    { path: '.seedup/audit.mjs', content: localAuditScript() },
    { path: '.claude/settings.json', content: `${JSON.stringify(hookSettings(), null, 2)}\n` },
  ];
}
