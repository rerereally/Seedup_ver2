# Seedup 상태

마지막 갱신 2026-11-20. 계획은 [supervisor-plan.md](supervisor-plan.md)(최상위 계획)를 따르고, 이 파일은 **지금 어디까지 왔는지만** 적습니다. 날짜별 진행 기록 파일은 따로 만들지 않고 이 파일을 고칩니다. 바꿀 때는 맨 위 날짜를 고치고, 숫자는 아래 "확인 방법"으로 직접 다시 셉니다.

## 1. 지금 상태

| 항목 | 상태 | 확인 방법 |
| :--- | :--- | :--- |
| 머지된 PR | #79~#124 (#124는 최상위 계획 문서). 열린 PR 없음 | `gh pr list --state merged` |
| Antigravity 작업(AG) | AG-1~9 **전부 완료** | [archive/antigravity-tasks.md](archive/antigravity-tasks.md) |
| Codex 작업(CX) 완료 | CX-1~6, CX-9~13, CX-15, CX-16 | [archive/codex-tasks.md](archive/codex-tasks.md), PR 제목 |
| Codex 작업(CX) 남음 | CX-7 고정 뼈대와 추가 모듈, CX-8 대상별 출력, CX-14 서버 버전 기록과 항목별 댓글. 셋 다 계획 5절 "보류"로 감(CX-14의 버전 기록만 단계 1로) | [supervisor-plan.md](supervisor-plan.md) 10-2 |
| DB 마이그레이션 | 30개. **운영 DB 미적용: `20261120130000_section_views.sql` 하나** | `ls supabase/migrations`, `check-schema` |
| 단위 테스트 | 318개 중 317개 통과(48개 파일). 실패 1개는 `tests/prd-exports.test.ts`의 gh 명령 테스트로, `/bin/sh`가 없는 Windows에서만 실패하고 Linux CI에서는 통과 | `npm test` |
| MCP | 도구 16개, 프롬프트 4개, 리소스 2개 | `lib/mcp/server.ts` |

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
| 1 목표 잠금 · 에이전트 연결 | A1 공유 타입 · 목표 모델 · 훅 번들 | 정지훈 · Claude Code | 시작 전 | 공유 타입이 가장 먼저 단독 PR |
| 1 | A2 MCP 목표 연결 · 공유 메모리 도구 | 정지훈 · Codex | 시작 전 | |
| 1 | A3 기준 측정 · 발표 서사 | 정지훈 · Antigravity | 시작 전 | |
| 1 | B1 저장(프로젝트 · 목표 버전 · 공유 메모리) | 장차희 · Claude Code | 시작 전 | |
| 1 | B2 기획 탭 목표 카드와 잠금 화면 | 장차희 · Codex | 시작 전 | |
| 2 2단 검증 · 이탈 검사 | A1 정적 검사 · 검증 토큰 · 이탈 규칙 | 정지훈 · Claude Code | 시작 전 | 단계 1 뒤 |
| 2 | A2 MCP `verify_feature` · 완료 게이트 | 정지훈 · Codex | 시작 전 | |
| 2 | A3 불량 diff · 오탐률 · 데모 | 정지훈 · Antigravity | 시작 전 | |
| 2 | B1 서버 검증(단순형) | 장차희 · Claude Code | 시작 전 | 결정 대기 0-4가 전제 조건 |
| 2 | B2 `/supervisor` 대시보드 · `/agents` 스타터 팩 | 장차희 · Codex | 시작 전 | |

## 3. 결정 대기

[supervisor-plan.md](supervisor-plan.md) 10-2에서 "결정 대기"인 항목입니다. 결정은 계획 세션에서 하고, 정해지면 이 표에서 지우고 계획 문서에 반영합니다.

| 항목 | 묶인 단계 | 정할 것 |
| :--- | :--- | :--- |
| 0-4 사용자 코드 · 아이디어가 무료 모델로 감 | 단계 2 전제 조건 | 무엇이 어느 모델로 가는지 개인정보 처리방침에 어떻게 밝힐지 |
| 3-4 메뉴 정리 · 범위 동결 | 단계 0 | 출시 때 앞에 둘 메뉴와 숨기거나 베타로 표시할 화면 |
| 로그인 없이 PRD 만들기 | 단계 0 | 허용 여부와 한도 |

## 4. 사람 일 (계속 진행)

- 1-1 인용 정밀도 사람 라벨 · KPI
- 1-9 사람 블라인드 채점(도구는 CX-1)
- 인터뷰 10명, 운영 지표(계획 7절)
