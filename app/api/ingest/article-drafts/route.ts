import { assertIngestAuth } from '@/lib/ingest/auth';
import { generateArticleDraft, validateGeneratedArticleDraft } from '@/lib/ingest/ai';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

type SourceItem = {
  sourceType: 'news' | 'ai_product' | 'github' | 'paper' | 'trend_bundle';
  sourceId: string;
  title: string;
  summary: string;
  trend: string | null;
  skills: string[];
  sourceRole: 'primary' | 'independent' | 'supporting' | 'context';
  sourceDomain: string | null;
  publishedAt: string | null;
};

type ArticleTrack = 'AI/LLM' | '프론트엔드' | '백엔드' | '오픈소스/GitHub' | '제품/빌드 아이디어' | '논문/리서치';

type ArticleCluster = {
  id: string;
  title: string;
  summary: string;
  trend: string | null;
  skills: string[];
  sourceTypes: string[];
  sources: SourceItem[];
  track: ArticleTrack;
  latestPublishedAt: string | null;
};

const DAILY_TRACKS: ArticleTrack[] = ['AI/LLM', '프론트엔드', '백엔드', '오픈소스/GitHub', '제품/빌드 아이디어', '논문/리서치'];
// 한 번의 실행에서 생성할 최대 수. 트랙별 고정 개수 제한은 두지 않는다.
const DAILY_TOTAL_LIMIT = 12;
const MAX_CANDIDATES_PER_TRACK = 6;
const TRACK_DIGEST_MIN_SOURCES = 3;
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

  await mapWithConcurrency(selectedClusters, mode === 'daily' ? 3 : 1, async (cluster) => {
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
      });
      if (!draft.content_markdown.trim()) {
        errors += 1;
        skipReasons.push(`${cluster.track}:generation_empty`);
        console.warn('Article draft generation returned empty content', cluster.id, cluster.title);
        return;
      }
      const quality = validateGeneratedArticleDraft(draft, { mode, track: cluster.track });
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
          ...cluster.sources.slice(0, 10).map((source) => `source_key:${sourceKey(source)}`),
          ...draft.referenced_tools.slice(0, 4).map((tool) => `tool:${tool}`),
          ...draft.source_links.slice(0, 4).map((link) => `source:${link}`),
        ],
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
  ]) {
    delete fallbackPayload[key];
  }

  console.warn('Article draft upsert retrying without recommendation columns. Apply supabase/schema.sql to enable full ranking metadata.');
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

function normalizeDailyNewsletterSection(value: unknown) {
  if (value === 'ai_product_radar' || value === 'github_project_pick' || value === 'build_idea' || value === 'paper_to_project') {
    return value;
  }
  return 'daily_briefing';
}

