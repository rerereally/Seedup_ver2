# Seedup
KNU_LLM BootCamp 8조
- 조민규 : PM 및 발표
- 김가남 : 오류 분석 및 테스트
- 정지훈 : 개발 과정 전담

Seedup은 개발자에게 필요한 최신 기술 신호를 모아, 읽을 만한 한국어 아티클과 프로젝트 아이디어로 연결하는 서비스입니다.

뉴스와 기술 블로그, 논문, GitHub 저장소, AI 제품, 개발자 커뮤니티 데이터를 먼저 수집합니다. 수집한 원천 데이터는 전처리와 중복 제거를 거쳐 Supabase에 저장되고, 서로 관련 있는 자료를 묶은 뒤에만 아티클과 추천 콘텐츠를 생성합니다.

## 주요 기능

- RSS와 기술 블로그에서 개발 뉴스 수집
- arXiv와 Hugging Face Papers에서 AI·개발 관련 논문 수집 및 한국어 리뷰 생성
- Product Hunt에서 AI 제품 수집 및 제품 평가
- GitHub API로 AI, MCP, RAG, 개발 도구, 백엔드, DevOps 저장소 수집
- npm, Hugging Face, DEV.to, Stack Overflow, Hacker News 외부 트렌드 수집
- 여러 소스의 키워드 신호를 합친 카테고리별 트렌드 랭킹
- OpenRouter 모델 사용량·성능 데이터 표시
- 최신 뉴스와 논문, 오픈소스, 제품을 활용한 맞춤형 추천
- 6개 데일리 아티클 트랙과 주간 Deep Dive 생성
- 아이디어 평가, RAG 근거 조회, 프로젝트 빌드 플랜 생성
- 아티클·논문·프로젝트·AI 제품·오픈소스 저장 및 좋아요/싫어요
- Supabase Auth 기반 Google 로그인과 온보딩
- Resend 기반 개인 맞춤 뉴스레터 발송
- 관리자 페이지에서 수집, 전처리, 트렌드 집계, 글 생성 실행

## 기술 구성

| 영역 | 사용 기술 |
| --- | --- |
| 웹 프레임워크 | Next.js 16 App Router, React 19, TypeScript |
| UI | Tailwind CSS 4, Lucide React, Motion |
| 데이터베이스 | Supabase PostgreSQL, Row Level Security, pgvector 선택 지원 |
| 인증 | Supabase Auth, Google OAuth |
| AI | OpenRouter API |
| 수집 | rss-parser, GitHub REST API, arXiv API, 외부 공개 API |
| 이메일 | Resend |
| 배포 | Cloudflare Workers, OpenNext |

## 사전 요구사항

- Node.js 20.9 이상
- npm 10 이상
- Supabase 프로젝트
- OpenRouter API 키
- GitHub Personal Access Token, GitHub 수집을 사용할 때 권장
- Google OAuth 설정, 로그인을 사용할 때 필요
- Resend API 키와 발신 도메인, 뉴스레터를 사용할 때 필요

운영체제는 macOS, Linux, Windows 모두 가능하지만 아래 명령은 macOS/Linux 기준입니다.

## 설치

```bash
git clone <저장소-주소>
cd Seedup_ver2
npm install
cp .env.example .env
```

`npm install`이 설치하는 패키지는 `package.json`과 `package-lock.json`에 고정되어 있습니다. 별도로 전역 설치해야 하는 패키지는 없습니다.

### 실행에 포함되는 주요 패키지

`package.json`에 직접 등록된 런타임 패키지:

- `@google/genai`
- `@hookform/resolvers`
- `@opennextjs/cloudflare`
- `@supabase/ssr`, `@supabase/supabase-js`
- `autoprefixer`, `postcss`
- `class-variance-authority`, `clsx`, `tailwind-merge`
- `lucide-react`, `motion`
- `next`, `react`, `react-dom`
- `rss-parser`

`package.json`에 직접 등록된 개발·배포 패키지:

- `@tailwindcss/postcss`, `@tailwindcss/typography`
- `@types/node`, `@types/react`, `@types/react-dom`
- `eslint`, `eslint-config-next`
- `tailwindcss`, `tw-animate-css`
- `typescript`
- `wrangler`

