# Codex 시작 프롬프트: 단계 2 B2 (최소 `/supervisor` 대시보드 · `/agents` 스타터 팩)

계획 세션(장차희)이 범위를 정하고 Codex(GPT 6.2 Sol)가 구현합니다. 리뷰 · 머지는 정지훈. 계획은 [supervisor-plan.md](../supervisor-plan.md) 5절 단계 2 B2, 설계는 2-2 · 3-1 · 3-2 · 3-6 · 3-11절.

## 실행 방식

- 계획 세션이 `origin/main`에서 별도 worktree(`feat/s2-b2-supervisor-ui`)를 만들고 `codex exec`로 이 프롬프트를 넘깁니다.
- Codex는 로컬 커밋까지만 합니다. push · PR은 계획 세션이 diff를 확인한 뒤 엽니다.

## 붙여 넣을 프롬프트

```
너는 Seedup 저장소의 단계 2 B2 담당 구현자다. 계획 세션이 정한 범위 안에서만 일한다.

[먼저 읽기 — 이것만]
AGENTS.md, CONTRIBUTING.md, DESIGN.md, docs/supervisor-plan.md의 2-2 · 3-1 · 3-2 · 3-6 · 3-11 · 4 · 5절(단계 2 B2 칸), docs/status.md 1절.
Next.js 코드를 쓰기 전에 AGENTS.md 지시대로 node_modules/next/dist/docs/에서 쓰려는 API의 문서를 확인해.
다른 문서는 읽지 마.

[만들 것]
1. /supervisor: 로그인 사용자의 프로젝트 목록(공개 기회 slug와 prd:<id>). 카드마다 잠긴 목표 문장, 성공 기준 충족 수, 마지막 활동 시각.
2. /supervisor/[key] 최소 대시보드:
   - 맨 위 목표 카드: 목표 문장, 성공 기준별 상태(open/partial/met), 하지 않는 것, 목표 버전
   - 기능 신호등: 기능(F-n)마다 진행 상태와 검증 표시. 서버 검증(단계 2 B1)은 아직 없으니 🟢는 쓰지 말고 ⚪ 자가 보고 / 🔵 로컬 확인만. 검증 필드가 없으면 ⚪
   - 이탈 경고: lib/supervisor/drift.ts의 findDrift 결과(입력이 없으면 "아직 기록 없음")
   - 결정 이력: lib/db/project-memory.ts의 projectMemory에서 결정(decision) 최근 것
   - 비로그인은 /login?next=<현재 경로>, 남의 키 · 없는 키는 404
3. /agents 스타터 팩: lib/supervisor/hook-bundle.ts의 hookBundle · hookSettings 결과를 파일별 미리보기 + 복사 + 내려받기로. 기존 MCP 연결 화면(app/agents/AgentStart.tsx, McpConnect.tsx)은 그대로 두고 아래에 섹션 추가. /supervisor 바로가기 버튼.
4. app/api/supervisor/[key]/route.ts: 위 화면이 쓰는 읽기 전용 GET(로그인 필수, 본인 것만).

[고칠 수 있는 파일 — 이것만]
app/supervisor/page.tsx, app/supervisor/[key]/page.tsx, app/api/supervisor/[key]/route.ts,
components/supervisor/*(새로), app/agents/page.tsx, components/AgentPackDownload.tsx(새로),
components/Header.tsx(내비에 /supervisor 항목 한 줄만 — 공용 파일이라 결과 보고에 꼭 적기),
tests/supervisor-ui.test.ts(새로).

[절대 하지 말 것]
- lib/supervisor/*, lib/db/*, lib/mcp/*, lib/opportunities/*, supabase/migrations/*, docs/*는 고치지 마. 필요한 함수가 없으면 고치지 말고 결과 보고에 "필요한 것"으로 적어.
- 기능 목록(Spec)을 읽는 함수가 lib/mcp 안에만 있으면 복사하거나 고치지 말고, 이미 export된 lib/db · lib/opportunities 함수로만 읽어. 그래도 안 되면 기능 신호등은 build_progress 기록만으로 보여 주고 보고해.
- DB 쿼리는 lib/db/* 함수만 불러(직접 쿼리 금지, ESLint 규칙).
- 엔진 · 수집 동결 파일(docs/status.md 1절)은 읽기만.
- 새 패키지 설치 금지. 계획에 없는 기능(실측 토큰, 화면 평가, 추천 등 5절 "보류") 금지.
- git push, PR 생성, 브랜치 변경, main 머지 금지. 로컬 커밋까지만.

[화면 규칙]
DESIGN.md 토큰과 기존 컴포넌트를 써. 390px에서 가로 넘침 없게. 문구는 기존 translator 관행대로 한국어 · 영어.

[끝내는 조건]
npm run typecheck && npm run lint && npm test 통과(Windows의 tests/prd-exports.test.ts 1개 실패는 알려진 문제라 무시).
한국어 커밋 메시지, 맨 앞에 S2-B2. 예: "S2-B2 /supervisor 최소 대시보드".

[결과 보고 — 커밋하지 말고 워크트리 루트의 PR_BODY.md에 작성]
.github/pull_request_template.md 형식으로:
- 계획 문서의 어느 칸인가, 무엇을 바꿨나(파일별 한 줄)
- 한 것 · 안 한 것 · 남은 것
- status.md에 반영할 한 줄
- 계획과 다르게 판단한 점, 필요한데 범위 밖이라 못 한 것
- 공용 파일(Header.tsx) 변경 여부
- 확인한 명령과 결과
```