function buildSources({
  news,
  products,
  repos,
  papers,
  trends,
}: {
  news: Array<Record<string, any>>;
  products: Array<Record<string, any>>;
  repos: Array<Record<string, any>>;
  papers: Array<Record<string, any>>;
  trends: Array<Record<string, any>>;
}): SourceItem[] {
  const trendBundle = trends.length
    ? [{
      sourceType: 'trend_bundle' as const,
      sourceId: trends[0].id as string,
      title: `이번 주 개발 트렌드 묶음: ${trends.map((item) => item.keyword).slice(0, 4).join(', ')}`,
      summary: trends.map((item) => {
        const score = item.display_score ?? item.score ?? '-';
        const growth = typeof item.weekly_growth_rate === 'number' ? `, 7일 변화 ${item.weekly_growth_rate}%` : '';
        const reason = Array.isArray(item.why_trending) && item.why_trending[0] ? ` ${item.why_trending[0]}` : '';
        const refs = Array.isArray(item.source_refs)
          ? item.source_refs.slice(0, 4).map((ref: Record<string, unknown>) => {
            const title = typeof ref.title === 'string' ? ref.title : 'source';
            const link = typeof ref.url === 'string' ? ` ${ref.url}` : '';
            return `- ${title}${link}`;
          }).join('\n')
          : '';
        return `${item.keyword} (${item.category ?? '트렌드'}, ${score}점${growth}): ${item.summary ?? '최근 감지된 개발 신호입니다.'}${reason}${refs ? `\n관련 출처:\n${refs}` : ''}`;
      }).join('\n'),
      trend: trends[0].keyword as string | null,
      skills: uniqueStrings([
        ...trends.map((item) => item.keyword).filter(Boolean),
        ...trends.flatMap((item) => item.related_skills ?? []),
        ...trends.flatMap((item) => item.related_tools ?? []),
      ]),
      publishedAt: new Date().toISOString(),
      sourceRole: 'context' as const,
      sourceDomain: null,
    }]
    : [];

  return [
    ...trendBundle,
    ...news.map((item) => ({
      sourceType: 'news' as const,
      sourceId: item.id as string,
      title: item.project_idea || item.title,
      summary: [
        `제목: ${item.title}`,
        `요약: ${item.short_summary || item.beginner_summary || item.summary || item.title}`,
        item.project_idea ? `프로젝트 연결: ${item.project_idea}` : null,
        item.original_url || item.source_url ? `링크: ${item.original_url || item.source_url}` : null,
        item.source ? `출처: ${item.source}` : null,
      ].filter(Boolean).join('\n'),
      trend: item.category ?? item.topic_tags?.[0] ?? null,
      skills: [...(item.skill_tags ?? []), ...(item.related_skills ?? [])],
      publishedAt: item.published_at ?? null,
      sourceRole: classifySourceRole(item.source, item.original_url || item.source_url),
      sourceDomain: getSourceDomain(item.original_url || item.source_url),
    })),
    ...products.map((item) => ({
      sourceType: 'ai_product' as const,
      sourceId: item.id as string,
      title: item.related_project_ideas?.[0] || `${item.name} 참고 AI 제품 프로젝트`,
      summary: [
        `제품: ${item.name}`,
        `설명: ${item.short_summary || item.description || item.name}`,
        item.related_project_ideas?.length ? `관련 아이디어: ${item.related_project_ideas.join(', ')}` : null,
        item.website_url || item.product_hunt_url ? `링크: ${item.website_url || item.product_hunt_url}` : null,
        item.use_cases?.length ? `사용 사례: ${item.use_cases.join(', ')}` : null,
      ].filter(Boolean).join('\n'),
      trend: item.category ?? item.topic_tags?.[0] ?? null,
      skills: [...(item.skill_tags ?? []), ...(item.use_cases ?? [])],
      publishedAt: item.created_at ?? null,
      sourceRole: 'primary' as const,
      sourceDomain: getSourceDomain(item.website_url || item.product_hunt_url),
    })),
    ...repos.filter(isUsableRepoSource).map((item) => ({
      sourceType: 'github' as const,
      sourceId: item.id as string,
      title: item.project_idea || `${item.repo_full_name} 참고 오픈소스 프로젝트`,
      summary: [
        `저장소: ${item.repo_full_name}`,
        `설명: ${item.short_summary || item.beginner_summary || item.description || item.repo_full_name}`,
        item.project_idea ? `프로젝트 연결: ${item.project_idea}` : null,
        item.repo_url ? `링크: ${item.repo_url}` : null,
        item.stars ? `Stars: ${item.stars}` : null,
        item.stars_delta_7d ? `7일 스타 변화: ${item.stars_delta_7d}` : null,
      ].filter(Boolean).join('\n'),
      trend: pickSpecificTrend([...(item.topic_tags ?? []), ...(item.topics ?? [])]),
      skills: [...(item.skill_tags ?? []), ...(item.topics ?? []), item.language].filter(Boolean),
      publishedAt: item.pushed_at ?? item.last_seen_at ?? null,
      sourceRole: 'primary' as const,
      sourceDomain: getSourceDomain(item.repo_url),
    })),
    ...papers.filter(isUsablePaperSource).map((item) => ({
      sourceType: 'paper' as const,
      sourceId: item.id as string,
      title: item.implementation_idea || item.service_idea || `${item.title} 기반 구현 아이디어`,
      summary: [
        `논문: ${item.title}`,
        `해설: ${item.beginner_summary || item.expert_summary || item.abstract || item.title}`,
        item.implementation_idea ? `구현 아이디어: ${item.implementation_idea}` : null,
        item.service_idea ? `서비스 아이디어: ${item.service_idea}` : null,
        item.paper_url ? `링크: ${item.paper_url}` : null,
        item.code_url ? `코드: ${item.code_url}` : null,
      ].filter(Boolean).join('\n'),
      trend: item.categories?.[0] ?? null,
      skills: [...(item.related_skills ?? []), ...(item.categories ?? [])],
      publishedAt: item.published_at ?? null,
      sourceRole: 'primary' as const,
      sourceDomain: getSourceDomain(item.paper_url),
    })),
  ];
}