버전은 `package.json`에 정의되어 있으며, 설치 시 `package-lock.json` 기준으로 재현됩니다. `npm install`만 실행하면 되므로 `npm install next`, `npm install supabase`처럼 개별 설치할 필요가 없습니다.

## 환경변수 설정

`.env.example`을 `.env`로 복사한 뒤 값을 입력합니다. `.env`와 API 키는 GitHub에 올리면 안 됩니다. `.gitignore`에 포함되어 있는지 확인하세요.

### 필수 환경변수

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=anthropic/claude-sonnet-5
OPENROUTER_FALLBACK_MODELS=google/gemini-3.5-flash

NEXT_PUBLIC_SITE_URL=http://localhost:3000
INGEST_SECRET=change-this-secret
ADMIN_EMAILS=you@example.com
NEXT_PUBLIC_ADMIN_EMAILS=you@example.com
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

`OPENROUTER_API_KEY` 하나로 전처리와 글 작성, 아이디어 평가를 모두 호출합니다. 현재 모델 역할은 다음과 같습니다.

- 전처리: `google/gemini-3.5-flash`
- 아티클 작성과 Deep Dive, 아이디어 평가: `anthropic/claude-sonnet-5`
- `OPENROUTER_FALLBACK_MODELS`: 작성 모델 장애 시 사용할 보조 모델
- `RAG_EMBEDDING_MODEL`: 아이디어 평가 RAG 임베딩에 사용할 OpenRouter 임베딩 모델

실제 운영값과 소스 목록은 항상 `.env.example`의 최신 내용을 기준으로 입력하세요.

## 데이터베이스 설정

1. Supabase Dashboard에서 새 프로젝트를 만듭니다.
2. SQL Editor에서 [supabase/schema.sql](supabase/schema.sql)의 전체 내용을 실행합니다.
3. 필요하면 테스트 데이터는 `supabase/dummy.sql`로 넣고, 삭제할 때는 `supabase/delete_dummy.sql`을 사용합니다.
4. Supabase의 `Authentication > Providers > Google`에서 Google 로그인을 켭니다.
5. Google OAuth와 Supabase에 다음 콜백 주소를 등록합니다.

```text
http://localhost:3000/auth/callback
http://localhost:3001/auth/callback
```

주요 테이블은 다음과 같습니다.

```text
profiles                  사용자 프로필
user_onboarding           온보딩 관심사·목표·기술 스택
news_items                원천 뉴스와 발행 아티클
research_papers           논문과 논문 리뷰 메타데이터
news_paper_links          뉴스와 논문 연결
ai_products               AI 제품
ai_product_ratings        AI 제품 사용자 평점
github_trends             GitHub 저장소
github_repo_snapshots     GitHub 스타 변화 이력
project_ideas             프로젝트 아이디어와 빌드 플랜
keyword_signals           여러 소스에서 나온 키워드 신호
trend_snapshots           기간별 트렌드 스냅샷
trends                    현재 트렌드 랭킹 캐시
ai_model_snapshots        OpenRouter 모델 인텔리전스
recommendation_feedback   추천 피드백
content_reactions         좋아요·싫어요
scraps                    사용자 저장 콘텐츠
idea_evaluations          아이디어 평가 결과
ingest_runs               수집·생성 실행 로그
ingest_rejections         품질 기준으로 제외된 원천 데이터
```

`SUPABASE_SERVICE_ROLE_KEY`는 서버에서만 사용합니다. 브라우저 코드나 GitHub 저장소에 노출하면 안 됩니다.

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

품질 검사:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

프로덕션 실행:

```bash
npm run build
npm run start
```

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

한 번에 실행하려면 다음 API를 사용할 수 있습니다.

```bash
curl -X POST "$BASE_URL/api/ingest/all?secret=$SECRET"
```

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
- 논문: arXiv `cs.AI`, `cs.LG`, `cs.CL`, `cs.CV`, `cs.SE`, `cs.DB`
- 제품: Product Hunt
- 오픈소스: GitHub REST API
- 외부 트렌드: npm, Hugging Face Models/Spaces/Papers, DEV.to, Stack Overflow, Hacker News
- 모델 인텔리전스: OpenRouter 공개 모델 목록과 벤치마크 필드

