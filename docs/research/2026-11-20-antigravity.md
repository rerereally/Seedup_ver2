# 3-2 표의 Antigravity 열을 이렇게 채우면 된다

| 기준 | Antigravity 열 제안 |
| --- | --- |
| ① MCP 연결 | **확인:** 원격 Streamable HTTP의 `serverUrl` + Bearer `headers` 형식. **확인 못 함:** Seedup 실제 연결·도구 호출. |
| 규칙 파일 | **확인:** `AGENTS.md`·`GEMINI.md` 자동 주입, `.agents/rules/*.md`와 레거시 `.agent/rules/*.md` 지원. 규칙은 누적. |
| 서버 안내문 | **확인:** 초기화 instructions를 `instructions.md`로 저장하고 MCP 디렉터리를 시스템 프롬프트에 안내. **확인 못 함:** 안내문 전문의 자동 모델 주입·길이 제한. |
| ② 시작 때 목표 | **확인:** 규칙 자동 주입 및 SessionStart의 JSON `injectSteps` 지원. **확인 못 함:** Seedup 잠긴 목표의 실제 주입·압축 뒤 재주입. |
| ③ 종료 인계 | **확인:** Stop의 `decision: "continue"`로 실행 계속 가능. **확인 못 함:** Seedup 인계 동작. 현재 묶음은 Claude용. |
| ④ 커밋 전 검사 | **확인:** 저장소 묶음에 Git `pre-commit` 스크립트 제공, 수동 설치. **확인 못 함:** Antigravity·Windows에서 실제 차단. |
| ⑤ 교차 판정 | **확인:** Gemini·Claude 선택 가능, 로컬 훅 입력에 `modelName`. **확인 못 함:** 원격 MCP의 개발 모델 자동 식별·Seedup 교차 판정. |
| 공통 제약 | **확인:** 현재 Seedup 스크립트는 `sh` 필요. Antigravity 전체의 필수 조건으로 일반화하지 않는다. Windows 훅 실행 셸은 확인 못 함. |

확인일: **2026-11-20 (KST)**. 아래 링크도 모두 이날 열람했다. `확인`은 공식 공개 문서·저장소 또는 지정 로컬 코드의 정적 확인이다. 계획 3-2의 “작동”은 다섯 기준을 **실제 클라이언트에서** 확인해야 하므로, 이번 조사만으로 어느 기준도 실기 완료로 바꾸지 않는다.

조사 범위: 지정된 선독 자료를 먼저 읽고, 모델 결정 확인을 위해 `docs/decisions.md`의 “검증 모델” 및 계획의 담당 칸을 추가 확인했다. 외부 근거는 Google 공식 문서와 공식 저장소만 사용했다. 공식 저장소의 일반 사용자 이슈는 제품 보증으로 채택하지 않았다. 비밀값·사용자 로그·개인 설정은 읽지 않았고, 제품 실행·설치·유료 API 호출은 하지 않았다. 계획·코드는 변경하지 않았다.

## 1. 프로젝트 규칙 파일

**결론 — 현재 공식 문서는 `AGENTS.md`를 직접 지원한다. 별도의 `GEMINI.md` 복제는 필수라는 근거가 없다.**

