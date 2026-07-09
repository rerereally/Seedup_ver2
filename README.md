# Seedup

Seedup is a developer trend and project idea platform. It collects developer news, AI product launches, and popular GitHub repositories, then turns them into beginner-friendly summaries, trend keywords, and portfolio project ideas.

Current product direction: Seedup is a personal developer newsletter engine. Raw RSS/Product/GitHub/Paper data is collected first, preprocessed into structured metadata, stored in Supabase, clustered with related signals, and only then converted into publishable Korean articles.

## Main Features

- Developer news collection from RSS feeds
- Product Hunt collection for AI product and product trend discovery
- GitHub trend collection using the GitHub REST API
- OpenRouter-powered AI summaries and project idea generation
- Supabase Auth with Google login
- Login onboarding survey with newsletter preference
- Trend ranking based on accumulated keyword signals
- Manual ingestion console with run history
- Article feed with fixed hero banner, Popular Top 5, news/paper filters, and article detail pages
- Article detail AI question panel for short article Q&A and project handoff to idea evaluation
- Chat-style idea evaluation with in-chat progress and analysis results
- Trend accordion, AI product ranking, GitHub trend pages, scraps, and project pages

## Tech Stack

- Next.js App Router
- React
- Tailwind CSS
- Supabase Postgres, Auth, and RLS
- OpenRouter API
- GitHub REST API
- rss-parser

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env` from `.env.example` and fill in the values:

```bash
cp .env.example .env
```

Required environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

OPENROUTER_API_KEY=your-openrouter-api-key
OPENROUTER_MODEL=google/gemini-3.5-flash
OPENROUTER_FALLBACK_MODELS=google/gemini-3.5-flash
NEXT_PUBLIC_SITE_URL=http://localhost:3001

GITHUB_TOKEN=your-github-token
GITHUB_MIN_STARS=50
INGEST_SECRET=change-this-secret
ADMIN_EMAILS=you@example.com
NEXT_PUBLIC_ADMIN_EMAILS=you@example.com

RESEND_API_KEY=your-resend-api-key
NEWSLETTER_FROM_EMAIL=Seedup <newsletter@your-domain.com>
```

`INGEST_SECRET` protects the manual ingestion API routes. Use the same value when calling `/api/ingest/*`.
`RESEND_API_KEY` and `NEWSLETTER_FROM_EMAIL` are used by the admin console's manual newsletter sender.

Run the development server:

```bash
npm run dev
```

If port `3000` is already in use, Next.js may automatically use `3001`. Use the URL printed in the terminal.

## Supabase Setup

Run this file in the Supabase SQL Editor:

```txt
supabase/schema.sql
```

This creates the main tables, RLS policies, grants, indexes, and duplicate cleanup needed by the ingestion routes.

Main tables:

- `profiles`
- `news_items`
- `ai_products`
- `github_trends`
- `research_papers`
- `news_paper_links`
- `project_ideas`
- `trends`
- `keyword_signals`
- `trend_snapshots`
- `ingest_runs`
- `scraps`
- `idea_evaluations`
- `user_onboarding`

Optional local test data:

```txt
supabase/dummy.sql
```

Remove local dummy/seed data:

```txt
supabase/delete_dummy.sql
```

## Google Login

In Supabase Dashboard:

1. Enable Google provider in `Authentication > Providers`.
2. Add the local callback URL:

```txt
http://localhost:3000/auth/callback
http://localhost:3001/auth/callback
```

3. Add the deployed callback URL later when hosting.

## Manual Data Ingestion

During local development, ingestion is manual. This makes it easier to check data quality, AI summaries, and Supabase rows before adding scheduled jobs.

Logged-in users can use the ingestion console:

```txt
http://localhost:3000/admin/ingest
```

The console runs each ingestion step and reads recent results from `ingest_runs`.
Only emails listed in `ADMIN_EMAILS` or `NEXT_PUBLIC_ADMIN_EMAILS` can access this page.

Run these in order. Replace `BootCamp` with your `INGEST_SECRET` value and use `3001` if that is the active port.

```txt
http://localhost:3000/api/ingest/rss?secret=BootCamp&limit=5
http://localhost:3000/api/ingest/products?secret=BootCamp&limit=10
http://localhost:3000/api/ingest/github?secret=BootCamp&limit=15&minStars=50&pruneDays=30
http://localhost:3000/api/ingest/research?secret=BootCamp&limit=12&minScore=55&minFitScore=18
http://localhost:3000/api/ingest/trends?secret=BootCamp
http://localhost:3000/api/ingest/project-ideas?secret=BootCamp&limit=10
http://localhost:3000/api/ingest/article-drafts?secret=BootCamp&mode=daily&limit=8
http://localhost:3000/api/ingest/article-drafts?secret=BootCamp&mode=deep-dive&limit=1&minSources=5&minSourceTypes=3
```

Expected order:

