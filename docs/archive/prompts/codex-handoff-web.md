# Codex 시작 프롬프트: 기획 → 에이전트 연결 1단계 (에이전트 단계 화면)

계획 세션(장차희)이 범위를 정하고 Codex(GPT 6.1 Sol, high)가 구현합니다. 리뷰 · 머지는 정지훈. 계획은 [supervisor-plan.md](../../supervisor-plan.md) 5절 "기획 → 에이전트 연결" 1단계, 설계는 3-2 · 3-11절, 화면 · 문구는 [DESIGN.md](../../../DESIGN.md)(2절 토큰, 8절 응답 형식).

## 실행 방식

- 계획 세션이 `origin/main`에서 별도 worktree(`feat/handoff-agent-step`)를 만들고 `codex exec`로 넘깁니다. Codex는 로컬 변경까지만 하고, 커밋 · push · PR은 계획 세션이 diff를 확인한 뒤 합니다.

## 붙여 넣을 프롬프트

```
너는 Seedup 저장소의 "기획 → 에이전트 연결 1단계" 구현자다. 계획 세션이 정한 범위 안에서만 일한다.

[먼저 읽기 — 이것만]
AGENTS.md, CONTRIBUTING.md, DESIGN.md(2절, 8절), docs/supervisor-plan.md의 3-2 · 3-11 · 5절 "기획 → 에이전트 연결".
기존 코드: components/IdeaWorkspace.tsx(projectKey 'prd:<id>', goalLocked, 진행 표시줄의 '에이전트' 단계), components/goal/GoalLock.tsx(목표 잠금, humanTasks로 사람이 먼저 할 일),
components/McpConnect.tsx, components/AgentPackDownload.tsx, app/agents/page.tsx(이 두 부품을 쓰는 방식),
components/opportunity-stage/PrdBuilder.tsx(agentSlug, agentPrompt, renderAgentBrief 호출), lib/opportunities/spec.ts의 renderAgentBrief(context.goal 지원),
app/api/projects/[key]/goal/route.ts(GET 잠긴 목표).
Next.js 코드를 쓰기 전에 AGENTS.md 지시대로 node_modules/next/dist/docs/에서 쓰려는 API 문서를 확인해.

[만들 것]
1. 에이전트 단계 화면: 목표를 잠그면(goalLocked) 진행 표시줄의 "에이전트" 단계에서 아래를 보여 줘. 새 컴포넌트는 components/goal/AgentHandoff.tsx 하나로.
   - 프로젝트 키(projectKey)와 /supervisor/<키> 링크(키는 URL 인코딩).
   - 시작 문장 복사 버튼(가장 눈에 띄게). 문장은 정확히 이 형식(한국어 · 영어, 기존 translator 관행):
     "Seedup 프로젝트 <키>를 이어서 진행해. resume_project {"project":"<키>"}로 잠긴 목표와 사람이 먼저 할 일을 확인하고, get_next_task {"project":"<키>"}로 다음 기능 하나를 받아 시작해. 목표나 범위를 바꾸는 결정은 먼저 나에게 물어봐."
     토큰이나 주소형 토큰은 절대 넣지 마.
   - MCP 연결: McpConnect를 재사용해. 연결 상태를 알 수 있는 기존 방법이 클라이언트 쪽에 없으면 새 API를 만들지 말고 connected=false로 두되, "이미 연결했다면 이 단계는 건너뛰세요" 한 줄을 붙여.
   - 저장소에 넣기: AgentPackDownload를 이 프로젝트 하나로 재사용해 훅 파일을 받게 하고, 잠긴 목표가 들어간 AGENTS.md 받기 버튼을 추가해(아래 2의 함수를 써서).
   - Codex 훅은 사용자가 /hooks에서 신뢰해야 실행된다는 안내 한 줄.
   - 사람이 먼저 할 일: GoalLock이 이미 보여 주면 중복하지 말고, 그렇지 않으면 같은 humanTasks 결과를 짧게.
2. PRD 화면 내보내기(PrdBuilder.tsx): 개인 PRD(prd:<id>)일 때도
   - renderAgentBrief에 프로젝트 키와 잠긴 목표(context.goal, GET /api/projects/[key]/goal로 읽음, 없으면 지금처럼)를 넘겨서 AGENTS.md에 "Project key"와 "Locked goal"이 들어가게.
   - 에이전트 안내 문장(agentPrompt)이 위 1의 시작 문장을 쓰게. 공개 기회(slug)일 때의 기존 문장 동작은 바꾸지 마.
3. 테스트: 시작 문장 생성(키 인코딩, 토큰 미포함), 개인 PRD의 AGENTS.md에 키와 잠긴 목표가 들어감, 목표 없으면 기존 출력 그대로. 화면은 기존 테스트 관행(서버 렌더링 문자열 확인 등)을 따라.

[고칠 수 있는 파일 — 이것만]
components/goal/AgentHandoff.tsx(새로), components/goal/*(필요한 연결만), components/IdeaWorkspace.tsx(에이전트 단계 부분만),
components/opportunity-stage/PrdBuilder.tsx(내보내기 · 안내 문장 부분만), tests/agent-handoff.test.ts(새로).

[절대 하지 말 것]
- lib/mcp/*, lib/supervisor/*, lib/db/*, lib/opportunities/*(spec.ts 포함), app/api/*, supabase/*, docs/*, DESIGN.md는 고치지 마. 필요한 게 있으면 결과 보고에 적어.
- 새 API, 새 패키지, MCP 도구 추가 금지(2단계는 정지훈 몫). 입구 통합(세 모드 합치기)도 하지 마.
- IdeaWorkspace.tsx · PrdBuilder.tsx에서 위 부분 말고 다른 동작은 바꾸지 마(큰 파일이라 diff를 작게).
- git 커밋 · push · PR · 브랜치 변경 금지. 로컬 변경까지만.

[화면 규칙]
DESIGN.md 토큰과 기존 컴포넌트, 390px에서 가로 넘침 없음, 문구는 한국어 · 영어.

[끝내는 조건]
npm run typecheck && npm run lint && npm test 통과(Windows의 tests/prd-exports.test.ts 1개 실패는 알려진 문제).

[결과 보고 — 커밋하지 말고 워크트리 루트의 PR_BODY.md에 작성]
.github/pull_request_template.md 형식으로: 계획 칸, 파일별 변경 한 줄, 한 것 · 안 한 것 · 남은 것, status.md에 반영할 한 줄, 계획과 다르게 판단한 점, 연결 상태를 어떻게 처리했는지, 2단계(MCP 파일 도구)에 넘길 것, 확인한 명령과 결과.
```