function buildArticleClusters(sources: SourceItem[], options: { minSources: number; minSourceTypes: number }): ArticleCluster[] {
  const buckets = new Map<string, SourceItem[]>();

  for (const source of sources.filter((item) => item.sourceType !== 'trend_bundle')) {
    for (const key of getClusterKeys(source)) {
      const bucket = buckets.get(key) ?? [];
      if (!bucket.some((item) => item.sourceType === source.sourceType && item.sourceId === source.sourceId)) {
        bucket.push(source);
      }
      buckets.set(key, bucket);
    }
  }

  const trendBundle = sources.find((item) => item.sourceType === 'trend_bundle');
  const clusters = [...buckets.entries()]
    .map(([key, items]) => buildClusterFromBucket(key, items, trendBundle))
    .filter((cluster) => cluster.sources.length >= options.minSources && cluster.sourceTypes.length >= options.minSourceTypes)
    .sort((a, b) => {
      const latestDiff = new Date(b.latestPublishedAt ?? 0).getTime() - new Date(a.latestPublishedAt ?? 0).getTime();
      if (latestDiff) return latestDiff;
      const diversityDiff = b.sourceTypes.length - a.sourceTypes.length;
      if (diversityDiff) return diversityDiff;
      return b.sources.length - a.sources.length;
    });

  const selected = new Map<string, ArticleCluster>();
  // 소스 중복 방지는 같은 트랙 안에서만 적용한다. 트랙 간 전역 차단을 하면
  // 앞에서 선택된 AI 클러스터가 논문/GitHub 후보를 모두 밀어내는 문제가 생긴다.
  for (const track of DAILY_TRACKS) {
    const trackClusters = clusters.filter((cluster) => cluster.track === track);
    const usedSourceKeys = new Set<string>();
    let trackCount = 0;
    for (const cluster of trackClusters) {
      const overlap = cluster.sources.filter((source) => usedSourceKeys.has(sourceKey(source))).length;
      if (trackCount > 0 && overlap > Math.floor(cluster.sources.length / 2)) continue;
      selected.set(cluster.id, cluster);
      trackCount += 1;
      for (const source of cluster.sources) usedSourceKeys.add(sourceKey(source));
      if (trackCount >= 3) break;
    }
  }

  // 정확히 같은 키워드가 아니어도, 같은 트랙의 독립적인 최신 신호를 묶은
  // 에디토리얼 브리프는 발행할 수 있다. 단일 원천 fallback은 발행 후보로 쓰지 않는다.
  const globallyUsedSources = new Set([...selected.values()].flatMap((cluster) => cluster.sources
    .filter((source) => source.sourceType !== 'trend_bundle')
    .map(sourceKey)));
  for (const track of DAILY_TRACKS) {
    if ([...selected.values()].some((cluster) => cluster.track === track && cluster.sources.filter((source) => source.sourceType !== 'trend_bundle').length >= TRACK_DIGEST_MIN_SOURCES)) continue;

    const digestSources = pickTrackDigestSources(track, sources, globallyUsedSources);
    if (digestSources.length < TRACK_DIGEST_MIN_SOURCES) continue;

    const digest = buildClusterFromBucket(`track digest ${track}`, digestSources, trendBundle);
    const trackDigest = {
      ...digest,
      id: `track-digest-${slugifyClusterKey(track)}`,
      title: `${track}에서 지금 봐야 할 ${digestSources.length}가지 개발 신호`,
      trend: `${track} 브리프`,
      track,
    };
    selected.set(trackDigest.id, trackDigest);
    for (const source of digestSources) globallyUsedSources.add(sourceKey(source));
  }

  return [...selected.values()];
}

