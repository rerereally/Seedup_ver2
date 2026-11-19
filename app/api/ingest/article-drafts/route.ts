import { mapLimit } from '@/lib/utils';
import { assertIngestAuth } from '@/lib/ingest/auth';
import { generateArticleDraft, validateGeneratedArticleDraft } from '@/lib/ingest/ai';
import {
  type ArticleCluster,
  type ArticleTrack,
  buildArticleClusters,
  buildSources,
  countSourceTypes,
  countTracks,
  DAILY_TOTAL_LIMIT,
  DAILY_TRACKS,
  getTodayTrackCounts,
  hasQualityNote,
  inferClusterDifficulty,
  inferRelatedRoles,
  isDuplicateCluster,
  meetsPublicationThreshold,
  normalizeDailyNewsletterSection,
  selectDailyClusters,
  sourceKey,
  uniqueStrings,
} from '@/lib/ingest/article-clusters';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const RECENT_DUPLICATE_WINDOW_DAYS = 14;
const DEEP_DIVE_WINDOW_DAYS = 7;

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
  const mode = url.searchParams.get('mode') === 'deep-dive' ? 'deep-dive' : 'daily';
  const limit = Number(url.searchParams.get('limit') ?? (mode === 'daily' ? DAILY_TOTAL_LIMIT : 1));
  const minSources = Number(url.searchParams.get('minSources') ?? (mode === 'daily' ? 3 : 5));
  const minSourceTypes = Number(url.searchParams.get('minSourceTypes') ?? (mode === 'daily' ? 2 : 3));
  const sourceLimit = mode === 'daily' ? 48 : 32;
  const recentSince = new Date(Date.now() - RECENT_DUPLICATE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const deepDiveSince = new Date(Date.now() - DEEP_DIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();
  const [newsResult, productsResult, reposResult, papersResult, trendsResult] = await Promise.all([
    supabase
      .from('news_items')
      .select('id,title,short_summary,beginner_summary,summary,newsletter_section,newsletter_priority,daily_rank_score,topic_tags,skill_tags,related_skills,project_idea,category,source,source_url,original_url,published_at')
      .neq('source', 'Seedup')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('newsletter_priority', { ascending: false, nullsFirst: false })
      .limit(sourceLimit),
    supabase
      .from('ai_products')
      .select('id,name,short_summary,description,newsletter_priority,topic_tags,skill_tags,use_cases,related_project_ideas,category,website_url,product_hunt_url,created_at')
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('newsletter_priority', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(sourceLimit),
    supabase
      .from('github_trends')
      .select('id,repo_full_name,repo_url,short_summary,beginner_summary,description,newsletter_priority,topic_tags,skill_tags,topics,language,project_idea,stars,stars_delta_7d,pushed_at,last_seen_at')
      .order('pushed_at', { ascending: false, nullsFirst: false })
      .order('newsletter_priority', { ascending: false, nullsFirst: false })
      .order('stars', { ascending: false })
      .limit(sourceLimit),
    supabase
      .from('research_papers')
      .select('id,title,beginner_summary,expert_summary,abstract,categories,related_skills,implementation_idea,service_idea,relevance_score,trend_score,buildability_score,paper_url,code_url')
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('trend_score', { ascending: false, nullsFirst: false })
      .limit(sourceLimit),
    supabase
      .from('trends')
      .select('id,keyword,summary,category,trend_type,display_score,score,weekly_growth_rate,why_trending,related_skills,related_tools,project_ideas,source_refs')
      .order('display_score', { ascending: false, nullsFirst: false })
      .order('rank', { ascending: true })
      .limit(mode === 'daily' ? 20 : 12),
  ]);
  const [{ data: recentGenerated }, { data: todayGenerated }] = await Promise.all([
    supabase
      .from('news_items')
      .select('id,title,original_url,topic_tags,quality_notes,published_at')
      .eq('source', 'Seedup')
      .gte('published_at', mode === 'deep-dive' ? deepDiveSince : recentSince)
      .order('published_at', { ascending: false })
      .limit(120),
    supabase
      .from('news_items')
      .select('id,title,quality_notes,published_at')
      .eq('source', 'Seedup')
      .gte('published_at', todayIso)
      .limit(40),
  ]);

  if (mode === 'deep-dive' && (recentGenerated ?? []).some((item) => hasQualityNote(item.quality_notes, 'content_mode:weekly_deep_dive'))) {
    await recordIngestRun(supabase, {
      source: 'deep-dive',
      status: 'success',
      inserted: 0,
      skipped: 1,
      errors: 0,
      durationMs: Date.now() - startedAt,
      detail: { mode, reason: 'weekly_deep_dive_already_exists' },
    });
    return NextResponse.json({ ok: true, upserted: 0, skipped: 1, errors: 0, reason: 'weekly_deep_dive_already_exists' });
  }

  const sources = buildSources({
    news: newsResult.data ?? [],
    products: productsResult.data ?? [],
    repos: reposResult.data ?? [],
    papers: papersResult.data ?? [],
    trends: trendsResult.data ?? [],
  });
  const recentItems = recentGenerated ?? [];
  const todayTrackCounts = getTodayTrackCounts(todayGenerated ?? []);
  const clusters = buildArticleClusters(sources, { minSources, minSourceTypes })
    .filter((cluster) => meetsPublicationThreshold(cluster, mode))
    .filter((cluster) => !isDuplicateCluster(cluster, recentItems));
  const selectedClusters = mode === 'daily'
    ? selectDailyClusters(clusters, Math.min(Math.max(1, limit), DAILY_TOTAL_LIMIT))
    : clusters.slice(0, 1);

  let upserted = 0;
  let errors = 0;
  let skipped = 0;
  const skipReasons: string[] = [];
  const upsertedTrackCounts = Object.fromEntries(DAILY_TRACKS.map((track) => [track, 0])) as Record<ArticleTrack, number>;

  await mapLimit(selectedClusters, mode === 'daily' ? 3 : 1, async (cluster) => {
    if (isDuplicateCluster(cluster, recentItems)) {
      skipped += 1;
      skipReasons.push(`${cluster.track}:duplicate_cluster`);
      return;
    }
    try {
      const { draft, model } = await generateArticleDraft({
        title: cluster.title,
        sourceType: mode === 'deep-dive' ? 'trend_bundle' : 'cluster',
        summary: cluster.summary,
        trend: cluster.trend,
        skills: cluster.skills,
        track: cluster.track,
        difficultyTarget: inferClusterDifficulty(cluster),
        sourceBundle: cluster.sources
          .filter((source) => source.sourceType !== 'trend_bundle')
          .map((source) => ({ title: source.title, source_type: source.sourceType, source_role: source.sourceRole, url: source.sourceUrl, summary: source.summary })),
      });
      if (!draft.content_markdown.trim()) {
        errors += 1;
        skipReasons.push(`${cluster.track}:generation_empty`);
        console.warn('Article draft generation returned empty content', cluster.id, cluster.title);
        return;
      }
      const quality = validateGeneratedArticleDraft(draft, {
        mode,
        track: cluster.track,
        allowedSourceUrls: cluster.sources.map((source) => source.sourceUrl).filter((url): url is string => Boolean(url)),
      });
      if (!quality.ok) {
        skipped += 1;
        skipReasons.push(`${cluster.track}:${quality.reason}`);
        console.warn('Generated article skipped after quality check', cluster.id, cluster.title, quality.reason);
        return;
      }

      const now = new Date().toISOString();
      const originalUrl = `seedup://article-drafts/cluster/${cluster.id}`;
      const articleResult = await upsertGeneratedArticle(supabase, {
        title: draft.title,
        raw_title: cluster.title,
        summary: draft.summary,
        short_summary: draft.summary,
        content: draft.content_markdown,
        content_type: mode === 'deep-dive' ? 'deep_dive' : 'article',
        newsletter_section: mode === 'deep-dive' ? 'deep_dive' : normalizeDailyNewsletterSection(draft.newsletter_section),
        newsletter_priority: draft.newsletter_priority,
        category: draft.category,
        source: 'Seedup',
        source_url: null,
        original_url: originalUrl,
        raw_content: cluster.summary,
        project_idea: draft.project_idea,
        ai_summary: draft.summary,
        beginner_summary: draft.summary,
        why_it_matters: draft.why_it_matters,
        key_points: draft.key_points,
        related_skills: draft.related_skills,
        difficulty: draft.difficulty,
        relevance_score: draft.newsletter_priority,
        ai_model: model,
        processed_at: now,
        source_language: 'ko',
        target_levels: draft.target_levels,
        target_goals: draft.target_goals,
        target_interests: draft.target_interests,
        content_depth: mode === 'deep-dive' ? '주간 Deep Dive' : '데일리 트랙 아티클',
        topic_tags: uniqueStrings([cluster.trend, ...draft.tags]).slice(0, 6),
        skill_tags: draft.related_skills.slice(0, 6),
        intent_tags: ['발행 글', '프로젝트 연결 가능'],
        audience_tags: draft.target_levels,
        related_roles: inferRelatedRoles(cluster),
        learning_topics: draft.related_skills,
        project_convertible: Boolean(draft.project_idea),
        personalization_hooks: draft.key_points,
        source_quality_score: 76,
        novelty_score: 70,
        buildability_score: 78,
        project_connect_score: 82,
        daily_rank_score: draft.newsletter_priority,
        recommendation_reasons: [draft.editorial_angle, '전처리된 여러 신호를 묶은 전문가 해설'],
        quality_notes: [
          mode === 'deep-dive' ? 'content_mode:weekly_deep_dive' : 'content_mode:daily_track_article',
          'content_mode:longform_editorial',
          `track:${cluster.track}`,
          `cluster_key:${cluster.id}`,
          `source_count:${cluster.sources.length}`,
          `source_types:${cluster.sourceTypes.join(',')}`,
          `evidence_confidence:${draft.evidence?.confidence ?? 'low'}`,
          `direct_metric_count:${draft.evidence?.direct_metric_count ?? 0}`,
          ...(draft.evidence?.limitations ?? []).slice(0, 3).map((limitation) => `evidence_limitation:${limitation}`),
          ...(draft.link_warnings ?? []).slice(0, 3).map((warning) => `link_warning:${warning}`),
          ...cluster.sources.slice(0, 10).map((source) => `source_key:${sourceKey(source)}`),
          ...draft.referenced_tools.slice(0, 4).map((tool) => `tool:${tool}`),
          ...draft.source_links.slice(0, 4).map((link) => `source:${link}`),
        ],
        article_evidence: draft.evidence ?? null,
        article_claims: draft.core_claims ?? [],
        technical_limitations: draft.technical_limitations ?? [],
        article_assumptions: draft.assumptions ?? [],
        mvp_scope: draft.mvp_scope ?? [],
        excluded_scope: draft.excluded_scope ?? [],
        measurable_acceptance_criteria: draft.measurable_acceptance_criteria ?? [],
        link_warnings: draft.link_warnings ?? [],
        ranked_at: now,
        published_at: now,
      });

      if (articleResult.error) {
        errors += 1;
        console.error('Generated article upsert failed', cluster.id, cluster.title, articleResult.error);
      } else {
        const articleId = articleResult.data?.id ?? null;
        if (articleId) await recordArticleEvidence(supabase, articleId, cluster, mode, draft.content_markdown);
        upserted += 1;
        upsertedTrackCounts[cluster.track] += 1;
        if (mode === 'daily') todayTrackCounts[cluster.track] = (todayTrackCounts[cluster.track] ?? 0) + 1;
        recentItems.push({
          id: originalUrl,
          title: draft.title,
          original_url: originalUrl,
          topic_tags: uniqueStrings([cluster.trend, ...draft.tags]),
          quality_notes: [
            `cluster_key:${cluster.id}`,
            ...cluster.sources.map((source) => `source_key:${sourceKey(source)}`),
          ],
          published_at: now,
        });
      }
    } catch (error) {
      errors += 1;
      console.error('Article draft generation failed', cluster.id, cluster.title, error);
    }
  });

  if (!selectedClusters.length) skipped += 1;

  await recordIngestRun(supabase, {
    source: mode === 'deep-dive' ? 'deep-dive' : 'article-drafts',
    status: getRunStatus(errors, upserted, skipped),
    inserted: upserted,
    skipped,
    errors,
    durationMs: Date.now() - startedAt,
    detail: {
      mode,
      limit,
      minSources,
      minSourceTypes,
      sources: sources.length,
      clusters: clusters.length,
      selected: selectedClusters.length,
      reason: upserted > 0
        ? undefined
        : errors > 0
          ? 'generation_or_upsert_failed'
          : skipped > 0
            ? 'all_selected_skipped'
            : clusters.length
              ? 'no_daily_candidates_after_filters'
              : 'no_eligible_clusters',
      skip_reasons: skipReasons.slice(0, 20),
      errors,
      today_track_counts: todayTrackCounts,
      source_types: countSourceTypes(sources),
      candidate_tracks: countTracks(clusters),
      selected_tracks: countTracks(selectedClusters),
      upserted_tracks: upsertedTrackCounts,
      target: 'news_items',
    },
  });

  return NextResponse.json({ ok: true, mode, upserted, skipped, errors, sources: sources.length, clusters: clusters.length, selected: selectedClusters.length, target: mode === 'daily' ? DAILY_TOTAL_LIMIT : 1 });
}

async function upsertGeneratedArticle(supabase: NonNullable<ReturnType<typeof createAdminClient>>, payload: Record<string, unknown>) {
  const result = await supabase.from('news_items').upsert(payload, { onConflict: 'original_url' }).select('id').single();
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
    'quality_notes',
    'article_evidence',
    'article_claims',
    'technical_limitations',
    'article_assumptions',
    'mvp_scope',
    'excluded_scope',
    'measurable_acceptance_criteria',
    'link_warnings',
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
    'quality_notes',
    'article_evidence',
    'article_claims',
    'technical_limitations',
    'article_assumptions',
    'mvp_scope',
    'excluded_scope',
    'measurable_acceptance_criteria',
    'link_warnings',
  ]) {
    delete fallbackPayload[key];
  }

  console.warn('Article draft upsert retrying without recommendation columns. Apply supabase/migrations to enable full ranking metadata.');
  return supabase.from('news_items').upsert(fallbackPayload, { onConflict: 'original_url' }).select('id').single();
}

async function recordArticleEvidence(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  articleId: string,
  cluster: ArticleCluster,
  mode: 'daily' | 'deep-dive',
  content: string,
) {
  const actualSources = cluster.sources.filter((source) => source.sourceType !== 'trend_bundle');
  const sectionCount = (content.match(/^##\s+/gm) ?? []).length;
  await supabase.from('article_source_links').upsert(
    actualSources.map((source) => ({
      article_id: articleId,
      source_type: source.sourceType,
      source_id: source.sourceId,
      source_role: source.sourceRole,
    })),
    { onConflict: 'article_id,source_document_id,source_type,source_id' },
  );
  await supabase.from('article_quality_evaluations').insert({
    article_id: articleId,
    content_mode: mode,
    passed: true,
    actual_source_count: actualSources.length,
    source_type_count: new Set(actualSources.map((source) => source.sourceType)).size,
    primary_source_count: actualSources.filter((source) => source.sourceRole === 'primary').length,
    independent_domain_count: new Set(actualSources.map((source) => source.sourceDomain).filter(Boolean)).size,
    section_count: sectionCount,
    character_count: content.length,
  });
}
