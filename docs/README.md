# 문서 목록

문서마다 용도와 상태 한 줄입니다. 상태: **최상위 계획** / **현행** / **결정 대기** / **보관**. 계획과 어긋나는 문서가 있으면 [supervisor-plan.md](supervisor-plan.md)를 따릅니다.

## 저장소 루트

| 문서 | 용도 | 상태 |
| :--- | :--- | :--- |
| [README.md](../README.md) | 서비스 소개, 기능, 설치 · 실행 · 배포 방법 | 현행 |
| [DESIGN.md](../DESIGN.md) | 디자인 시스템(v2): 토큰 · 컴포넌트 · 화면 규칙 | 현행 |
| [AGENTS.md](../AGENTS.md) | 에이전트가 작업 전에 읽는 규칙 | 현행 |

## docs/

| 문서 | 용도 | 상태 |
| :--- | :--- | :--- |
| [supervisor-plan.md](supervisor-plan.md) | 목표 중심 에이전트 개발 흐름 계획, 단계별 작업 분배 | 최상위 계획 |
| [status.md](status.md) | 지금 상태, 단계별 진행, 결정 대기 (계속 갱신) | 현행 |
| [service-plan.md](service-plan.md) | 2026-11-18 서비스 분석과 작업 계획, 진단 근거 | 현행 (계획과 어긋나면 최상위 계획을 따름) |
| [scorecard.md](scorecard.md) | AI 공학 성적표: PRD 품질 · 인용 정밀도 수치 | 현행 |
| [user-interview.md](user-interview.md) | 사용자 확인(인터뷰) 진행 가이드 | 현행 |
| [hosting.md](hosting.md) | 호스팅 위치 비교 자료 | 결정 대기 (비용이 드는 결정이라 사용자가 정함) |
| [prd-builder-split.md](prd-builder-split.md) | PRD 화면(`PrdBuilder`) 나누기 리팩터링 계획 | 현행 (시작 전) |
| [trend-and-recommendation-review.md](trend-and-recommendation-review.md) | 트렌드 수집과 추천 알고리즘 평가 | 현행 |
| [prompts/astra-planning.md](prompts/astra-planning.md) | Astra 시작 프롬프트: 계획 세션 이어받기(총괄 · 계획 보조) | 현행 |
| [prompts/codex-scorecard-refresh.md](prompts/codex-scorecard-refresh.md) | Codex 프롬프트: 성적표 감독관 정적 검사 숫자 갱신 | 현행 |
| [prompts/codex-privacy-wording.md](prompts/codex-privacy-wording.md) | Codex 프롬프트: 처리방침에 입력별 모델 · 보관 범위 | 현행 |
| [prompts/antigravity-remaining.md](prompts/antigravity-remaining.md) | Antigravity 시작 프롬프트: 단계 2 보완 ② · ④ · ⑤ · ⑥, 연결 2, 세 입구, 흐름 E2E(T1~T7) | 현행 |
| [prompts/codex-antigravity-research.md](prompts/codex-antigravity-research.md) | Codex 조사 프롬프트: Antigravity 확인(클라이언트 호환 ①) | 현행 |
| [prompts/client-check.md](prompts/client-check.md) | 사람용 확인 순서: 클라이언트별 실제 연결(클라이언트 호환 ②) | 현행 |
| [prompts/codex-handoff-web.md](prompts/codex-handoff-web.md) | Codex 시작 프롬프트: 기획 → 에이전트 연결 1단계(에이전트 단계 화면) | 현행 |
| [prompts/codex-s2-research.md](prompts/codex-s2-research.md) | Codex 조사 프롬프트: 9절 "확인이 필요한 것"(코드 변경 없음) | 현행 |
| [prompts/codex-s2-a2.md](prompts/codex-s2-a2.md) | Codex 시작 프롬프트: 단계 2 A2 (`verify_feature` 서버 검증 연결, 완료 게이트) | 현행 |
| [prompts/antigravity-s2-a3.md](prompts/antigravity-s2-a3.md) | Antigravity 시작 프롬프트: 단계 2 A3 (불량 diff · 오탐률 · 데모) | 현행 |
| [prompts/codex-s2-b1.md](prompts/codex-s2-b1.md) | Codex 시작 프롬프트: 단계 2 B1 (서버 검증 단순형, 0-4 A안) | 현행 |
| [prompts/codex-s2-b2.md](prompts/codex-s2-b2.md) | Codex 시작 프롬프트: 단계 2 B2 (최소 `/supervisor` · `/agents` 스타터 팩) | 현행 |
| [prompts/codex-s1-a2.md](prompts/codex-s1-a2.md) | Codex 시작 프롬프트: 단계 1 A2 (MCP 목표 연결 · 공유 메모리 도구) | 현행 (A1 · B1 머지 뒤 사용) |
| [prompts/antigravity-s1-a3.md](prompts/antigravity-s1-a3.md) | Antigravity 시작 프롬프트: 단계 1 A3 (기준 측정 · 발표 서사) | 현행 (지금 사용 가능) |
| `hackathon-judging-2026-11-19.md` | 해커톤 모의 심사와 발표안 | 현행, 해커톤이 끝나면 보관. 아직 저장소에 커밋되지 않음(메인 체크아웃에만 있음) |
| [research/project-check-template.md](research/project-check-template.md) | 실제 프로젝트 검증 기록 양식 | 현행 |
| [research/2026-11-20-antigravity.md](research/2026-11-20-antigravity.md) | Antigravity 확인 조사(규칙 파일 · 원격 MCP · 훅 · 개발 모델) | 참고 |
| [research/2026-11-20-section9.md](research/2026-11-20-section9.md) | 계획 9절 확인 조사 보고서(훅 · MCP 클라이언트 · GitHub · Workers · 외부 출처 · OpenRouter · DB) | 참고 |
| [archive/](archive/README.md) | 대체되거나 최상위 계획으로 흡수된 문서 17개, 문서마다 옮긴 이유 | 보관 |
