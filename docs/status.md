# Seedup 상태

마지막 갱신 2026-11-20(오후). 계획은 [supervisor-plan.md](supervisor-plan.md)(최상위 계획)를 따르고, 이 파일은 **지금 어디까지 왔는지만** 적습니다. 날짜별 진행 기록 파일은 따로 만들지 않고 이 파일을 고칩니다. 바꿀 때는 맨 위 날짜를 고치고, 숫자는 아래 "확인 방법"으로 직접 다시 셉니다.

## 1. 지금 상태

| 항목 | 상태 | 확인 방법 |
| :--- | :--- | :--- |
| 머지된 PR | #79~#137, #139~#142. #141은 발표 문서, #142는 단계 1 A2, #140은 단계 2 A1 일부 | `gh pr list --state merged --limit 20` |
| 열린 PR | 갱신 시점 기준 기능 PR 없음 | `gh pr list` |
| 문서 | 최상위 계획 · 상태 · 문서 목록 · 결정 기록 · 작업 규약(`CONTRIBUTING.md`) 갖춤. 낡은 문서 17개는 `docs/archive/`. 단계 1 A2 · A3 시작 프롬프트는 `docs/prompts/` | [README.md](README.md) |
| 역할 | 장차희 총괄 · 계획, 정지훈 기술 구현 · 머지 · 운영 DB 마이그레이션 적용. 정지훈이 맡긴 Claude Code 머지 세션은 4절 점검 조건을 따름(마이그레이션 PR과 자기 PR 제외) | `CONTRIBUTING.md` 1 · 4 · 7절 |
| `main` 머지 | 해커톤 발표용 머지 동결 해제. 규약 4절에 따라 CI · 리뷰 · 계획 순서를 충족한 PR을 계속 머지 | `CONTRIBUTING.md` 4 · 9절, [결정 기록](decisions.md) |
| Antigravity 작업(AG) | AG-1~9 **전부 완료** | [archive/antigravity-tasks.md](archive/antigravity-tasks.md) |
| Codex 작업(CX) 완료 | CX-1~6, CX-9~13, CX-15, CX-16 | [archive/codex-tasks.md](archive/codex-tasks.md), PR 제목 |
| Codex 작업(CX) 남음 | CX-7 고정 뼈대와 추가 모듈, CX-8 대상별 출력, CX-14 서버 버전 기록과 항목별 댓글. 셋 다 계획 5절 "보류"로 감(CX-14의 버전 기록만 단계 1로) | [supervisor-plan.md](supervisor-plan.md) 10-2 |
| DB 마이그레이션 | 31개. 운영 적용 확인 필요: `20261120130000_section_views.sql`(이전 기록상 미적용), `20261120150000_supervisor_projects.sql`(#131에서 추가) | `ls supabase/migrations`, `check-schema` |
| 단위 테스트 | 349개(53개 파일). #140에서 8개, #142에서 7개 추가. 최신 `main` 전체 실행 결과는 CI에서 확인 | `npm test` |
| MCP | 도구 22개, 프롬프트 4개, 리소스 2개 | `lib/mcp/server.ts` |

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
| 0 지금 출시 | 운영 `section_views` 적용, `OPENROUTER_FREE_ONLY=true` 확인 | 사람 | 시작 전 | |
| 0 | 대표 흐름만 앞에, 로그인 → PRD → 내보내기 → MCP 직접 확인 | 사람 | 시작 전 | 메뉴 정리 · 로그인 없이 PRD는 결정 대기(3절) |
| 0 | 알리기 | 사람 | 시작 전 | |
| 1 목표 잠금 · 에이전트 연결 | A1 공유 타입 · 목표 모델 · 훅 번들 | 정지훈 · Claude Code | 공유 타입(#132)과 나머지(#137) 머지 | 목표 모델 · 사람 할 일 · 훅 번들. 실제 Claude Code 세션에서 훅 확인 필요 |
| 1 | A2 MCP 목표 연결 · 공유 메모리 도구 | 정지훈 · Codex | PR #142 머지 | B1 운영 마이그레이션 적용 여부와 실제 MCP 클라이언트 연결 확인 필요 |
| 1 | A3 기준 측정 · 발표 서사 | 정지훈 · Antigravity | PR #136 · #141 머지(일부 완료) | 기준 측정과 10분 발표 · 5분 질의응답 대본, 발표 전략 반영. PR 보고상 운영 저장 PRD 표본 없음. 목표 도달률 계산은 남음 |
| 1 | B1 저장(프로젝트 · 목표 버전 · 공유 메모리) | Claude Code(기술 책임 정지훈) | PR #131 머지 | 공유 타입 반영. 정지훈이 운영 마이그레이션 `20261120150000_supervisor_projects.sql` 적용 여부 확인 |
| 1 | B2 기획 탭 목표 카드와 잠금 화면 | Codex(기술 책임 정지훈) | PR #133 머지(Claude Code 세션이 대신 진행) | B1 뒤에 머지. 로그인 상태 실제 저장 확인과 원문 0건 PRD의 저장 ID 전달이 남음 |
| 1 보완 | 목표 재잠금 → 기능 재확인, 목표 카드 A1 판정 · 성공 기준 id 버그, 사람이 먼저 할 일 표시 | 정지훈 · Claude Code | 계획 반영(시작 전) | 단계 2 A2보다 먼저 머지(`lib/mcp/server.ts` 겹침) |
| 2 2단 검증 · 이탈 검사 | A1 정적 검사 · 검증 토큰 · 이탈 규칙 | 정지훈 · Claude Code | PR #140 머지(일부) | 계획 순서와 달리 단계 1 A2(#142)보다 앞서 머지. 로컬 훅 1단 검사는 남음 |
| 2 | A2 MCP `verify_feature` · 완료 게이트 | 정지훈 · Codex | 시작 전 | |
| 2 | A3 불량 diff · 오탐률 · 데모 | 정지훈 · Antigravity | 시작 전 | |
| 2 | B1 서버 검증(단순형) | Claude Code(기술 책임 정지훈) | 시작 전 | 결정 대기 0-4가 전제 조건 |
| 2 | B2 `/supervisor` 대시보드 · `/agents` 스타터 팩 | Codex(GPT 6.2 Sol, 장차희 계획 세션이 지시 · 기술 책임 정지훈) | 진행 중(2026-11-20 시작) | [프롬프트](prompts/codex-s2-b2.md). 서버 검증 전이라 ⚪ · 🔵만 표시 |

## 3. 결정 대기

[supervisor-plan.md](supervisor-plan.md) 10-2에서 "결정 대기"인 항목입니다. 결정은 계획 세션에서 하고, 정해지면 이 표에서 지우고 계획 문서에 반영합니다.

| 항목 | 묶인 단계 | 정할 것 |
| :--- | :--- | :--- |
| 0-4 사용자 코드 · 아이디어가 어느 모델로 가나 | 단계 2 전제 조건 | 계획 세션 제안: 아이디어 · PRD는 무료 모델 유지 + 처리방침과 화면에 "무료 모델 제공사가 입력을 기록 · 학습에 쓸 수 있음" 명시, 코드(검증)는 데이터 수집을 거부하는 유료 경로로만 보내고 처리방침에 명시. OpenRouter 데이터 수집 거부 설정 동작은 확인 필요 |
| 머지 위임(PR #135) | 모든 단계 | #135로 규약 반영됨. 장차희의 확인과 `decisions.md` 기록은 결정 대기 |
| 3-4 메뉴 정리 · 범위 동결 | 단계 0 | 출시 때 앞에 둘 메뉴와 숨기거나 베타로 표시할 화면 |
| 로그인 없이 PRD 만들기 | 단계 0 | 허용 여부와 한도 |

## 4. 사람 일 (계속 진행)

- 1-1 인용 정밀도 사람 라벨 · KPI
- 1-9 사람 블라인드 채점(도구는 CX-1)
- 인터뷰 10명, 운영 지표(계획 7절)
