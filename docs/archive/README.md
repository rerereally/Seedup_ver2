# 보관 문서

2026-11-20에 [supervisor-plan.md](../supervisor-plan.md)가 최상위 계획이 되면서 옮긴 문서입니다. 기록으로만 남기고 더 고치지 않습니다. 지금 상태는 [status.md](../status.md), 계획은 [supervisor-plan.md](../supervisor-plan.md)를 봅니다.

## 대체됨

| 문서 | 왜 옮겼나 | 무엇이 대체했나 |
| :--- | :--- | :--- |
| [final-report.md](final-report.md) | 2026-11-14 PR #1~#3 기준 보고서라 지금 코드와 다름 | [status.md](../status.md), [scorecard.md](../scorecard.md) |
| [improvement-plan.md](improvement-plan.md) | 2026-11-14 개선 계획, 이후 계획들로 여러 번 대체됨 | [supervisor-plan.md](../supervisor-plan.md) |
| [next-tasks.md](next-tasks.md) | 2026-11-14 세션 인계용 작업 목록, 끝났거나 계획으로 옮겨짐 | [supervisor-plan.md](../supervisor-plan.md) 5절, [status.md](../status.md) |
| [improvement-audit-2026-11-19.md](improvement-audit-2026-11-19.md) | PR #78 기준 감사, P0~P2 항목은 #79~#85로 처리됨 | [status.md](../status.md), 남은 항목은 계획 10-2 |
| [platform-roadmap.md](platform-roadmap.md) | 2026-11-17 플랫폼 방향, 목표 중심 계획으로 다시 정함 | [supervisor-plan.md](../supervisor-plan.md) 0~2절 |
| [agent-build-map-plan.md](agent-build-map-plan.md) | 원문 → PRD → 코드 기능 A~J 계획, 상당 부분 #65~#78로 구현되고 나머지는 계획으로 다시 정함 | [supervisor-plan.md](../supervisor-plan.md) 3절, README 주요 기능 |
| [redesign-plan.md](redesign-plan.md) | 2026-11-18 전면 개편 계획, 적용 끝남 | [DESIGN.md](../../DESIGN.md) |
| [ui-plan.md](ui-plan.md) | 2026-11-18 화면 계획, 개편과 이후 작업으로 대체됨 | [DESIGN.md](../../DESIGN.md), [service-plan.md](../service-plan.md) |

## 최상위 계획으로 흡수됨

| 문서 | 왜 옮겼나 | 무엇이 대체했나 |
| :--- | :--- | :--- |
| [work-plan-merged-2026-11-20.md](work-plan-merged-2026-11-20.md) | 세 계획을 합친 통합 계획, 남은 항목이 계획 10-2로 옮겨짐 | [supervisor-plan.md](../supervisor-plan.md) 10-2 |
| [ai-agent-work-plan.md](ai-agent-work-plan.md) | 통합 계획의 원본 중 하나 | [supervisor-plan.md](../supervisor-plan.md) 10-2 |
| [codex-tasks.md](codex-tasks.md) | CX-1~16 중 CX-7 · 8 · 14 외 완료, 남은 것은 보류로 옮겨짐 | [status.md](../status.md), 계획 5절 "보류" |
| [antigravity-tasks.md](antigravity-tasks.md) | AG-1~9 전부 완료 | [status.md](../status.md) |
| [progress-2026-11-20.md](progress-2026-11-20.md) | 날짜별 진행 기록, 이제 상태는 한 파일에서 갱신 | [status.md](../status.md) |

## 커밋 안 됐던 개인 문서

메인 체크아웃에만 있던 2026-11-16 문서를 기록으로 커밋했습니다.

