import { assertIngestAuth } from '@/lib/ingest/auth';
import { analyzeNews } from '@/lib/ingest/ai';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { evaluateArticleKeywordPolicy } from '@/lib/ingest/keyword-policy';
import { MAX_ITEMS_PER_SOURCE, RSS_SOURCES } from '@/lib/ingest/sources';
import { buildArticleContext, stripHtml, truncate } from '@/lib/ingest/text';
import { shouldGenerateArticleDraft, shouldGenerateBuildIdea } from '@/lib/recommendations';
import { createAdminClient } from '@/lib/supabase/admin';
import Parser from 'rss-parser';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

const parser = new Parser({
  timeout: 12000,
  headers: {
    'user-agent': 'SeedupBot/1.0',
  },
});

const SOURCE_CONCURRENCY = 4;
const ITEM_CONCURRENCY = 2;
const RECENT_WINDOW_DAYS = Number(process.env.RSS_RECENT_WINDOW_DAYS ?? 7);

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
  const limitPerSource = Number(url.searchParams.get('limit') ?? MAX_ITEMS_PER_SOURCE);
  const minScore = Number(url.searchParams.get('minScore') ?? 45);
  const results = await mapWithConcurrency(RSS_SOURCES, SOURCE_CONCURRENCY, async (source) => {
    let inserted = 0;
    let skipped = 0;
    let errors = 0;
    let fetched = 0;
    let recent = 0;

    try {
      const feed = await parser.parseURL(source.url);
      fetched = feed.items.length;
      const recentItems = feed.items.filter((item) => isRecentEnough(item.isoDate ?? item.pubDate));
      recent = recentItems.length;
      const items = recentItems.slice(0, limitPerSource);

      const outcomes = await mapWithConcurrency(items, ITEM_CONCURRENCY, (item) => ingestItem({ item, minScore, source, supabase }));
      for (const outcome of outcomes) {
        if (outcome === 'inserted') inserted += 1;
        if (outcome === 'skipped') skipped += 1;
        if (outcome === 'error') errors += 1;
      }
    } catch (error) {
      errors += 1;
      console.error('RSS source failed', source.name, error);
    }

    return { source: source.name, fetched, recent, inserted, skipped, errors };
  });

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

