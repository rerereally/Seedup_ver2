# Antigravity 시작 프롬프트: 단계 2 남은 칸과 기획 → 에이전트 연결

담당 정지훈 · Antigravity. 계획은 [supervisor-plan.md](../supervisor-plan.md) 5절(단계 2 보완, 기획 → 에이전트 연결, 세 입구 한 출구, 흐름 전체 E2E, 클라이언트 호환), 순서는 [status.md](../status.md) 2-2.

## 쓰는 법

- 아래 **공통 머리말**을 붙이고, 이어서 **작업 하나**를 붙여 넣습니다. 작업 하나가 PR 하나입니다.
- 순서와 동시 진행:

| 순서 | 작업 | 같이 돌려도 되는 것 | 시작 조건 |
| :--- | :--- | :--- | :--- |
| 1 | T1 보완 ② 검증 수준 칸 | T4, T5, T6 | 없음 |
| 2 | T2 보완 ④ 이탈 입력 | T4, T5, T6 | T1 머지(둘 다 `lib/mcp/server.ts`) |
| 3 | T3 연결 2 `setup_project` | T4, T5, T6 | T2 머지, **MCP 도구 정리 결정**(아래 T3 참고) |
| - | T4 보완 ⑥ 검증 운영 | T1~T3 | 없음(`lib/verifier`만) |
| - | T5 보완 ⑤ 훅 형식 | T1~T3 | 없음(`lib/supervisor/hook-bundle.ts`만) |
| - | T6 세 입구 한 출구 | T1~T3 | 없음(화면만) |
| 마지막 | T7 흐름 전체 E2E | - | T1 · T3 · T6 머지 |

- `lib/mcp/server.ts`를 고치는 T1 · T2 · T3은 **한 번에 하나씩**만 돌립니다.

## 공통 머리말 (모든 작업 앞에)

```
너는 Seedup 저장소에서 정지훈(기술 구현 · 머지 담당)의 Antigravity 에이전트다.
최신 main에서 작업 브랜치를 만들고, 먼저 AGENTS.md, CONTRIBUTING.md, DESIGN.md(2절 토큰, 8절 MCP 응답 형식), docs/supervisor-plan.md(최상위 계획), docs/status.md, docs/decisions.md를 읽어.
Next.js 코드를 쓰기 전에는 AGENTS.md 지시대로 node_modules/next/dist/docs/에서 쓰려는 API 문서를 확인해.

[지킬 것]
- 아래 작업의 "고칠 수 있는 파일"만 고쳐. 다른 파일이 필요하면 고치지 말고 PR 본문에 적어.
- docs/status.md, docs/supervisor-plan.md, docs/decisions.md, DESIGN.md는 고치지 마(계획 세션 몫, CONTRIBUTING 8절).
- 엔진 · 수집 동결 파일(docs/status.md 1절 목록)은 건드리지 마.
- DB 쿼리는 lib/db/* 또는 기존 데이터 접근 파일 안에서만. 비밀값은 저장 · 로그 금지.
- 공유 타입은 lib/supervisor/types.ts를 그대로 쓰고, 바꿔야 하면 PR 본문에 이유를 적어.
- 브랜치 <종류>/<작업ID>-<요약>, 한국어 커밋(맨 앞에 작업 ID).
- 끝나면 npm run typecheck && npm run lint && npm test(Windows의 tests/prd-exports.test.ts 1개 실패는 알려진 문제), 마이그레이션이 있으면 npm run migrations.
- PR을 열고 .github/pull_request_template.md를 채워. 본문에 꼭: 한 것 · 안 한 것 · 남은 것, "status.md에 반영할 한 줄", 계획과 다르게 판단한 점, 운영에서 할 일.
- 머지는 하지 마(정지훈이 리뷰 · 머지).
```

## T1. 단계 2 보완 ② 기능별 검증 수준 칸