**근거 (확인):** [Rules](https://antigravity.google/docs/rules), [Customization discovery](https://antigravity.google/docs/customization-discovery/) — 확인일 2026-11-20.

| 범위 | 자동 탐색 위치 |
| --- | --- |
| 프로젝트 | workspace부터 저장소 루트까지 각 디렉터리의 `AGENTS.md`, `GEMINI.md`, `.agents/AGENTS.md`, `.agents/GEMINI.md`, `.agents/rules/*.md` |
| 레거시 | `.agent/rules/*.md`도 인식. 새 프로젝트는 `.agents/` 권장. |
| 전역 | `~/.gemini/AGENTS.md`, `~/.gemini/GEMINI.md`, `~/.gemini/config/AGENTS.md`, `~/.gemini/config/GEMINI.md`, `~/.gemini/config/rules/*.md` |

`AGENTS.md`·`GEMINI.md`는 frontmatter 없이 항상 활성화된다. 모듈 규칙은 유효한 YAML `trigger`가 필요하며, 항상 넣으려면 `always_on`을 쓴다. workspace 아래 하위 폴더는 자동 탐색하지 않는다. rules 디렉터리도 기본적으로 바로 아래 `.md`만 찾는다.

우선순위는 **덮어쓰기보다 누적**이다. 규칙은 모두 합쳐지며, `AGENTS.md > GEMINI.md` 또는 전역·프로젝트 충돌의 확정 승자 순서는 확인 못 했다. discovery 문서의 이름 중복 우선순위는 skill·custom agent에 관한 것이므로 규칙에 적용하지 않는다. 규칙·skill은 매 턴 다시 읽는다.

파일당 24,000바이트 제한과 활성 전역·always_on 규칙 합계 20,000토큰 예산이 있다. 초과 시 파일 절단 또는 큰 규칙의 경로 포인터 전환이 가능하다. 파일 참조만 남는 것과 목표 전문 주입을 구분해야 한다.

**계획 영향 (제안):** 3-2의 규칙 파일 칸, “기획→에이전트 연결” 2단계 및 클라이언트 호환 ③에 반영한다. `lib/opportunities/spec.ts:175`의 `EXPORT_FILES.agents = 'AGENTS.md'`는 현재 공식 지원과 일치한다. `lib/supervisor/hook-bundle.ts:13`의 `.seedup/goal.md`는 자동 규칙 경로가 아니다. 목표가 그 파일에만 있으면 ②를 충족했다고 볼 수 없다. 내보내기 내용의 완전성은 이번 범위에서 추가 검증하지 않았다.

## 2. 원격 MCP와 설치 안내

**결론 — `lib/mcp/clients.ts`의 Antigravity 설정 형식과 IDE 메뉴 안내는 공식 문서와 일치한다. 주소에 토큰을 넣어야만 하는 클라이언트가 아니다.**

**근거 (확인):** [MCP: configuration structure / authentication / IDE setup](https://antigravity.google/docs/mcp) — 확인일 2026-11-20. 공식 예시는 HTTPS endpoint의 `serverUrl`과 `headers.Authorization`의 Bearer 값을 사용한다. 원격 전송은 Streamable HTTP이며 `url` 별칭도 가능하다. legacy HTTP+SSE와 `httpUrl`은 지원하지 않는다고 명시한다.

설정은 전역 `~/.gemini/config/mcp_config.json` 또는 workspace `.agents/mcp_config.json`의 `mcpServers`에 둔다. IDE의 … → MCP Servers → Manage MCP Servers → View raw config 경로도 문서에 있다. App·CLI는 관리 화면이 다르다.

**코드 대조:** `lib/mcp/clients.ts:70`의 `serverUrl`·`headers`, `:71`의 경로, `:72`의 IDE 메뉴는 일치한다. **확인된 형식 오류 없음.** 다만 제품명이 Antigravity 전체라면 `:72`는 IDE 표면에 한정된 안내다. 저장 후 새로고침의 정확한 UI·버전별 동작과 Seedup endpoint 호환성은 실기로 확인 못 했다.

**계획 영향 (제안):** 3-2 ① 및 클라이언트 실제 연결 확인 ②에서 현재 Bearer 방식을 그대로 시험할 근거가 있다. `lib/mcp/clients.ts`를 주소형 토큰으로 바꿀 근거는 없다. 추가 workspace 경로·표면 구분 안내 여부는 호환 보완 ③에서 결정한다.

## 3. initialize 응답의 instructions

**결론 — 초기화 instructions의 저장·발견 경로는 확인했지만, 전문을 매번 모델에 직접 넣는다는 보장은 확인 못 했다.**

**근거 (확인):** [MCP: Tool loading, lazy vs. eager](https://antigravity.google/docs/mcp#tool-loading-lazy-vs-eager) — 확인일 2026-11-20. 기본 lazy 모드에서 서버 도구 schema와 함께 선택적 `instructions.md`를 디스크에 저장한다. 시스템 프롬프트에는 해당 MCP 디렉터리 경로와 도구 이름을 넣고, 필요한 schema를 에이전트가 읽는다.

**확인 못 함:** instructions 전문의 무조건 주입, 자동 읽기 시점, 문자·바이트·토큰 제한, 절단 방식. eager 설정은 도구 schema의 선등록 설명이며 instructions 전문 주입 보증으로 해석하지 않는다. 1절의 규칙 파일 한도는 이 필드의 한도가 아니다.

**계획 영향 (제안):** 3-2 서버 안내문 칸을 “지원” 한 단어로 채우지 않는다. 클라이언트 호환 ③의 `lib/mcp/server.ts` 안내문 개선은 유효하나, Antigravity에서 안내문만으로 ②를 보장하지 않는다. 규칙 파일·도구 응답에도 핵심 목표와 다음 행동을 유지할 필요가 있다는 설계 판단이다. 해당 서버 파일은 이번에 열람·수정하지 않았다.

## 4. 수명주기 훅·종료 계속·승인

**결론 — 수명주기 훅은 지원하지만 Claude 설정·반환값과 호환되지 않는다. 압축 전후 전용 훅은 확인 못 했다.**

**근거 (확인):** [Hooks](https://antigravity.google/docs/hooks) — 확인일 2026-11-20.

설정: `.agents/hooks.json` 또는 `~/.gemini/config/hooks.json`. 구조는 `훅이름 → 이벤트 → handler 배열`. 이벤트는 `SessionStart`, `PreToolUse`, `PostToolUse`, `PreInvocation`, `PostInvocation`, `Stop`. SessionStart는 새 대화 첫 호출 전 한 번이며 matcher를 무시한다. PreCompact·PostCompact·SessionEnd는 문서 이벤트 목록에 없다.

입출력은 stdin/stdout JSON, camelCase다. 공통 입력은 `conversationId`, `workspacePaths`, `transcriptPath`, `artifactDirectoryPath`, `modelName`, `lastUserInput`. Stop은 `executionNum`, `terminationReason`, `fullyIdle`, 선택적 `error`도 받는다.

시작 주입 반환 예:

```json
{"injectSteps":[{"systemMessage":{"systemMessage":"잠긴 목표와 다음 작업 지침"}}]}
```

Stop 계속 반환 예:

```json
{"decision":"continue","reason":"미검증 변경의 인계를 남기세요."}
```

이외 decision은 종료를 허용한다. `stop_hook_active`는 문서 계약에 없다. Stop은 실행 루프 종료이며 앱 닫기·강제 종료까지 보장하지 않는다.

**승인:** CLI `/hooks`, IDE Customizations → Hooks에서 확인·관리한다. [Settings](https://antigravity.google/docs/settings?tab=cli)는 workspace 신뢰 저장을 설명한다. 그러나 훅별 최초 실행 승인·정의 변경 후 재승인 절차는 확인 못 했다. `/hooks`가 Codex처럼 신뢰 승인 명령이라고 단정하지 않는다. PreToolUse의 `ask`·`force_ask`는 도구 실행 승인 방식이며 훅 설치 승인과 다르다. — 확인일 2026-11-20.

**계획 영향 (제안):** 3-2 ②·③, 단계 2 B2 스타터 팩, 클라이언트 호환 ③의 `lib/supervisor/hook-bundle.ts`에 별도 어댑터가 필요하다. 계속 실행의 횟수 제한과 압축·재개 실기는 남은 확인 사항이다. 계획 자체는 수정하지 않았다.

## 5. Elicitation과 MCP Apps

**결론 — Elicitation의 실제 요청·응답 지원은 확인 못 했다. App의 MCP UI 관련 기록은 있지만 Seedup 카드 표시까지 확인된 것은 아니다.**

**근거:** [MCP 문서](https://antigravity.google/docs/mcp), [공식 CLI 저장소](https://github.com/google-antigravity/antigravity-cli), [공식 Changelog](https://antigravity.google/docs/changelog) — 확인일 2026-11-20.

| 항목 | 확인 범위와 한계 |
| --- | --- |
| Elicitation | 공식 MCP 문서·릴리스 기록에서 form/URL 요청의 지원 계약과 응답 UI를 확인 못 함. 공식 저장소에 사용자가 올린 capability 로그가 검색되지만 제품 지원의 확정 근거로 사용하지 않았다. |
| MCP Apps / App | App v2.33.0(2026-11-17) 수정 목록은 플러그인·MCP apps의 custom file viewer를 명시한다. 따라서 UI 기능 자체가 없다고 단정할 수 없다. |
| Seedup 카드 / IDE / CLI | `ui://` 리소스, `_meta.ui.resourceUri`, Apps bridge·표시 방식·지원 버전 및 Seedup 카드 실기는 확인 못 함. App의 viewer 기록을 IDE·CLI 지원으로 확대하지 않는다. |

**계획 영향 (제안):** 3-2의 “고급 기능은 보너스” 원칙 및 단계 2 A2의 `lib/mcp/*` 응답에 적용한다. 텍스트 결과와 사용자가 대화로 확인하는 경로를 유지한다. 내장 질문 도구나 HTML artifact 표시만으로 MCP Elicitation·Apps 지원을 판정하지 않는다.

## 6. 개발 모델 계열과 교차 검증

**결론 — Antigravity라는 클라이언트 이름만으로 개발 모델 계열을 결정할 수 없다. 원격 MCP의 자동 모델 식별 계약은 확인 못 했다.**

**근거 (확인):** [Choose a model](https://antigravity.google/docs/models), [Hooks common input fields](https://antigravity.google/docs/hooks#common-input-fields) — 확인일 2026-11-20. 모델 선택에는 Google Gemini와 Anthropic Claude 계열이 있으며 대화 도중 전환할 수 있다. 로컬 훅은 해당 호출 모델의 `modelName`을 받는다. 이것은 원격 MCP 자동 전달과 별개의 경로다.

**확인 못 함:** MCP `clientInfo`의 공식 고정 name/version 값, 모델 계열을 담는 표준·Antigravity 전용 요청 필드/헤더, 현재 선택 모델이나 개발 이력 전체를 서버가 자동 조회하는 API. 공식 저장소 이슈의 `antigravity-client` 로그는 일반 사용자 관측이므로 확정 계약에서 제외했다. ACP의 clientInfo와 MCP의 clientInfo도 혼동하지 않는다.

**로컬 결정 근거:** `docs/decisions.md:29`의 “검증 모델”, 특히 `:31`은 GPT 6.2 Sol·Haiku 5.5 중 개발과 다른 계열이 판정하도록 결정했다.

**계획 영향 (제안):** 3-2 ⑤, 클라이언트 호환 ③의 “개발 모델 계열 직접 입력(결정 대기)” 칸이 필요하다는 근거다. 관련 파일은 `lib/mcp/server.ts`의 입력 계약과 검증 모델 선택 코드(이번 미열람)다. `developed_with: antigravity`만 추가해 Claude 개발을 Haiku에 보내면 같은 계열이 될 수 있다. Gemini 개발이면 두 검증 후보 모두 다른 계열이지만, 혼합 개발·모델 전환·미입력 처리 정책은 사람이 결정해야 한다. `VERIFIER_MODELS` 순서만으로 ⑤ 충족이라고 표시할 수 없다.

## 7. Windows 실행 환경과 현재 묶음의 차이

**결론 — Antigravity에서 Windows 명령 실행은 확인된다. `sh` 요구는 현재 Seedup 묶음에서 발생하며, Antigravity 훅의 기본 셸은 확인 못 했다.**

**근거 (확인):** [공식 Changelog](https://antigravity.google/docs/changelog)의 CLI v1.0.10(2026-06-19)은 기본 셸 해석을 PowerShell로 바꾼 기록이 있다. [Download](https://antigravity.google/download)는 Windows PowerShell·CMD 설치 경로를 제공한다. [Terminal sandbox](https://antigravity.google/docs/sandbox/)는 Windows sandbox에 Windows 11 24H2 및 2026년 8월 이후 업데이트가 필요하다고 설명한다. 설치 가능한 OS와 sandbox 가능한 OS는 구분한다. — 확인일 2026-11-20.

**확인 못 함:** Windows command 훅의 정확한 launcher·셸 선택 순서, PowerShell·Node 직접 호출의 제품별 실기 결과. 일반 명령 실행의 PowerShell 기록을 훅 실행 셸의 보증으로 사용하지 않는다.

아래는 현재 워크트리 줄 번호다. 참고 보고서의 과거 줄 번호를 복사하지 않았다. 외부 계약은 2·4절 링크와 대조했다.

| 파일·줄 | 확인된 일치·차이와 영향 |
| --- | --- |
| `lib/mcp/clients.ts:70` | `serverUrl`·Bearer headers 일치. 주소형 토큰 전용이라는 주장은 근거 없음. |
| `lib/mcp/clients.ts:71` | 전역 설정 경로 일치. workspace 경로는 안내하지 않음. |
| `lib/mcp/clients.ts:72` | IDE 메뉴 안내 일치. App·CLI 안내로는 표면 구분이 필요. |
| `lib/supervisor/hook-bundle.ts:78`, `:94` | Claude의 top-level hooks·`.claude/settings.json`만 제공. Antigravity 설정 파일이 아님. |
| `lib/supervisor/hook-bundle.ts:79` | 중첩 matcher 그룹을 반환. Antigravity SessionStart의 직접 handler 배열과 다르며 `compact` 매칭으로 압축 뒤 실행을 보장할 수 없음. |
| `lib/supervisor/hook-bundle.ts:42` | 목표 평문을 stdout에 출력. Antigravity의 JSON 주입 계약과 다름. |
| `lib/supervisor/hook-bundle.ts:59` | Claude의 `stop_hook_active`에 의존. Antigravity에서 같은 반복 방지 보장은 없음. |
| `lib/supervisor/hook-bundle.ts:71` | `decision: "block"` 반환. Antigravity에서는 계속 실행 값이 아니므로 인계 강제를 이식할 수 없음. |
| `lib/supervisor/hook-bundle.ts:40`, `:46`, `:56`, `:79`, `:80` | POSIX 스크립트 및 명시적 `sh` 호출. 현재 파일 그대로 쓰려면 해당 환경 필요. |
| `lib/supervisor/hook-bundle.ts:33`, `:34`, `:48` | pre-commit 수동 설치, `sh`·Node 의존. Node가 없으면 검사 생략 후 성공 종료하므로 ④를 설치만으로 충족했다고 볼 수 없음. |

이 차이는 Antigravity 지원을 약속한 구현의 회귀라는 뜻이 아니다. 파일 `:1`·`:6`은 애초 Claude용 범위를 명시한다.

**계획 영향 (제안):** 3-2 공통 제약, 단계 2 B2 및 호환 보완 ③의 Windows 대응에 반영한다. `lib/supervisor/hook-bundle.ts`의 셸 의존 제거 또는 설치 전제 안내 방식은 구현 담당이 결정한다. 실제 연결 확인 ②에서는 사용 셸·제품 버전·Node 존재와 ①~⑤ 결과를 기록해야 한다. 조사 보고서 외 파일 수정, 커밋·push·PR·브랜치 변경은 하지 않았다.
