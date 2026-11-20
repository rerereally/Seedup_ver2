# Codex 시작 프롬프트: 단계 1 A2 (MCP 목표 연결 · 공유 메모리 도구)

담당 정지훈 · Codex. 계획은 [supervisor-plan.md](../supervisor-plan.md) 5절 단계 1 A2, 설계는 3-2 · 3-3 · 3-11절입니다.

## 시작 전에 사람이 확인할 것

A2는 단계 1 머지 순서의 **마지막**입니다(A1 타입 → B1 → A1 나머지 · B2 · A3 → A2). 아래 파일이 `main`에 있어야 시작합니다.

- `lib/supervisor/types.ts`([#132](https://github.com/rerereally/Seedup_ver2/pull/132)), `lib/supervisor/goal.ts` (A1)
- `lib/db/supervisor-projects.ts`, `lib/db/project-goals.ts`, `lib/db/project-memory.ts` (B1)

`lib/mcp/server.ts`는 공용 파일입니다. 시작한다고 장차희 님께 먼저 알립니다.

## 붙여 넣을 프롬프트

```
최신 main에서 브랜치 feat/s1-a2-mcp-goal을 만들어 작업해.
먼저 AGENTS.md, CONTRIBUTING.md, DESIGN.md, docs/supervisor-plan.md를 읽어.
너는 docs/supervisor-plan.md 5절 단계 1의 A2(Codex) 담당이야. 설계는 3-2, 3-3, 3-11절을 따라.

[시작 조건]
lib/supervisor/types.ts, lib/supervisor/goal.ts, lib/db/supervisor-projects.ts, lib/db/project-goals.ts, lib/db/project-memory.ts가 main에 있는지 먼저 확인해.
하나라도 없으면 아무것도 고치지 말고 빠진 파일 이름만 나에게 알리고 멈춰.

[고칠 수 있는 파일]
lib/mcp/server.ts, lib/mcp/endpoint.ts, lib/mcp/apps.ts, lib/opportunities/spec.ts(AGENTS.md 내보내기 부분만), tests/mcp-goal.test.ts,
README.md(MCP 도구 수 · 도구 목록이 실제로 바뀐 부분만).
다른 파일이 필요하면 고치지 말고 나에게 알려. 특히 lib/supervisor/*, lib/db/*, 수집 동결 파일(docs/status.md 1절 목록)은 건드리지 마.
docs/status.md, docs/supervisor-plan.md, docs/decisions.md는 고치지 마(CONTRIBUTING.md 8절 "문서는 누가 언제 고치나").
공유 타입은 lib/supervisor/types.ts를 그대로 쓰고, 바꿔야 하면 먼저 나에게 말해. DB는 lib/db/*의 기존 함수만 불러.

[할 일]
1. 프로젝트 키: 기존 slug 인자에 같은 뜻의 project 인자를 추가해. 'prd:<dossier_id>'는 lib/db/dossiers.ts의 userPrdById(본인 것만)로 읽어서
   Opportunity 형태(slug=키, name=제목, evidence=저장 원문, supply=rivals 또는 빈 배열)로 만들고 기존 경로를 그대로 타게 해.
   진행 기록의 slug는 text라 마이그레이션은 필요 없어.
2. 서버 안내문(lib/mcp/server.ts의 instructions 고정 문장)에 사용자의 진행 중 목표 요약을 넣어.
3. get_next_task 응답에 목표 요약(목표 문장, 성공 기준, 하지 않는 것)을 싣고, 다음 작업을 goal.ts의 기여도 순서로 골라.
4. 새 도구: resume_project, connect_repo(공개 저장소만, 서버 토큰), check_env(환경 키 "이름"만 받고 확인. 값은 절대 받거나 저장하지 마).
5. 공유 메모리 도구: record_decision, save_handoff, get_project_memory.
   resume_project와 get_next_task 응답에는 최근 결정 몇 개와 마지막 인수인계만 짧게 싣고, 전체는 get_project_memory로.
6. 목표나 범위에 영향을 주는 결정(범위 밖 기능 추가, 하지 않는 것 뒤집기)이면 응답에 "사용자에게 터미널에서 물어라"를 지시하고,
   승인 결과는 record_decision에 "대화에서 승인"으로 남기게 해.
7. AGENTS.md 내보내기에 잠긴 목표, 성공 기준, 하지 않는 것, 최근 결정, 프로젝트 키를 넣어.
응답에 싣는 기억은 짧게 유지해(토큰 절약). 비밀값은 어디에도 저장하지 마.

[테스트]
tests/mcp-goal.test.ts에 최소한 이것을 넣어: prd:<id>가 남의 PRD를 못 읽음, get_next_task에 목표 요약이 실림,
check_env가 값을 받지 않음, 범위 밖 결정에서 "사용자에게 물어라" 지시가 나옴.

[끝낼 때]
1. npm run typecheck && npm run lint && npm test를 통과시켜.
2. 바꾼 내용이 적힌 md 문서를 같은 PR에서 최신화해. MCP 도구 수나 도구 목록이 바뀌었으면 lib/mcp/server.ts를 다시 세어
   README.md를 고치고, 공용 파일이니 PR 본문 공용 파일 칸에 체크해.
3. 커밋 메시지는 "S1-A2 <한국어 요약>" 형식으로 써.
4. .github/pull_request_template.md를 채우고, PR 본문에 아래 세 가지를 꼭 적어(CONTRIBUTING.md 8절):
   (1) 한 것 · 안 한 것 · 남은 것
   (2) status.md에 반영할 한 줄: 2절 "1 | A2" 줄의 새 내용, MCP 도구 수가 바뀌었으면 1절 MCP 줄의 새 숫자
   (3) 계획과 다르게 판단한 점이나 계획 문서가 틀린 곳
5. PR만 열어. 머지, main에 직접 push, 배포는 하지 마.
```

## 끝난 뒤 사람이 할 것

- PR 리뷰 후 머지. 단계 1의 마지막 머지이므로, 머지 전에 B1 마이그레이션이 운영 DB에 적용됐는지 `check-schema`로 확인합니다.
- `main` 머지 동결 중이면 머지하지 않고 기다립니다(`docs/status.md` 1절).
- 머지 직후 PR 본문의 "status.md에 반영할 한 줄"을 `docs/status.md`에 옮깁니다(머지한 사람, `CONTRIBUTING.md` 8절).