```
[작업] 단계 2 보완 ② (작업 ID S2-F2, 브랜치 feat/s2-f2-verification-level)
지금 A2(#162)는 완료 때 검증 수준을 build_progress.note의 태그([supervisor_verified:<sha8>], [self_reported])로만 남기고,
/supervisor 대시보드(components/supervisor/model.ts)는 일부러 🟢를 보여 주지 않는다. 이걸 칸으로 바꾼다.

할 일:
1. 마이그레이션: build_progress에 검증 수준 칸 추가(값 supervisor_verified | local_checked | self_reported, 기본 self_reported).
   이미 있는 행은 note 태그로 채워(supervisor_verified 태그가 있으면 supervisor_verified). npx tsx scripts/check-migrations.ts --write.
2. lib/opportunities/build-progress.ts: 읽기 · 쓰기에 이 칸. 기존 호출의 동작은 그대로.
3. lib/mcp/server.ts: update_feature_status 완료 게이트가 이 칸에 기록(유효 토큰 → supervisor_verified, 토큰 없음 → self_reported). note 태그는 그대로 두어 하위 호환.
   local_checked는 이번에 쓰지 마(로컬 검사 결과를 받는 길이 아직 없음). 칸과 화면 표시만 준비.
4. components/supervisor/model.ts · Dashboard.tsx: 이 칸으로 🟢 · 🔵 · ⚪ 표시(DESIGN.md 8.2: 항상 글자와 함께, 🟢는 서버 검증만).
5. 테스트: 유효 토큰 done → supervisor_verified 저장, 토큰 없음 → self_reported, 마이그레이션 백필 규칙, 대시보드가 🟢를 보여 줌.

고칠 수 있는 파일: supabase/migrations/<새 파일>, lib/schema-manifest.json, lib/opportunities/build-progress.ts, lib/mcp/server.ts(게이트 부분만),
components/supervisor/model.ts, components/supervisor/Dashboard.tsx, 관련 tests.
운영에서 할 일(PR 본문에): 머지 직후 운영 DB 적용 + check-schema.
```

## T2. 단계 2 보완 ④ 이탈 검사 입력

```
[작업] 단계 2 보완 ④ (작업 ID S2-F4, 브랜치 feat/s2-f4-drift-input)
lib/supervisor/drift.ts의 findDrift는 "명세에 없는 화면 · API · 테이블"을 보려면 파일 상태와 새 테이블 정보가 필요한데, 지금 커밋 기록엔 파일 경로만 있다.

할 일:
1. link_commit이 파일마다 상태(added | modified | deleted)를 선택 입력으로 받게(기존 files 배열 입력도 계속 받음).
2. 커밋 기록(lib/opportunities/feature-commits.ts)에 파일 상태 저장. 칸이 필요하면 마이그레이션.
3. verify_feature가 서버에서 가져온 diff(lib/verifier)에서 새 마이그레이션 파일의 create table 이름을 읽어 이탈 판정 입력으로 넘김(명세에 없는 테이블).
4. components/supervisor/model.ts가 새 입력으로 findDrift를 부르게.
5. 테스트: 명세에 없는 새 화면 · API 경로 · 테이블이 경고로 잡힘, 상태 없는 옛 입력도 동작.

고칠 수 있는 파일: lib/mcp/server.ts(link_commit · verify_feature의 이탈 입력 부분만), lib/opportunities/feature-commits.ts, 필요하면 supabase/migrations/<새 파일> · lib/schema-manifest.json,
lib/supervisor/drift.ts(입력 확장만), components/supervisor/model.ts, 관련 tests.
```

## T3. 기획 → 에이전트 연결 2단계 (`setup_project`)