function pickTrackDigestSources(track: ArticleTrack, sources: SourceItem[], usedSources: Set<string>) {
  const candidates = sources.filter((source) => source.sourceType !== 'trend_bundle'
    && !usedSources.has(sourceKey(source))
    && sourceMatchesTrack(source, track));
  const selected: SourceItem[] = [];
  const usedDomains = new Set<string>();

  for (const source of candidates) {
    const domain = source.sourceDomain ?? `${source.sourceType}:${source.sourceId}`;
    if (usedDomains.has(domain) && candidates.some((item) => item.sourceDomain && item.sourceDomain !== domain && sourceMatchesTrack(item, track))) continue;
    selected.push(source);
    usedDomains.add(domain);
    if (selected.length >= 4) break;
  }

  return selected;
}

function sourceMatchesTrack(source: SourceItem, track: ArticleTrack) {
  const text = `${source.title} ${source.summary} ${source.skills.join(' ')}`.toLowerCase();
  if (track === '오픈소스/GitHub') return source.sourceType === 'github';
  if (track === '제품/빌드 아이디어') return source.sourceType === 'ai_product';
  if (track === '논문/리서치') return source.sourceType === 'paper';
  if (track === '프론트엔드') return /front|react|next\.?js|vue|svelte|css|ui|ux|browser|web component|accessibility|design system|프론트/.test(text);
  if (track === '백엔드') return /back|server|api|database|postgres|mysql|mongodb|redis|kafka|grpc|graphql|spring|java|kotlin|node|nestjs|express|fastapi|django|flask|golang|rust|kubernetes|docker|terraform|microservice|distributed system|queue|worker|cache|infra|cloud|devops|backend|서버|백엔드|데이터베이스|마이크로서비스/.test(text);
  return /ai|llm|agent|rag|mcp|model|codex|claude code|copilot|머신러닝|인공지능|생성형/.test(text);
}

function inferClusterDifficulty(cluster: ArticleCluster): '초급' | '중급' | '고급' {
  const text = `${cluster.title} ${cluster.summary} ${cluster.skills.join(' ')}`.toLowerCase();
  if (/tutorial|getting started|beginner|introduction|quickstart|walkthrough|입문|초보|기초|따라하기|실습/.test(text)) return '초급';
  if (/production|architecture|distributed|scalab|performance|security|benchmark|evaluation|observability|kubernetes|운영|아키텍처|성능|보안|분산|평가|관찰 가능/.test(text)) return '고급';
  return '중급';
}

function selectDailyClusters(clusters: ArticleCluster[], maxTotal: number) {
  const selected: ArticleCluster[] = [];
  const selectedIds = new Set<string>();

  for (let round = 0; selected.length < maxTotal; round += 1) {
    let addedThisRound = false;
    for (const track of DAILY_TRACKS) {
      if (selected.length >= maxTotal) return selected;
      const cluster = clusters.find((item) => item.track === track && !selectedIds.has(item.id));
      if (!cluster) continue;
      selected.push(cluster);
      selectedIds.add(cluster.id);
      addedThisRound = true;
    }
    if (!addedThisRound) break;
  }

  return selected;
}