1. `rss`: fills `news_items`
2. `products`: fills `ai_products`
3. `github`: fills `github_trends` after repository quality gates
4. `research`: fills `research_papers` and `news_paper_links` after research fit and AI quality gates
5. `trends`: writes `keyword_signals`, `trend_snapshots`, and updates `trends`
6. `project-ideas`: fills `project_ideas`
7. `article-drafts`: writes publishable Seedup articles into `news_items`

A successful trend response looks like:

```json
{
  "ok": true,
  "signals": 120,
  "upserted": 12
}
```

## Source Management

Default RSS and Product Hunt sources live in:

```txt
lib/ingest/sources.ts
```

You can optionally override them from `.env`.

Format:

```env
INGEST_RSS_SOURCES="IT동아|https://it.donga.com/feeds/rss/|ko
전자신문|http://rss.etnews.com/03.xml|ko
요즘IT|https://yozm.wishket.com/magazine/feed/|ko"

INGEST_PRODUCT_SOURCES="Product Hunt|https://www.producthunt.com/feed|en"
```

If these env values are empty, the app uses the default sources in code.

## Data Quality Gates

Seedup now uses separate gates per source type. The goal is to prevent weak raw data from becoming a trend, recommendation, or article.

GitHub ingestion:

- Default minimum stars: `50` (`GITHUB_MIN_STARS` or `minStars` query param)
- Default freshness window: pushed within the last 30 days
- Skips forks, archived repos, disabled repos, thin descriptions, low-signal awesome/list/tutorial repos, and off-topic repos
- Requires a Seedup-relevant signal such as AI agent, MCP, RAG, AI coding, developer tools, CLI/SDK, workflow automation, app templates, or AI-focused frontend/backend tooling
- Records daily star snapshots in `github_repo_snapshots` when the schema is applied

Research ingestion:

- Default minimum AI relevance score: `55`
- Default minimum Seedup fit score: `18`
- Off-domain papers such as medical/public-health/biology are rejected unless they have a strong developer anchor such as software engineering, coding agents, code generation, APIs/SDKs, developer tooling, deployment, observability, backend, frontend, database, or DevOps
- Paper reviews must be Korean, non-generic, and long enough to read like a Seedup paper article, not an abstract copy

Trend aggregation:

- Generic standalone skills such as `TypeScript`, `React`, `Next.js`, `Rust`, `TUI`, `Benchmark`, `API`, and `LLM` are not allowed to rank by themselves
- Build-idea phrases such as `이 저장소를 활용하여...` are rejected as low-signal keywords
- Each category has its own threshold:
  - `개발 워크플로우` only accepts concrete work patterns such as AI Code Review, Codebase Q&A, Test Generation, Design to Code, PRD to Code, and Figma to Code Workflow
  - `AI 도구·모델` only accepts detected tool/model names such as Claude Code, Cursor, Qwen, Ollama, Cline, Continue, OpenHands, v0, and similar entities
  - `구현 패턴` only accepts implementation patterns such as MCP Server Design, RAG Evaluation, Tool Calling, LLM Observability, Prompt Caching, Streaming UI, Eval Pipeline, and Rate Limit Handling
  - `오픈소스 프로젝트` requires an actual GitHub project/repo display name, not repo topics or languages
  - `빌드 아이디어` requires generated project topics from clustered signals, not raw keywords

## Trend Calculation

Seedup does not only overwrite a simple trend list. It accumulates keyword signals.

Data flow:

```txt
news_items / ai_products / github_trends / research_papers
        -> keyword_signals
        -> trend_snapshots
        -> trends
```

Trend entity extraction is category-specific:

- `개발 워크플로우`: extracts workflow/action patterns from RSS/news, papers, products, GitHub descriptions, and community-style sources
- `AI 도구·모델`: extracts product, model, and tool names from Product Hunt, GitHub, Hugging Face-style signals, npm-style signals, and community mentions
- `구현 패턴`: extracts concrete architecture and implementation patterns from news, papers, GitHub descriptions, and project ideas
- `오픈소스 프로젝트`: extracts only GitHub repo/project display names
- `빌드 아이디어`: generates project topics such as `AI 코드 리뷰 봇`, `RAG 품질 평가 대시보드`, and `LLM 비용 모니터링 대시보드` from clustered signals

Trend score considers:

- Recent 7-day signal count
- Previous 7-day comparison
- Last 30-day accumulated signals
- Source diversity across news, products, GitHub, and papers
- GitHub quality/freshness after repository gates
- Product source weight
- Category-specific source weights for GitHub, npm, Product Hunt, Hacker News, DEV.to, Stack Overflow, Hugging Face, RSS/news, and papers
- Recency decay for older signals

The `trends` table is used as the current ranking cache for the UI.

## AI Behavior

OpenRouter is used for:

- News relevance analysis
- Korean article rewriting and beginner-friendly long-form summaries
- Product analysis
- GitHub repository reviews
- Project idea generation
- Article Q&A in the detail sidebar
- Idea evaluation chat responses