```
[작업] 연결 2단계 (작업 ID H2, 브랜치 feat/h2-setup-project)
시작 조건: 정지훈이 "MCP 도구 정리" 결정을 내렸을 것(docs/status.md 3절). 결정이 계획 세션 추천안(23 → 19)이면 이 작업 전에 도구 정리를 별도 PR로 먼저 한다(계획 5절 "MCP 도구 정리" 표 그대로).

할 일:
1. MCP 도구 setup_project { project }: 저장소에 쓸 파일을 돌려줌. 각 파일은 { path, content }.
   - AGENTS.md: lib/opportunities/spec.ts renderAgentBrief(잠긴 목표 · 키 포함, 연결 1의 웹 내보내기와 같은 내용)
   - CLAUDE.md: "AGENTS.md를 읽어" 한 줄(Claude Code는 CLAUDE.md를 기본으로 읽음)
   - 훅 묶음: lib/supervisor/hook-bundle.ts의 hookBundle(키) 결과(pre-commit 포함)
   - 응답은 DESIGN.md 8.1: 첫 줄 결론 → 파일 목록 → "Next:" 한 줄. Codex 훅은 사용자가 /hooks에서 신뢰해야 실행된다는 안내.
   - 토큰 · 주소형 토큰은 어떤 파일에도 넣지 마.
2. record_decision이 scope_change를 받으면 응답에 웹 목표 재잠금 화면 링크(MCP엔 목표 잠금 도구가 없음).
3. 시작 문장 흐름에 맞게 resume_project 응답의 Next:가 저장소 파일이 없을 때 setup_project를 먼저 안내.
4. 테스트: 남의 키 거부, 목표 없을 때 AGENTS.md는 기존 형식, 파일 내용에 토큰 없음, scope_change 응답 링크.

고칠 수 있는 파일: lib/mcp/server.ts, lib/mcp/endpoint.ts, lib/mcp/apps.ts(필요하면), README.md(도구 목록 · 수), 관련 tests.
lib/supervisor/hook-bundle.ts · lib/opportunities/spec.ts는 불러 쓰기만(고칠 게 있으면 PR 본문에).
```

## T4. 단계 2 보완 ⑥ 검증 운영

```
[작업] 단계 2 보완 ⑥ (작업 ID S2-F6, 브랜치 feat/s2-f6-verify-ops)
근거: docs/research/2026-11-20-section9.md 3-1 · 3-2 · 6절.

할 일:
1. lib/verifier/github.ts: 성공한 파일만 80개로 세는 지금 방식에 더해, 실패 · 바이너리로 버린 파일 요청에도 상한(시도 수 상한). 상한에 닿으면 남은 파일은 "보지 못함".
2. 검증 1회의 GitHub 요청 수와 걸린 시간을 결과에 기록(verifications에 칸이 필요하면 마이그레이션). 나중에 p50/p95를 낼 수 있게.
3. OpenRouter에서 provider.data_collection = "deny"를 만족하는 제공사가 없어 실패하면, 다른 경로로 몰래 완화하지 말고 명확한 오류 문구 + 사용량 환불.
4. 테스트: 실패 파일이 많아도 시도 상한에서 멈춤, 요청 수 · 시간 기록, deny 실패 시 오류와 환불.

고칠 수 있는 파일: lib/verifier/*, lib/db/verifications.ts, 필요하면 supabase/migrations/<새 파일> · lib/schema-manifest.json, 관련 tests.
lib/llm.ts는 고치지 마(필요하면 PR 본문에).
```

## T5. 단계 2 보완 ⑤ 훅 형식 (클라이언트 호환 ③의 훅 부분)

```
[작업] 단계 2 보완 ⑤ (작업 ID S2-F5, 브랜치 feat/s2-f5-hook-format)
근거: docs/research/2026-11-20-section9.md 1-1 · 1-3 · 1-5절(파일 · 줄 대조표).

할 일(lib/supervisor/hook-bundle.ts):
1. Claude Code SessionStart matcher에 clear · fork 추가(startup|resume|clear|compact|fork).
2. Stop 훅이 stdin JSON을 문자열 패턴이 아니라 구조로 읽음(stop_hook_active), 반복 막기 유지.
3. 스크립트 · goal 파일 경로를 프로젝트 루트 기준으로(훅 입력의 cwd나 git 루트).
4. upstream이 없는 브랜치의 커밋도 "push 안 됨"으로 인계 요청.
5. PreCompact 훅: 압축 직전 인계(save_handoff를 부르라는 안내).
6. Codex용 .codex/hooks.json(같은 동작, Codex 형식). 묶음 설명에 /hooks 신뢰 안내.
7. Windows: sh가 없을 때를 위한 대응(Git Bash 안내 또는 node로 실행하는 스크립트 중 하나를 고르고 이유를 PR 본문에).
8. 테스트: 생성되는 각 파일의 형식과 위 동작.
이번 작업에서 빼는 것: developed_with 확장, 서버 안내문 512자 재배치, CLAUDE.md 제공(T3)은 결정 · 다른 칸 몫.

고칠 수 있는 파일: lib/supervisor/hook-bundle.ts, lib/supervisor/local-audit.ts(경로 처리에 필요하면), 관련 tests.
```

