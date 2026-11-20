# Antigravity 작업 목록 (Gemini 4 Argon High)

2026-11-20 작성. [work-plan-merged-2026-11-20.md](work-plan-merged-2026-11-20.md)에서 외부 에이전트에게 맡기기 좋은 것만 골랐습니다.

## 고른 기준

- **범위가 분명하고 판단할 것이 적은 작업**만 넣었습니다. UI, 문구, 설정, 테스트 위주입니다.
- **3개월치 데이터 수집이 다른 세션에서 돌고 있으므로**, 수집과 엔진 코드는 건드리지 않습니다. `lib/opportunities/engine.ts`, `actors.ts`, `merge.ts`, `rules.ts`, `web.ts`, `live-evidence.ts`, `lib/ingest/*`, `lib/opportunities/data/*`, `scripts/run-opportunity-engine.ts`가 여기에 해당합니다.
- **Claude가 맡을 것은 뺐습니다.** 경쟁 조사 에이전트(1-3), 요구사항-원문 판정(1-2), 평가 체계(1-9), 무료 모델 데이터 정책 결정(0-4), 저장 0건 원인 조사(3-5)가 그렇습니다.
- **사람이 할 것도 뺐습니다.** 인용 라벨 확인, 인터뷰가 그렇습니다.

## 진행 방법

- **한 번에 작업 하나, PR 하나**로 진행합니다. 매번 최신 `main`에서 새 브랜치를 땁니다.
- **같은 파일을 건드리는 작업은 앞 PR이 머지된 뒤에 시작합니다.** 아래 표의 "겹치는 파일"을 보세요. AG-1, AG-2, AG-3은 모두 `components/IdeaWorkspace.tsx`를 건드리므로 순서대로 진행합니다.
- PR이 올라오면 Claude가 확인하고 머지합니다.

| 순서 | 작업 | 크기 | 겹치는 파일 |
|---|---|---|---|
| 1차 | AG-1 로그인 안내 일치 | 작음 | `IdeaWorkspace.tsx` |
| 1차 | AG-4 MCP 토큰 서명 키 분리 | 작음 | 없음 |
| 1차 | AG-5 README 글 도우미 표현 | 작음 | `README.md` |
| 2차 | AG-2 고정 질문 먼저 보여 주기 | 중간 | `IdeaWorkspace.tsx` |
| 3차 | AG-3 근거 0건 안내 | 작음 | `IdeaWorkspace.tsx` |
| 3차 | AG-6 홈 대상 문장, 원문 띠 정리 | 작음 | `app/page.tsx`, `components/landing/*` |
| 4차 | AG-7 사람 검토 목록을 DB로 | 중간 | `lib/opportunities/review.ts`, 마이그레이션 |
| 4차 | AG-8 CI E2E를 로컬 DB로 | 중간 | `.github/workflows/ci.yml` |
| 5차 | AG-9 바이브코더 쉬운 길 | 중간 | `PrdBuilder.tsx` 등 PRD 화면 |

1차의 세 작업은 서로 겹치지 않아 동시에 진행해도 됩니다.

---

## 공통 지시 (모든 작업 앞에 붙여 넣기)

```text
너는 Seedup 저장소(Next.js 16 App Router, React 19, TypeScript, Supabase, Cloudflare Workers)에서 작업한다.

반드시 지킬 것:
1. 시작 전에 AGENTS.md를 읽는다. 이 Next.js는 학습 데이터와 다르니, 관련 API를 쓰기 전에 node_modules/next/dist/docs/의 해당 문서를 확인한다.
2. 최신 main에서 새 브랜치를 만든다. 이름은 fix/..., feat/..., chore/... 중 하나로 한다.
3. 이 작업 범위만 고친다. 관계없는 리팩터링, 포맷 변경, 파일 이동은 하지 않는다.
4. 새 의존성을 추가하지 않는다.
5. 아래 파일은 수정하지 않는다(다른 세션에서 데이터 수집 중): lib/opportunities/engine.ts, actors.ts, merge.ts, rules.ts, web.ts, live-evidence.ts, lib/ingest/*, lib/opportunities/data/*, scripts/run-opportunity-engine.ts
6. 화면 문구는 t('한국어', 'English') 형태를 유지하고 두 언어를 모두 고친다. 한국어는 쉬운 말, 짧은 문장, 존댓말("~합니다")로 쓴다.
7. .env 파일을 만들거나 커밋하지 않는다. 모델을 호출하는 스크립트(npm run engine, flow, eval 등)를 돌리지 않는다.
8. 끝나면 npm test, npm run typecheck, npm run lint를 모두 통과시킨다. 새 로직에는 tests/ 아래에 tsx --test 형식의 테스트를 하나 이상 더한다.
9. PR 본문에 다음을 쓴다: 무엇을 왜 바꿨는지, 바꾼 파일 목록, 실행한 확인 명령과 결과, 확인하지 못한 것.
10. 판단이 필요한 지점에서 추측하지 말고 PR 본문의 "질문" 항목에 남긴다.
```

