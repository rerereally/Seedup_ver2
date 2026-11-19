// Pure source-bundle construction, clustering, and publication-threshold checks for article draft generation.
export type SourceItem = {
  sourceType: 'news' | 'ai_product' | 'github' | 'paper' | 'trend_bundle';
  sourceId: string;
  title: string;
  summary: string;
  trend: string | null;
  skills: string[];
  sourceRole: 'primary' | 'independent' | 'supporting' | 'context';
  sourceDomain: string | null;
  sourceUrl: string | null;
  publishedAt: string | null;
};

export type ArticleTrack = 'AI/LLM' | '프론트엔드' | '백엔드' | '오픈소스/GitHub' | '제품/빌드 아이디어' | '논문/리서치';

export type ArticleCluster = {
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

export const DAILY_TRACKS: ArticleTrack[] = ['AI/LLM', '프론트엔드', '백엔드', '오픈소스/GitHub', '제품/빌드 아이디어', '논문/리서치'];
// 한 번의 실행에서 생성할 최대 수. 트랙별 고정 개수 제한은 두지 않는다.
export const DAILY_TOTAL_LIMIT = 12;
const MAX_CANDIDATES_PER_TRACK = 6;
const TRACK_DIGEST_MIN_SOURCES = 3;
const RECENT_DUPLICATE_WINDOW_DAYS = 14;
const DEEP_DIVE_WINDOW_DAYS = 7;

export function normalizeDailyNewsletterSection(value: unknown) {
  if (value === 'ai_product_radar' || value === 'github_project_pick' || value === 'build_idea' || value === 'paper_to_project') {
    return value;
  }
  return 'daily_briefing';
}

export function buildSources({
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
      sourceUrl: null,
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
      sourceUrl: item.original_url || item.source_url || null,
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
      sourceUrl: item.website_url || item.product_hunt_url || null,
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
      sourceUrl: item.repo_url || null,
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
      sourceUrl: item.paper_url || item.code_url || null,
    })),
  ];
}

export function buildArticleClusters(sources: SourceItem[], options: { minSources: number; minSourceTypes: number }): ArticleCluster[] {
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

export function inferClusterDifficulty(cluster: ArticleCluster): '초급' | '중급' | '고급' {
  const text = `${cluster.title} ${cluster.summary} ${cluster.skills.join(' ')}`.toLowerCase();
  if (/tutorial|getting started|beginner|introduction|quickstart|walkthrough|입문|초보|기초|따라하기|실습/.test(text)) return '초급';
  if (/production|architecture|distributed|scalab|performance|security|benchmark|evaluation|observability|kubernetes|운영|아키텍처|성능|보안|분산|평가|관찰 가능/.test(text)) return '고급';
  return '중급';
}

export function selectDailyClusters(clusters: ArticleCluster[], maxTotal: number) {
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

export function sourceKey(source: SourceItem) {
  return `${source.sourceType}:${source.sourceId}`;
}

export function getTodayTrackCounts(items: Array<Record<string, any>>) {
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

export function countTracks(items: Array<{ track: ArticleTrack }>) {
  return Object.fromEntries(DAILY_TRACKS.map((track) => [track, items.filter((item) => item.track === track).length]));
}

export function countSourceTypes(items: SourceItem[]) {
  return Object.fromEntries(uniqueStrings(items.map((item) => item.sourceType)).map((type) => [type, items.filter((item) => item.sourceType === type).length]));
}


export function meetsPublicationThreshold(cluster: ArticleCluster, mode: 'daily' | 'deep-dive') {
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

export function isDuplicateCluster(cluster: ArticleCluster, recentItems: Array<Record<string, any>>) {
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

export function hasQualityNote(value: unknown, note: string) {
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

export function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))));
}

export function inferRelatedRoles(source: Pick<SourceItem, 'title' | 'summary' | 'skills'>) {
  const combined = `${source.title} ${source.summary} ${source.skills.join(' ')}`.toLowerCase();
  const roles = [];
  if (/front|react|next|ui|ux|css/.test(combined)) roles.push('frontend_developer');
  if (/back|api|server|database|postgres|spring|node/.test(combined)) roles.push('backend_developer');
  if (/ai|llm|agent|model|ml|paper/.test(combined)) roles.push('ai_builder');
  if (/startup|product|saas|idea|market/.test(combined)) roles.push('startup_builder');
  return roles.length ? roles : ['developer'];
}