## T6. 세 입구, 한 출구

```
[작업] 세 입구 한 출구 (작업 ID E3, 브랜치 feat/e3-three-entries)
기획 탭의 PRD 만들기 · 아이디어 검증 · 레포 분석이 모두 같은 출구(목표 잠금 → 에이전트 단계)로 오게 한다. 큰 입구 통합은 하지 않는다.

할 일:
1. 레포 분석(components/SeedAdvisor.tsx의 역기획 PRD): PRD를 개인 PRD(prd:<id>)로 저장하고, 그 아래 목표 잠금(components/goal/GoalLock.tsx)과
   에이전트 단계(components/goal/AgentHandoff.tsx)를 붙임. 분석한 저장소를 프로젝트 저장소로 저장(lib/db/supervisor-projects.ts의 기존 함수를 쓰는 작은 API, 본인 키만).
2. 아이디어 검증(components/ValidationReportPanel.tsx): "이 아이디어로 PRD 만들기"가 리포트의 원문(증거 id) · 경쟁 도구까지 PRD 입력으로 넘김.
   받는 쪽 components/IdeaWorkspace.tsx는 그 입력을 받는 부분만.
3. /agents(app/agents/page.tsx, components/AgentPackDownload.tsx): 내 프로젝트마다 시작 문장 복사(AgentHandoff의 agentStartPrompt 재사용).
   같은 파일의 문구 버그 "현재 번들에는 pre-commit 검사가 없습니다"를 실제 묶음 내용대로 고침(#157 뒤로 틀림).
4. 테스트: 레포 분석 PRD가 키를 받고 목표 잠금 뒤 에이전트 단계가 보임, 검증 → PRD에 증거 id가 넘어감, /agents 시작 문장에 토큰 없음.
화면은 DESIGN.md 토큰, 390px 가로 넘침 없음, 한국어 · 영어.

고칠 수 있는 파일: components/SeedAdvisor.tsx(PRD 부분), components/ValidationReportPanel.tsx, components/IdeaWorkspace.tsx(받는 부분만),
app/agents/page.tsx, components/AgentPackDownload.tsx, components/goal/*(재사용에 필요한 export만), app/api/projects/[key]/repo/route.ts(새로, 필요하면), 관련 tests.
lib/mcp/*, lib/supervisor/*는 고치지 마.
```

## T7. 흐름 전체 E2E

```
[작업] 흐름 전체 E2E (작업 ID E2E, 브랜치 test/e2e-goal-to-verified)
시작 조건: T1 · T3 · T6 머지.

할 일:
1. e2e/(Playwright, 기존 e2e/flow.spec.ts · setup.ts 방식, 로컬 Supabase): 로그인 → PRD 만들기 → 목표 잠금 → 에이전트 단계 → 시작 문장 복사 내용 확인.
2. MCP 통합 테스트(tests/): 같은 프로젝트 키로 resume_project → connect_repo → get_next_task → update_feature_status(in_progress) → verify_feature(가짜 GitHub · 가짜 검증 모델) → update_feature_status(done, 토큰) → 대시보드 🟢.
3. 레포 분석 · 아이디어 검증 입구에서 에이전트 단계까지 한 경로씩.
4. CI에서 돌게(.github/workflows/ci.yml의 e2e 잡에 이미 포함되는지 확인, 필요하면 PR 본문에).

고칠 수 있는 파일: e2e/*, tests/*, 필요하면 테스트용 가짜 의존성 주입 지점(PR 본문에 이유).
```
