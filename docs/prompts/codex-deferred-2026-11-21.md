# Codex 시작 프롬프트: 보류 항목 앞당기기 (2026-11-21)

정지훈이 계획 5절 "보류"에서 아래 항목을 앞당겨 Codex에 맡깁니다(2026-11-21). 계획 문서([supervisor-plan.md](../supervisor-plan.md)) 5절 · "바뀐 기록" 갱신은 계획 세션(장차희)이 따로 합니다. 트랙 B 협업 세팅과 codebase-memory-mcp 연동은 이번에 하지 않습니다.

| 칸 | 내용 | 브랜치 | 순서 · 겹침 |
| :--- | :--- | :--- | :--- |
| C0 | Aside 근거 파일 → `found_evidence` 적재 | `feat/evidence-import` | 먼저. 다른 칸과 파일 안 겹침 |
| C1 | 역질문 루프 + 트랙 자동 분류 | `feat/question-loop` | C2보다 먼저 |
| C2 | PRD 모듈 · 보강 에이전트 | `feat/prd-modules` | C1 머지 뒤 |
| C3 | 실측 토큰 · 비용 트래커 | `feat/usage-tracker` | 마이그레이션 포함 → 정지훈이 직접 머지 · 운영 적용 |
| C4 | 오픈소스 · 스킬 추천 승격 | `feat/toolkit-promotion` | `lib/mcp/server.ts`를 C3와 함께 건드리지 않게 C3 뒤 |
| C5 | LoopForge 연동 안내 | `docs/loopforge` | 문서만, 언제든 |

## 실행 방식

- 칸마다 `origin/main`에서 새 worktree를 만들고 아래 "공통 지시" + 그 칸의 프롬프트를 이어 붙여 `codex exec`로 넘깁니다. 모델은 GPT 6.2 Sol, high.
- Codex는 로컬 커밋까지만 합니다. push · PR은 정지훈이 diff를 확인한 뒤 엽니다.
- 칸 프롬프트의 "고칠 파일" 밖의 파일이 필요하면 Codex는 멈추고 보고합니다.

## 공통 지시 (모든 칸 앞에 붙여 넣기)

```
너는 Seedup 저장소(Next.js 16 App Router, React 19, TypeScript, Supabase, Cloudflare Workers)에서 일하는 구현자다.
Seedup은 공개 글의 불편(원문)을 글자 단위로 대조해 모으고, 그 원문을 근거로 PRD를 만들어 코딩 에이전트(MCP, AGENTS.md)에 넘기는 서비스다.

이 작업은 docs/supervisor-plan.md 5절 "보류"에 있던 항목을 정지훈이 2026-11-21에 앞당긴 것이다. 계획 문서에 아직 반영되지 않았어도 이 프롬프트의 범위대로 진행해. 계획 문서는 고치지 마.

[먼저 읽기]
AGENTS.md, CONTRIBUTING.md, docs/status.md 1절, docs/supervisor-plan.md의 이 칸 관련 절(칸 프롬프트에 적음).
이 Next.js는 학습 데이터와 다를 수 있다. 라우트 · 서버 액션 API를 쓰기 전에 node_modules/next/dist/docs/의 해당 문서를 확인해.

[원칙]
- 모델은 찾거나 쓰기만 하고, 근거 채택 · 판정 · 점수는 코드와 규칙이 정한다.
- 원문은 isVerbatimQuote(lib/opportunities/rules.ts)를 통과해야만 근거(E-n)다. 근거 없는 요구사항은 가설(H-n).
- 모델 호출은 lib/llm.ts의 callJsonModel / streamText만. 웹 기능 기본 모델은 lib/opportunities/models.ts의 lightWebModels(질문 · 분류처럼 가벼운 것) 또는 기존 PRD 체인을 따른다. 모델이 실패하면 지금 동작으로 돌아가는 대체 경로를 남긴다.
- DB 쿼리는 lib/db/* 안에서만.

[지킬 것]
1. 칸 프롬프트의 "고칠 파일"만 만들거나 고친다. 관계없는 리팩터링 · 포맷 변경 · 파일 이동 금지. 새 의존성 금지.
2. 데이터 수집 동결 파일은 고치지 않는다(읽고 import는 된다): lib/opportunities/engine.ts, actors.ts, merge.ts, rules.ts, web.ts, live-evidence.ts, lib/ingest/*, lib/opportunities/data/*, scripts/run-opportunity-engine.ts.
3. 화면 문구는 t('한국어', 'English')로 두 언어 모두. 한국어는 쉬운 말, 짧은 문장, 존댓말.
4. .env를 만들거나 커밋하지 않는다. 모델을 실제로 부르는 스크립트(npm run engine, flow, scripts/eval-*, judge-*)는 실행하지 않는다. 테스트는 lib/llm-fixtures.ts 같은 기존 가짜 응답 패턴을 쓴다.
5. 마이그레이션은 supabase/migrations/<기존보다 늦은 시각>_<이름>.sql, 추가 후 npx tsx scripts/check-migrations.ts --write.
6. 커밋 메시지는 한국어, 맨 앞에 칸 ID(C0~C5). 끝나면 npm run typecheck && npm run lint && npm test 통과.
7. 끝에 보고: 바꾼 파일, 테스트 결과, 확인하지 못한 것, 계획과 다르게 판단한 것.
```