async function ingestItem({
  item,
  minScore,
  source,
  supabase,
}: {
  item: Parser.Item;
  minScore: number;
  source: (typeof RSS_SOURCES)[number];
  supabase: NonNullable<ReturnType<typeof createAdminClient>>;
}): Promise<'inserted' | 'skipped' | 'error'> {
  const originalUrl = item.link || item.guid;
  if (!originalUrl || !item.title) return 'skipped';

  try {
    const rawContent = stripHtml(
      getItemField(item, 'content:encoded') ||
      item.content ||
      item.contentSnippet ||
      item.summary ||
      '',
    );
    const content = rawContent || item.title;
    const publishedAt = item.isoDate ?? item.pubDate ?? new Date().toISOString();
    const sourceDocument = await saveRawSourceDocument(supabase, {
      canonicalUrl: originalUrl,
      sourceName: source.name,
      sourceType: 'rss',
      sourceRole: source.tier === 'primary' ? 'primary' : source.tier === 'specialist' ? 'independent' : 'supporting',
      sourceDomain: getSourceDomain(originalUrl),
      language: source.language,
      title: item.title,
      publishedAt,
      rawPayload: {
        guid: item.guid ?? null,
        link: item.link ?? null,
        pubDate: item.pubDate ?? null,
        isoDate: item.isoDate ?? null,
        contentSnippet: item.contentSnippet ?? null,
      },
    });
    const keywordPolicy = evaluateArticleKeywordPolicy({ title: item.title, content, source: source.name });
    if (!keywordPolicy.shouldAnalyze) {
      await recordRejection(supabase, {
        source: source.name,
        sourceUrl: source.url,
        originalUrl,
        title: item.title,
        reason: keywordPolicy.hardExcluded.length ? 'hard_excluded_keyword' : 'keyword_score_too_low',
        keywordScore: keywordPolicy.score,
        matchedKeywords: keywordPolicy.matched,
        softExcluded: keywordPolicy.softExcluded,
        hardExcluded: keywordPolicy.hardExcluded,
      });
      return 'skipped';
    }

    const sourceJson = {
      title: item.title,
      content: buildArticleContext(content, 5200),
      source: source.name,
      sourceUrl: source.url,
      originalUrl,
      publishedAt,
    };
    const { analysis, model } = await analyzeNews({
      title: sourceJson.title,
      content: sourceJson.content,
      source: sourceJson.source,
      sourceLanguage: source.language,
    });

    const dailyRankScore = calculateDailyRankScore({
      publishedAt: sourceJson.publishedAt,
      relevanceScore: analysis.relevance_score,
      sourceQualityScore: analysis.source_quality_score,
      noveltyScore: analysis.novelty_score,
      buildabilityScore: analysis.buildability_score,
      projectConnectScore: analysis.project_connect_score,
      keywordScore: keywordPolicy.score,
      sourceDefaultQuality: source.quality ?? 60,
    });

    if (analysis.relevance_score < minScore && dailyRankScore < minScore) {
      await recordRejection(supabase, {
        source: source.name,
        sourceUrl: source.url,
        originalUrl,
        title: item.title,
        reason: 'rank_score_too_low',
        keywordScore: keywordPolicy.score,
        matchedKeywords: keywordPolicy.matched,
        softExcluded: keywordPolicy.softExcluded,
        hardExcluded: keywordPolicy.hardExcluded,
        aiScore: analysis.relevance_score,
        dailyRankScore,
      });
      return 'skipped';
    }

    const koreanTitle = truncate(analysis.translated_title || item.title, 180);
    const shouldDraftArticle = shouldGenerateArticleDraft(analysis);
    const shouldDraftBuildIdea = shouldGenerateBuildIdea(analysis);
    const articleContent = shouldDraftArticle && analysis.article_markdown
      ? analysis.article_markdown
      : null;
    const contentQuality = evaluateMetadataQuality(analysis);
    if (!contentQuality.pass) {
      await recordRejection(supabase, {
        source: source.name,
        sourceUrl: source.url,
        originalUrl,
        title: item.title,
        reason: contentQuality.reason,
        keywordScore: keywordPolicy.score,
        matchedKeywords: keywordPolicy.matched,
        softExcluded: keywordPolicy.softExcluded,
        hardExcluded: keywordPolicy.hardExcluded,
        aiScore: analysis.relevance_score,
        dailyRankScore,
      });
      return 'skipped';
    }
    const canonicalKey = buildCanonicalKey(koreanTitle, sourceJson.publishedAt);

    const payload = {
        title: koreanTitle,
        raw_title: item.title,
        summary: truncate(analysis.ai_summary, 500),
        content: articleContent,
        raw_content: rawContent || item.title,
        category: analysis.category,
        content_type: analysis.content_type,
        newsletter_section: analysis.newsletter_section,
        newsletter_priority: analysis.newsletter_priority,
        short_summary: analysis.short_summary,
        source: source.name,
        source_url: source.url,
        original_url: originalUrl,
        canonical_key: canonicalKey,
        duplicate_group_key: canonicalKey,
        image_url: extractImageUrl(item),
        project_idea: shouldDraftBuildIdea ? analysis.project_idea : null,
        ai_summary: analysis.ai_summary,
        beginner_summary: analysis.beginner_summary,
        why_it_matters: analysis.why_it_matters,
        key_points: analysis.key_points,
        related_skills: analysis.related_skills,
        difficulty: analysis.difficulty,
        target_levels: analysis.target_levels,
        target_goals: analysis.target_goals,
        target_interests: analysis.target_interests,
        content_depth: analysis.content_depth,
        relevance_score: analysis.relevance_score,
        topic_tags: analysis.topic_tags,
        skill_tags: analysis.skill_tags,
        intent_tags: analysis.intent_tags,
        audience_tags: analysis.audience_tags,
        related_roles: analysis.related_roles,
        learning_topics: analysis.learning_topics,
        project_convertible: analysis.project_convertible,
        personalization_hooks: analysis.personalization_hooks,
        source_quality_score: Math.max(analysis.source_quality_score, source.quality ?? 0),
        novelty_score: analysis.novelty_score,
        buildability_score: analysis.buildability_score,
        project_connect_score: analysis.project_connect_score,
        daily_rank_score: dailyRankScore,
        recommendation_reasons: analysis.recommendation_reasons,
        quality_notes: [
          ...contentQuality.notes,
          articleContent ? 'content_mode:article_draft' : 'content_mode:metadata_only',
        ],
        ranked_at: new Date().toISOString(),
        ai_model: model,
        processed_at: new Date().toISOString(),
        source_language: source.language,
        published_at: publishedAt,
        source_document_id: sourceDocument?.id ?? null,
      };

    const { error } = await upsertNewsItem(supabase, payload);

    if (error) {
      console.error('RSS upsert failed', source.name, item.title, error);
      return 'error';
    }

    await refreshDuplicateGroup(supabase, canonicalKey);
    return 'inserted';
  } catch (error) {
    console.error('RSS item failed', source.name, item.title, error);
    return 'error';
  }
}