---

## AG-1. 로그인 안내 일치

```text
[문제]
화면마다 로그인 안내가 다르다. 실제 동작은 "질문에 답하기까지는 로그인 없이, PRD 생성은 로그인 후 하루 10개 무료"다.
- app/page.tsx:145 "초안은 로그인 없이, PRD는 하루 10개까지 무료"
- components/landing/TryIdea.tsx:93 "로그인 없이 초안까지 만들 수 있어요"
- app/guide/page.tsx:16 "PRD 초안은 로그인 없이, PRD 생성은 로그인 후 하루 10개까지 무료"
- components/IdeaWorkspace.tsx:429, 452 "로그인하고 PRD 만들기", "로그인하고 만들기"

[할 일]
1. 저장소 전체에서 "로그인 없이", "no account" 같은 안내를 grep으로 모두 찾는다.
2. 실제 동작(질문 답하기는 로그인 없이, PRD 생성은 로그인 필요, 하루 10개 무료)에 맞게 문구를 통일한다. 예: "질문 답하기까지는 로그인 없이, PRD는 로그인하면 하루 10개까지 무료"
3. 화면 동작(로그인 조건)은 바꾸지 않는다. 문구만 고친다.

[완료 기준]
- 홈, 랜딩, 가이드, PRD 화면의 안내가 같은 내용을 말한다.
- "로그인 없이 초안"처럼 실제와 다른 표현이 남아 있지 않다.
```

## AG-2. 고정 질문 먼저 보여 주기

```text
[문제]
components/IdeaWorkspace.tsx는 /api/ideas/questions의 모델 질문을 기다리는 동안(서버에서 최대 25초, lib/opportunities/questions.ts의 ANSWER_BUDGET_MS) 질문을 보여 주지 않는다. 189행 questions 계산에서 plan도 planFailed도 없으면 빈 배열이다. 실패하면 결국 고정 질문(QUESTIONS, 42행)이 나온다. 또 고정 질문의 첫 선택지가 아이디어와 무관하다. 예를 들어 "대학생 가계부 앱"을 넣어도 "대학생"이 선택지에 없다.

[할 일]
1. 모델 질문을 기다리는 동안 고정 질문을 바로 보여 준다.
2. 모델 질문이 도착했을 때:
   - 사용자가 아직 하나도 답하지 않았다면 모델 질문 목록으로 바꾼다(지금처럼 마지막에 EXTRA를 붙인다).
   - 이미 하나라도 답했다면 바꾸지 않고 고정 질문을 계속 쓴다. 답변 key가 서로 달라 섞으면 답이 사라진다.
3. 고정 질문 'users'의 선택지 맨 앞에 아이디어 문장에서 뽑은 대상 명사를 넣는다.
   - 모델 없이 규칙으로 한다. 순수 함수 하나(예: lib/ideas/input.ts에 ideaAudience(idea, lang))로 만든다.
   - 한국어: "대학생", "학생", "직장인", "프리랜서", "디자이너", "마케터", "PM", "개발자", "자영업자", "부모", "교사", "1인 개발자" 같은 짧은 사전에서 찾는다. 더 긴 단어를 먼저 맞춘다.
   - 영어: student, designer, marketer, freelancer, developer, parent, teacher 등.
   - 찾지 못하면 지금 선택지를 그대로 쓴다. 이미 있는 선택지와 같으면 중복으로 넣지 않는다.
4. localStorage(STORAGE_KEY)에 저장된 예전 답변이 깨지지 않게 한다. 117행 주석의 동작을 유지한다.

[테스트]
tests/에 ideaAudience 테스트를 추가한다: "대학생 가계부 앱" → "대학생", "AI 에이전트 권한 관리" → 없음, "A budgeting app for students" → "students" 또는 "Students".

[완료 기준]
- 아이디어를 넣으면 첫 질문이 1초 안에 보인다(네트워크를 기다리지 않음).
- "대학생 가계부 앱"을 넣으면 첫 질문 선택지 맨 앞에 "대학생"이 있다.
- 첫 질문에 답한 뒤 모델 질문이 도착해도 답이 사라지지 않는다.
```

