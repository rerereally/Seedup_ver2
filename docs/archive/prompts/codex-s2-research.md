# Codex 시작 프롬프트: 9절 "확인이 필요한 것" 조사

계획 세션(장차희)이 지시하고 Codex(GPT 6.1 Sol, 웹 검색 켬)가 조사합니다. 계획은 [supervisor-plan.md](../../supervisor-plan.md) 5절 "단계 2에 함께 하는 것"의 9절 조사, 대상은 9절 목록. **코드는 고치지 않습니다.** 결과는 계획 세션이 9절과 보류 기능 크기 판단에 반영합니다.

## 실행 방식

- 계획 세션이 `origin/main`에서 별도 worktree를 만들고 `codex --search exec`로 넘깁니다(읽기 위주, 보고서 파일 하나만 씀).
- 공식 문서 · 공식 가격표 · 저장소 코드만 근거로 삼고, 근거 링크와 확인 날짜를 남깁니다. 확인하지 못한 것은 "확인 못 함"으로 적습니다.

## 붙여 넣을 프롬프트

```
너는 Seedup 저장소의 조사 담당이다. 코드는 한 줄도 고치지 않고, 결과 보고서 파일 하나만 쓴다.

[먼저 읽기 — 이것만]
docs/supervisor-plan.md의 1절 결정 표, 3-2, 3-4, 3-7, 3-8, 3-9, 3-10, 9절. lib/supervisor/hook-bundle.ts(지금 만드는 훅 파일), lib/verifier/github.ts(GitHub 호출), wrangler.jsonc.

[조사할 것 — 9절 목록 순서대로]
1. 훅 형식
   - Claude Code 훅: SessionStart · PreCompact · Stop의 입력 JSON 필드(특히 transcript_path, session_id, source), Stop에서 종료를 막고 이어 가게 하는 방법(반환 형식), matcher 값. 공식 문서 근거.
   - Claude Code의 OpenTelemetry 지표 이름(토큰 · 비용).
   - Codex CLI 훅: 지원하는 이벤트, 입력 형식, 사용자 승인(/hooks) 필요 여부. Codex 세션 로그(~/.codex/sessions) 파일 형식과 토큰 사용량 필드.
   - lib/supervisor/hook-bundle.ts가 만드는 설정이 위 형식과 맞는지 대조하고, 어긋나는 곳을 파일 · 줄로 적어.
2. MCP 클라이언트별 지원
   - initialize 응답의 instructions를 반영하는지(Claude Code, Codex, Cursor, VS Code), 서버가 사용자에게 직접 묻는 기능(elicitation) 지원 여부, MCP Apps 카드 렌더링 지원 여부. 표로.
3. 검증 실행 환경
   - GitHub REST API 한도: 인증 토큰 1개 기준 시간당 요청 수, lib/verifier/github.ts가 검증 1회에 쓰는 요청 수 추정(코드를 읽고 세어), 그래서 시간당 가능한 검증 횟수.
   - Cloudflare Workers: 요청 하나의 실행 시간 · CPU 제한(무료 · 유료), 응답 뒤 waitUntil 제한, Workflows · Durable Objects · Queues 제공 플랜과 가격. Seedup의 요금제는 알 수 없으면 "확인 못 함"으로 두고 플랜별로 적어.
4. Cloudflare Browser Rendering: 제공 플랜, 가격, 동시 세션 · 시간 제한.
5. 외부 근거 출처 약관 · API: App Store 고객 리뷰 피드(공식 RSS 여부), 네이버 검색 API(블로그 · 카페 · 지식iN, 하루 한도, 상업 이용 조건), YouTube Data API 댓글(쿼터, 약관상 저장 제한). 각각 "원문 일부를 저장 · 인용해도 되는가"를 중심으로.
6. OpenRouter: provider.data_collection = "deny" 옵션의 실제 동작(공식 문서), GPT 6.2 Sol과 Haiku 5.5를 OpenRouter에서 부를 수 있는지와 모델 ID, 그 경로가 데이터 수집 거부와 함께 쓸 수 있는지.
7. DB 필드: supabase/migrations를 읽고 GitHub 트렌드 · AI 제품 테이블에 라이선스 · 패키지 이름(npm 등) 필드가 있는지. 없으면 어디서 얻을 수 있는지(GitHub API의 license 필드 등).
(codebase-memory-mcp 출력 형식과 운영 PRD 채움 비율은 이번 범위에서 빼.)

[결과 — 워크트리 루트의 RESEARCH.md 하나에만 쓰고 커밋하지 마]
- 항목마다: 결론 한 줄 → 근거(링크, 확인 날짜) → 우리 계획에 주는 영향(어느 절 · 칸, 보류 기능 크기에 미치는 영향).
- 맨 위에 "계획 9절을 이렇게 바꾸면 된다"는 제안 목록(확인된 것은 지우고 사실로 옮길 곳, 새로 생긴 확인 항목).
- 추정과 확인을 섞지 마. 확인 못 한 것은 그렇게 적어.

[하지 말 것]
- 저장소의 어떤 파일도 고치거나 새로 만들지 마(RESEARCH.md만 예외). git 커밋 · push · PR · 브랜치 변경 금지.
- 비밀값(.env 등)을 읽지 마. 유료 API를 실제로 호출하지 마.
```
