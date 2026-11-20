// Layer 3 of the agent link (docs/supervisor-plan.md 3-2): Claude Code hooks that run whether or not the agent thinks
// to call Seedup. Session start (and after a compaction) puts the locked goal and the next-task instruction back into
// context; stopping with unsaved or unpushed work asks once for a handoff note. Files only, no network and no token:
// the goal is a snapshot of the locked version, and the agent asks the MCP server for anything live.
// shortcut: Claude Code only; Codex reads AGENTS.md (A2) until its hook format is confirmed (plan 9).
import { goalSummary } from './goal';
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
  ].join('\n');
}

const SESSION_START = `#!/bin/sh
# Seedup: prints the locked goal into the session (start, resume, after compaction).
cat ${GOAL_FILE} 2>/dev/null || echo "Seedup 목표 파일(${GOAL_FILE})이 없습니다. Seedup에서 훅 묶음을 다시 받으세요."
exit 0
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
[ -z "$dirty" ] && [ -z "$unpushed" ] && exit 0
printf '%s\\n' '{"decision":"block","reason":"커밋하지 않았거나 push하지 않은 변경이 있습니다. 끝내기 전에 Seedup MCP의 save_handoff로 하던 일, 다음 할 일, 주의할 점, 검증 안 된 커밋을 남기세요(프로젝트 ${projectKey}). 도구가 없으면 사용자에게 요약해 주세요."}'
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

/** Files for the starter pack (/agents, stage 2 B2): the goal snapshot, two hook scripts and the settings block. */
export function hookBundle(projectKey: ProjectKey, goal: ProjectGoal, tasks: HumanTask[] = []): BundleFile[] {
  if (!SAFE_KEY.test(projectKey)) throw new Error(`Not a project key: ${projectKey}`);
  return [
    { path: GOAL_FILE, content: goalFile(projectKey, goal, tasks) },
    { path: '.seedup/session-start.sh', content: SESSION_START, executable: true },
    { path: '.seedup/stop.sh', content: stopScript(projectKey), executable: true },
    { path: '.claude/settings.json', content: `${JSON.stringify(hookSettings(), null, 2)}\n` },
  ];
}