## AG-3. 근거 0건 안내

```text
[문제]
아이디어와 맞는 원문이 0건이면 PRD 전체가 가설이 되는데, 사용자는 그 뜻과 다음에 할 일을 모른다. 관련 화면은 components/IdeaWorkspace.tsx(542행 근처 "웹에서 찾기")와 홈 매칭 결과다.

[할 일]
1. 원문이 0건일 때(웹에서 찾기 뒤에도 0건 포함) 짧은 안내 상자를 보여 준다.
   - 이유: "Seedup은 개발자 커뮤니티(GitHub, HN, Stack Overflow 등)의 글을 모읍니다. 이 아이디어의 사용자는 다른 곳에 있을 가능성이 큽니다."
   - 할 수 있는 것 세 가지와 링크: 직접 들은 말 넣기(지금 메모 입력 칸), 크롬 확장으로 원문 담기(/extension 안내가 있으면 그 경로), 지켜보기 등록(이미 있는 지켜보기 기능).
   - 이 상태로 만든 PRD는 "가설 초안"이라는 것을 한 줄로 알린다.
2. 이미 있는 컴포넌트와 스타일 클래스를 쓴다. 새 디자인 체계를 만들지 않는다.
3. 원문이 1건 이상이면 이 상자를 보이지 않는다.

[완료 기준]
- 근거 0건 화면에 이유 한 줄, 다음 행동 세 가지, 가설 초안 안내가 보인다.
- 근거가 있을 때는 화면이 지금과 같다.
```

## AG-4. MCP 토큰 서명 키 분리

```text
[문제]
lib/db/mcp-tokens.ts:12가 MCP 토큰 HMAC 키로 SUPABASE_SECRET_KEY를 재사용한다. DB 키를 바꾸면 모든 MCP 연결이 끊기고, 비밀값 하나가 두 용도로 쓰인다.

[할 일]
1. MCP_TOKEN_SECRET 환경변수를 먼저 쓰고, 없을 때만 SUPABASE_SECRET_KEY로 대체한다. 기존 토큰이 끊기면 안 된다.
2. 이 키를 쓰는 곳을 grep으로 모두 찾아 같은 함수 하나로 모은다.
3. .env.example과 README의 환경변수 표에 MCP_TOKEN_SECRET을 추가하고 설명을 적는다: "없으면 SUPABASE_SECRET_KEY를 씁니다. 한번 정하면 바꾸지 마세요(바꾸면 기존 MCP 연결이 끊김)."
4. app/agents 화면에 주소형 토큰(/api/mcp/<token>) 연결 안내가 있다면 "이 주소는 서버 로그에 남을 수 있으니, 가능하면 헤더 방식 연결을 쓰세요"라는 한 줄을 더한다.

[테스트]
- MCP_TOKEN_SECRET이 없을 때와 SUPABASE_SECRET_KEY만 있을 때 만든 토큰이 같은 서명을 낸다(기존 호환).
- MCP_TOKEN_SECRET이 있으면 그 값을 쓴다.

[완료 기준]
- 위 테스트가 통과하고, 환경변수를 새로 설정하지 않은 운영 환경에서 동작이 그대로다.
```

## AG-5. README 글 도우미 표현

```text
[문제]
README.md 63행과 173행은 글 도우미 챗봇이 RAG(pgvector)를 쓰는 것처럼 보인다. 실제 app/api/articles/ask/route.ts와 lib/ingest/ai-qa.ts는 벡터 검색 없이 그 글 본문만 모델에 넘긴다.

[할 일]
1. 코드를 읽고 실제 동작을 확인한다.
2. README의 해당 표현을 실제와 맞게 고친다. 예: 아키텍처 그림의 RAG 상자에서 "글 도우미 챗봇"을 빼고, 기능 설명에 "그 글의 본문을 근거로 답합니다"라고 적는다.
3. README에서 RAG를 쓴다고 적힌 다른 기능도 코드에서 retrieveIdeaContext 또는 match_seedup_content를 실제로 부르는지 확인하고, 다르면 함께 고친다. 결과를 PR 본문에 표로 남긴다.
4. 코드는 바꾸지 않는다. 문서만 고친다.

[완료 기준]
- README의 RAG 설명이 실제로 벡터 검색을 하는 기능(아이디어 평가, MCP 관련 자료 등)만 가리킨다.
```