function buildClusterFromBucket(key: string, items: SourceItem[], trendBundle?: SourceItem) {
  const deduped = dedupeSources([...(trendBundle ? [trendBundle] : []), ...items]).slice(0, 8);
  const sourceTypes = uniqueStrings(deduped.map((item) => item.sourceType));
  const track = inferArticleTrack(key, deduped);
  const clusterTitle = `${titleCaseClusterKey(key)} 흐름을 실제 프로젝트로 연결하는 법`;
  const skills = uniqueStrings(deduped.flatMap((item) => item.skills)).slice(0, 12);
  const latestPublishedAt = deduped
    .filter((source) => source.sourceType !== 'trend_bundle')
    .map((source) => source.publishedAt)
    .filter((value): value is string => Boolean(value))
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  const summary = [
    `클러스터 주제: ${titleCaseClusterKey(key)}`,
    `참고 데이터 수: ${deduped.length}`,
    `참고 source type: ${sourceTypes.join(', ')}`,
    '',
    ...deduped.map((source, index) => [
      `## Source ${index + 1}: ${source.sourceType}`,
      `제목: ${source.title}`,
      source.trend ? `주제: ${source.trend}` : null,
      source.skills.length ? `스킬/태그: ${source.skills.slice(0, 8).join(', ')}` : null,
      source.summary,
    ].filter(Boolean).join('\n')),
  ].join('\n\n');

  return {
    id: slugifyClusterKey(key),
    title: clusterTitle,
    summary,
    trend: titleCaseClusterKey(key),
    skills,
    sourceTypes,
    sources: deduped,
    track,
    latestPublishedAt,
  };
}

function inferArticleTrack(key: string, sources: SourceItem[]): ArticleTrack {
  const text = `${key} ${sources.map((source) => `${source.title} ${source.summary} ${source.skills.join(' ')}`).join(' ')}`.toLowerCase();
  const sourceTypes = new Set(sources.map((source) => source.sourceType));
  if (sourceTypes.has('paper')) return '논문/리서치';
  if (sourceTypes.has('github')) return '오픈소스/GitHub';
  if (sourceTypes.has('ai_product')) return '제품/빌드 아이디어';
  if (/front|react|next\.?js|vue|svelte|css|ui|ux|browser|web component|프론트/.test(text)) return '프론트엔드';
  if (/back|server|api|database|postgres|mysql|mongodb|redis|kafka|grpc|graphql|spring|java|kotlin|node|nestjs|express|fastapi|django|flask|golang|rust|kubernetes|docker|terraform|microservice|distributed system|queue|worker|cache|infra|cloud|devops|backend|서버|백엔드|데이터베이스|마이크로서비스/.test(text)) return '백엔드';
  if (/startup|saas|product hunt|product|maker|side project|business|market|revenue|창업|사이드|제품|서비스|빌드|아이디어/.test(text)) return '제품/빌드 아이디어';
  return 'AI/LLM';
}

function getClusterKeys(source: SourceItem) {
  return uniqueStrings([
    source.trend,
    ...source.skills,
    ...extractKeywordsFromText(`${source.title} ${source.summary}`),
  ])
    .map((key) => normalizeClusterKey(key))
    .filter((key) => key && !GENERIC_TREND_TERMS.has(key))
    .slice(0, 8);
}

function extractKeywordsFromText(text: string) {
  const lower = text.toLowerCase();
  const known = [
    'ai agent',
    'coding agent',
    'mcp server',
    'mcp',
    'rag evaluation',
    'rag',
    'vector database',
    'local llm',
    'ai coding assistant',
    'codex',
    'claude code',
    'github copilot',
    'developer workflow',
    'build log',
    'implementation guide',
    'cli',
    'terminal',
    'browser agent',
    'computer use',
    'developer tool',
    'workflow automation',
    'model routing',
    'observability',
    'vercel ai sdk',
    'supabase auth',
    'api gateway',
    'microservices',
    'distributed systems',
    'graphql',
    'grpc',
    'kafka',
    'kubernetes',
    'serverless',
    'database migration',
    'observability',
  ];
  return known.filter((keyword) => lower.includes(keyword));
}

function normalizeClusterKey(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ') ?? '';
}

