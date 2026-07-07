import { assertIngestAuth } from '@/lib/ingest/auth';
import { analyzeProduct } from '@/lib/ingest/ai';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { PRODUCT_SOURCES } from '@/lib/ingest/sources';
import { stripHtml } from '@/lib/ingest/text';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import Parser from 'rss-parser';

export const runtime = 'nodejs';
export const maxDuration = 60;

const parser = new Parser({
  timeout: 12000,
  headers: { 'user-agent': 'SeedupBot/1.0' },
});

export async function GET(request: Request) {
  return ingest(request);
}

export async function POST(request: Request) {
  return ingest(request);
}

async function ingest(request: Request) {
  const startedAt = Date.now();
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase server configuration' }, { status: 500 });
  }

  const url = new URL(request.url);
  const limitPerSource = Number(url.searchParams.get('limit') ?? 10);
  let upserted = 0;
  let errors = 0;
  let skipped = 0;

  for (const source of PRODUCT_SOURCES) {
    try {
      const feed = await parser.parseURL(source.url);

      for (const item of feed.items.slice(0, limitPerSource)) {
        const productUrl = item.link || item.guid;
        const name = normalizeProductName(item.title ?? '');
        if (!name || !productUrl) {
          skipped += 1;
          continue;
        }

        const content = stripHtml(getItemField(item, 'content:encoded') || item.content || item.contentSnippet || item.summary || name);
        const { analysis } = await analyzeProduct({ name, content, url: productUrl });

        const { error } = await supabase.from('ai_products').upsert(
          {
            name,
            category: analysis.category,
            description: analysis.description,
            score: analysis.score,
            rating_count: 0,
            status: analysis.status,
            website_url: productUrl,
            source: source.name,
            product_hunt_url: productUrl,
            launch_date: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
            use_cases: analysis.use_cases,
            pricing_type: analysis.pricing_type,
            target_user: analysis.target_user,
            related_project_ideas: analysis.related_project_ideas,
          },
          { onConflict: 'product_hunt_url' },
        );

        if (error) {
          errors += 1;
          console.error('Product upsert failed', name, error);
        } else {
          upserted += 1;
        }
      }
    } catch (error) {
      errors += 1;
      console.error('Product source failed', source.name, error);
    }
  }

  await recordIngestRun(supabase, {
    source: 'products',
    status: getRunStatus(errors, upserted),
    inserted: upserted,
    skipped,
    errors,
    durationMs: Date.now() - startedAt,
    detail: { limitPerSource },
  });

  return NextResponse.json({ ok: true, upserted, skipped, errors });
}

function normalizeProductName(title: string) {
  return title.split(' - ')[0]?.trim() || title.trim();
}

function getItemField(item: Parser.Item, key: string) {
  const record = item as Parser.Item & Record<string, unknown>;
  const value = record[key];
  return typeof value === 'string' ? value : '';
}