| 문서 | 왜 옮겼나 | 무엇이 대체했나 |
| :--- | :--- | :--- |
| [hackathon-playbook.md](hackathon-playbook.md) | 프로젝트와 무관한 해커톤 일반 원칙 | 없음(참고용) |
| [hackathon-topic-ideas.md](hackathon-topic-ideas.md) | Seedup 대신 고를 만한 주제 후보, 주제는 Seedup으로 정해짐 | 없음(참고용) |
| [seedup-evaluation-strategy.md](seedup-evaluation-strategy.md) | `fe33b53` 기준 평가와 해커톤 전략, 코드가 많이 바뀜 | [scorecard.md](../scorecard.md), [supervisor-plan.md](../supervisor-plan.md) |
| [seedup-improvements-global-strategy.md](seedup-improvements-global-strategy.md) | 위 평가를 옮긴 개선 목록, 이후 계획들로 대체됨 | [supervisor-plan.md](../supervisor-plan.md) |

## 계획 검토 자료(PDF)

2026-11-20 계획 세션에서 만든 PDF입니다. 내용은 Markdown 계획에 반영돼 있고, 근거 기록으로만 둡니다.

| 문서 | 왜 옮겼나 | 무엇이 대체했나 |
| :--- | :--- | :--- |
| [seedup-v3-review-2026-11-20.pdf](seedup-v3-review-2026-11-20.pdf) | v3 계획 검토(main `05cda90` 기준)와 작업 분배 근거 | [supervisor-plan.md](../supervisor-plan.md) |
| [seedup-plan-2026-11-20.pdf](seedup-plan-2026-11-20.pdf) | 같은 날 계획 문서를 PDF로 뽑은 것 | [supervisor-plan.md](../supervisor-plan.md)(이후 갱신은 Markdown에만) |

## 끝난 작업의 시작 프롬프트

2026-11-21에 `docs/prompts/`에서 옮긴 프롬프트입니다. 작업이 PR로 끝나 다시 쓰지 않습니다.

| 문서 | 무슨 작업 | 결과 |
| :--- | :--- | :--- |
| [prompts/codex-s1-a2.md](prompts/codex-s1-a2.md) | 단계 1 A2 MCP 목표 연결 · 공유 메모리 | #142 |
| [prompts/codex-s2-a2.md](prompts/codex-s2-a2.md) | 단계 2 A2 `verify_feature` 서버 검증 연결 | #162 |
| [prompts/codex-s2-b1.md](prompts/codex-s2-b1.md) | 단계 2 B1 서버 검증 단순형 | #151 |
| [prompts/codex-s2-b2.md](prompts/codex-s2-b2.md) | 단계 2 B2 `/supervisor` · `/agents` 스타터 팩 | #153 |
| [prompts/codex-handoff-web.md](prompts/codex-handoff-web.md) | 기획 → 에이전트 연결 1단계 | #163 |
| [prompts/codex-privacy-wording.md](prompts/codex-privacy-wording.md) | 처리방침 입력별 모델 · 보관 범위 | #167, 이후 #218 |
| [prompts/codex-scorecard-refresh.md](prompts/codex-scorecard-refresh.md) | 성적표 정적 검사 숫자 갱신 | #168 |
| [prompts/codex-s2-research.md](prompts/codex-s2-research.md) | 계획 9절 확인 조사 | [research/2026-11-20-section9.md](../research/2026-11-20-section9.md) |
| [prompts/antigravity-s1-a3.md](prompts/antigravity-s1-a3.md) | 단계 1 A3 기준 측정 · 발표 서사 | #136 · #141 |
| [prompts/antigravity-s2-a3.md](prompts/antigravity-s2-a3.md) | 단계 2 A3 불량 diff · 오탐률 · 데모 | #158 |
| [prompts/antigravity-remaining.md](prompts/antigravity-remaining.md) | 단계 2 보완 · 연결 2 · 세 입구 · 흐름 E2E | #166 · #170~#178 |
| [prompts/codex-antigravity-research.md](prompts/codex-antigravity-research.md) | Antigravity 확인 조사 | [research/2026-11-20-antigravity.md](../research/2026-11-20-antigravity.md), 이후 Antigravity 지원 중단 |
| [prompts/astra-planning.md](prompts/astra-planning.md) | 2026-11-20 오후 계획 세션 인계(Astra) | 상태와 규약이 바뀜. 지금 상태는 [status.md](../status.md), 규약은 [CONTRIBUTING.md](../../CONTRIBUTING.md) |
