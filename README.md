# Seedup

KNU_LLM BootCamp 8조
- 조민규 : PM 및 발표
- 김가남 : 오류 분석 및 테스트
- 정지훈 : 개발 과정 전담

**Seedup**은 개발자들이 실제로 남긴 불만(Pain Point)을 원문과 대조해 수집하고, 이미 출시된 도구의 공급 상태를 교차 확인한 뒤 **근거가 연결된 PRD와 코딩 에이전트용 브리프(`AGENTS.md`)**까지 이어주는 프로덕트 인텔리전스 서비스입니다. 내 GitHub 저장소에 바로 붙일 다음 기능·논문 추천(`/seeds`)과 멀티소스 기반 개발 트렌드·아티클 큐레이션도 함께 제공합니다.

배포 주소: [https://seedup.rerereally.com](https://seedup.rerereally.com)

---

## 핵심 파이프라인 요약

1. **멀티소스 데이터 수집**: GitHub Issues/Repos, Hacker News, Stack Overflow, DEV.to, Lobsters, arXiv, Hugging Face, Product Hunt, npm, 국내외 기술 블로그(RSS) 데이터를 수집합니다.
2. **원문 대조 & 신호 집계**: LLM이 추출한 인용문이 실제 원문 본문에 그대로 존재하는지(`isVerbatimQuote`) 검증하고, 9개 소스의 키워드 신호를 시간 감쇠 가중치로 집계합니다.
3. **기회 판정 & RAG 분석**: 수요 강도·공급 빈틈·최근성을 합산한 100점 만점 기회 점수와 시장 상태(`열림` / `좁아지는 중` / `닫힘` / `조사 중`)를 산출하고, `pgvector` 임베딩으로 아이디어의 시장성·실현 가능성을 평가합니다.
4. **PRD · 에이전트 · 내 레포 연결**: 담은 증언만 인용하는 PRD 초안(미인용 항목은 가설로 자동 분리)과 `AGENTS.md`를 생성하고, 내 GitHub 공개 저장소(`/seeds`)에 맞는 다음 기능과 학술 논문을 추천합니다.

---

## 주요 기능 (8대 핵심 모듈)

### 1. 인터랙티브 홈 스테이지 & 즉석 PRD 빌더 (`/`)
- **Matter.js 2D 물리 증언 칩 파일**: 실제 개발자 불만 인용문들이 물리 엔진(중력·충돌·쿠션 안착)으로 반응하며, 마우스/터치로 드래그하거나 클릭해 근거 폴더에 수집 (`prefers-reduced-motion` 정적 그리드 자동 전환 지원)
- **하이브리드 실시간 기회 매칭**: 타이핑 즉시 반응하는 로컬 토큰 매칭 + 450ms 디바운스 후 동작하는 1536차원 임베딩 코사인 유사도 매칭 (`POST /api/opportunities/match`)
- **실시간 근거 확인서 (`EvidenceCertificate`)**: 최소 증언 3건 이상 + 최소 플랫폼 2종 이상 충족 여부 실시간 판정, 영어 원문·한국어 번역·원문 링크·`원문 일치` 검증 배지 표시
- **근거 기반 PRD & `AGENTS.md` 생성 (`PrdBuilder`)**: 담은 근거 번호를 인용한 요구사항(`requirements`)과 근거 미달 가설(`hypotheses`)을 서버에서 엄격히 분리하여 생성하고, `PRD 마크다운 복사`, `AGENTS.md 복사/다운로드`, `내 도시에(Dossier) 저장` 지원

### 2. 기회 엔진 & 기회 탐색기 (`/opportunities`, `/opportunities/[slug]`)
- **멀티 액터(Actor) 수요·공급 교차 수집**:
  - **5대 수요 플랫폼 액터**: GitHub Issues, Hacker News (Ask HN/댓글), Stack Overflow, DEV.to, Lobsters
  - **4대 공급 채널 탐색**: GitHub Repositories, npm Registry, Show HN, VS Code Marketplace
- **원문 대조 검증 (`isVerbatimQuote`)**: 인용문이 실제 원문 텍스트에 15자 이상 정규화 부분 문자열로 포함될 때만 채택하여 환각(Hallucination) 원천 차단
- **100점 만점 기회 점수 & 시장 상태 분류**: 수요(40점) + 공급 빈틈(35점) + 최근성(25점) 정량 계산 및 직접 경쟁 수·스타 수 기반 시장 상태(`open` / `narrowing` / `closed` / `unknown`) 자동 판정
- **Why Now 타이밍 분석 & 선행 적중 기록 (`trackRecord`)**: 최근 30일/90일 신호 집중도 분석 및 첫 불만 포착일(`firstSeenAt`) 이후 실제로 등장한 후발 도구 수(`followersAfterSignal`) 추적
- **시계열 스냅샷 병합 (`mergeSnapshot`)**: 코사인 유사도(0.68+) 및 공유 원문(2건+) 기준으로 이전 스냅샷과 병합해 증언·플랫폼·경쟁 상태 변화 이력(`describeChange`) 기록

### 3. 내 씨앗 — GitHub 저장소 기반 맞춤형 어드바이저 (`/seeds`)
- **내 공개 저장소 자동 분석**: GitHub OAuth 연동 시 최근 업데이트된 비포크(non-fork) 공개 저장소 최대 5개의 설명·언어·토픽·`README.md` 자동 수집
- **맞춤형 신호 연결**: 저장소 임베딩과 키워드를 대조해 가장 가까운 기회 신호(최대 2개) 및 관련 아티클·유사 오픈소스(최대 3개) 자동 매칭
- **다음 기능 제안 & GitHub 이슈 복사**: 저장소 맥락과 개발자 불만 신호를 결합해 다음 릴리즈에 추가할 기능 3가지를 제안하고 GitHub 이슈 등록용 마크다운 원클릭 복사 지원
- **arXiv + OpenAlex 이중 폴백 논문 추천 & 변화 감지**: 저장소 주제에 맞는 최신 논문 최대 3편 추천(arXiv 속도 제한 시 OpenAlex 자동 폴백) 및 재방문 시 새로 추가된 신호에 `새 신호` 배지 표시

### 4. AI 아이디어 검증기 & pgvector RAG 엔진 (`/ideas`)
- **사전 입력 검증 (`validateIdeaInput`)**: 최소 글자 수, 자모 연타, 비속어, 무의미 입력을 서버 호출 전 필터링
- **하이브리드 RAG 근거 검색 (`retrieveIdeaContext`)**: Supabase `content_embeddings`(1536차원) 코사인 유사도와 키워드 오버랩으로 관련 뉴스·아티클·오픈소스·제품·논문 근거 검색
- **다차원 평가 리포트 (`EvaluationPanel`)**: 종합 점수(100점)·시장성·기술 실현 가능성 산출, **사용자 명시 내용(`user_stated`) vs AI 추정 가정(`inferred_assumptions`) 분리**, RAG 근거 수 기반 서버 측 신뢰도(`높음/보통/낮음`) 강제 보정, 강점·리스크·차별화 포인트·MVP 첫 단계·검증 질문 제공 (24시간 캐시 지원)

### 5. 멀티소스 기술 아티클 · 논문 심층 리뷰 · 글 도우미 챗봇 (`/news`, `/papers/[id]`)
- **6개 데일리 아티클 트랙 & 주간 Deep Dive**: `AI/LLM`, `프론트엔드`, `백엔드`, `오픈소스/GitHub`, `제품/빌드 아이디어`, `논문/리서치` 트랙별로 최소 3개 이상 원문 소스 & 2종 이상 소스 타입이 모인 클러스터만 발행
- **문장별 주장 출처 분류 (`article_claims`)**: 아티클 내 핵심 주장을 `원문 근거(source)`, `추론(inference)`, `배경지식(general_knowledge)`으로 분류 및 원문 링크 연결
- **논문 한국어 심층 리뷰 (`/papers/[id]`)**: arXiv·Hugging Face 논문의 핵심 기여, 실무 적용 포인트, 한계점, 쉬운 한국어 해설 생성
- **우측 플로팅 글 도우미 챗봇 (`ArticleAssistant`)**: 상세 페이지 우측에서 현재 읽고 있는 본문 컨텍스트를 기반으로 핵심 요약·용어 설명·실무 적용 질의응답 (`POST /api/articles/ask`)

### 6. 개발 트렌드 랭킹 & OpenRouter 모델 인텔리전스 (`/trends`)
- **9대 소스 통합 5개 카테고리 트렌드**: GitHub, npm, Hugging Face, DEV.to, Stack Overflow, Product Hunt, Hacker News, RSS, 논문 신호를 통합해 `개발 워크플로우`, `AI 도구·모델`, `구현 패턴`, `오픈소스 프로젝트`, `빌드 아이디어` 5대 카테고리로 분류 및 주간 성장률(`급상승` / `꾸준한 강세` / `신규 진입`) 표시
- **모델 인텔리전스 비교 (`ModelIntelligencePanel`)**: OpenRouter 실사용 인기 순위, Artificial Analysis 지능 지수(Intelligence Index), Design Arena 영역별 디자인 ELO 리더보드 통합 비교

### 7. 실전 프로젝트 빌드 플랜 · AI 제품 랭크 · 오픈소스 (`/projects`, `/ai-products`, `/github-trends`)
- **실전 프로젝트 빌드 플랜 (`/projects/[id]`)**: MVP 범위(`꼭 넣을 것` / `여유 있으면 넣을 것` / `이번엔 뺄 것`), 일차별 구현 태스크·산출물·완료 기준(`done_when`)·예상 소요 시간, 출시 후 검증 지표 제공
- **AI 제품 평가 (`/ai-products/[id]`)**: Product Hunt 기반 최신 AI 제품의 기능·타겟·가격·대안 분석 및 로그인 사용자 1~5점 별점 투표(`AIProductRatingControl`) & 리뷰 작성(`submitAIProductReview`)
- **GitHub 급상승 오픈소스 (`/github-trends/[id]`)**: 스타 급상승 저장소의 아키텍처 요약, 실무 활용 사례, 유사 레포 비교 및 빠른 시작 가이드 제공

### 8. 개인화 추천 · 통합 보관함 · 검색 · 이중 뉴스레터 · 관리자 콘솔
- **온보딩 & 하이브리드 추천 (`/onboarding`, `/profile`, `lib/recommendations.ts`)**: 개발 수준·관심 분야·목표·선호 스택과 보관함 스크랩 키워드(`scrapTokens`)를 결합한 맞춤형 추천 및 추천 클릭(CTR) 피드백 기록
- **통합 보관함 & 반응 (`/scrap`)**: 기회, 도시에(PRD), 아티클, 프로젝트, AI 제품, 오픈소스, 논문, 아이디어 스크랩 및 좋아요·싫어요(`ReactionBar`)·조회수(`ViewTracker`) 기록
- **통합 검색 (`/search`)**: 기회, 아티클, 오픈소스, AI 제품, 프로젝트를 단일 검색어로 가로질러 탐색하고 카테고리별 탭 필터링 지원
- **이중 뉴스레터 발송 (Resend + DB 멱등성 보장)**: 개인 맞춤 아티클 뉴스레터(`lib/newsletter/email.ts`) 및 스크랩한 기회 변동 알림 / 주간 기회 다이제스트(`lib/newsletter/opportunity-digest.ts`) 발송
- **관리자 데이터 수집·관제 콘솔 (`/admin/ingest`)**: 3단계 파이프라인(수집/전처리 → 신호 집계 → 글/아이디어 생성) 실행 제어, 소스별 승인율 및 건강 상태(`ok` / `unstable` / `stale` / `failing`) 모니터링, 품질 미달 제외 기사 로그(`ingest_rejections`) 조회

---

## 기술 구성

| 영역 | 사용 기술 |
| --- | --- |
| 웹 프레임워크 | Next.js 16 App Router, React 19, TypeScript |
| UI & 인터랙션 | Tailwind CSS 4, Matter.js (2D 물리 엔진), Lucide React |
| 데이터베이스 | Supabase PostgreSQL, Row Level Security (RLS), pgvector (1536차원 임베딩) |
| 인증 | Supabase Auth (Google OAuth, GitHub OAuth) |
| AI & 임베딩 | OpenRouter API (LLM 생성·전처리·평가 및 `text-embedding-3-small` 임베딩) |
| 수집 | `rss-parser`, GitHub REST API, Hacker News Algolia API, Stack Exchange API, DEV.to API, Lobsters, npm Registry, VS Code Marketplace, arXiv API, OpenAlex API, 외부 공개 API |
| 이메일 | Resend (`newsletter_sends` 멱등성 보장) |
| 배포 | Cloudflare Workers, OpenNext |

## 사전 요구사항

- Node.js 20.9 이상
- npm 10 이상
- Supabase 프로젝트
- OpenRouter API 키
- GitHub Personal Access Token, GitHub 수집 및 기회 엔진을 사용할 때 권장
- Google OAuth 및 GitHub OAuth 설정, 로그인과 `/seeds` 연동을 사용할 때 필요
- Resend API 키와 발신 도메인, 뉴스레터 및 기회 다이제스트를 사용할 때 필요

운영체제는 macOS, Linux, Windows 모두 가능하지만 아래 명령은 macOS/Linux 기준입니다.

## 설치

```bash
git clone https://github.com/rerereally/Seedup_ver2.git
cd Seedup_ver2
npm install
cp .env.example .env
```

`npm install`이 설치하는 패키지는 `package.json`과 `package-lock.json`에 고정되어 있습니다. 별도로 전역 설치해야 하는 패키지는 없습니다.

> GitHub에서 받은 코드만으로 화면을 띄우는 것은 가능하지만, 로그인·데이터 수집·AI 기능까지 실행하려면 아래의 Supabase 스키마와 환경변수 설정이 반드시 필요합니다. `.env`와 Cloudflare Secrets는 보안상 저장소에 포함하지 않습니다.

### 실행에 포함되는 주요 패키지

`package.json`에 직접 등록된 런타임 패키지:

- `@opennextjs/cloudflare`
- `@supabase/ssr`, `@supabase/supabase-js`
- `postcss`
- `lucide-react`
- `matter-js`
- `next`, `react`, `react-dom`
- `rss-parser`

`package.json`에 직접 등록된 개발·배포 패키지:

- `@tailwindcss/postcss`
- `@types/matter-js`, `@types/node`, `@types/react`, `@types/react-dom`
- `eslint`, `eslint-config-next`
- `tailwindcss`
- `tsx`
- `typescript`
- `wrangler`

버전은 `package.json`에 정의되어 있으며, 설치 시 `package-lock.json` 기준으로 재현됩니다. `npm install`만 실행하면 되므로 `npm install next`, `npm install supabase`처럼 개별 설치할 필요가 없습니다.

## 환경변수 설정

`.env.example`을 `.env`로 복사한 뒤 값을 입력합니다. `.env`와 API 키는 GitHub에 올리면 안 됩니다. `.gitignore`에 포함되어 있는지 확인하세요.

### 필수 환경변수

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-key
SUPABASE_SECRET_KEY=sb_secret_your-key

OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=nvidia/nemotron-3.5-super-vl:free
OPENROUTER_FALLBACK_MODELS=openrouter/free

NEXT_PUBLIC_SITE_URL=http://localhost:3000
INGEST_SECRET=change-this-secret
ADMIN_EMAILS=you@example.com
```

### 선택 환경변수

```env
GITHUB_TOKEN=your-github-token
GITHUB_MIN_STARS=50
HUGGINGFACE_TOKEN=your-huggingface-token
STACKEXCHANGE_KEY=your-stackexchange-key

RESEND_API_KEY=your-resend-api-key
NEWSLETTER_FROM_EMAIL="Seedup <newsletter@your-domain.com>"

RAG_EMBEDDING_MODEL=openai/text-embedding-3-small
OPENROUTER_TIMEOUT_MS=45000
OPENROUTER_ARTICLE_TIMEOUT_MS=75000
MAX_ITEMS_PER_SOURCE=10
RSS_RECENT_WINDOW_DAYS=7
INGEST_OPENROUTER_MODEL_LIMIT=20
CRON_SECRET=optional-cron-secret
INGEST_INTERNAL_URL=http://localhost:3000
```

`OPENROUTER_API_KEY` 하나로 전처리와 글 작성, 기회 엔진, PRD 생성, 아이디어 평가를 모두 호출합니다. 현재 모델 역할은 다음과 같습니다.

- 아티클 작성과 Deep Dive, 아이디어 평가, PRD 생성: `OPENROUTER_MODEL`, 기본값 `anthropic/claude-sonnet-5`
- 전처리: `OPENROUTER_PREPROCESS_MODELS`, 기본값 `google/gemini-3.5-flash`
- `OPENROUTER_FALLBACK_MODELS`: 작성 모델 장애 시 사용할 보조 모델
- `RAG_EMBEDDING_MODEL`: 기회 매칭 및 아이디어 평가 RAG 임베딩에 사용할 OpenRouter 임베딩 모델

테스트 중 무료 모델을 쓰려면 `OPENROUTER_MODEL`에 `:free` 모델이나 `openrouter/free`를 지정합니다. `OPENROUTER_PREPROCESS_MODELS`를 비워두면 전처리도 같은 무료 모델을 사용합니다. `OPENROUTER_FREE_ONLY=true`를 설정하면 임베딩을 포함한 모든 유료 모델 호출이 차단됩니다. 무료 임베딩은 1536차원을 지원하는 모델만 사용할 수 있습니다.

위 무료 모델은 테스트용입니다. 운영에서는 `OPENROUTER_MODEL=anthropic/claude-sonnet-5`, `OPENROUTER_FALLBACK_MODELS=google/gemini-3.5-flash`처럼 유료 모델로 바꿉니다. 소스 목록은 항상 `.env.example`의 최신 내용을 기준으로 입력하세요.

## 데이터베이스 설정

1. Supabase Dashboard에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 [supabase/schema.sql](supabase/schema.sql)의 전체 내용을 실행합니다.
3. 이미 운영 중인 프로젝트에서는 아래 추가 마이그레이션을 순서대로 실행합니다(새 프로젝트는 `schema.sql`에 포함되어 있습니다):
   - [supabase/opportunities_2026_11.sql](supabase/opportunities_2026_11.sql): 기회 엔진(`opportunities`) 및 보관함 도시에(`evidence_dossiers`)
   - [supabase/hardening_2026_11.sql](supabase/hardening_2026_11.sql): 일일 AI 호출 쿼터(`daily_usage_limits`, `consume_daily_usage` RPC) 및 RLS 강화
   - [supabase/newsletter_sends_2026_11.sql](supabase/newsletter_sends_2026_11.sql): 뉴스레터 및 기회 다이제스트 중복 발송 방지(`newsletter_sends`)
4. 필요하면 테스트 데이터는 `supabase/dummy.sql`로 넣고, 삭제할 때는 `supabase/delete_dummy.sql`을 사용합니다.
5. Supabase의 `Authentication > Providers`에서 Google 및 GitHub 로그인을 켭니다.
6. Google/GitHub OAuth와 Supabase에 다음 콜백 주소를 등록합니다.

```text
http://localhost:3000/auth/callback
http://localhost:3001/auth/callback
https://seedup.rerereally.com/auth/callback
```

주요 테이블은 다음과 같습니다.

```text
profiles                  사용자 프로필
user_onboarding           온보딩 관심사·목표·기술 스택
opportunities             기회 엔진 스냅샷·점수·수요 증언·공급 목록·시계열 히스토리
evidence_dossiers         사용자가 조합해 저장한 증언 도시에 및 PRD 마크다운
news_items                원천 뉴스와 발행 아티클
article_claims            아티클 문장별 주장 분류(원문 근거/추론/배경지식)
research_papers           논문과 논문 리뷰 메타데이터
news_paper_links          뉴스와 논문 연결
ai_products               AI 제품
ai_product_ratings        AI 제품 사용자 평점
ai_product_reviews        AI 제품 사용자 상세 리뷰
github_trends             GitHub 저장소
github_repo_snapshots     GitHub 스타 변화 이력
project_ideas             프로젝트 아이디어와 빌드 플랜
keyword_signals           여러 소스에서 나온 키워드 신호
trend_snapshots           기간별 트렌드 스냅샷
trends                    현재 트렌드 랭킹 캐시
ai_model_snapshots        OpenRouter·Artificial Analysis·Design Arena 모델 인텔리전스
content_embeddings        아이디어 평가 RAG용 1536차원 pgvector 임베딩
recommendation_feedback   추천 피드백
content_reactions         좋아요·싫어요
scraps                    사용자 저장 콘텐츠
idea_evaluations          아이디어 평가 결과
daily_usage_limits        사용자별 일일 AI 호출 쿼터
newsletter_sends          뉴스레터 및 기회 다이제스트 발송 멱등성 기록
ingest_runs               수집·생성 실행 로그
ingest_rejections         품질 기준으로 제외된 원천 데이터
```

키는 Supabase 대시보드의 `Settings > API Keys`에서 확인합니다. `SUPABASE_SECRET_KEY`는 서버에서만 사용합니다. 브라우저 코드나 GitHub 저장소에 노출하면 안 됩니다.

## 로컬 실행

개발 서버:

```bash
npm run dev
```

브라우저에서 접속합니다.

```text
http://localhost:3000
```

포트가 이미 사용 중이면 Next.js가 `3001` 같은 다른 포트를 출력합니다. 터미널에 표시된 주소를 사용하세요.

품질 검사 및 테스트:

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

프로덕션 실행:

```bash
npm run build
npm run start
```

데모 전 주요 화면 점검 (스모크 테스트):

앱을 먼저 실행한 뒤(`npm run dev` 또는 배포 주소), 주요 페이지와 API가 200으로 응답하고 오류 화면이 없는지 확인합니다.

```bash
SMOKE_BASE_URL=http://localhost:3000 npm run smoke
SMOKE_BASE_URL=https://배포주소 npm run smoke
```

`SMOKE_BASE_URL`을 생략하면 `http://localhost:3000`을 사용합니다. 하나라도 실패하면 종료 코드 1로 끝납니다.

## 데이터 수집과 글 생성 순서

관리자 계정으로 로그인한 뒤 `/admin/ingest`에서 실행할 수 있습니다. 보통 아래 순서로 실행합니다.

```text
1. RSS / 뉴스 전처리
2. AI 제품 수집
3. GitHub 수집
4. 논문 수집·리뷰
5. npm·Hugging Face·DEV.to·Stack Overflow·Hacker News 외부 트렌드 수집
6. OpenRouter 모델 인텔리전스 수집
7. 트렌드 집계
8. 프로젝트 아이디어 생성
9. 데일리 아티클 생성
10. 주간 Deep Dive 생성
11. 뉴스레터 발송
```

수집과 전처리는 글 발행이 아닙니다. `rss` 실행은 `news_items`에 원천·전처리 데이터를 저장하고, 발행 글은 별도의 `article-drafts` 실행에서 생성합니다.

### 보호된 API 직접 실행

`YOUR_INGEST_SECRET`은 `.env`의 `INGEST_SECRET` 값으로 바꿉니다. 비밀값은 URL이 아니라 `x-ingest-secret` 헤더로 보냅니다.

```bash
BASE_URL=http://localhost:3000
SECRET=YOUR_INGEST_SECRET

curl -X POST -H "x-ingest-secret: $SECRET" "$BASE_URL/api/ingest/rss?limit=8"
curl -X POST -H "x-ingest-secret: $SECRET" "$BASE_URL/api/ingest/products?limit=12"
curl -X POST -H "x-ingest-secret: $SECRET" "$BASE_URL/api/ingest/github?limit=15&minStars=50"
curl -X POST -H "x-ingest-secret: $SECRET" "$BASE_URL/api/ingest/research?limit=12&minScore=55&minFitScore=18"
curl -X POST -H "x-ingest-secret: $SECRET" "$BASE_URL/api/ingest/external-trends"
curl -X POST -H "x-ingest-secret: $SECRET" "$BASE_URL/api/ingest/model-intelligence"
curl -X POST -H "x-ingest-secret: $SECRET" "$BASE_URL/api/ingest/trends"
curl -X POST -H "x-ingest-secret: $SECRET" "$BASE_URL/api/ingest/project-ideas?limit=10"
curl -X POST -H "x-ingest-secret: $SECRET" "$BASE_URL/api/ingest/article-drafts?mode=daily"
curl -X POST -H "x-ingest-secret: $SECRET" "$BASE_URL/api/ingest/article-drafts?mode=deep-dive"
curl -X POST -H "x-ingest-secret: $SECRET" "$BASE_URL/api/ingest/embeddings?perSource=40&max=60"
```

아이디어 평가(RAG)는 `content_embeddings`에 있는 콘텐츠만 근거로 찾습니다. 처음 한 번은 쌓여 있는 데이터를 채워야 하므로, 응답의 `remaining`이 0이 될 때까지 아래 명령을 반복하세요.

```bash
curl -X POST -H "x-ingest-secret: $SECRET" "$BASE_URL/api/ingest/embeddings?perSource=1000&max=200"
```

한 번에 실행하려면 다음 API를 사용할 수 있습니다.

```bash
curl -X POST -H "x-ingest-secret: $SECRET" "$BASE_URL/api/ingest/all"
```

### 자동 수집

`.github/workflows/scheduled-ingest.yml`이 매일 06:00(KST)에 수집과 트렌드 집계를 실행합니다. 저장소의 Actions Secrets에 배포 주소 `SEEDUP_SITE_URL`과 `SEEDUP_INGEST_SECRET`을 등록해야 하며, 스케줄은 기본 브랜치에 병합된 뒤부터 동작합니다. Actions 화면의 `Run workflow`로 수동 실행할 수도 있습니다.

## 수집 소스

RSS 주소와 외부 API 주소는 `.env.example`의 다음 변수에서 관리합니다.

```text
INGEST_RSS_SOURCES
INGEST_ARXIV_SOURCES
INGEST_PRODUCT_SOURCES
INGEST_NPM_SOURCES
INGEST_HUGGINGFACE_SOURCES
INGEST_DEVTO_SOURCES
INGEST_STACKOVERFLOW_SOURCES
INGEST_HACKERNEWS_SOURCES
```

각 줄은 아래 형식입니다.

```env
소스 이름|URL|언어 코드
```

예시:

```env
INGEST_RSS_SOURCES="OpenAI News|https://openai.com/news/rss.xml|en
요즘IT|https://yozm.wishket.com/magazine/feed/|ko"
```

현재 수집 범위:

- RSS: 국내 기술 뉴스, Lenny's Newsletter, Hacker News RSS, OpenAI·AWS·GitHub·Vercel·Cloudflare·Kubernetes 등 공식 블로그
- 논문: arXiv `cs.AI`, `cs.LG`, `cs.CL`, `cs.CV`, `cs.SE`, `cs.DB` 및 OpenAlex 폴백
- 제품: Product Hunt
- 오픈소스: GitHub REST API
- 외부 트렌드: npm, Hugging Face Models/Spaces/Papers, DEV.to, Stack Overflow, Hacker News
- 기회 엔진 수요/공급: GitHub Issues/Repos, Hacker News(Ask HN/Show HN/댓글), Stack Overflow, DEV.to, Lobsters, npm, VS Code Marketplace
- 모델 인텔리전스: OpenRouter 공개 모델 목록, Artificial Analysis, Design Arena 벤치마크 필드

YouTube API는 현재 사용하지 않습니다.

## 기회 엔진 및 기회 다이제스트

개발자들이 공개적으로 남긴 불만에서 만들 만한 기회를 찾습니다. 전체 실행에 수십 분이 걸리므로 Worker가 아니라 로컬 또는 GitHub Actions에서 돌립니다.

```bash
npm run engine
```

`lib/opportunities/data/`의 스냅샷만 갱신합니다. DB 테이블이 비어 있으면 화면은 이 스냅샷을 사용합니다.

```bash
npm run engine -- --persist
```

Supabase에도 게시합니다. `.github/workflows/opportunity-engine.yml`이 매주 월요일 같은 작업을 실행합니다.

수집은 소스별 액터로 나뉘어 있습니다(`lib/opportunities/actors.ts`). 액터마다 호출 간격, 재시도, 실행 결과를 따로 관리하므로 한 소스가 실패해도 나머지는 계속됩니다.

인용문은 서버가 원문과 대조해 일치할 때만 남깁니다(`isVerbatimQuote`). 기준 통과는 서로 다른 게시글 3건 이상, 플랫폼 2종 이상입니다.

기회 변동 알림 및 주간 기회 다이제스트 이메일 발송은 아래 스크립트와 `.github/workflows/opportunity-digest.yml`로 실행합니다.

```bash
npx tsx --env-file=.env scripts/send-opportunity-digest.ts --mode=changes
npx tsx --env-file=.env scripts/send-opportunity-digest.ts --mode=weekly
```

## 품질 기준

Seedup은 수집된 URL 개수만으로 발행 여부를 판단하지 않습니다.

- 원천 데이터와 전처리 데이터, 발행 데이터를 분리
- URL·제목·콘텐츠 해시를 이용한 중복 수집 방지
- RSS는 최근 데이터와 관련성, 품질 점수, 금지 키워드 검사
- 논문은 개발·AI·소프트웨어 관련성 및 코드·벤치마크 연결성 검사
- GitHub는 스타 수, 최근 활동, 설명 품질, 저장소 주제, 포크·보관 여부 검사
- 트렌드는 최근 7일 신호, 이전 기간 대비 증가량, 최근 30일 누적량, 소스 다양성, 신선도를 반영
- `trend_bundle`은 글의 문맥으로만 사용하고 실제 독립 출처 수에는 포함하지 않음
- 일반 데일리 글은 관련 원천 자료와 소스 유형이 충분하지 않으면 발행하지 않음
- 같은 날짜와 같은 주제의 유사 글은 중복 발행하지 않음
- 논문과 제품은 각각 별도의 분석 프롬프트와 품질 검사를 적용

데일리 아티클은 다음 6개 트랙을 기준으로 후보를 고릅니다. 한 번의 실행에서 최대 12개까지 생성할 수 있지만, 자료 품질과 중복 방지 기준을 통과한 글만 발행합니다.

```text
AI / LLM
프론트엔드
백엔드
오픈소스 / GitHub
제품 / 빌드 아이디어
논문 / 리서치
```

자료가 충분한 트랙만 발행하며, 기준을 억지로 낮춰 빈약한 글을 만들지 않습니다. Deep Dive는 관리자에서 별도로 실행하고 주 1회 발행을 전제로 합니다.

## 추천과 아이디어 평가

로그인 사용자의 추천에는 온보딩 정보와 행동 데이터가 함께 사용됩니다.

- 관심 분야
- 현재 수준
- 목표와 희망 직무
- 선호 콘텐츠 유형
- 선호 기술 스택
- 저장·조회·좋아요·싫어요·추천 피드백

아이디어 평가에서는 최신 뉴스, 논문, GitHub, AI 제품 데이터를 Supabase에서 검색해 근거로 사용합니다. RAG 임베딩을 사용할 때는 `RAG_EMBEDDING_MODEL`과 OpenRouter 크레딧이 필요합니다.

평가 모델은 종합 점수, 항목별 점수, 강점·약점, MVP 범위처럼 검증 가능한 핵심 판단만 짧은 JSON으로 반환합니다. 위험 요소, 다음 실행 단계, 점수별 근거, 신뢰도는 서버가 RAG 참고 자료 수와 출처 다양성 규칙을 적용해 구성합니다. 모델 응답이 길어져 JSON이 잘리는 문제를 줄이고, 같은 기준으로 결과를 보여주기 위한 구조입니다.

## 뉴스레터

관리자 페이지에서 수동 발송하거나 기회 다이제스트 워크플로를 통해 자동 발송합니다. 수신자는 온보딩 프로필, 스크랩한 기회, 추천 점수를 기준으로 개인별로 달라지며, `newsletter_sends` 테이블과 Resend `Idempotency-Key`로 중복 발송을 방지합니다.

필수 환경변수:

```env
RESEND_API_KEY=your-resend-api-key
NEWSLETTER_FROM_EMAIL="Seedup <newsletter@your-domain.com>"
```

Resend에서 발신 도메인을 인증하지 않으면 실제 수신자에게 발송되지 않을 수 있습니다.

## Cloudflare Workers 배포

이 프로젝트는 `@opennextjs/cloudflare`를 사용하며, `main` 브랜치 푸시 시 CI 통과 후 자동으로 배포됩니다(`.github/workflows/ci.yml`).

```bash
npx wrangler login
npx wrangler whoami
npm run deploy
```

로컬에서 배포 결과를 확인하려면:

```bash
npm run preview
```

Cloudflare Workers의 Variables and Secrets에 `.env`의 서버 환경변수를 등록합니다. 특히 다음 값은 반드시 설정해야 합니다.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
OPENROUTER_API_KEY
OPENROUTER_MODEL
OPENROUTER_FALLBACK_MODELS
NEXT_PUBLIC_SITE_URL
INGEST_SECRET
ADMIN_EMAILS
```

관리자 수집 기능도 배포 환경에서 사용할 경우 아래 값을 실제 서비스 도메인으로 설정합니다. `localhost` 주소를 넣으면 배포된 Worker가 자기 자신에게 요청하지 못합니다.

```text
INGEST_INTERNAL_URL=https://seedup.rerereally.com
```

`wrangler.jsonc`에는 여러 외부 API와 Supabase를 함께 호출하는 Worker의 실행 위치를 자동 최적화하도록 Smart Placement가 설정되어 있습니다. 이는 Supabase 등 백엔드 연결 지연을 줄이는 설정이며, OpenRouter 모델의 지역 제공 제한을 보장해 해결하는 기능은 아닙니다.

배포 후 `NEXT_PUBLIC_SITE_URL`을 실제 도메인 주소로 바꾸고, Supabase Google/GitHub OAuth 콜백에도 아래 주소를 추가합니다.

```text
https://seedup.rerereally.com/auth/callback
```

## 자주 발생하는 문제

### `fetch failed` 또는 타임아웃

외부 RSS, GitHub, OpenRouter, Supabase 중 하나가 응답하지 않는 경우입니다. 먼저 관리자 실행 로그에서 실패한 소스를 확인하고, OpenRouter 글 생성은 다음 값을 늘려 재시도할 수 있습니다.

```env
OPENROUTER_TIMEOUT_MS=60000
OPENROUTER_ARTICLE_TIMEOUT_MS=120000
```

### 아이디어 평가에서 `평가 모델에 연결하지 못했습니다`가 표시됨

대개 OpenRouter 모델의 일시적인 빈 응답, 요청 제한, 또는 응답 형식 오류입니다. `OPENROUTER_API_KEY`와 OpenRouter 크레딧을 확인한 뒤 잠시 후 다시 시도하세요. Seedup은 짧은 JSON 응답을 우선 요청하고 한 번 재시도하지만, 두 요청 모두 실패하면 임의의 0점 결과를 저장하지 않고 오류를 안내합니다.

Cloudflare Worker 로그에 `This model is not available in your region`이라는 `403`이 표시되면 API 키나 호출 횟수 문제가 아니라, 해당 Worker 요청 위치에서 OpenRouter 모델을 제공하지 않는 경우입니다. OpenRouter에서 허용되는 다른 모델로 `OPENROUTER_MODEL`과 `OPENROUTER_FALLBACK_MODELS`를 변경하거나, AI 호출을 지원 지역의 별도 백엔드로 분리해야 합니다.

### `permission denied for table`

Supabase SQL Editor에서 `supabase/schema.sql` 전체를 다시 실행하고 `SUPABASE_SECRET_KEY`가 서버 환경변수에 있는지 확인합니다.

### `ON CONFLICT` 제약조건 오류

스키마의 unique index가 빠진 상태입니다. `supabase/schema.sql`을 다시 적용합니다.

### 글이 생성되지 않음

자료가 없거나 중복 클러스터만 남았거나, 소스 다양성·품질 기준을 통과하지 못한 경우입니다. 관리자 페이지의 `제외된 기사 로그`, `소스별 품질 디버그`, `article-drafts` 실행 사유를 먼저 확인합니다.

### Google 로그인 후 돌아오지 않음

Supabase와 Google Cloud Console 양쪽에 현재 실행 주소의 `/auth/callback`을 등록했는지 확인합니다. 포트가 `3001`이면 `3001` 주소도 별도로 등록해야 합니다.

## 프로젝트 구조

```text
app/
  page.tsx               인터랙티브 홈 스테이지 (OpportunityStage)
  opportunities/         기회 탐색 목록 및 상세 (점수·Why Now·선행 기록·PRD 생성)
  seeds/                 내 GitHub 저장소 기반 맞춤형 기능·논문 어드바이저
  ideas/                 아이디어 평가 & pgvector RAG 리포트
  news/                  아티클 목록·상세
  papers/                논문 상세
  trends/                트렌드 페이지 & 모델 인텔리전스
  projects/              프로젝트 아이디어 & 일차별 빌드 플랜
  ai-products/           AI 제품 목록·상세·평점·리뷰
  github-trends/         GitHub 급상승 오픈소스 상세
  scrap/                 통합 보관함
  search/                통합 검색
  onboarding/            사용자 관심사·수준·목표·스택 온보딩
  profile/               사용자 프로필 및 온보딩 수정
  admin/ingest/          관리자 수집 콘솔
  api/                   수집, 기회 매칭·PRD·도시에, 씨앗, 평가, 챗봇, 반응, 추천 API
  actions/               관리자·인증·보관함·리뷰·뉴스레터 서버 액션
components/
  opportunity-stage/     Matter.js 칩 파일, 근거 확인서 모달, 즉석 PRD 빌더
  SeedAdvisor.tsx        GitHub 저장소별 기회·기능·논문 어드바이저 UI
  ArticleAssistant.tsx   우측 플로팅 본문 컨텍스트 질의응답 챗봇
  ModelIntelligencePanel.tsx  OpenRouter·Artificial Analysis·Design Arena 비교 패널
lib/
  data.ts                Supabase 조회 함수와 타입
  opportunities/         기회 수집 액터, 원문 대조 규칙, 점수·Why Now, 스냅샷 병합, PRD 생성
  seeds/                 GitHub 공개 레포 조회, 기회·뉴스 연결, 기능 제안, 논문 검색
  ideas/                 아이디어 입력 사전 검증 규칙
  ingest/                AI 전처리, RAG, 소스, 품질 정책
  newsletter/            맞춤형 아티클 뉴스레터 및 기회 변동/주간 다이제스트 렌더러
  recommendations.ts     개인화 추천 엔진
  rate-limit.ts          일일 AI 호출 쿼터 제어
scripts/
  run-opportunity-engine.ts   기회 엔진 실행 및 스냅샷 병합 CLI
  send-opportunity-digest.ts  기회 변동 알림 및 주간 다이제스트 발송 CLI
supabase/
  schema.sql             테이블, 인덱스, RLS 정책
  opportunities_2026_11.sql   기회 및 도시에 스키마 마이그레이션
  hardening_2026_11.sql       일일 쿼터 RPC 및 보안 하드닝 마이그레이션
  newsletter_sends_2026_11.sql 뉴스레터 발송 멱등성 테이블 마이그레이션
tests/                   단위 테스트
.env.example             환경변수 예시와 수집 소스
wrangler.jsonc           Cloudflare Workers 설정
open-next.config.ts      OpenNext 설정
```

## 개발 명령어

```bash
npm run dev       # 개발 서버
npm run lint      # ESLint 검사
npm run typecheck # TypeScript 검사
npm test          # 단위 테스트
npm run engine    # 기회 엔진 실행
npm run build     # 프로덕션 빌드
npm run start     # 프로덕션 서버
npm run preview   # Cloudflare 로컬 미리보기
npm run deploy    # Cloudflare Workers 배포
```

## 라이선스

현재 저장소에는 별도 라이선스 파일이 없습니다. 공개 배포 전에 프로젝트 소유자와 라이선스 정책을 정하세요.