All AI routes use `google/gemini-3.5-flash` by default. Keep `OPENROUTER_MODEL` and `OPENROUTER_FALLBACK_MODELS` aligned unless you intentionally test another model.

News ingestion first parses source data into structured fields such as title, source, original URL, published date, and cleaned content. The AI returns analysis JSON only: Korean title, category, relevance score, summaries, target audience tags, related skills, and project ideas. RSS ingestion does not publish long articles.

Article generation happens separately in `/api/ingest/article-drafts`.

Daily articles:

- Four tracks: `AI/LLM`, `프론트엔드`, `백엔드`, `사이드프로젝트/창업`
- Up to 2 posts per track per day, max 8 total
- Requires at least 3 related sources and at least 2 source types by default
- Rejects short/generic/template-like drafts before saving

Weekly Deep Dive:

- Separate admin action
- Intended to run once per week
- Requires at least 5 sources and 3 source types by default

Paper reviews use their own prompt and quality gate. They must read like a paper-specific Korean mini article with beginner explanation, practitioner analysis, implementation idea, service angle, and limits. Generic abstract rewrites are skipped.

If OpenRouter returns an empty or invalid response, ingestion skips quality-sensitive content instead of publishing weak fallback articles.

## UI Notes

- Shared page headers use `components/PageIntro.tsx` and `.page-intro-*` styles in `app/globals.css`.
- The article page keeps the hero banner fixed height and places Popular Top 5 beside it.
- Category cards were removed from the article page; global search lives in the header.
- Related paper reviews on article details are collapsed by default.
- The idea evaluation page is a chat interface. While AI is running, it shows `답변을 생각중입니다.` and then renders the analysis inside the chat.
- Page backgrounds use the same `bg-surface` base for visual consistency.

## Common Issues

### Port 3000 is in use

This is not an error. Next.js will print the active port:

```txt
Local: http://localhost:3001
```

Use that port for the browser and ingestion APIs.

### `permission denied for table`

Run `supabase/schema.sql` again. The ingestion routes need `SUPABASE_SERVICE_ROLE_KEY` and service role grants.

### `there is no unique or exclusion constraint matching the ON CONFLICT specification`

Run `supabase/schema.sql` again. The schema creates the unique indexes needed by `upsert`.

### `OpenRouter returned empty content`

This can happen with free models. The app logs the issue and uses fallback analysis where possible.

## Scripts

```bash
npm run dev
npm run lint
npm run build
npm run start
```

## Deployment Notes

For production, add scheduled ingestion after hosting. The recommended order is:

1. RSS ingestion
2. Product ingestion
3. GitHub ingestion with `minStars=50`
4. Research paper reviews with `minScore=55&minFitScore=18`
5. Trend aggregation
6. Project idea generation
7. Daily article generation

On Vercel, this can be done with Vercel Cron Jobs calling the protected ingestion URLs with `INGEST_SECRET`.

## Research Paper Reviews

Seedup can collect AI/developer research papers and turn them into news-like internal content.

Current sources:

```txt
arXiv API: https://export.arxiv.org/api/query
Papers with Code API: https://paperswithcode.com/api/v1/papers/
Hugging Face Papers: https://huggingface.co/papers
```

Manual run:

```bash
curl -X POST "http://localhost:3001/api/ingest/research?secret=YOUR_INGEST_SECRET&limit=12"
```

What it fills:

```txt
research_papers
news_paper_links
```

The news page shows a `Seedup 논문 리뷰` section, and each news detail page can show related paper reviews in the right sidebar.

## Cloudflare Workers Deployment

This project is configured for Cloudflare Workers using the Cloudflare OpenNext adapter.

Cloudflare files:

- `wrangler.jsonc`
- `open-next.config.ts`

Useful commands:

```bash
npm run preview
npm run deploy
```

Before deploying, log in to Cloudflare:

```bash
npx wrangler login
npx wrangler whoami
```

If login is difficult in a non-interactive terminal, create a Cloudflare API token and set it locally:

```bash
export CLOUDFLARE_API_TOKEN=your-cloudflare-api-token
npm run deploy
```

Set these variables in Cloudflare Workers `Settings > Variables and Secrets`:

```txt
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
OPENROUTER_API_KEY
OPENROUTER_MODEL
OPENROUTER_FALLBACK_MODELS
NEXT_PUBLIC_SITE_URL
GITHUB_TOKEN
GITHUB_MIN_STARS
INGEST_SECRET
ADMIN_EMAILS
NEXT_PUBLIC_ADMIN_EMAILS
RESEND_API_KEY
NEWSLETTER_FROM_EMAIL
```

After deployment, update:

```txt
NEXT_PUBLIC_SITE_URL=https://your-worker-or-custom-domain
```

Also add the deployed callback URL in Supabase Google Auth settings:

```txt
https://your-worker-or-custom-domain/auth/callback
```
