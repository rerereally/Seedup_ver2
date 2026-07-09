import { assertIngestAuth } from '@/lib/ingest/auth';
import { generateArticleDraft, validateGeneratedArticleDraft } from '@/lib/ingest/ai';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

type SourceItem = {
  sourceType: 'news' | 'ai_product' | 'github' | 'paper' | 'trend_bundle';
  sourceId: string;
  title: string;
  summary: string;
  trend: string | null;
  skills: string[];
};

type ArticleTrack = 'AI/LLM' | '프론트엔드' | '백엔드' | '사이드프로젝트/창업';

type ArticleCluster = {
  id: string;
  title: string;
  summary: string;
  trend: string | null;
  skills: string[];
  sourceTypes: string[];
  sources: SourceItem[];
  track: ArticleTrack;
};

const DAILY_TRACKS: ArticleTrack[] = ['AI/LLM', '프론트엔드', '백엔드', '사이드프로젝트/창업'];
const DAILY_PER_TRACK = 2;
const DAILY_TOTAL_LIMIT = DAILY_TRACKS.length * DAILY_PER_TRACK;
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
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();
  const [newsResult, productsResult, reposResult, papersResult, trendsResult] = await Promise.all([
    supabase
      .from('news_items')
      .select('id,title,short_summary,beginner_summary,summary,newsletter_section,newsletter_priority,topic_tags,skill_tags,related_skills,project_idea,category,source,source_url,original_url')
      .order('newsletter_priority', { ascending: false, nullsFirst: false })
      .order('daily_rank_score', { ascending: false, nullsFirst: false })
      .limit(sourceLimit),
    supabase
      .from('ai_products')
      .select('id,name,short_summary,description,newsletter_priority,topic_tags,skill_tags,use_cases,related_project_ideas,category,website_url,product_hunt_url')
      .order('newsletter_priority', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(sourceLimit),
    supabase
      .from('github_trends')
      .select('id,repo_full_name,repo_url,short_summary,beginner_summary,description,newsletter_priority,topic_tags,skill_tags,topics,language,project_idea,stars,stars_delta_7d')
      .order('newsletter_priority', { ascending: false, nullsFirst: false })
      .order('stars', { ascending: false })
      .limit(sourceLimit),
    supabase
      .from('research_papers')
      .select('id,title,beginner_summary,expert_summary,abstract,categories,related_skills,implementation_idea,service_idea,relevance_score,trend_score,buildability_score,paper_url,code_url')
      .order('trend_score', { ascending: false, nullsFirst: false })
      .order('published_at', { ascending: false })
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
      .gte('published_at', recentSince)
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
    .filter((cluster) => mode === 'deep-dive' || (todayTrackCounts[cluster.track] ?? 0) < DAILY_PER_TRACK)
    .filter((cluster) => !isDuplicateCluster(cluster, recentItems));
  const selectedClusters = mode === 'daily'
    ? selectDailyClusters(clusters, todayTrackCounts, Math.min(limit, DAILY_TOTAL_LIMIT - totalTrackCount(todayTrackCounts)))
    : clusters.slice(0, 1);

  let upserted = 0;
  let errors = 0;
  let skipped = 0;

  for (const cluster of selectedClusters) {
    try {
      const { draft, model } = await generateArticleDraft({
        title: cluster.title,
        sourceType: mode === 'deep-dive' ? 'trend_bundle' : 'cluster',
        summary: cluster.summary,
        trend: cluster.trend,
        skills: cluster.skills,
        track: cluster.track,
      });
      const quality = validateGeneratedArticleDraft(draft);
      if (!quality.ok) {
        skipped += 1;
        console.warn('Generated article skipped after quality check', cluster.id, cluster.title, quality.reason);
        continue;
      }

      const now = new Date().toISOString();
      const originalUrl = `seedup://article-drafts/cluster/${cluster.id}`;
      const { error } = await upsertGeneratedArticle(supabase, {
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

      if (error) {
        errors += 1;
        console.error('Generated article upsert failed', cluster.id, cluster.title, error);
      } else {
        upserted += 1;
      }
    } catch (error) {
      errors += 1;
      console.error('Article draft generation failed', cluster.id, cluster.title, error);
    }
  }

  if (!selectedClusters.length) skipped += 1;

  await recordIngestRun(supabase, {
    source: mode === 'deep-dive' ? 'deep-dive' : 'article-drafts',
    status: getRunStatus(errors, upserted),
    inserted: upserted,
    skipped,
    errors,
    durationMs: Date.now() - startedAt,
    detail: { mode, limit, minSources, minSourceTypes, sources: sources.length, clusters: clusters.length, selected: selectedClusters.length, target: 'news_items' },
  });

  return NextResponse.json({ ok: true, mode, upserted, skipped, errors, sources: sources.length, clusters: clusters.length, selected: selectedClusters.length });
}

async function upsertGeneratedArticle(supabase: NonNullable<ReturnType<typeof createAdminClient>>, payload: Record<string, unknown>) {
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
  return supabase.from('news_items').upsert(fallbackPayload, { onConflict: 'original_url' });
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
      const diversityDiff = b.sourceTypes.length - a.sourceTypes.length;
      if (diversityDiff) return diversityDiff;
      return b.sources.length - a.sources.length;
    });

  const selected = new Map<string, ArticleCluster>();
  const usedSourceKeys = new Set<string>();
  for (const cluster of clusters) {
    const overlap = cluster.sources.filter((source) => usedSourceKeys.has(sourceKey(source))).length;
    if (overlap > Math.floor(cluster.sources.length / 2)) continue;
    selected.set(cluster.id, cluster);
    for (const source of cluster.sources) usedSourceKeys.add(sourceKey(source));
  }

  return [...selected.values()];
}

function selectDailyClusters(clusters: ArticleCluster[], initialCounts: Record<ArticleTrack, number>, maxTotal: number) {
  const counts = { ...initialCounts };
  const selected: ArticleCluster[] = [];

  for (const track of DAILY_TRACKS) {
    for (const cluster of clusters.filter((item) => item.track === track)) {
      if (selected.length >= maxTotal) return selected;
      if ((counts[track] ?? 0) >= DAILY_PER_TRACK) break;
      selected.push(cluster);
      counts[track] = (counts[track] ?? 0) + 1;
    }
  }

  return selected;
}

function buildClusterFromBucket(key: string, items: SourceItem[], trendBundle?: SourceItem) {
  const deduped = dedupeSources([...(trendBundle ? [trendBundle] : []), ...items]).slice(0, 8);
  const sourceTypes = uniqueStrings(deduped.map((item) => item.sourceType));
  const track = inferArticleTrack(key, deduped);
  const clusterTitle = `${titleCaseClusterKey(key)} 흐름을 실제 프로젝트로 연결하는 법`;
  const skills = uniqueStrings(deduped.flatMap((item) => item.skills)).slice(0, 12);
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
  };
}

function inferArticleTrack(key: string, sources: SourceItem[]): ArticleTrack {
  const text = `${key} ${sources.map((source) => `${source.title} ${source.summary} ${source.skills.join(' ')}`).join(' ')}`.toLowerCase();
  if (/front|react|next\.?js|vue|svelte|css|ui|ux|browser|web component|프론트/.test(text)) return '프론트엔드';
  if (/back|server|api|database|postgres|redis|spring|node|fastapi|infra|cloud|devops|backend|서버|백엔드/.test(text)) return '백엔드';
  if (/startup|saas|product hunt|product|maker|side project|business|market|revenue|창업|사이드|제품|서비스/.test(text)) return '사이드프로젝트/창업';
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
    'browser agent',
    'computer use',
    'developer tool',
    'workflow automation',
    'model routing',
    'observability',
    'vercel ai sdk',
    'supabase auth',
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

function isDuplicateCluster(cluster: ArticleCluster, recentItems: Array<Record<string, any>>) {
  const clusterTokens = tokenSet([cluster.id, cluster.title, cluster.trend, ...cluster.skills].join(' '));
  const clusterSourceKeys = new Set(cluster.sources.map(sourceKey));

  for (const item of recentItems) {
    const notes = getQualityNotes(item.quality_notes);
    if (notes.includes(`cluster_key:${cluster.id}`)) return true;

    const recentSourceKeys = new Set(notes.filter((note) => note.startsWith('source_key:')).map((note) => note.replace(/^source_key:/, '')));
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
