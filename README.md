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
| 데이터 수집 | `rss-parser`, GitHub REST API, Hacker News Algolia API, Stack Exchange API, DEV.to API, Lobsters, npm Registry, VS Code Marketplace, arXiv API, OpenAlex API, Hugging Face, Product Hunt |
| 이메일 | Resend API (`newsletter_sends` 멱등성 보장) |
| 배포 | Cloudflare Workers (`@opennextjs/cloudflare`), GitHub Actions (스케줄 수집·기회 엔진·다이제스트) |

---

## 사전 요구사항

- Node.js 20.9 이상
- npm 10 이상
- Supabase 프로젝트
- OpenRouter API 키
- GitHub Personal Access Token (GitHub 수집 및 기회 엔진 실행 시 권장)
- Google OAuth 및 GitHub OAuth 설정 (로그인 및 `/seeds` 연동 시 필요)
- Resend API 키와 발신 도메인 (뉴스레터 및 기회 다이제스트 발송 시 필요)

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
- `lucide-react`
- `matter-js`
- `next`, `react`, `react-dom`
- `postcss`
- `rss-parser`

`package.json`에 직접 등록된 개발·배포·테스트 패키지:

- `@tailwindcss/postcss`, `tailwindcss`
- `@types/matter-js`, `@types/node`, `@types/react`, `@types/react-dom`
- `eslint`, `eslint-config-next`
- `tsx`, `typescript`
- `wrangler`

---

## 환경변수 설정

`.env.example`을 `.env`로 복사한 뒤 값을 입력합니다. `.env`와 API 키는 GitHub에 올리면 안 됩니다.

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
- `RAG_EMBEDDING_MODEL`: 기회 매칭 및 아이디어 평가 RAG 임베딩에 사용할 OpenRouter 임베딩 모델 (1536차원)

테스트 중 무료 모델을 쓰려면 `OPENROUTER_MODEL`에 `:free` 모델이나 `openrouter/free`를 지정합니다. `OPENROUTER_FREE_ONLY=true`를 설정하면 임베딩을 포함한 모든 유료 모델 호출이 차단됩니다.

---

## 데이터베이스 설정

1. Supabase Dashboard에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 [supabase/schema.sql](supabase/schema.sql)의 전체 내용을 실행합니다.
3. 기존 운영 중인 프로젝트에 최신 기능을 반영할 때는 아래 마이그레이션을 순서대로 실행합니다(새 프로젝트는 `schema.sql`에 포함되어 있습니다):
   - [supabase/opportunities_2026_11.sql](supabase/opportunities_2026_11.sql): 기회 엔진(`opportunities`) 및 증거 도시에(`evidence_dossiers`)
   - [supabase/hardening_2026_11.sql](supabase/hardening_2026_11.sql): 일일 사용량 제한(`daily_usage_limits`, `consume_daily_usage` RPC) 및 RLS 강화
   - [supabase/newsletter_sends_2026_11.sql](supabase/newsletter_sends_2026_11.sql): 뉴스레터·기회 다이제스트 중복 발송 방지(`newsletter_sends`)
4. 필요하면 테스트 데이터는 `supabase/dummy.sql`로 넣고, 삭제할 때는 `supabase/delete_dummy.sql`을 사용합니다.
5. Supabase의 `Authentication > Providers`에서 **Google** 및 **GitHub** 로그인을 활성화합니다.
6. OAuth 콜백 주소를 등록합니다:

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
ai_product_ratings        AI 제품 사용자 별점
ai_product_reviews        AI 제품 사용자 상세 리뷰
github_trends             GitHub 저장소
github_repo_snapshots     GitHub 스타 변화 이력
project_ideas             프로젝트 아이디어와 일차별 빌드 플랜
keyword_signals           여러 소스에서 나온 키워드 신호
trend_snapshots           기간별 트렌드 스냅샷
trends                    현재 트렌드 랭킹 캐시
ai_model_snapshots        OpenRouter·Artificial Analysis·Design Arena 모델 인텔리전스
content_embeddings        아이디어 평가 RAG용 1536차원 pgvector 임베딩
recommendation_feedback   추천 노출·클릭 피드백
content_reactions         좋아요·싫어요
scraps                    사용자 저장 콘텐츠 (기회·아티클·프로젝트·제품·오픈소스·논문·아이디어)
idea_evaluations          아이디어 평가 결과 캐시
daily_usage_limits        사용자별 일일 AI 기능 호출 쿼터
newsletter_sends          뉴스레터 및 기회 다이제스트 발송 멱등성 기록
ingest_runs               수집·생성 실행 로그
ingest_rejections         품질 기준으로 제외된 원천 데이터 로그
```

---

## 로컬 실행 및 테스트

개발 서버:

```bash
npm run dev
```

타입·린트·단위 테스트·빌드 검사:

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

---

## 기회 엔진 및 기회 다이제스트 실행

### 1. 기회 엔진 (`scripts/run-opportunity-engine.ts`)

개발자들이 공개적으로 남긴 불만에서 만들 만한 기회를 찾고 기존 공급 도구와 대조합니다.

```bash
# 로컬 스냅샷(lib/opportunities/data/) 갱신 및 이전 스냅샷과 시계열 병합
npm run engine

