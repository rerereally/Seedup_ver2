# 문서 목록

문서마다 용도와 상태 한 줄입니다. 상태: **방향 기준** / **현행** / **결정 대기** / **보관**. 계획 문서끼리 어긋나면 [supervisor-plan.md](supervisor-plan.md)를 따르고, 문서와 코드가 어긋나면 문서를 코드에 맞춥니다([CONTRIBUTING.md](../CONTRIBUTING.md) 8절).

## 저장소 루트

| 문서 | 용도 | 상태 |
| :--- | :--- | :--- |
| [README.md](../README.md) | 서비스 소개, 기능, 설치 · 실행 · 배포 방법 | 현행 |
| [DESIGN.md](../DESIGN.md) | 디자인 시스템(v2): 토큰 · 컴포넌트 · 화면 규칙 | 현행 |
| [AGENTS.md](../AGENTS.md) | 에이전트가 작업 전에 읽는 규칙 | 현행 |
| [CONTRIBUTING.md](../CONTRIBUTING.md) | 작업 규약: 브랜치 · PR · 마이그레이션 · 문서 갱신 | 현행 (2026-11-21 완화) |

## docs/

| 문서 | 용도 | 상태 |
| :--- | :--- | :--- |
| [supervisor-plan.md](supervisor-plan.md) | 목표 중심 에이전트 개발 흐름 계획, 단계별 작업 분배 | 방향 기준 |
| [status.md](status.md) | 지금 상태, 단계별 진행, 결정 대기 (계속 갱신) | 현행 |
| [decisions.md](decisions.md) | 결정 기록(새 결정이 맨 위) | 현행 |
| [pitch-strategy-2026-11-21.md](pitch-strategy-2026-11-21.md) | 해커톤 발표 전략 | 현행, 해커톤이 끝나면 보관 |
| [pitch-script-2026-11-21.md](pitch-script-2026-11-21.md) | 해커톤 발표 대본 | 현행, 해커톤이 끝나면 보관 |
| [service-plan.md](service-plan.md) | 2026-11-18 서비스 분석과 작업 계획, 진단 근거 | 현행 (계획과 어긋나면 최상위 계획을 따름) |
| [scorecard.md](scorecard.md) | AI 공학 성적표: PRD 품질 · 인용 정밀도 수치 | 현행 |
| [user-interview.md](user-interview.md) | 사용자 확인(인터뷰) 진행 가이드 | 현행 |
| [hosting.md](hosting.md) | 호스팅 위치 비교 자료 | 결정 대기 (비용이 드는 결정이라 사용자가 정함) |
| [prd-builder-split.md](prd-builder-split.md) | PRD 화면(`PrdBuilder`) 나누기 리팩터링 계획 | 현행 (시작 전) |
| [trend-and-recommendation-review.md](trend-and-recommendation-review.md) | 트렌드 수집과 추천 알고리즘 평가 | 현행 |
| [prompts/aside-evidence-backfill.md](prompts/aside-evidence-backfill.md) | 근거 보강(계획 3-10)용 Aside 원문 수집 프롬프트 | 현행 |
| [prompts/codex-deferred-2026-11-21.md](prompts/codex-deferred-2026-11-21.md) | 보류 항목을 맡길 때 쓰는 Codex 프롬프트 모음 | 현행 |
| [prompts/client-check.md](prompts/client-check.md) | 사람용 확인 순서: 클라이언트별 실제 연결(클라이언트 호환 ②) | 현행 |
| `hackathon-judging-2026-11-19.md` | 해커톤 모의 심사와 발표안 | 현행, 해커톤이 끝나면 보관. 아직 저장소에 커밋되지 않음(메인 체크아웃에만 있음) |
| [research/project-check-template.md](research/project-check-template.md) | 실제 프로젝트 검증 기록 양식 | 현행 |
| [research/2026-11-20-antigravity.md](research/2026-11-20-antigravity.md) | Antigravity 확인 조사(규칙 파일 · 원격 MCP · 훅 · 개발 모델) | 참고 |
| [research/2026-11-20-section9.md](research/2026-11-20-section9.md) | 계획 9절 확인 조사 보고서(훅 · MCP 클라이언트 · GitHub · Workers · 외부 출처 · OpenRouter · DB) | 참고 |
| [archive/prompts/](archive/README.md#끝난-작업의-시작-프롬프트) | 끝난 작업의 시작 · 조사 프롬프트 13개(단계 1 · 2 칸, Antigravity, 11-20 계획 세션 인계) | 보관 |
| [archive/](archive/README.md) | 대체되거나 최상위 계획으로 흡수된 문서 17개, 문서마다 옮긴 이유 | 보관 |
