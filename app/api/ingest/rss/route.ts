import { assertIngestAuth } from '@/lib/ingest/auth';
import { analyzeNews } from '@/lib/ingest/ai';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { RSS_SOURCES } from '@/lib/ingest/sources';
import { stripHtml, truncate } from '@/lib/ingest/text';
import { createAdminClient } from '@/lib/supabase/admin';
import Parser from 'rss-parser';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const parser = new Parser({
  timeout: 12000,
  headers: {
    'user-agent': 'SeedupBot/1.0',
  },
});

export async function POST(request: Request) {
  return ingest(request);
}

export async function GET(request: Request) {
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
  const limitPerSource = Number(url.searchParams.get('limit') ?? 5);
  const minScore = Number(url.searchParams.get('minScore') ?? 45);
  const results: Array<{ source: string; inserted: number; skipped: number; errors: number }> = [];

  for (const source of RSS_SOURCES) {
    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    try {
      const feed = await parser.parseURL(source.url);
      const items = feed.items.slice(0, limitPerSource);

      for (const item of items) {
        const originalUrl = item.link || item.guid;
        if (!originalUrl || !item.title) {
          skipped += 1;
          continue;
        }

        const rawContent = stripHtml(
          getItemField(item, 'content:encoded') ||
          item.content ||
          item.contentSnippet ||
          item.summary ||
          '',
        );
        const content = rawContent || item.title;
        const { analysis, model } = await analyzeNews({ title: item.title, content, source: source.name });

        if (analysis.relevance_score < minScore) {
          skipped += 1;
          continue;
        }

        const { error } = await supabase.from('news_items').upsert(
          {
            title: item.title,
            raw_title: item.title,
            summary: truncate(analysis.ai_summary, 500),
            content,
            raw_content: content,
            category: analysis.category,
            source: source.name,
            source_url: source.url,
            original_url: originalUrl,
            image_url: extractImageUrl(item),
            project_idea: analysis.project_idea,
            ai_summary: analysis.ai_summary,
            beginner_summary: analysis.beginner_summary,
            why_it_matters: analysis.why_it_matters,
            key_points: analysis.key_points,
            related_skills: analysis.related_skills,
            difficulty: analysis.difficulty,
            relevance_score: analysis.relevance_score,
            ai_model: model,
            processed_at: new Date().toISOString(),
            source_language: source.language,
            published_at: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
          },
          { onConflict: 'original_url' },
        );

        if (error) {
          errors += 1;
          console.error('RSS upsert failed', source.name, item.title, error);
        } else {
          inserted += 1;
        }
      }
    } catch (error) {
      errors += 1;
      console.error('RSS source failed', source.name, error);
    }

    results.push({ source: source.name, inserted, skipped, errors });
  }

  const totals = results.reduce(
    (sum, item) => ({
      inserted: sum.inserted + item.inserted,
      skipped: sum.skipped + item.skipped,
      errors: sum.errors + item.errors,
    }),
    { inserted: 0, skipped: 0, errors: 0 },
  );

  await recordIngestRun(supabase, {
    source: 'rss',
    status: getRunStatus(totals.errors, totals.inserted),
    inserted: totals.inserted,
    skipped: totals.skipped,
    errors: totals.errors,
    durationMs: Date.now() - startedAt,
    detail: { limitPerSource, minScore, results },
  });

  return NextResponse.json({ ok: true, ...totals, results });
}

function extractImageUrl(item: Parser.Item) {
  const enclosureUrl = item.enclosure?.url;
  if (enclosureUrl) return enclosureUrl;

  const content = getItemField(item, 'content:encoded') || item.content || '';
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match?.[1] ?? null;
}

function getItemField(item: Parser.Item, key: string) {
  const record = item as Parser.Item & Record<string, unknown>;
  const value = record[key];
  return typeof value === 'string' ? value : '';
}
