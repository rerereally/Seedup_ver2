# Seedup 상태

마지막 갱신 2026-11-20(저녁). 계획은 [supervisor-plan.md](supervisor-plan.md)(최상위 계획)를 따르고, 이 파일은 **지금 어디까지 왔는지만** 적습니다. 날짜별 진행 기록 파일은 따로 만들지 않고 이 파일을 고칩니다. 바꿀 때는 맨 위 날짜를 고치고, 숫자는 아래 "확인 방법"으로 직접 다시 셉니다.

## 1. 지금 상태

| 항목 | 상태 | 확인 방법 |
| :--- | :--- | :--- |
| 머지된 PR | #79~#137, #139~#154. 최근: #149 단계 1 보완, #151 단계 2 B1 서버 검증, #153 단계 2 B2 대시보드 · 스타터 팩, #152 · #154 계획 묶음 | `gh pr list --state merged --limit 20` |
| 열린 PR | 갱신 시점 기준 기능 PR 없음 | `gh pr list` |
| 문서 | 최상위 계획 · 상태 · 문서 목록 · 결정 기록 · 작업 규약(`CONTRIBUTING.md`) 갖춤. 낡은 문서 17개는 `docs/archive/`. 단계 1 A2 · A3 시작 프롬프트는 `docs/prompts/` | [README.md](README.md) |
| 역할 | 장차희 총괄 · 계획, 정지훈 기술 구현 · 머지 · 운영 DB 마이그레이션 적용. 정지훈이 맡긴 Claude Code 머지 세션은 4절 점검 조건을 따름(마이그레이션 PR과 자기 PR 제외) | `CONTRIBUTING.md` 1 · 4 · 7절 |
| `main` 머지 | 해커톤 발표용 머지 동결 해제. 규약 4절에 따라 CI · 리뷰 · 계획 순서를 충족한 PR을 계속 머지 | `CONTRIBUTING.md` 4 · 9절, [결정 기록](decisions.md) |
| 운영 배포 | **#177에서 멈춤.** main의 CI e2e가 #178부터 실패해 deploy 단계가 건너뛰어짐. #178 · #179 · #180의 코드는 운영에 없음(마이그레이션만 운영 적용). 원인 수정 PR #182 머지(`2d8cd43`, 그 PR의 CI e2e는 재시도 없이 통과). 그 뒤 main CI의 deploy가 실제로 돌았는지 확인 필요 | GitHub Actions `CI` 실행 기록 |
| Antigravity 작업(AG) | AG-1~9 **전부 완료** | [archive/antigravity-tasks.md](archive/antigravity-tasks.md) |
| Codex 작업(CX) 완료 | CX-1~6, CX-9~13, CX-15, CX-16 | [archive/codex-tasks.md](archive/codex-tasks.md), PR 제목 |
| Codex 작업(CX) 남음 | CX-7 고정 뼈대와 추가 모듈, CX-8 대상별 출력, CX-14 서버 버전 기록과 항목별 댓글. 셋 다 계획 5절 "보류"로 감(CX-14의 버전 기록만 단계 1로) | [supervisor-plan.md](supervisor-plan.md) 10-2 |
| DB 마이그레이션 | 36개(main `ff0c290` 기준). #180의 `20261120190000_found_evidence.sql` 포함, 운영 `check-schema` 통과(2026-11-20) | `ls supabase/migrations`, `check-schema` |
| 단위 테스트 | 349개(53개 파일). #140에서 8개, #142에서 7개 추가. 최신 `main` 전체 실행 결과는 CI에서 확인 | `npm test` |
| MCP | 도구 20개(#176, 운영 조회 확인). 프롬프트 4개, 리소스 2개. #182: 완료 수를 🟢 감독관 검증 · ⚪ 자가 보고로 나눔, 개인 PRD 준비 항목 보완, `get_my_prd`에 초안 표시, Codex 연결 안내에 `tool_timeout_sec = 180` | `lib/mcp/server.ts` |

### 데이터 수집 동결

3개월치 수집이 다른 세션에서 돌고 있어, 동결 해제 전까지 아래 엔진 파일은 고치지 않습니다. 근거 보강(계획 3-10)과 엔진 작업은 그 뒤에 합니다.

- `lib/opportunities/engine.ts`, `actors.ts`, `merge.ts`, `rules.ts`, `web.ts`, `live-evidence.ts`
- `lib/ingest/*`
- `lib/opportunities/data/*`
- `scripts/run-opportunity-engine.ts`

## 2. 단계별 진행

담당과 파일은 [supervisor-plan.md](supervisor-plan.md) 5절 표를 따릅니다.

| 단계 | 칸 | 담당 | 상태 | 막힌 것 · 메모 |
| :--- | :--- | :--- | :--- | :--- |
| 0 지금 출시 | 운영 `section_views` 적용, `OPENROUTER_FREE_ONLY=true` 확인 | 사람 | 일부 확인 | 운영 스키마 확인 완료. 무료 모델 설정 확인은 남음 |
| 0 | 대표 흐름만 앞에, 로그인 → PRD → 내보내기 → MCP 직접 확인 | 사람 | 시작 전 | 메뉴 정리 · 로그인 없이 PRD는 결정 대기(3절) |
| 0 | 처리방침 갱신(어느 입력이 어느 모델로: 아이디어 · PRD는 무료 모델, 검증 코드는 GPT 6.2 Sol 또는 Haiku 5.5) | 정지훈 | 알리기 전 | B1 #151의 문구에 모델 이름을 더함 |
| 0 | 덜 된 화면 베타 표시나 숨김(`/supervisor` 등) | 정지훈 | 알리기 전 | 어떤 화면을 숨길지는 3-4 메뉴 정리 결정과 함께 |
| 0 | 알리기 | 사람 | 해커톤 발표 뒤 | 그 전에 아래 두 줄 먼저(정지훈 결정) |
| 1 목표 잠금 · 에이전트 연결 | A1 공유 타입 · 목표 모델 · 훅 번들 | 정지훈 · Claude Code | 공유 타입(#132)과 나머지(#137) 머지 | 목표 모델 · 사람 할 일 · 훅 번들. 실제 Claude Code 세션에서 훅 확인 필요 |
| 1 | A2 MCP 목표 연결 · 공유 메모리 도구 | 정지훈 · Codex | PR #142 머지 | B1 운영 스키마와 Codex 연결 확인. 다른 클라이언트 확인은 호환 ② 참고 |
| 1 | A3 기준 측정 · 발표 서사 | 정지훈 · Antigravity | PR #136 · #141 머지(일부 완료) | 기준 측정과 10분 발표 · 5분 질의응답 대본, 발표 전략 반영. PR 보고상 운영 저장 PRD 표본 없음. 목표 도달률 계산은 남음 |
| 1 | B1 저장(프로젝트 · 목표 버전 · 공유 메모리) | Claude Code(기술 책임 정지훈) | PR #131 머지 | 공유 타입 반영. 운영 `check-schema`에서 `supervisor_projects` 확인 |
| 1 | B2 기획 탭 목표 카드와 잠금 화면 | Codex(기술 책임 정지훈) | PR #133 머지(Claude Code 세션이 대신 진행) | B1 뒤에 머지. 로그인 상태 실제 저장 확인과 원문 0건 PRD의 저장 ID 전달이 남음 |
| 1 보완 | 목표 재잠금 → 기능 재확인, 목표 카드 A1 판정 · 성공 기준 id 버그, 사람이 먼저 할 일 표시 | 정지훈 · Claude Code | PR #149 머지 | |
| 2 2단 검증 · 이탈 검사 | A1 정적 검사 · 검증 토큰 · 이탈 규칙 | 정지훈 · Claude Code | PR #140 머지(일부) | 계획 순서와 달리 단계 1 A2(#142)보다 앞서 머지. 로컬 훅 1단 검사는 남음 |
| 2 | A2 MCP `verify_feature` · 완료 게이트 | 정지훈 · Codex | PR #162 머지 | SHA 검증 · 엄격 완료 게이트. #175에서 결과 조회를 같은 기능·SHA의 `verify_feature` 재호출로 통합. 운영에서 공개 저장소 SHA로 검증 → 조회 → 완료 한 번 확인 필요 |
| 2 | A3 불량 diff · 오탐률 · 데모 | 정지훈 · Antigravity | 시작 가능 | [프롬프트](prompts/antigravity-s2-a3.md). 코드 변경 없음(측정 · 데모 · 문서) |
| 2 | B1 서버 검증(단순형) | Codex(GPT 6.1 Sol, 장차희 계획 세션이 지시 · 기술 책임 정지훈) | PR #151 머지 | 운영 `verifications` 조회 확인. `VERIFIER_MODELS` 설정, OpenRouter data_collection deny · 6.2 호출 확인, costUsd는 아직 0 |
| 2 | B2 `/supervisor` 대시보드 · `/agents` 스타터 팩 | Codex(GPT 6.1 Sol, 장차희 계획 세션이 지시 · 기술 책임 정지훈) | PR #153 머지 | 신호등은 아직 모두 ⚪(검증 수준 필드는 2 보완 ②). 알리기 전 베타 표시 또는 숨김(단계 0) |
| 2 | MCP 화면 · 응답 기준(DESIGN.md 8절) | 초안 정지훈 · 확정 계획 세션 | 완료(#147 초안, 확정 2026-11-20) | A2 · B2 응답 · 카드가 이 기준을 따름 |
| 2 보완 | ① 프로젝트 목록 함수(#156), ② 기능별 검증 수준, ③ pre-commit(#157), ④ 이탈 입력, ⑤ 훅 형식 보완, ⑥ 검증 운영 보완, ⑦ 정적 검사 오탐(`env(…)`) | 정지훈 | ①, ③ 머지. ② · ④ 시작 가능(A2 머지됨) | ②는 마이그레이션 포함. ② · ④ · ⑤ · ⑥은 정지훈 · Antigravity [프롬프트](prompts/antigravity-remaining.md) T1 · T2 · T5 · T4 |
| 2 | 9절 확인 조사 | Codex(GPT 6.1 Sol · 웹 검색, 장차희 계획 세션이 지시) | 완료(2026-11-20) | [보고서](research/2026-11-20-section9.md). 계획 9절 · 단계 2 보완 ⑤ · ⑥에 반영 |
| 연결 1 | 기획 → 에이전트 연결 1단계: 에이전트 단계 화면, 개인 PRD `AGENTS.md`에 목표 · 키 | Codex(GPT 6.1 Sol, 장차희 계획 세션이 지시 · 기술 책임 정지훈) | PR #163 머지 | [프롬프트](prompts/codex-handoff-web.md). 시작 문장에 저장소 연결(`connect_repo`) 포함 |
| 연결 2 | MCP 파일 제공 도구(`setup_project`), 목표 변경 시 웹 재잠금 링크 | 정지훈 · Antigravity | PR #176 머지 | setup_project 및 웹 목표 재잠금 링크 추가. 운영 MCP 도구 목록에서 setup_project 확인 |
| 세 입구 | ① 레포 분석 → 출구, ② 검증 → PRD 근거, ③ `/agents` 프로젝트별 시작 문장(+ 스타터 팩 문구 버그) | 정지훈 · Antigravity | 시작 가능 | [프롬프트](prompts/antigravity-remaining.md) T6 |
| 3-10 일부 | 아이디어 근거 검색 · MCP 개인 PRD 연결 | 정지훈 | PR #180 머지 | 공용 원문 재사용·재검색·비로그인 검색·생활 분야 Q&A, P0 열린 질문 먼저. 계획상 보류 구간 일부가 앞당겨졌으며 수집 동결 파일은 변경 없음. App Store 리뷰는 권리 확인 대기. 운영 MCP 초안 → PRD 직접 확인 필요. **#180 뒤 남았던 문제(PR #182 머지로 수정):** ① 저장된 개인 PRD를 다시 읽으면 준비 항목이 사라져 P0 기능마다 막연한 질문 6개가 나옴 ② 같은 원문을 담은 다른 아이디어가 저장 행 · 프로젝트 키 · 잠긴 목표를 나눠 써서 뒤 아이디어가 앞 PRD를 덮어씀. 운영에서 이미 덮어써진 저장본이 있는지는 확인 안 함 |
| E2E | 흐름 전체(로그인 → 목표 잠금 → 에이전트 → 🟢) | 정지훈 · Antigravity | PR #178 머지 | 세 입구 → 목표 잠금 → 에이전트 안내 브라우저 테스트와 테스트용 GitHub·모델을 사용한 MCP → 🟢 통합 테스트 추가. 실제 운영 프로젝트 완주는 별도. 브라우저 테스트는 머지 뒤 CI에서 계속 실패했음(겹치는 선택자 2개, 3-10 줄의 ② 저장본 충돌). PR #182 머지로 수정 |
| 호환 ① | Antigravity 확인 조사 | Codex(장차희 지시) | 완료(2026-11-20) | [보고서](research/2026-11-20-antigravity.md). `AGENTS.md` 지원, 훅은 형식이 달라 어댑터 필요, 개발 모델 계열 입력 필요 |
| 성적표 갱신 | 감독관 정적 검사 숫자를 #160 뒤 실측값으로 | Codex 시도 → 샌드박스 실패, 계획 세션이 측정 | PR #168 열림 | 불량 diff 25/25, 새 오탐 후보(`env(…)`) → 보완 ⑦ |
| 처리방침 | 입력별 모델(무료 모델 / GPT 6.2 Sol · Haiku 5.5)과 보관 범위 | Codex(장차희 지시 · 기술 책임 정지훈) | PR #167 열림 | [프롬프트](prompts/codex-privacy-wording.md). 출시 전 준비 |
| 실제 프로젝트 검증 | 프로젝트 3개(트랙 A · 트랙 B · 기존 저장소), 목표 도달률 첫 측정 | 장차희 · 정지훈 | 시작 조건 대기(운영 준비, 보완 ②, 실제 연결 확인 1개) | 계획 5절 "실제 프로젝트 검증", [양식](research/project-check-template.md) |
| 호환 ② | 클라이언트별 실제 연결 확인(Claude Code · Codex · Antigravity) | 장차희 · 정지훈 | 운영 준비 뒤 | [확인 순서](prompts/client-check.md). 실제 프로젝트 게이트 첫 번째 |
| 호환 ③ | CLAUDE.md 제공, 안내문 앞 512자, developed_with 확장, Codex 훅, Windows | 정지훈 | 결정 대기(developed_with 방식) | 단계 2 보완 ⑤를 넓힘 |
| 도구 정리 | MCP 도구 23 → 19 | 정지훈 | PR #175 머지 | 운영 Codex에서 도구 19개 확인 |

## 2-1. 운영 준비 (정지훈, 🟢가 운영에서 나오려면 필요)

- 운영 DB `20261120160000_verifications.sql` 스키마 확인 완료. `check-schema` 통과
- `VERIFIER_MODELS`에 `openai/gpt-6.2-sol`, `anthropic/claude-haiku-5.5`
- OpenRouter 계정 privacy · Safety Retention 설정, 두 모델이 deny 필터 아래 호출되는지 1회씩
- GitHub 토큰 종류(시간당 요청 한도)
- 대시보드 🟢 표시는 단계 2 보완 ②(검증 수준 칸) 뒤

## 2-2. 추천 순서 (계획 세션, 2026-11-20)

1. 운영 준비(2-1) → 호환 ② 실제 연결 확인(운영 확인 겸)
2. 단계 2 보완 ②(검증 수준 칸, 대시보드 🟢)
3. MCP 도구 정리 → 연결 2(`setup_project`)
4. 호환 ③(보완 ⑤ 포함) → 보완 ⑥ → 보완 ④ → 흐름 E2E
- 동시에 장차희 쪽: 세 입구 한 출구(Codex), 호환 ① Antigravity 조사(Codex)

## 3. 결정 대기

[supervisor-plan.md](supervisor-plan.md) 10-2에서 "결정 대기"인 항목입니다. 결정은 계획 세션에서 하고, 정해지면 이 표에서 지우고 계획 문서에 반영합니다.

| 항목 | 묶인 단계 | 정할 것 |
| :--- | :--- | :--- |
| 머지 위임(PR #135) | 모든 단계 | #135로 규약 반영됨. 장차희의 확인과 `decisions.md` 기록은 결정 대기 |
| 3-4 메뉴 정리 · 범위 동결 | 단계 0 | 출시 때 앞에 둘 메뉴와 숨기거나 베타로 표시할 화면 |
| 로그인 없이 PRD 만들기 | 단계 0 | 허용 여부와 한도 |
| MCP 도구 정리 범위 | 단계 2 | 정지훈: 계획 세션 추천안(23 → 19, `link_commit` 유지, 기획/개발 분리는 미룸)대로 할지 |
| `developed_with` 확장 방식 | 단계 2 | 정지훈: `antigravity` 값만 추가할지, 개발 모델 계열을 직접 받는 입력을 더할지 |
| 비공개 저장소 검증(GitHub App) | 출시 | 장차희 · 정지훈: 보류에서 꺼내 출시 전 필수로 할지 |
| 심층 감독 | 단계 3 이후 | 계획 세션 추천은 보류 유지(단순형과 비교 측정 뒤 결정) |
| 출시 메시지 | 출시 | 장차희: "감독(목표 이탈 방지 + 다른 모델의 완료 확인)" 하나로 좁히고 리서치 · PRD는 입구로 둘지 |

## 3-1. 후속으로 정해진 일

- 처리방침(`lib/legal.ts`)에 "어느 입력이 어느 모델로 가는지"를 모델 이름까지 적기: 아이디어 · PRD는 무료 모델, 검증 코드는 GPT 6.2 Sol 또는 Haiku 5.5(개발 계열과 다른 쪽). B1 PR #151 머지 뒤 작은 PR로(정지훈).
- OpenRouter에서 GPT 6.2 Sol을 부를 수 있는지 확인(정지훈). 안 되면 검증 모델을 다시 정해야 함(우리 Codex CLI 계정에서는 6.2가 막혀 6.1 Sol로 개발 중).
- DESIGN.md 8.5 결정 반영 구현: `app/globals.css`에 `warn` · `warn-soft` 토큰, MCP Apps 카드(`lib/mcp/apps.ts`) 색을 2절 토큰에 맞춤, `goalSummary`의 미착수 표시 ⚪ → ⬜(`lib/supervisor/goal.ts`), 대시보드 이탈 경고에 `warn`. 정지훈(A1 · A2 파일), 단계 2 A2와 함께.
- 교차 계열 판정: A2(#162)는 `verify_feature`의 선택 입력 `developed_with`(`codex` · `claude-code`)로 계열을 넘김. 값이 없으면(Antigravity 등) 계열을 거르지 않으므로 `VERIFIER_MODELS` 순서가 판정 모델을 정함.
- 실제 프로젝트로 핵심 고리 검증: 단계 2 완료 뒤 시작(보류 기능을 꺼내는 조건과 같음).

## 4. 사람 일 (계속 진행)

- 1-1 인용 정밀도 사람 라벨 · KPI
- 1-9 사람 블라인드 채점(도구는 CX-1)
- 인터뷰 10명, 운영 지표(계획 7절)