function titleCaseClusterKey(value: string) {
  return value
    .split(' ')
    .map((part) => ['ai', 'llm', 'rag', 'mcp', 'tui', 'api', 'sdk'].includes(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function slugifyClusterKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
}

function dedupeSources(sources: SourceItem[]) {
  const seen = new Set<string>();
  const result: SourceItem[] = [];
  for (const source of sources) {
    const key = sourceKey(source);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function sourceKey(source: SourceItem) {
  return `${source.sourceType}:${source.sourceId}`;
}

function getTodayTrackCounts(items: Array<Record<string, any>>) {
  const counts = Object.fromEntries(DAILY_TRACKS.map((track) => [track, 0])) as Record<ArticleTrack, number>;
  for (const item of items) {
    const notes = getQualityNotes(item.quality_notes);
    const trackNote = notes.find((note) => note.startsWith('track:'));
    const track = trackNote?.replace(/^track:/, '') as ArticleTrack | undefined;
    if (track && track in counts) counts[track] += 1;
  }
  return counts;
}

function totalTrackCount(counts: Record<ArticleTrack, number>) {
  return DAILY_TRACKS.reduce((sum, track) => sum + (counts[track] ?? 0), 0);
}

function countTracks(items: Array<{ track: ArticleTrack }>) {
  return Object.fromEntries(DAILY_TRACKS.map((track) => [track, items.filter((item) => item.track === track).length]));
}

function countSourceTypes(items: SourceItem[]) {
  return Object.fromEntries(uniqueStrings(items.map((item) => item.sourceType)).map((type) => [type, items.filter((item) => item.sourceType === type).length]));
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

function meetsPublicationThreshold(cluster: ArticleCluster, mode: 'daily' | 'deep-dive') {
  const actualSources = cluster.sources.filter((source) => source.sourceType !== 'trend_bundle');
  const actualTypes = new Set(actualSources.map((source) => source.sourceType));
  const primaryCount = actualSources.filter((source) => source.sourceRole === 'primary').length;
  const independentEntities = new Set(actualSources.map((source) => (
    source.sourceType === 'github' || source.sourceType === 'paper'
      ? `${source.sourceType}:${source.sourceId}`
      : source.sourceDomain || `${source.sourceType}:${source.sourceId}`
  )));
  const isProductTrack = cluster.track === '제품/빌드 아이디어';
  const minimumSources = mode === 'deep-dive' ? 5 : isProductTrack ? 2 : 3;
  const minimumTypes = mode === 'deep-dive' ? 3 : 2;
  const minimumPrimary = mode === 'deep-dive' ? 2 : 1;
  const independentCoverage = actualSources.length >= 3 && independentEntities.size >= 3;
  const sourceDiversityPass = actualTypes.size >= minimumTypes
    || (mode === 'daily' && independentCoverage);
  const primaryCoveragePass = primaryCount >= minimumPrimary
    || (mode === 'daily' && independentCoverage);

  return actualSources.length >= minimumSources
    && sourceDiversityPass
    && primaryCoveragePass
    && independentEntities.size >= 2;
}

function classifySourceRole(sourceName: string | null | undefined, url: string | null | undefined): SourceItem['sourceRole'] {
  const value = `${sourceName ?? ''} ${url ?? ''}`;
  return /openai|anthropic|google|github|aws|cloudflare|vercel|nvidia|naver|kakao|toss|woowahan|daangn|arxiv/i.test(value)
    ? 'primary'
    : 'independent';
}

function getSourceDomain(url: string | null | undefined) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function isDuplicateCluster(cluster: ArticleCluster, recentItems: Array<Record<string, any>>) {
  const clusterTokens = tokenSet([cluster.id, cluster.title, cluster.trend, ...cluster.skills].join(' '));
  // trend_bundle은 모든 클러스터에 공통으로 붙는 현재 트렌드 요약이다.
  // 이를 실제 원문 소스로 세면 이전 글과 공통 트렌드만 겹쳐도
  // 백엔드/프론트엔드 등 다른 트랙 후보까지 중복으로 잘못 제거된다.
  const clusterSourceKeys = new Set(
    cluster.sources
      .filter((source) => source.sourceType !== 'trend_bundle')
      .map(sourceKey),
  );

  for (const item of recentItems) {
    const notes = getQualityNotes(item.quality_notes);
    if (notes.includes(`cluster_key:${cluster.id}`)) return true;

    const recentSourceKeys = new Set(
      notes
        .filter((note) => note.startsWith('source_key:'))
        .map((note) => note.replace(/^source_key:/, ''))
        .filter((key) => !key.startsWith('trend_bundle:')),
    );
    const sourceOverlap = [...clusterSourceKeys].filter((key) => recentSourceKeys.has(key)).length;
    if (sourceOverlap >= Math.max(2, Math.ceil(clusterSourceKeys.size * 0.5))) return true;

    const recentTokens = tokenSet([item.title, ...(Array.isArray(item.topic_tags) ? item.topic_tags : [])].join(' '));
    if (jaccard(clusterTokens, recentTokens) >= 0.58) return true;
  }

  return false;
}

function tokenSet(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9가-힣.+#\s]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 2 && !GENERIC_TREND_TERMS.has(token)),
  );
}

function jaccard(left: Set<string>, right: Set<string>) {
  if (!left.size || !right.size) return 0;
  const intersection = [...left].filter((token) => right.has(token)).length;
  const union = new Set([...left, ...right]).size;
  return intersection / union;
}

function hasQualityNote(value: unknown, note: string) {
  return getQualityNotes(value).includes(note);
}

function getQualityNotes(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

const GENERIC_TREND_TERMS = new Set([
  'ai',
  'llm',
  'python',
  'javascript',
  'typescript',
  'react',
  'next.js',
  'node.js',
  'api',
  'github',
  'open source',
  'developer',
  'development',
  'software',
  'code',
  'coding',
  'data',
  'model',
  'tool',
  'tools',
  'product',
  'news',
  '개발',
  '기술',
  '뉴스',
  '데이터',
  '모델',
  '도구',
]);

function pickSpecificTrend(values: Array<string | null | undefined>) {
  return values.map((value) => value?.trim()).find((value): value is string => Boolean(value && !GENERIC_TREND_TERMS.has(value.toLowerCase()))) ?? null;
}

function isUsableRepoSource(item: Record<string, any>) {
  const stars = Number(item.stars ?? 0);
  const text = [item.repo_full_name, item.description, item.short_summary, item.beginner_summary, item.project_idea, ...(item.topics ?? [])]
    .join(' ')
    .toLowerCase();
  if (stars < 50) return false;
  if (/이 저장소를 활용하여|이 저장소처럼|핵심 기능 만들어보기/i.test(text)) return false;
  return /agent|llm|mcp|rag|vector|developer tool|devtool|cli|sdk|workflow|automation|ai coding|codegen|next|react|supabase|vercel ai/i.test(text);
}

function isUsablePaperSource(item: Record<string, any>) {
  const relevance = Number(item.relevance_score ?? item.trend_score ?? 0);
  const buildability = Number(item.buildability_score ?? 0);
  const text = [item.title, item.beginner_summary, item.expert_summary, item.implementation_idea, item.service_idea, ...(item.categories ?? []), ...(item.related_skills ?? [])]
    .join(' ')
    .toLowerCase();
  if (relevance < 55 || buildability < 55) return false;
  if (/기반\s+미니\s+데모|논문 아이디어를 활용한|arxiv:\S+|announce type|abstract:/i.test(text)) return false;
  return /agent|llm|mcp|rag|retrieval|software engineering|developer tool|code generation|api|sdk|cli|backend|frontend|database|observability|workflow|automation/.test(text);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

function inferRelatedRoles(source: Pick<SourceItem, 'title' | 'summary' | 'skills'>) {
  const combined = `${source.title} ${source.summary} ${source.skills.join(' ')}`.toLowerCase();
  const roles = [];
  if (/front|react|next|ui|ux|css/.test(combined)) roles.push('frontend_developer');
  if (/back|api|server|database|postgres|spring|node/.test(combined)) roles.push('backend_developer');
  if (/ai|llm|agent|model|ml|paper/.test(combined)) roles.push('ai_builder');
  if (/startup|product|saas|idea|market/.test(combined)) roles.push('startup_builder');
  return roles.length ? roles : ['developer'];
}