---

## C0. 근거 파일 적재

```
[칸] C0 근거 적재. 계획 3-10(근거 보강) 중 "수집한 원문을 DB에 넣기".
[읽기] docs/supervisor-plan.md 3-10, docs/prompts/aside-evidence-backfill.md(입력 파일 형식), lib/db/found-evidence.ts, lib/opportunities/live-evidence.ts의 quotesFromLink · safeSourceUrl · platformOfUrl(읽기만), supabase/migrations/20261120190000_found_evidence.sql.

[만들 것]
scripts/import-evidence.ts — Aside가 만든 evidence-YYYY-MM.jsonl 파일들을 읽어 found_evidence에 넣는다.
1. 인자: --dir <폴더> (필수), --dry-run, --limit <n>, --concurrency <n>(기본 3).
2. 줄마다 검사하고, 하나라도 어기면 버리고 이유를 센다:
   - JSON 파싱, 필수 필드(url, platform, quote, posted_at, terms).
   - posted_at이 2026-01-01T00:00:00Z 이상 2026-11-21T23:59:59Z 이하.
   - quote 길이 12~400, isCompleteQuote 통과.
   - url이 safeSourceUrl을 통과(사설 IP · 이상한 스킴 차단).
   - 원문 재확인: quotesFromLink(url, '', quote)를 불러(given이 있으면 모델을 부르지 않는다) 결과가 ok일 때만 통과. 파일에 적힌 "확인됨"은 믿지 않는다.
3. 통과한 줄은 quotesFromLink가 돌려준 id · platform · url · quote를 쓰고, quote_ko · score · posted_at은 파일 값으로 채운다. terms는 파일의 terms(소문자, 공백 정리, 중복 제거, 최대 12개)에 "domain:<domain>"과 "kind:<kind>"를 더한다.
4. saveFoundEvidence와 같은 RPC(save_found_evidence)로 100줄씩 넣는다. lib/db/found-evidence.ts에 terms를 줄마다 받는 함수가 없으면 그 파일에 함수 하나만 추가(기존 함수는 그대로).
5. 같은 url은 한 번만 받는다(같은 글에서 원문 1개 규칙). 사이트마다 요청 간격 1초 이상, 실패는 2번까지 다시.
6. --dry-run이면 DB에 쓰지 않고 집계만. 끝에 출처 · 월별 통과 수와 버린 이유별 수를 표로 출력.
7. package.json scripts에 "import-evidence": "tsx --env-file=.env scripts/import-evidence.ts" 한 줄.

[고칠 파일] scripts/import-evidence.ts, lib/db/found-evidence.ts(함수 추가만), package.json(scripts 한 줄), tests/import-evidence.test.ts.
[테스트] 줄 검사(기간 밖, 덜 끝난 문장, 잘못된 url, 중복 url), terms 정리, quotesFromLink는 가짜로 바꿔 ok · not_found · unreadable 경로.
```