YouTube API는 현재 사용하지 않습니다.

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

## 뉴스레터

관리자 페이지에서 수동 발송합니다. 수신자는 온보딩 프로필과 추천 점수를 기준으로 개인별로 달라집니다.

필수 환경변수:

```env
RESEND_API_KEY=your-resend-api-key
NEWSLETTER_FROM_EMAIL="Seedup <newsletter@your-domain.com>"
```

Resend에서 발신 도메인을 인증하지 않으면 실제 수신자에게 발송되지 않을 수 있습니다.

## Cloudflare Workers 배포

이 프로젝트는 `@opennextjs/cloudflare`를 사용합니다.

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
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
OPENROUTER_MODEL
OPENROUTER_FALLBACK_MODELS
NEXT_PUBLIC_SITE_URL
INGEST_SECRET
ADMIN_EMAILS
NEXT_PUBLIC_ADMIN_EMAILS
```

배포 후 `NEXT_PUBLIC_SITE_URL`을 실제 Worker 주소로 바꾸고, Supabase Google OAuth 콜백에도 아래 주소를 추가합니다.

```text
https://your-domain.example.com/auth/callback
```

## 자주 발생하는 문제

### `fetch failed` 또는 타임아웃

외부 RSS, GitHub, OpenRouter, Supabase 중 하나가 응답하지 않는 경우입니다. 먼저 관리자 실행 로그에서 실패한 소스를 확인하고, OpenRouter 글 생성은 다음 값을 늘려 재시도할 수 있습니다.

```env
OPENROUTER_TIMEOUT_MS=60000
OPENROUTER_ARTICLE_TIMEOUT_MS=120000
```

### `permission denied for table`

Supabase SQL Editor에서 `supabase/schema.sql` 전체를 다시 실행하고 `SUPABASE_SERVICE_ROLE_KEY`가 서버 환경변수에 있는지 확인합니다.

### `ON CONFLICT` 제약조건 오류

스키마의 unique index가 빠진 상태입니다. `supabase/schema.sql`을 다시 적용합니다.

### 글이 생성되지 않음

자료가 없거나 중복 클러스터만 남았거나, 소스 다양성·품질 기준을 통과하지 못한 경우입니다. 관리자 페이지의 `제외된 기사 로그`, `소스별 품질 디버그`, `article-drafts` 실행 사유를 먼저 확인합니다.

### Google 로그인 후 돌아오지 않음

Supabase와 Google Cloud Console 양쪽에 현재 실행 주소의 `/auth/callback`을 등록했는지 확인합니다. 포트가 `3001`이면 `3001` 주소도 별도로 등록해야 합니다.

## 프로젝트 구조

```text
app/
  api/                 수집, 평가, 반응, 추천 API
  actions/             관리자·인증·뉴스레터 서버 액션
  admin/ingest/        관리자 수집 콘솔
  news/                아티클 목록·상세
  papers/              논문 상세
  trends/              트렌드 페이지
  ideas/               아이디어 평가
  projects/            프로젝트 아이디어
  ai-products/         AI 제품
components/            공용 UI와 클라이언트 상호작용
lib/data.ts            Supabase 조회 함수와 타입
lib/ingest/            AI 전처리, RAG, 소스, 품질 정책
supabase/schema.sql    테이블, 인덱스, RLS 정책
.env.example           환경변수 예시와 수집 소스
wrangler.jsonc         Cloudflare Workers 설정
open-next.config.ts    OpenNext 설정
```

## 개발 명령어

```bash
npm run dev       # 개발 서버
npm run lint      # ESLint 검사
npx tsc --noEmit  # TypeScript 검사
npm run build     # 프로덕션 빌드
npm run start     # 프로덕션 서버
npm run preview   # Cloudflare 로컬 미리보기
npm run deploy    # Cloudflare Workers 배포
```

## 라이선스

현재 저장소에는 별도 라이선스 파일이 없습니다. 공개 배포 전에 프로젝트 소유자와 라이선스 정책을 정하세요.