## AG-6. 홈 대상 문장, 원문 띠 정리

```text
[문제]
홈에 누구를 위한 서비스인지 보이지 않고, 흐르는 원문 띠에 "메시 B-rep 변환" 같은 먼 주제가 영어 그대로 지나간다.

[할 일]
1. 홈 첫 문장(app/page.tsx 140행 근처) 아래에 대상 한 줄을 더한다.
   한국어: "개발 도구, AI 도구를 만드는 사람을 위해 개발자들이 실제로 쓴 글을 모읍니다."
   영어도 함께 쓴다.
2. 흐르는 원문 띠(components/landing/QuoteMarquee.tsx 등, 실제 위치는 찾는다)에 원문과 한국어 번역(quoteKo)을 함께 보여 준다. 언어가 영어면 번역은 숨긴다. quoteKo가 비어 있으면 원문만 보여 준다.
3. 띠에 올리는 문제는 검증 기준을 통과한 것(qualified가 true)만 쓴다. 그러면 띠가 너무 짧아질 수 있으니, 통과한 문제가 5개 미만이면 지금 방식으로 되돌린다.
4. 모바일 폭(375px)에서 줄이 넘치지 않는지 확인한다.

[완료 기준]
- 홈에 대상 문장이 보인다.
- 띠에 한국어 번역이 보이고, 검증 기준을 통과한 문제만 지나간다.
```

## AG-7. 사람 검토 목록을 DB로

```text
[문제]
숨길 문제와 뺄 인용이 lib/opportunities/review.ts의 HIDDEN, DROPPED_QUOTES 상수라서 보정할 때마다 코드 수정과 배포가 필요하다.

[할 일]
1. supabase/migrations/에 새 마이그레이션을 추가한다. 테이블 opportunity_reviews(slug, kind: 'hide' | 'drop_quote', quote, reason, created_by, created_at)를 만들고, RLS를 켜서 읽기는 서비스 키로만, 쓰기도 서비스 키로만 하게 한다. 기존 마이그레이션 이름 규칙(타임스탬프_이름.sql)을 따른다. 지금 상수 값들을 같은 마이그레이션에서 insert한다.
2. lib/db/에 읽기와 쓰기 함수를 두고, review.ts는 상수 대신 이 테이블을 읽는다. DB를 읽지 못하면 지금 상수를 그대로 쓰는 대체 경로를 남긴다. 사이트가 비면 안 된다.
3. /admin/ingest 화면에 "문제 숨기기", "인용 빼기" 입력과 버튼을 둔다. 관리자 확인은 이미 있는 lib/auth/admin.ts를 쓴다.
4. 사이트, MCP, 메일이 모두 같은 함수를 거치는지 확인한다(지금 tidyOpportunities를 쓰는 곳).
5. npm run migrations와 npm run rls 검사가 통과해야 한다. 단, rls는 .env가 필요하니 돌릴 수 없으면 PR 본문에 적는다.

[테스트]
- DB 행이 있으면 그 문제가 숨겨지고, 그 인용이 빠진다.
- DB 읽기가 실패하면 상수 값으로 동작한다.

[완료 기준]
- 배포 없이 관리자 화면에서 숨기기와 인용 빼기를 하면 사이트와 MCP에 반영된다.

[주의]
운영 DB에 마이그레이션을 직접 적용하지 않는다. PR에는 파일만 올린다.
```

## AG-8. CI E2E를 로컬 DB로