# Supabase(opportunities 테이블)까지 함께 게시
npm run engine -- --persist
```

- `.github/workflows/opportunity-engine.yml`이 매주 월요일 자동으로 실행합니다.
- 수집은 소스별 액터(`lib/opportunities/actors.ts`)로 격리되어 있어 한 소스가 실패해도 전체 실행은 중단되지 않습니다.
- 인용문은 서버가 원문과 대조해 일치할 때만 남기며(`isVerbatimQuote`), 기준 통과(`qualified`)는 서로 다른 게시글 3건 이상 + 플랫폼 2종 이상입니다.

### 2. 기회 다이제스트 메일 (`scripts/send-opportunity-digest.ts`)

```bash
# 보관함에 저장한 기회의 상태·증언 변화 알림 발송
npx tsx --env-file=.env scripts/send-opportunity-digest.ts --mode=changes

# 주간 기회 요약 다이제스트 발송
npx tsx --env-file=.env scripts/send-opportunity-digest.ts --mode=weekly
```

- `.github/workflows/opportunity-digest.yml`을 통해 자동 발송할 수 있으며, `newsletter_sends` 테이블과 Resend `Idempotency-Key`로 중복 발송을 방지합니다.

---

## 데이터 수집과 글 생성 순서 (`/admin/ingest`)

관리자 계정으로 로그인한 뒤 `/admin/ingest`에서 3단계 파이프라인을 실행할 수 있습니다.

```text
[1단계: 데이터 수집/전처리]
1. RSS / 뉴스 전처리
2. AI 제품 수집
3. GitHub 수집
4. 논문 수집·리뷰
5. npm·Hugging Face·DEV.to·Stack Overflow·Hacker News 외부 트렌드 수집
6. OpenRouter 모델 인텔리전스 수집

[2단계: 신호 집계]
7. 통합 트렌드 집계

[3단계: 글/아이디어 생성 및 발송]
8. 프로젝트 아이디어 및 빌드 플랜 생성
9. 6개 트랙 데일리 아티클 생성
10. 주간 Deep Dive 생성
11. 맞춤형 뉴스레터 발송
```

### 보호된 API 직접 실행

`YOUR_INGEST_SECRET`은 `.env`의 `INGEST_SECRET` 값으로 바꿉니다.

```bash
BASE_URL=http://localhost:3000
SECRET=YOUR_INGEST_SECRET

