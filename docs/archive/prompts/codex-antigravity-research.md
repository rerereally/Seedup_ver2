# Codex 조사 프롬프트: Antigravity 확인 조사 (클라이언트 호환 ①)

계획 세션(장차희)이 지시하고 Codex(GPT 6.1 Sol, 웹 검색 켬)가 조사합니다. 계획은 [supervisor-plan.md](../../supervisor-plan.md) 5절 "클라이언트 호환과 실제 연결 확인" ①, 형식은 [9절 조사 보고서](../../research/2026-11-20-section9.md)와 같습니다. **코드는 고치지 않습니다.** 결과는 계획 세션이 3-2의 클라이언트별 지원 수준 표에 반영합니다.

## 붙여 넣을 프롬프트

```
너는 Seedup 저장소의 조사 담당이다. 코드는 한 줄도 고치지 않고, 결과 보고서 파일 하나만 쓴다.

[먼저 읽기 — 이것만]
docs/supervisor-plan.md의 3-2(클라이언트별 지원 수준 표와 "작동" 기준 다섯 가지), docs/research/2026-11-20-section9.md(형식 참고, 1 · 2절),
lib/mcp/clients.ts(Antigravity 설치 안내), lib/supervisor/hook-bundle.ts, lib/opportunities/spec.ts의 EXPORT_FILES.

[조사할 것 — Google Antigravity, 공식 문서 · 공식 저장소만 근거]
1. 규칙 파일: 에이전트가 세션마다 자동으로 읽는 프로젝트 파일(AGENTS.md, GEMINI.md, .agent/rules 등)의 이름 · 위치 · 우선순위.
2. 원격 MCP: ~/.gemini/config/mcp_config.json의 serverUrl 형식, 인증 헤더 지원 여부(Authorization: Bearer) 또는 주소형 토큰만 되는지. lib/mcp/clients.ts 안내가 맞는지 대조.
3. 서버 안내문: initialize 응답의 instructions를 모델에 넣는지, 길이 제한.
4. 훅: 세션 시작 · 압축 · 종료 같은 수명주기 훅을 지원하는지, 입력 형식, 종료를 막고 이어 가게 하는 방법, 사용자 승인 절차.
5. 사용자 확인 요청(elicitation)과 MCP Apps 카드 표시 지원 여부.
6. 개발 모델: Antigravity가 쓰는 모델 계열을 MCP 서버가 알 수 있는 방법(clientInfo 등). Seedup 검증은 개발과 다른 계열이 판정해야 함(decisions.md "검증 모델").
7. Windows에서 훅 · 명령 실행 환경(sh 필요 여부).

[결과 — 워크트리 루트의 RESEARCH.md 하나에만 쓰고 커밋하지 마]
- 맨 위: 3-2 표의 Antigravity 열을 이렇게 채우면 된다(기준마다 한 줄, 확인 / 확인 못 함).
- 항목마다: 결론 한 줄 → 근거(링크, 확인 날짜) → 우리 계획에 주는 영향(어느 칸 · 파일).
- lib/mcp/clients.ts · hook-bundle.ts와 어긋나는 곳은 파일 · 줄로.
- 추정과 확인을 섞지 마. 확인 못 한 것은 그렇게 적어.

[하지 말 것]
- 저장소의 어떤 파일도 고치거나 새로 만들지 마(RESEARCH.md만 예외). git 커밋 · push · PR · 브랜치 변경 금지.
- 비밀값을 읽지 마. 유료 API를 호출하지 마.
```