## C1. 역질문 루프 + 트랙 자동 분류

```
[칸] C1. 계획 2-1의 ① 트랙 분류와 ③ 역질문 루프.
[읽기] docs/supervisor-plan.md 1절 결정 표의 "트랙" 줄, 2-1, lib/opportunities/questions.ts, app/api/ideas/questions/route.ts, components/IdeaWorkspace.tsx(질문 흐름: plan, planFailed, waitingForPlan, useTailored, questions, answers, brief), lib/opportunities/spec.ts의 withPrdReadiness · OPEN_SLOT_MARKER(읽기만), components/IdeaComposer.tsx(읽기만).

[지금 상태]
아이디어마다 모델이 질문 3~5개를 한 번 만들고(planQuestions), 다 답하면 끝이다. 모델이 실패하면 고정 질문 7개. 트랙(A 개인용: 내부 툴 · 자동화 / B 출시용: 외부 사용자)은 화면에 없다.

[만들 것]
1. 트랙 자동 분류: 첫 질문 묶음을 만드는 같은 모델 호출에서 track('A'|'B')과 이유 한 줄을 함께 받는다(호출을 늘리지 않는다). 화면 첫 질문 위에 "개인용으로 보고 질문합니다 · 바꾸기" 같은 한 줄과 바꾸기 버튼. 바꾸면 그 트랙으로 질문을 다시 받는다(답이 하나도 없을 때만, 있으면 남은 라운드부터 적용).
2. 트랙별 질문 초점: A는 기능 · 데이터 입출력 · 사용 시나리오, B는 목표 · 대상 · 문제 · 가치. SYSTEM 프롬프트에 트랙별 "다룰 만한 결정" 목록으로 넣는다.
3. 역질문 루프: 한 라운드(질문 묶음)를 다 답하면, 지금까지의 아이디어 · 트랙 · 질문과 답을 넣어 모델을 다시 부른다. 모델은 { done: boolean, gaps: string[], questions: [...] }를 낸다.
   - 멈춤: done이 true, 또는 새 질문이 0개, 또는 라운드 3번, 또는 질문 합계 12개 중 먼저 오는 것.
   - 같은 key나 거의 같은 질문(normalizeForMatch 기준 같음)은 다시 묻지 않는다.
   - "잘 모르겠어요"나 건너뛴 답은 빈칸으로 남은 것으로 보지 않는다(다시 묻지 않는다).
   - 라운드 사이 대기 중에는 지금의 "질문을 고르는 중" 표시를 쓴다. 모델이 실패하면 루프를 멈추고 지금까지의 답으로 진행(오류를 띄우지 않는다).
4. "나머지는 기본값으로" 버튼: 루프 중 언제든 보이는 버튼. 누르면 루프를 멈추고 남은 질문은 답하지 않은 채 PRD로 간다(지금의 "지금 만들면 답하지 않은 칸은 가설로 채워집니다"와 같은 처리).
5. 진행 단계 표시(Stages)의 "질문 n/m"은 라운드가 늘면 m도 늘어난다. "라운드 2/3" 같은 표시를 하나 더한다.
6. 로컬 저장(Saved 타입)에 track과 라운드를 더해 새로고침 뒤에도 이어지게. 예전 저장값(track 없음)은 그대로 열린다.
7. API: POST /api/ideas/questions 에 { idea, quotes, lang, track?, history?: [{key, question, answer}] }. history가 있으면 다음 라운드 요청. 응답은 { questions, track, trackReason, done }. 요청 한도(PER_MINUTE)는 그대로.

[고칠 파일] lib/opportunities/questions.ts, app/api/ideas/questions/route.ts, components/IdeaWorkspace.tsx, tests/questions.test.ts(없으면 새로).
[테스트] normalizeQuestions의 track · done 처리, 중복 질문 제거, 멈춤 조건 4가지, 예전 저장값 호환.
[하지 않을 것] MCP 쪽 질문(get_next_task의 열린 질문)은 이 칸에서 건드리지 않는다.
```

