# Codex 시작 프롬프트: 단계 2 A2 (`verify_feature`를 서버 검증에 연결, 완료 게이트)

담당 정지훈 · Codex. 계획은 [supervisor-plan.md](../supervisor-plan.md) 5절 단계 2 A2, 설계는 1절 결정 표(검증 방식 · 판정 위치 · 승인 · 게이트 · 모델) · 3-4 · 3-6절, 화면 · 응답 기준은 [DESIGN.md](../../DESIGN.md) 8절. 관련 결정은 [decisions.md](../decisions.md)의 "검증 모델: GPT 6.2 Sol · Haiku 5.5", "DESIGN.md 8.5".

## 시작 전에 사람이 확인할 것

- `main`에 B1 서버 검증(#151, `lib/verifier/run.ts`), 단계 1 보완(#149)이 있어야 합니다. 둘 다 머지됨.
- 운영 DB에 `20261120160000_verifications.sql`이 적용되고 `VERIFIER_MODELS`가 설정되어야 실제로 동작합니다. 개발 · 테스트는 가짜 의존성으로 하므로 없어도 시작할 수 있습니다.
- `lib/mcp/server.ts`는 공용 파일입니다. 시작한다고 장차희 님께 알립니다.
- 모델: 우리 Codex CLI 계정에서는 6.2 모델이 막혀 있었습니다(6.1 Sol은 동작). 설계 판단이 많아 high 추론을 권합니다.

## 붙여 넣을 프롬프트

```
최신 main에서 브랜치 feat/s2-a2-verify-gate를 만들어 작업해.
먼저 AGENTS.md, CONTRIBUTING.md, DESIGN.md 8절, docs/supervisor-plan.md(1절 결정 표, 3-4, 3-6, 4, 5절 단계 2 A2 · 단계 2 보완), docs/decisions.md를 읽어.
기존 코드: lib/verifier/run.ts(startVerification, getVerification, StartVerificationInput, VerificationCriterion), lib/supervisor/verify-token.ts(readVerificationToken), lib/supervisor/goal.ts, lib/mcp/server.ts의 verify_feature · update_feature_status · link_commit · connect_repo, lib/mcp/endpoint.ts, lib/mcp/apps.ts.
너는 docs/supervisor-plan.md 5절 단계 2의 A2(Codex) 담당이야.

[할 일]
1. verify_feature를 B1 서버 검증으로 바꿔.
   - 입력: project(또는 slug), feature, sha(전체 40자리). diff는 더 이상 받지 마(에이전트가 보낸 diff를 믿지 않음, 계획 1절 "완료 판정").
   - 저장소는 프로젝트에 연결된 공개 저장소(connect_repo로 저장된 것). 없으면 isError로 "Next: connect_repo"를 안내.
   - 완료 기준은 서버에 있는 그 기능의 명세에서 가져와 VerificationCriterion으로 바꿔(에이전트가 보낸 기준은 쓰지 마). 테스트 기준은 kind:'test'.
   - 하지 않는 것(잠긴 목표의 outOfScope)을 outOfScope로 넘겨.
   - 교차 계열(decisions.md): 개발 도구를 알 수 있으면 developmentModel을 넘겨(선택 입력 developed_with: 'codex' | 'claude-code' 등을 받고, 없으면 넘기지 않음). 어떻게 알아냈는지 결과 보고에 적어.
   - 결과가 running이면 id를 돌려주고, 새 도구 get_verification { project, id }로 결과를 받게 해.
   - 하루 횟수는 B1이 차감하니 MCP 쪽 기존 10회 차감과 이중으로 세지 않게 정리해.
2. update_feature_status(done) 완료 게이트(계획 1절 "게이트"):
   - 선택 입력 verification_token. readVerificationToken으로 사용자 · 프로젝트 · 기능 · SHA가 맞는지 확인되면 🟢 supervisor_verified로 기록(note에 [supervisor_verified:<sha8>]).
   - 토큰이 없거나 맞지 않으면: 프로젝트가 엄격 모드(supervisor_projects.strict)면 isError로 거부, 아니면 ⚪ self_reported로 기록.
   - 🔵 local_checked는 이번에 만들지 마(로컬 훅 결과를 받는 길은 단계 2 보완 ② · ③).
   - 진행 기록에 검증 수준 칸을 추가하는 마이그레이션은 하지 마(단계 2 보완 ②). 지금은 note 태그로만.
3. 응답과 카드는 DESIGN.md 8절대로: 첫 줄 결론 → 잠긴 목표(goalSummary) → 본문 → "Next:" 한 줄. 사용자 확인이 필요하면 8.1의 ASK USER 블록. 🟢은 서버 검증이 통과했을 때만.
4. DESIGN.md 8.5 결정 중 MCP 쪽 두 가지:
   - lib/mcp/apps.ts 카드 색을 DESIGN.md 2절 토큰(새 warn / warn-soft 포함)에 맞춰.
   - lib/supervisor/goal.ts의 goalSummary에서 성공 기준 미착수 표시를 ⚪ → ⬜로. 이 한 가지 말고 goal.ts는 고치지 마.
5. 테스트(tests/mcp-supervisor.test.ts): 가짜 GitHub · 모델 · 저장소로 최소 아래를 확인.
   저장소 미연결 → 안내, 에이전트 기준 무시, 차단 결과 → 토큰 없음, 유효 토큰 done → 🟢 태그, 다른 기능 · 다른 SHA · 변조 토큰 거부,
   엄격 모드 토큰 없음 → isError, 일반 모드 토큰 없음 → ⚪, get_verification 본인 것만, 응답 첫 줄 · Next 형식.

[고칠 수 있는 파일]
lib/mcp/server.ts, lib/mcp/endpoint.ts, lib/mcp/apps.ts, lib/supervisor/goal.ts(⬜ 한 가지만), tests/mcp-supervisor.test.ts,
README.md(MCP 도구 목록과 수가 실제로 바뀐 부분만).
다른 파일이 필요하면 고치지 말고 나에게 알려. 특히 lib/verifier/*, lib/db/*, supabase/migrations/*, components/*, app/*, 수집 동결 파일(docs/status.md 1절)은 건드리지 마.
docs/status.md, docs/supervisor-plan.md, docs/decisions.md, DESIGN.md는 고치지 마(CONTRIBUTING.md 8절).

[끝내는 조건]
npm run typecheck && npm run lint && npm test 통과(Windows에서 tests/prd-exports.test.ts 1개 실패는 알려진 문제). 한국어 커밋, 맨 앞에 S2-A2. PR을 열고 템플릿을 채워.
PR 본문에: 한 것 · 안 한 것 · 남은 것, status.md에 반영할 한 줄, 계획과 다르게 판단한 점, developmentModel을 알아낸 방법, 운영에서 확인할 것.
```
