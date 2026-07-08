# Seedup

Seedup is a developer trend and project idea platform. It collects developer news, AI product launches, and popular GitHub repositories, then turns them into beginner-friendly summaries, trend keywords, and portfolio project ideas.

## Main Features

- Developer news collection from RSS feeds
- Product Hunt collection for AI product and product trend discovery
- GitHub trend collection using the GitHub REST API
- OpenRouter-powered AI summaries and project idea generation
- Supabase Auth with Google login
- Login onboarding survey with newsletter preference
- Trend ranking based on accumulated keyword signals
- Manual ingestion console with run history
- News/detail pages, trend accordion, AI product pages, GitHub trend pages, scraps, and project pages

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
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
NEXT_PUBLIC_SITE_URL=http://localhost:3001

GITHUB_TOKEN=your-github-token
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
http://localhost:3000/api/ingest/github?secret=BootCamp&limit=5
http://localhost:3000/api/ingest/trends?secret=BootCamp
http://localhost:3000/api/ingest/project-ideas?secret=BootCamp&limit=10
```

Expected order:

1. `rss`: fills `news_items`
2. `products`: fills `ai_products`
3. `github`: fills `github_trends`
4. `trends`: writes `keyword_signals`, `trend_snapshots`, and updates `trends`
5. `project-ideas`: fills `project_ideas`

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

## Trend Calculation

Seedup does not only overwrite a simple trend list. It accumulates keyword signals.

Data flow:

```txt
news_items / ai_products / github_trends
        -> keyword_signals
        -> trend_snapshots
        -> trends
```

Trend score considers:

- Recent 7-day signal count
- Previous 7-day comparison
- Last 30-day accumulated signals
- Source diversity across news, products, and GitHub
- GitHub star weight
- Product source weight
- Recency decay for older signals

The `trends` table is used as the current ranking cache for the UI.

## AI Behavior

OpenRouter is used for:

- News relevance analysis
- Beginner-friendly summaries
- Product analysis
- GitHub repository reviews
- Project idea generation

If OpenRouter returns an empty or invalid response, the app falls back to a local summary so ingestion can continue.

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
3. GitHub ingestion
4. Trend aggregation
5. Project idea generation

On Vercel, this can be done with Vercel Cron Jobs calling the protected ingestion URLs with `INGEST_SECRET`.

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
NEXT_PUBLIC_SITE_URL
GITHUB_TOKEN
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