## C2. PRD 모듈 · 보강 에이전트 (C1 머지 뒤)

```
[칸] C2. 계획 10-2의 "5-3 PRD 모듈 · 보강 에이전트(CX-7)".
[읽기] docs/archive/codex-tasks.md의 "CX-7. 고정 뼈대와 추가 모듈", docs/archive/work-plan-merged-2026-11-20.md의 5-3 줄, lib/opportunities/spec.ts(Spec, normalizeSpec, withPrdReadiness, specIssues), PRD를 만드는 라우트(app/api/opportunities/prd/route.ts)와 수정 라우트(prd/revise), PRD 화면 컴포넌트(components/opportunity-stage/PrdBuilder.tsx), 내보내기 렌더러(spec를 마크다운 · AGENTS.md로 바꾸는 함수), lib/opportunities/questions.ts(C1 결과).

[만들 것]
1. 모듈 5개(고정 뼈대는 그대로 두고 덧붙인다): api_tool(API 설계, 요청 한도, 버전 정책, SDK) / enterprise(권한, 보안 · 컴플라이언스, 감사 기록, 연동) / consumer(온보딩, 재방문, 스토어 정책) / data_ai(데이터 출처와 라이선스, 모델 비용, 품질 측정) / external_api(의존 API의 가격 · 약관 · 종료 위험).
2. 모듈 고르기: PRD 생성 모델 호출 안에서 함께 받거나, 짧은 호출 하나(최대 2개, 이유 한 줄). 실패하면 모듈 없이.
3. 모듈마다 검사 규칙을 specIssues에 넣는다(예: enterprise인데 권한 항목이 비면 지적). 모듈 항목도 근거가 없으면 가설로 표시.
4. 파싱 · 렌더 · 내보내기 · 문서 화면에 모듈 섹션을 잇는다. Spec 타입에 modules?: 선택 필드로 더해 예전 PRD가 그대로 열리게.
5. 보강 에이전트(PRD가 만들어진 뒤): 문서 화면에 "빈 곳 채우기" 버튼. 순서는 빈 곳 찾기(withPrdReadiness의 열린 슬롯 · 가설 · 모듈 검사 지적) → 원문 · 저장된 근거(found_evidence의 storedEvidence)에서 조사 → 그래도 모르는 것만 질문(C1의 질문 UI와 같은 모양, 최대 5개) → 답으로 PRD 수정(기존 revise 경로). 조사로 채운 칸은 출처(E-n)를 달고, 못 채운 칸은 그대로 열린 질문.
[고칠 파일] lib/opportunities/spec.ts, lib/opportunities/prd-modules.ts(새로), PRD 생성 · 수정 라우트, PrdBuilder와 문서 화면 컴포넌트, 내보내기 렌더러 파일, tests/prd-modules.test.ts. 위 경로가 실제와 다르면 실제 파일을 찾아 쓰고 보고에 적어.
[테스트] 모듈 검사 규칙, 모듈 없는 예전 PRD 호환(파싱 · 렌더 · 내보내기), 보강 에이전트의 "조사로 채움 / 질문으로 남김" 나누기.
```

## C3. 실측 토큰 · 비용 트래커 (마이그레이션 포함)