```text
[문제]
.github/workflows/ci.yml의 e2e 잡이 secrets.SUPABASE_SECRET_KEY 등으로 실제(운영으로 보이는) Supabase에 접속한다. PR마다 테스트 기록이 운영 데이터에 남고, 서비스 키가 PR 빌드에 노출된다.

[할 일]
1. e2e 잡을 migrations 잡처럼 supabase CLI로 로컬 DB를 띄워(supabase start 또는 db start) 그 주소와 키로 돌린다.
2. e2e가 필요로 하는 데이터나 테스트 계정이 있으면 supabase/seed.sql 또는 테스트 준비 스크립트로 만든다. playwright.config.ts와 e2e/ 폴더를 읽고 무엇이 필요한지 정리한다.
3. 운영 secrets(SUPABASE_SECRET_KEY 등)를 e2e 잡에서 뺀다. PR preview 배포 잡은 건드리지 않는다.
4. 로컬에서 supabase start가 가능하면 e2e를 한 번 돌려 결과를 PR 본문에 적는다. 불가능하면 그렇다고 적는다.

[완료 기준]
- e2e 잡에 운영 Supabase secrets가 없다.
- CI에서 e2e가 로컬 DB로 통과한다.
```

## AG-9. 바이브코더를 위한 쉬운 길 (PRD 화면)

```text
[문제]
E-n, R-n, F-n, S-n 추적, 가설, 6가지 개발 준비 슬롯이 처음 온 바이브코더에게는 어렵다.

[할 일]
개념은 없애지 않고, 처음에는 숨기고 필요할 때 펼치게 한다.
1. PRD 결과 화면(components/opportunity-stage/PrdBuilder.tsx와 관련 컴포넌트)의 기본 보기를 "문서"로 둔다.
2. 추적 번호(E-n, R-n 등)는 작게 보이고, 누르면 연결된 원문이 강조된다. 지금의 traceOf 강조를 그대로 쓴다.
3. "가설"이 처음 나올 때 한 번만 "아직 확인 안 된 것: 원문 근거가 없어 직접 확인이 필요합니다"라고 풀어 쓴다.
4. 6가지 개발 준비 슬롯의 제목 옆에 "에이전트가 먼저 물어볼 것"이라는 설명을 붙인다.
5. 내보내기의 첫 버튼은 사용자가 온보딩에서 고른 도구(lib/onboarding.ts, OnboardingForm.tsx에서 값을 찾는다) 하나로 두고, 나머지는 "다른 도구"로 접는다. 고른 값이 없으면 지금 순서를 쓴다.

[완료 기준]
- 처음 PRD를 연 사람에게 문서 보기가 먼저 보이고, 추적 번호를 누르면 원문이 강조된다.
- 가설 설명은 한 번만 보인다.
- 온보딩에서 Cursor를 고른 사용자는 내보내기 첫 버튼이 Cursor다.

[주의]
PRD 데이터 구조(spec.ts의 형식)와 서버 API는 바꾸지 않는다. 화면만 고친다.
```

---

## PR 리뷰 때 Claude가 볼 것

- 수집 중인 엔진과 수집 파일을 건드리지 않았는가
- 작업 범위를 벗어난 변경이 없는가
- 새 의존성이 없는가
- `npm test`, `typecheck`, `lint` 결과가 PR에 있고, CI가 통과했는가
- 한국어와 영어 문구가 모두 고쳐졌는가
- 보안 작업(AG-4, AG-7, AG-8)은 기존 동작과 호환되고, 비밀값이 새지 않는가
- 마이그레이션은 기존 데이터를 지우지 않고, RLS가 켜져 있는가
- 화면 작업은 미리보기에서 직접 확인합니다(모바일 폭 포함)

## 이번에 빼고 Claude가 할 것

| 작업 | 이유 |
|---|---|
| 1-3 경쟁·근거 조사 에이전트 | 설계 판단이 많고, 수집 코드(`actors.ts`, `web.ts`)를 건드림 |
| 1-2 요구사항-원문 판정, P0 Critic 켜기 | 품질 기준을 정해야 함 |
| 1-9 평가 체계 | 모델 비용이 들고 채점 설계가 필요함 |
| 0-4 무료 모델 데이터 정책 | 사용자 결정이 필요함 |
| 0-7 SSRF 남은 부분 | 리다이렉트 재검사는 이미 `web.ts`에 있음. 남은 사설 IP 검사는 수집 코드라 수집이 끝난 뒤 진행 |
| 1-4~1-7 엔진 정리, 4-2 모델 경로 통합 | 수집 중인 코드 |
| 3-5 저장 0건 원인 조사 | DB와 화면을 함께 봐야 함 |
