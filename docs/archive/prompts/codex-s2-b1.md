# Codex 시작 프롬프트: 단계 2 B1 (서버 검증 단순형)

계획 세션(장차희)이 범위를 정하고 Codex(GPT 6.1 Sol, high)가 구현합니다. 리뷰 · 머지는 정지훈(마이그레이션 포함이라 정지훈이 직접 머지하고 운영 DB에 적용). 계획은 [supervisor-plan.md](../../supervisor-plan.md) 5절 단계 2 B1, 설계는 1절 결정 표 · 3-4 · 3-5 · 3-6절, 결정은 [decisions.md](../../decisions.md)의 "0-4(A안)".

## 실행 방식

- 계획 세션이 `origin/main`에서 별도 worktree(`feat/s2-b1-verifier`)를 만들고 `codex exec`로 넘깁니다. Codex는 로컬 커밋까지만 하고, push · PR은 계획 세션이 diff를 확인한 뒤 엽니다.
- 단계 2 A2(정지훈, MCP `verify_feature` 연결)가 이 칸의 함수를 부릅니다. 함수 이름과 입출력은 계획 4절 타입(`Verification`, `CriterionVerdict`, `CodeCitation`)을 따릅니다.

## 붙여 넣을 프롬프트

```
너는 Seedup 저장소의 단계 2 B1 담당 구현자다. 계획 세션이 정한 범위 안에서만 일한다.

[먼저 읽기 — 이것만]
AGENTS.md, CONTRIBUTING.md, docs/supervisor-plan.md의 1절 결정 표 · 3-4 · 3-5 · 3-6 · 4 · 5절(단계 2 B1 칸), docs/decisions.md의 "0-4(A안)" 항목, docs/status.md 1절.
기존 코드: lib/supervisor/types.ts, lib/supervisor/diff-audit.ts(auditDiff, scrubSecrets), lib/supervisor/verify-token.ts(signVerificationToken, readVerificationToken), lib/llm.ts(callJsonModel), lib/db/*의 기존 패턴, supabase/migrations 최근 파일 2개, lib/opportunities/rules.ts의 isVerbatimQuote(읽기만).
다른 문서는 읽지 마.

[만들 것 — 계획 3-4 "2단: 서버 확정"]
1. lib/verifier/github.ts: 공개 저장소의 커밋 SHA 하나에 대해 diff, 바뀐 파일 전체 내용, CI check runs 결과를 GitHub REST API로 가져오기(서버 GITHUB_TOKEN). 파일이 너무 크면 바뀐 파일과 완료 기준에 걸린 파일만, 나머지는 "보지 못함" 목록으로.
2. lib/verifier/citations.ts: 모델이 낸 코드 인용 { path, line, quote }가 그 SHA의 파일에 글자 그대로 있는지 대조. 안 맞으면 verified:false, 그 기준 판정은 unclear로 내림.
3. lib/verifier/run.ts: startVerification(input)과 getVerification(userId, id).
   순서: 자료 모으기 → auditDiff로 정적 검사(차단이 하나라도 있으면 모델을 부르지 않고 status 'blocked') → scrubSecrets로 마스킹 → 완료 기준과 자료를 한 번에 넣어 모델 1회 판정(필요하면 1회 더, 최대 2회, tool 루프 없음) → 인용 대조 → "테스트 통과" 기준은 CI success일 때만 met → 전부 met이면 signVerificationToken으로 토큰 → 결과 저장.
   같은 (SHA, 기능)은 저장된 결과를 재사용. 사용자별 하루 횟수는 기존 consume_ai_usage 방식으로 차감하고 실패 시 환불(기존 코드 패턴 따르기).
4. 모델 호출 경로(0-4 A안): 검증은 유료 모델만, 데이터 수집을 거부하는 경로로만.
   lib/llm.ts의 callJsonModel에 선택 옵션 하나만 추가해(예: noDataCollection: true → OpenRouter 요청 본문 provider.data_collection = "deny"). 기존 호출의 동작은 바꾸지 마. 무료 전용 설정(OPENROUTER_FREE_ONLY)과 별도로 검증 모델은 환경변수 VERIFIER_MODELS에서 읽어.
   OpenRouter가 provider.data_collection "deny"를 실제로 지원하는지 node_modules나 코드 주석으로 확인할 수 없으면, 구현은 하되 결과 보고에 "확인 필요"로 적어.
5. lib/db/verifications.ts + supabase/migrations/<지금보다 늦은 시각>_verifications.sql: verifications 테이블(계획 4절 Verification 필드), RLS는 본인 읽기 · 서버만 쓰기(기존 마이그레이션 관행). 추가 후 npx tsx scripts/check-migrations.ts --write.
6. lib/legal.ts: 처리방침의 "밖으로 보내는 곳"에서 OpenRouter 줄을 0-4 A안대로 고쳐: 아이디어 · PRD는 무료 모델로 갈 수 있고 그 제공사가 입력을 기록 · 학습에 쓸 수 있음, 기능 검증 시 코드는 데이터 수집을 거부하는 유료 경로로만 보내고 판정에만 씀. 다른 문장은 그대로.
7. components/IdeaWorkspace.tsx: 아이디어 입력 근처에 "무료 모델 제공사가 입력을 기록 · 학습에 쓸 수 있습니다" 안내 한 줄(한국어 · 영어, 기존 translator 관행, 처리방침 링크). 이 한 줄 말고 다른 곳은 고치지 마.
8. tests/verifier.test.ts: GitHub와 모델은 가짜로 주입. 최소: 차단 결과면 모델 호출 0회, 가짜 인용은 unclear, CI 실패면 테스트 기준 not_met, 전부 met이면 토큰 발급, 같은 SHA 재사용, noDataCollection 옵션이 요청 본문에 들어감.

[고칠 수 있는 파일 — 이것만]
lib/verifier/*(새로), lib/db/verifications.ts(새로), supabase/migrations/<새 파일>, lib/schema-manifest.json(재생성만),
lib/llm.ts(옵션 추가만), lib/legal.ts(그 한 줄만), components/IdeaWorkspace.tsx(안내 한 줄만), tests/verifier.test.ts(새로).

[절대 하지 말 것]
- lib/mcp/*, lib/supervisor/*, components/goal/*, components/supervisor/*, app/supervisor/*, app/agents/*, docs/*는 고치지 마(다른 칸). 필요한 게 있으면 결과 보고에 적어.
- tool calling 루프, 사용자 저장소의 CI 안에서 판정하기, 비공개 저장소 · GitHub App, 화면 평가는 만들지 마(계획에서 뺐거나 보류).
- 비밀값(키, 토큰 값)을 저장하거나 로그에 남기지 마. 환경변수는 이름만.
- DB 쿼리는 lib/db/* 안에서만. 엔진 · 수집 동결 파일(docs/status.md 1절)은 읽기만.
- 새 패키지 설치 금지. git push, PR 생성, 브랜치 변경, main 머지 금지. 로컬 커밋까지만.

[끝내는 조건]
npm run typecheck && npm run lint && npm test && npm run migrations 통과(Windows의 tests/prd-exports.test.ts 1개 실패는 알려진 문제라 무시).
한국어 커밋 메시지, 맨 앞에 S2-B1.

[결과 보고 — 커밋하지 말고 워크트리 루트의 PR_BODY.md에 작성]
.github/pull_request_template.md 형식으로: 계획 칸, 파일별 변경 한 줄, 한 것 · 안 한 것 · 남은 것, status.md에 반영할 한 줄, 계획과 다르게 판단한 점, 확인 필요(OpenRouter data_collection 등), 새 환경변수 이름(VERIFIER_MODELS 등), 운영 DB 마이그레이션 필요: 예, 공용 파일(lib/llm.ts, components/IdeaWorkspace.tsx) 변경 내용, A2가 부를 함수 시그니처, 확인한 명령과 결과.
```