```
[칸] C3. 계획 3-8.
[읽기] docs/supervisor-plan.md 3-8, lib/opportunities/models.ts(PAID 단가 usdPerMillion), lib/mcp/auth.ts(MCP 토큰 인증), lib/supervisor/hook-bundle.ts(사용자에게 주는 훅 묶음), supabase/migrations의 prd_runs · verifications 정의, lib/db/의 기존 패턴, app/supervisor 화면.

[만들 것]
1. 단가표 lib/pricing.ts: 모델 id → 입력 · 출력 US$/1M 토큰. lib/opportunities/models.ts의 PAID 값을 옮겨 한 곳에서 쓰게(models.ts는 pricing.ts를 읽도록 최소 수정). Claude Code · Codex가 쓰는 모델 id(claude-opus-5-5, claude-sonnet-5-5, claude-haiku-5-5, gpt-6.2-sol 등)도 넣되, 값을 확인할 수 없으면 null로 두고 화면에 "단가 없음".
2. 업로드 API POST /api/usage: MCP 토큰 인증. 본문 { project, source: 'claude_code'|'codex', session_id, rows: [{ ts, model, input_tokens, output_tokens, cache_read_tokens?, cache_write_tokens? }] }. (source, session_id, ts, model)로 중복 제거. 하루 업로드 횟수 한도는 consume_ai_usage_for.
3. 수집 스크립트(사용자 컴퓨터에서 도는 것, hook-bundle에 넣는다):
   - Claude Code: Stop 훅 입력의 transcript_path JSONL에서 응답별 usage를 읽어 지난 업로드 이후 것만 보낸다.
   - Codex: ~/.codex/sessions 세션 로그를 읽는 스크립트.
   - 토큰 수와 모델 이름만 보낸다. 대화 내용 · 파일 경로 · 코드는 절대 보내지 않는다. 이 점을 스크립트 머리 주석과 훅 안내 문구에 적는다.
4. 집계: 기능(F-n)이 in_progress~done이던 시간 구간으로 기능별 · 성공 기준별 토큰 · 비용. Seedup 자체 사용량(prd_runs.cost_usd, verifications)도 프로젝트 합계에 더한다.
   절감액 = (같은 토큰을 최상위 모델로 썼을 때 비용) − (실제 비용). 최상위 모델은 pricing.ts에 표시.
5. 모델 등급 추천: 기능별로 "이 정도 규모 기능은 지난 기록상 Haiku급으로 충분했음" 같은 한 줄. 규칙(코드)으로만 정한다: 같은 프로젝트에서 낮은 등급 모델로 🟢 검증을 받은 기능의 토큰 규모와 비교. 기록이 3개 미만이면 추천하지 않는다.
6. 화면: /supervisor의 프로젝트 화면에 기능별 토큰 · 비용 · 절감액 표. MCP get_next_task 응답에는 넣지 않는다(C4가 그 파일을 고친다).
7. 마이그레이션: agent_usage 테이블(위 행 + user_id, project_key), RLS는 본인 읽기 · 서버만 쓰기.
[고칠 파일] lib/pricing.ts(새로), lib/opportunities/models.ts(단가를 pricing.ts에서 읽게만), app/api/usage/route.ts(새로), lib/db/agent-usage.ts(새로), lib/supervisor/hook-bundle.ts, scripts/usage/claude-code.ts · scripts/usage/codex.ts(새로, 또는 hook-bundle이 쓰는 형식), supabase/migrations/<시각>_agent_usage.sql, lib/schema-manifest.json(스크립트로 재생성), /supervisor 화면 파일, tests/usage.test.ts.
[테스트] 중복 제거, 시간 구간 집계, 절감액 계산, 단가 없는 모델, transcript JSONL · Codex 로그 파싱(가짜 파일), 내용이 업로드 본문에 섞이지 않는지.
[주의] 마이그레이션 PR이라 정지훈이 직접 머지하고 운영 DB에 적용한다. 보고에 적용 순서를 적어.
```

## C4. 오픈소스 · 스킬 추천 승격 (C3 머지 뒤)

