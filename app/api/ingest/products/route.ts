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
        const metadata = buildProductNewsletterMetadata(analysis, source.quality ?? 78);
        const { data: existing } = await supabase
          .from('ai_products')
          .select('score,rating_count,user_score_sum')
          .eq('product_hunt_url', productUrl)
          .maybeSingle();

        const payload = {
            name,
            category: analysis.category,
            description: analysis.description,
            ...metadata,
            score: existing?.score ?? null,
            rating_count: existing?.rating_count ?? 0,
            user_score_sum: existing?.user_score_sum ?? 0,
            status: analysis.status,
            website_url: productUrl,
            source: source.name,
            product_hunt_url: productUrl,
            launch_date: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
            use_cases: analysis.use_cases,
            pricing_type: analysis.pricing_type,
            target_user: analysis.target_user,
            related_project_ideas: analysis.related_project_ideas,
          };

        const { error } = await upsertProduct(supabase, payload);

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

async function upsertProduct(supabase: NonNullable<ReturnType<typeof createAdminClient>>, payload: Record<string, unknown>) {
  const result = await supabase.from('ai_products').upsert(payload, { onConflict: 'product_hunt_url' });
  if (!result.error) return result;

  const message = result.error.message.toLowerCase();
  const metadataColumnError = [
    'content_type',
    'newsletter_section',
    'newsletter_priority',
    'short_summary',
    'topic_tags',
    'skill_tags',
    'intent_tags',
    'audience_tags',
    'related_roles',
    'learning_topics',
    'project_convertible',
    'personalization_hooks',
    'source_quality_score',
    'novelty_score',
    'buildability_score',
    'project_connect_score',
    'recommendation_reasons',
  ].some((column) => message.includes(column));

  if (!metadataColumnError) return result;

  const fallbackPayload = { ...payload };
  for (const key of [
    'content_type',
    'newsletter_section',
    'newsletter_priority',
    'short_summary',
    'topic_tags',
    'skill_tags',
    'intent_tags',
    'audience_tags',
    'related_roles',
    'learning_topics',
    'project_convertible',
    'personalization_hooks',
    'source_quality_score',
    'novelty_score',
    'buildability_score',
    'project_connect_score',
    'recommendation_reasons',
  ]) {
    delete fallbackPayload[key];
  }

  console.warn('Product upsert retrying without newsletter metadata columns. Apply supabase/schema.sql to enable full metadata.');
  return supabase.from('ai_products').upsert(fallbackPayload, { onConflict: 'product_hunt_url' });
}

function buildProductNewsletterMetadata(analysis: Awaited<ReturnType<typeof analyzeProduct>>['analysis'], sourceQuality: number) {
  const projectConvertible = Boolean(analysis.related_project_ideas?.length);
  const priority = Math.max(45, Math.min(95, Math.round(Number(analysis.score ?? 7) * 10)));

  return {
    content_type: 'ai_product',
    newsletter_section: 'ai_product_radar',
    newsletter_priority: priority,
    short_summary: analysis.description,
    topic_tags: [analysis.category, 'AI 제품'].filter(Boolean),
    skill_tags: analysis.use_cases ?? [],
    intent_tags: projectConvertible ? ['프로젝트 연결 가능', '창업 아이디어 검증'] : ['제품 탐색'],
    audience_tags: [analysis.target_user ?? '개발자'],
    related_roles: inferRoles([analysis.category, analysis.target_user, ...(analysis.use_cases ?? [])]),
    learning_topics: analysis.use_cases ?? [],
    project_convertible: projectConvertible,
    personalization_hooks: analysis.related_project_ideas ?? [],
    source_quality_score: sourceQuality,
    novelty_score: priority,
    buildability_score: projectConvertible ? 72 : 48,
    project_connect_score: projectConvertible ? 72 : 48,
    recommendation_reasons: projectConvertible ? ['AI 제품을 프로젝트 아이디어로 확장 가능'] : ['새 AI 제품 탐색에 적합'],
  };
}

function inferRoles(values: Array<string | null | undefined>) {
  const text = values.filter(Boolean).join(' ').toLowerCase();
  const roles = new Set<string>();
  if (/front|react|next|ui|ux|프론트|디자인/.test(text)) roles.add('frontend_developer');
  if (/back|api|db|server|node|postgres|supabase|백엔드/.test(text)) roles.add('backend_developer');
  if (/ai|llm|agent|model|rag|automation|자동화|인공지능/.test(text)) roles.add('ai_builder');
  if (/startup|product|saas|창업|제품|사이드/.test(text)) roles.add('startup_builder');
  if (!roles.size) roles.add('developer');
  return [...roles];
}

function normalizeProductName(title: string) {
  return title.split(' - ')[0]?.trim() || title.trim();
}

function getItemField(item: Parser.Item, key: string) {
  const record = item as Parser.Item & Record<string, unknown>;
  const value = record[key];
  return typeof value === 'string' ? value : '';
}