async function saveRawSourceDocument(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  input: {
    canonicalUrl: string;
    sourceName: string;
    sourceType: string;
    sourceRole: 'primary' | 'independent' | 'supporting' | 'context';
    sourceDomain: string | null;
    language: string;
    title: string;
    publishedAt: string;
    rawPayload: Record<string, unknown>;
  },
) {
  const { data } = await supabase
    .from('source_documents')
    .upsert({
      canonical_url: input.canonicalUrl,
      source_name: input.sourceName,
      source_type: input.sourceType,
      source_role: input.sourceRole,
      source_domain: input.sourceDomain,
      language: input.language,
      title: input.title,
      published_at: input.publishedAt,
      raw_payload: input.rawPayload,
      processing_status: 'processed',
      processed_at: new Date().toISOString(),
    }, { onConflict: 'canonical_url' })
    .select('id')
    .maybeSingle();
  return data;
}

function getSourceDomain(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

async function upsertNewsItem(supabase: NonNullable<ReturnType<typeof createAdminClient>>, payload: Record<string, unknown>) {
  const result = await supabase.from('news_items').upsert(payload, { onConflict: 'original_url' });
  if (!result.error) return result;

  const message = result.error.message.toLowerCase();
  const recommendationColumnError = [
    'topic_tags',
    'skill_tags',
    'intent_tags',
    'audience_tags',
    'content_type',
    'newsletter_section',
    'newsletter_priority',
    'short_summary',
    'source_quality_score',
    'novelty_score',
    'buildability_score',
    'project_connect_score',
    'daily_rank_score',
    'recommendation_reasons',
    'related_roles',
    'learning_topics',
    'project_convertible',
    'personalization_hooks',
    'ranked_at',
    'canonical_key',
    'duplicate_group_key',
    'quality_notes',
    'source_document_id',
  ].some((column) => message.includes(column));

  if (!recommendationColumnError) return result;

  const fallbackPayload = { ...payload };
  for (const key of [
    'topic_tags',
    'skill_tags',
    'intent_tags',
    'audience_tags',
    'content_type',
    'newsletter_section',
    'newsletter_priority',
    'short_summary',
    'source_quality_score',
    'novelty_score',
    'buildability_score',
    'project_connect_score',
    'daily_rank_score',
    'recommendation_reasons',
    'related_roles',
    'learning_topics',
    'project_convertible',
    'personalization_hooks',
    'ranked_at',
    'canonical_key',
    'duplicate_group_key',
    'quality_notes',
    'source_document_id',
  ]) {
    delete fallbackPayload[key];
  }

  console.warn('RSS upsert retrying without recommendation columns. Apply supabase/schema.sql to enable full ranking metadata.');
  return supabase.from('news_items').upsert(fallbackPayload, { onConflict: 'original_url' });
}

function isRecentEnough(value: string | undefined) {
  if (!value) return true;
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return true;
  return Date.now() - time <= RECENT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function calculateDailyRankScore({
  publishedAt,
  relevanceScore,
  sourceQualityScore,
  noveltyScore,
  buildabilityScore,
  projectConnectScore,
  keywordScore,
  sourceDefaultQuality,
}: {
  publishedAt: string;
  relevanceScore: number;
  sourceQualityScore: number;
  noveltyScore: number;
  buildabilityScore: number;
  projectConnectScore: number;
  keywordScore: number;
  sourceDefaultQuality: number;
}) {
  const publishedTime = new Date(publishedAt).getTime();
  const ageHours = Number.isFinite(publishedTime) ? Math.max(0, (Date.now() - publishedTime) / 36e5) : 168;
  const freshness = ageHours <= 24 ? 35 : ageHours <= 48 ? 28 : ageHours <= 168 ? 16 : 4;
  return Math.round(
    freshness +
    Math.min(relevanceScore * 0.22, 22) +
    Math.min(sourceQualityScore * 0.1, 10) +
    Math.min(sourceDefaultQuality * 0.05, 5) +
    Math.min(noveltyScore * 0.1, 10) +
    Math.min(buildabilityScore * 0.12, 12) +
    Math.min(projectConnectScore * 0.11, 11) +
    Math.min(Math.max(keywordScore, 0) * 0.18, 14),
  );
}

function evaluateMetadataQuality(analysis: {
  short_summary: string;
  key_points: string[];
  topic_tags: string[];
  skill_tags: string[];
  newsletter_section: string;
  newsletter_priority: number;
}) {
  const summaryLength = stripHtml(analysis.short_summary).replace(/\s+/g, ' ').trim().length;
  const tagCount = analysis.topic_tags.length + analysis.skill_tags.length;
  const hasEnoughKeyPoints = analysis.key_points.length >= 2;
  const hasNewsletterRouting = Boolean(analysis.newsletter_section) && Number(analysis.newsletter_priority ?? 0) > 0;
  const pass = summaryLength >= 40 && hasEnoughKeyPoints && tagCount >= 1 && hasNewsletterRouting;
  const notes = [
    `summary_length:${summaryLength}`,
    `tags:${tagCount}`,
    `key_points:${analysis.key_points.length}`,
    `newsletter_section:${analysis.newsletter_section}`,
  ];

  return {
    pass,
    reason: summaryLength < 40 ? 'metadata_summary_too_short' : !hasEnoughKeyPoints ? 'metadata_key_points_too_few' : 'metadata_routing_missing',
    notes,
  };
}

function buildCanonicalKey(title: string, publishedAt: string) {
  const publishedTime = new Date(publishedAt).getTime();
  const day = Number.isFinite(publishedTime) ? new Date(publishedTime).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  const normalizedTitle = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 1 && !['the', 'and', 'with', '에서', '으로', '하는', '대한'].includes(token))
    .slice(0, 10)
    .join('-');

  return `${day}:${normalizedTitle || 'untitled'}`;
}

async function refreshDuplicateGroup(supabase: NonNullable<ReturnType<typeof createAdminClient>>, canonicalKey: string) {
  const { data, error } = await supabase
    .from('news_items')
    .select('id')
    .eq('canonical_key', canonicalKey);

  if (error || !data?.length) return;

  await supabase
    .from('news_items')
    .update({
      duplicate_group_key: canonicalKey,
      duplicate_count: data.length,
    })
    .eq('canonical_key', canonicalKey);
}

async function recordRejection(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  payload: {
    source: string;
    sourceUrl: string;
    originalUrl: string;
    title: string;
    reason: string;
    keywordScore: number;
    matchedKeywords: string[];
    softExcluded: string[];
    hardExcluded: string[];
    aiScore?: number;
    dailyRankScore?: number;
  },
) {
  const { error } = await supabase.from('ingest_rejections').insert({
    source: payload.source,
    source_url: payload.sourceUrl,
    original_url: payload.originalUrl,
    title: truncate(payload.title, 240),
    reason: payload.reason,
    keyword_score: payload.keywordScore,
    matched_keywords: payload.matchedKeywords,
    soft_excluded: payload.softExcluded,
    hard_excluded: payload.hardExcluded,
    ai_score: payload.aiScore ?? null,
    daily_rank_score: payload.dailyRankScore ?? null,
  });

  if (error && !['42P01', '42703', '42501'].includes(error.code ?? '')) {
    console.warn('Failed to record ingest rejection', error.message);
  }
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T) => Promise<R>) {
  const results: R[] = [];
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function extractImageUrl(item: Parser.Item) {
  const enclosureUrl = item.enclosure?.url;
  if (isImageUrl(enclosureUrl)) return enclosureUrl;

  const content = getItemField(item, 'content:encoded') || item.content || '';
  const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
  return isImageUrl(match?.[1]) ? match?.[1] ?? null : null;
}

function getItemField(item: Parser.Item, key: string) {
  const record = item as Parser.Item & Record<string, unknown>;
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function isImageUrl(url?: string | null) {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return /\.(jpg|jpeg|png|webp|gif|avif)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}