```
[칸] C4. 계획 3-9.
[읽기] docs/supervisor-plan.md 3-9, lib/opportunities/toolkit.ts(TOOLKIT, recommendToolkit, renderToolkit), scripts/check-toolkit.ts, supabase/migrations의 github_trends · github_repo_snapshots · ai_products 정의, lib/mcp/server.ts의 get_next_task 응답 조립 부분, lib/db/의 기존 패턴.

[만들 것]
1. 승격 기준(코드 규칙): DB 후보(github_trends, ai_products) 중 저장소 존재 · 보관(archived) 아님 · 라이선스 있음(OSI 허용 목록) · 최근 활동(pushed_at 180일 이내) · 별 수 기준(기본 500) · 알려진 취약점 없음(GitHub advisory API 조회, 결과를 캐시). 통과분만 후보.
   승격은 자동 반영이 아니라 scripts/promote-toolkit.ts가 후보 목록(JSON)을 만들고, 사람이 확인한 것만 lib/opportunities/toolkit-promoted.json에 넣는 방식. 런타임은 TOOLKIT + toolkit-promoted.json을 읽는다.
2. 패키지 이름: 검증된 저장소의 package.json · 레지스트리(npm, PyPI)에서 확인된 정확한 이름만. 모델이 이름을 만들지 않는다. 확인 못 한 후보는 버린다.
3. 맞추기: 기능(F-n)별 규칙 + 기존 임베딩(content_embeddings가 있으면 그것, 없으면 규칙만). 저장소 package.json(connect_repo로 연결된 경우)과 맞지 않는 생태계는 빼고, 이미 쓰는 패키지는 빼되 새 릴리스 · 보안 알림이 있으면 한 줄로 알린다.
4. 전달: get_next_task 응답에 기능당 최대 3개(이름, 왜 맞는지 한 줄 — DB 데이터로, 저장소 주소). 새 MCP 도구는 만들지 않는다(get_build_skill_pack은 이번 범위 밖). PRD 화면의 기존 toolkit 자리에도 같은 결과.
5. 되먹임: link_commit · verify_feature로 들어온 커밋에서 package.json 변경을 보고 추천한 패키지가 추가됐는지 기록(recommendation_feedback 테이블이 맞으면 재사용, 아니면 보고만 하고 멈춤). 순위 반영은 채택 수로만, 돈 · 제휴로 바꾸지 않는다.
6. 스킬 팩: 이번 범위에서는 TOOLKIT의 kind 'skill' 항목을 기능별로 묶어 보여 주는 것까지. 외부 스킬 출처 수집은 하지 않는다.
[고칠 파일] lib/opportunities/toolkit.ts, lib/opportunities/toolkit-promoted.json(새로, 빈 배열로 시작), scripts/promote-toolkit.ts(새로), lib/db/toolkit.ts(새로), lib/mcp/server.ts(get_next_task의 추천 줄만), PRD 화면의 toolkit 표시 부분, tests/toolkit-promotion.test.ts.
[테스트] 승격 기준 각 항목, 이름 확인 실패 시 버림, 생태계 불일치 제외, 이미 쓰는 패키지 처리, 기능당 3개 상한.
```

## C5. LoopForge 연동 안내 (문서만)

```
[칸] C5. docs/service-plan.md 307줄 "LoopForge 연동".
[읽기] docs/service-plan.md 해당 줄, lib/mcp/server.ts의 도구 목록(이름 · 설명만), README.md의 MCP 연결 안내.
LoopForge가 무엇인지 저장소 안에서 확인할 수 없으면, 추측으로 쓰지 말고 멈춰서 "LoopForge 단계 이름과 설정 방식 자료가 필요함"이라고 보고해.

[만들 것] docs/integrations/loopforge.md 한 파일.
- LoopForge의 요구사항 · 구현 · 리뷰 단계마다 어떤 Seedup MCP 도구를 부르는지 표(요구사항: get_my_prd · resume_project, 구현: get_next_task · update_feature_status, 리뷰: verify_feature · link_commit).
- SOP 예시 하나(단계별로 에이전트에게 줄 지시문).
- Seedup 안에 LoopForge 기능을 넣지 않는다는 점과 이유(서버 운영 도구라 대상이 다름) 한 줄.
[고칠 파일] docs/integrations/loopforge.md만. 코드는 고치지 않는다.
```