curl -X POST "$BASE_URL/api/ingest/rss?secret=$SECRET&limit=8"
curl -X POST "$BASE_URL/api/ingest/products?secret=$SECRET&limit=12"
curl -X POST "$BASE_URL/api/ingest/github?secret=$SECRET&limit=15&minStars=50"
curl -X POST "$BASE_URL/api/ingest/research?secret=$SECRET&limit=12&minScore=55&minFitScore=18"
curl -X POST "$BASE_URL/api/ingest/external-trends?secret=$SECRET"
curl -X POST "$BASE_URL/api/ingest/model-intelligence?secret=$SECRET"
curl -X POST "$BASE_URL/api/ingest/trends?secret=$SECRET"
curl -X POST "$BASE_URL/api/ingest/project-ideas?secret=$SECRET&limit=10"
curl -X POST "$BASE_URL/api/ingest/article-drafts?secret=$SECRET&mode=daily"
curl -X POST "$BASE_URL/api/ingest/article-drafts?secret=$SECRET&mode=deep-dive"
```

일괄 실행 API:

```bash
curl -X POST "$BASE_URL/api/ingest/all?secret=$SECRET"
```

`.github/workflows/scheduled-ingest.yml`이 매일 06:00(KST)에 수집과 트렌드 집계를 자동 실행합니다.

---

## Cloudflare Workers 배포

이 프로젝트는 `@opennextjs/cloudflare`를 사용하며, `main` 브랜치 푸시 시 `.github/workflows/deploy-cloudflare.yml`을 통해 자동 배포됩니다.

수동 배포 명령어:

```bash
npx wrangler login
npx wrangler whoami
npm run deploy
```

로컬에서 Cloudflare 런타임 미리보기:

```bash
npm run preview
```

---

## 프로젝트 구조

```text
app/
  page.tsx               인터랙티브 홈 스테이지 (OpportunityStage)
  opportunities/         기회 탐색 목록 및 상세 (점수·Why Now·선행 기록·PRD 생성)
  seeds/                 내 GitHub 저장소 기반 맞춤형 기능·논문 어드바이저
  ideas/                 AI 아이디어 검증기 & pgvector RAG 리포트
  news/                  6개 트랙 아티클 목록·상세
  papers/                논문 한국어 심층 리뷰 상세
  trends/                9대 소스 개발 트렌드 랭킹 & 모델 인텔리전스
  projects/              실전 프로젝트 일차별 빌드 플랜 상세
  ai-products/           AI 제품 목록·상세·별점·리뷰
  github-trends/         GitHub 급상승 오픈소스 상세
  scrap/                 통합 보관함 (기회·도시에·아티클·프로젝트·제품·오픈소스·논문·아이디어)
  search/                통합 검색
  onboarding/            사용자 관심사·수준·목표·스택 온보딩
  profile/               내 프로필 및 온보딩 설정 수정
  admin/ingest/          관리자 3단계 데이터 수집·품질 관제 콘솔
  api/                   기회 매칭·PRD·도시에·씨앗·아이디어 평가·글 도우미·수집 API
  actions/               인증·보관함·반응·리뷰·뉴스레터·관리자 서버 액션
components/
  opportunity-stage/     Matter.js 칩 파일, 근거 확인서 모달, 즉석 PRD 빌더
  SeedAdvisor.tsx        GitHub 저장소별 기회·기능·논문 어드바이저 UI
  ArticleAssistant.tsx   우측 플로팅 본문 컨텍스트 질의응답 챗봇
  ModelIntelligencePanel.tsx  OpenRouter·Artificial Analysis·Design Arena 비교 패널
lib/
  opportunities/         기회 수집 액터, 원문 대조 규칙, 점수·Why Now, 스냅샷 병합, PRD 생성
  seeds/                 GitHub 공개 레포 조회, 기회·뉴스 연결, 기능 제안, arXiv/OpenAlex 논문 검색
  ideas/                 아이디어 입력 사전 검증 규칙
  ingest/                AI 전처리, pgvector RAG, 멀티소스 수집기, 클러스터링 품질 정책
  newsletter/            맞춤형 아티클 뉴스레터 및 기회 변동/주간 다이제스트 렌더러
  recommendations.ts     온보딩 + 보관함 토큰 결합 개인화 추천 엔진
  rate-limit.ts          일일 AI 사용량 쿼터 제어
scripts/
  run-opportunity-engine.ts   기회 엔진 실행 및 스냅샷 시계열 병합 CLI
  send-opportunity-digest.ts  기회 변동 알림 및 주간 다이제스트 발송 CLI
supabase/
  schema.sql             전체 테이블·인덱스·RLS 정책 스키마
  opportunities_2026_11.sql   기회 및 도시에 스키마 마이그레이션
  hardening_2026_11.sql       일일 쿼터 RPC 및 보안 하드닝 마이그레이션
  newsletter_sends_2026_11.sql 뉴스레터 발송 멱등성 테이블 마이그레이션
tests/                   기회 규칙, 시계열 병합, 씨앗 어드바이저, 가드, 캐시 단위 테스트
```

## 개발 명령어

```bash
npm run dev       # 개발 서버 실행
npm run lint      # ESLint 검사
npm run typecheck # TypeScript 타입 검사
npm test          # 단위 테스트 실행 (tests/**/*.test.ts)
npm run engine    # 기회 엔진 실행 및 스냅샷 병합
npm run build     # 프로덕션 빌드
npm run start     # 프로덕션 서버 실행
npm run preview   # Cloudflare Workers 로컬 미리보기
npm run deploy    # Cloudflare Workers 배포
```

## 라이선스

현재 저장소에는 별도 라이선스 파일이 없습니다. 공개 배포 전에 프로젝트 소유자와 라이선스 정책을 정하세요.
