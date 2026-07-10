import type { AIProduct, GitHubTrend, NewsItem, ProjectIdea, ResearchPaper, ScrapItem } from '@/lib/data';

export type ContentType =
  | 'news'
  | 'article'
  | 'ai_product'
  | 'github_repo'
  | 'paper'
  | 'career_tip'
  | 'build_idea'
  | 'deep_dive';

export type NewsletterSection =
  | 'daily_briefing'
  | 'ai_product_radar'
  | 'github_project_pick'
  | 'build_idea'
  | 'career_tip'
  | 'deep_dive'
  | 'paper_to_project';

export type RecommendationMetadata = {
  content_type: ContentType;
  newsletter_section: NewsletterSection;
  newsletter_priority: number;
  short_summary: string;
  topic_tags: string[];
  skill_tags: string[];
  intent_tags: string[];
  audience_tags: string[];
  related_roles: string[];
  target_levels: string[];
  target_goals: string[];
  target_interests: string[];
  learning_topics: string[];
  project_convertible: boolean;
  personalization_hooks: string[];
  source_quality_score: number;
  novelty_score: number;
  buildability_score: number;
  project_connect_score: number;
  recommendation_reasons: string[];
  relevance_score?: number | null;
};

export type UserNewsletterProfile = {
  user_id: string;
  label?: string;
  level: string;
  interests: string[];
  goals: string[];
  preferred_roles: string[];
  preferred_stack: string[];
  content_preferences: NewsletterSection[];
  frequency: 'daily' | 'three_times_week' | 'weekly';
};

export type NewsletterContentItem = {
  id: string;
  title: string;
  href: string;
  sourceLabel: string;
  publishedAt?: string | null;
  metadata: RecommendationMetadata;
  raw: NewsItem | AIProduct | GitHubTrend | ProjectIdea | ResearchPaper;
};

export type ScoredNewsletterItem = {
  content: NewsletterContentItem;
  score: number;
  reasons: string[];
};

export const DEMO_NEWSLETTER_PROFILES: UserNewsletterProfile[] = [
  {
    user_id: 'demo-ai-frontend',
    label: 'AI 프론트엔드 포트폴리오',
    level: '초보자',
    interests: ['AI', '프론트엔드', 'Next.js'],
    goals: ['포트폴리오 만들기', '최신 기술 공부'],
    preferred_roles: ['frontend_developer', 'ai_builder'],
    preferred_stack: ['Next.js', 'TypeScript', 'Supabase'],
    content_preferences: ['daily_briefing', 'github_project_pick', 'build_idea'],
    frequency: 'daily',
  },
  {
    user_id: 'demo-backend-job',
    label: '백엔드 취업 준비',
    level: '초보자',
    interests: ['백엔드', 'DB', 'API'],
    goals: ['취업/이직 준비', '포트폴리오 만들기'],
    preferred_roles: ['backend_developer'],
    preferred_stack: ['Node.js', 'PostgreSQL', 'Supabase'],
    content_preferences: ['daily_briefing', 'github_project_pick', 'career_tip'],
    frequency: 'daily',
  },
  {
    user_id: 'demo-startup-ai',
    label: 'AI 스타트업 빌더',
    level: '중급자',
    interests: ['AI 제품', '창업', '사이드 프로젝트'],
    goals: ['창업 아이디어 검증', '사이드 프로젝트'],
    preferred_roles: ['startup_builder', 'ai_builder'],
    preferred_stack: ['Next.js', 'OpenRouter API', 'Supabase'],
    content_preferences: ['ai_product_radar', 'build_idea', 'deep_dive'],
    frequency: 'weekly',
  },
];

export type RecommendationProfile = {
  tokens: string[];
  levels: string[];
  goals: string[];
  interests: string[];
  tracks: DailyArticleTrack[];
};

export type RecommendedItem<T> = {
  item: T;
  score: number;
  reasons: string[];
};

type RecommendableArticle = NewsItem | ResearchPaper;
type DailyArticleTrack = 'AI/LLM' | '프론트엔드' | '백엔드' | '오픈소스/GitHub' | '제품/빌드 아이디어' | '논문/리서치';

const TRACKS: DailyArticleTrack[] = ['AI/LLM', '프론트엔드', '백엔드', '오픈소스/GitHub', '제품/빌드 아이디어', '논문/리서치'];

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map(normalize).filter(Boolean)));
}

export function overlap(left: string[] = [], right: string[] = []) {
  const rightSet = new Set(right.map(normalize));
  return unique(left).filter((value) => rightSet.has(value)).length;
}

function fuzzyOverlap(left: string[] = [], right: string[] = []) {
  const normalizedLeft = unique(left);
  const normalizedRight = unique(right);
  return normalizedLeft.filter((leftValue) =>
    normalizedRight.some((rightValue) => leftValue.includes(rightValue) || rightValue.includes(leftValue)),
  ).length;
}

export function scoreContentForProfile(content: RecommendationMetadata, profile: UserNewsletterProfile) {
  let score = 0;
  const preferredTracks = inferPreferredTracks([
    ...profile.interests,
    ...profile.goals,
    ...profile.preferred_roles,
    ...profile.preferred_stack,
  ]);
  score += fuzzyOverlap(content.topic_tags, profile.interests) * 4;
  score += fuzzyOverlap(content.skill_tags, profile.preferred_stack) * 3;
  score += fuzzyOverlap(content.target_goals, profile.goals) * 4;
  score += overlap(content.related_roles, profile.preferred_roles) * 4;
  score += overlap(content.topic_tags, preferredTracks) * 5;
  if (content.target_levels.some((level) => normalize(level) === normalize(profile.level))) score += 3;
  if (profile.content_preferences.includes(content.newsletter_section)) score += 2;
  score += content.newsletter_priority * 0.2;
  score += content.novelty_score * 0.1;
  score += content.source_quality_score * 0.1;
  return Math.round(score);
}

export function shouldGenerateArticleDraft(analysis: RecommendationMetadata & { relevance_score?: number | null }) {
  return (
    Number(analysis.relevance_score ?? 0) >= 75 &&
    analysis.source_quality_score >= 60 &&
    analysis.newsletter_priority >= 70 &&
    analysis.novelty_score >= 50
  );
}

export function shouldGenerateBuildIdea(analysis: RecommendationMetadata & { relevance_score?: number | null }) {
  return (
    analysis.project_convertible &&
    Number(analysis.relevance_score ?? 0) >= 70 &&
    analysis.buildability_score >= 65 &&
    analysis.project_connect_score >= 65
  );
}

export function buildRecommendationProfile(answers: Record<string, unknown> | null | undefined, extraTokens: string[] = []): RecommendationProfile {
  const values = Object.values(answers ?? {}).flatMap((value) => Array.isArray(value) ? value : [value]);
  const tokens = unique([...values.map(String), ...extraTokens]);
  const answerList = (id: string) => {
    const value = answers?.[id];
    return unique((Array.isArray(value) ? value : value ? [value] : []).map(String));
  };
  const levels = answerList('level');
  const goals = unique([...answerList('goals'), ...answerList('goal')]);
  const interests = answerList('interests');

  const resolvedInterests = interests.length ? interests : tokens.filter((token) => !/beginner|intermediate|advanced|입문|초보|중급|고급|실무/.test(token));
  const resolvedGoals = goals.length ? goals : tokens.filter((token) => /portfolio|project|startup|career|포트폴리오|프로젝트|창업|커리어|취업|이직|트렌드|논문|연구|실무/.test(token));

  return {
    tokens,
    levels: levels.length ? levels : tokens.filter((token) => /beginner|intermediate|advanced|입문|초보|중급|고급|실무/.test(token)),
    goals: resolvedGoals,
    interests: resolvedInterests,
    tracks: inferPreferredTracks([...tokens, ...resolvedInterests, ...resolvedGoals]),
  };
}

export function scrapTokens(scraps: ScrapItem[]) {
  return unique(scraps.flatMap((item) => [item.item_type, item.title, item.description, item.tag].filter(Boolean).map(String)));
}

function articleText(item: RecommendableArticle) {
  const paper = item as ResearchPaper;
  const news = item as NewsItem;

  return [
    item.title,
    news.summary,
    news.beginner_summary,
    news.category,
    paper.abstract,
    paper.expert_summary,
    paper.review_type,
    paper.difficulty,
    ...(news.related_skills ?? []),
    ...(news.topic_tags ?? []),
    ...(news.skill_tags ?? []),
    ...(news.intent_tags ?? []),
    ...(news.audience_tags ?? []),
    ...(paper.related_skills ?? []),
    ...(news.target_levels ?? []),
    ...(paper.target_levels ?? []),
    ...(news.target_goals ?? []),
    ...(paper.target_goals ?? []),
    ...(news.target_interests ?? []),
    ...(paper.target_interests ?? []),
    ...(paper.categories ?? []),
    ...(news.quality_notes ?? []),
  ].join(' ').toLowerCase();
}

function publishedAt(item: RecommendableArticle) {
  return item.published_at ? new Date(item.published_at).getTime() : 0;
}

function freshnessScore(item: RecommendableArticle, now = Date.now()) {
  const published = publishedAt(item);
  if (!published) return 4;

  const ageHours = Math.max(0, (now - published) / 36e5);
  if (ageHours <= 24) return 35;
  if (ageHours <= 48) return 28;
  if (ageHours <= 168) return 18;
  if (ageHours <= 720) return 8;
  return 2;
}

function profileMatchScore(text: string, profile: RecommendationProfile) {
  const matches = profile.tokens.filter((token) => token.length > 1 && text.includes(token));
  return Math.min(matches.length * 8, 28);
}

function articleQualitySignals(item: NewsItem) {
  const notes = item.quality_notes ?? [];
  const contentLength = item.content?.trim().length ?? 0;
  const sourceCount = getNumberNote(notes, 'source_count');
  const sourceTypes = getStringNote(notes, 'source_types')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const isGeneratedArticle = notes.some((note) => note === 'content_mode:daily_track_article' || note === 'content_mode:weekly_deep_dive');
  const isLongform = notes.includes('content_mode:longform_editorial') || contentLength >= 2600;
  const hasMultipleSources = sourceCount >= 3;
  const hasMixedSources = sourceTypes.length >= 2;

  let score = 0;
  if (isGeneratedArticle) score += 22;
  if (isLongform) score += 18;
  if (hasMultipleSources) score += Math.min(sourceCount * 4, 20);
  if (hasMixedSources) score += sourceTypes.length >= 3 ? 14 : 10;
  if (contentLength >= 4500) score += 10;
  if (contentLength > 0 && contentLength < 1200) score -= 28;
  if (!contentLength) score -= 40;

  return {
    score,
    isGeneratedArticle,
    isLongform,
    sourceCount,
    sourceTypes,
    track: getArticleTrack(item),
  };
}

function trackMatchScore(item: NewsItem, profile: RecommendationProfile) {
  const track = getArticleTrack(item);
  if (!track || !profile.tracks.length) return 0;
  return profile.tracks.includes(track) ? 24 : -8;
}

export function getArticleTrack(item: NewsItem): DailyArticleTrack | null {
  const notes = item.quality_notes ?? [];
  const notedTrack = getStringNote(notes, 'track');
  if (isDailyArticleTrack(notedTrack)) return notedTrack;
  if (item.content_type === 'deep_dive') return null;
  if (item.source === 'Seedup' && item.newsletter_section === 'paper_to_project') return '논문/리서치';
  if (item.newsletter_section === 'github_project_pick') return '오픈소스/GitHub';
  if (item.newsletter_section === 'ai_product_radar' || item.newsletter_section === 'build_idea') return '제품/빌드 아이디어';

  const text = [
    item.title,
    item.summary,
    item.category,
    item.newsletter_section,
    ...(item.topic_tags ?? []),
    ...(item.skill_tags ?? []),
    ...(item.related_roles ?? []),
    ...(item.target_interests ?? []),
  ].join(' ');
  const inferred = inferPreferredTracks([text])[0];
  return inferred ?? null;
}

function inferPreferredTracks(values: string[]) {
  const text = values.join(' ').toLowerCase();
  const tracks: DailyArticleTrack[] = [];
  if (/ai|llm|agent|rag|openai|gemini|claude|머신러닝|인공지능|데이터\/ml|ai\/llm/.test(text)) tracks.push('AI/LLM');
  if (/front|react|next|typescript|ui|ux|프론트|웹|앱 개발/.test(text)) tracks.push('프론트엔드');
  if (/back|api|server|node|spring|fastapi|postgres|database|db|supabase|docker|cloud|devops|aws|백엔드|서버|데이터베이스/.test(text)) tracks.push('백엔드');
  if (/startup|side|product|saas|maker|창업|사이드|제품|아이디어|포트폴리오|메이커|빌드/.test(text)) tracks.push('제품/빌드 아이디어');
  return TRACKS.filter((track) => tracks.includes(track));
}

function isDailyArticleTrack(value: string): value is DailyArticleTrack {
  return TRACKS.includes(value as DailyArticleTrack);
}

function getStringNote(notes: string[], key: string) {
  const prefix = `${key}:`;
  return notes.find((note) => note.startsWith(prefix))?.slice(prefix.length).trim() ?? '';
}

function getNumberNote(notes: string[], key: string) {
  const value = Number(getStringNote(notes, key));
  return Number.isFinite(value) ? value : 0;
}

function recommendationReasons(item: RecommendableArticle, profile: RecommendationProfile, text: string, scoreParts: { freshness: number; match: number; relevance: number; build: number }) {
  const reasons: string[] = [];
  if (scoreParts.freshness >= 28) reasons.push('최근 24~48시간 신호');
  if (scoreParts.match > 0) reasons.push('관심사와 일치');
  if (scoreParts.relevance >= 16) reasons.push('관련도 높은 콘텐츠');
  if (scoreParts.build > 0) reasons.push('프로젝트로 확장 가능');
  if (profile.levels.some((level) => text.includes(level))) reasons.push('선호 난이도와 맞음');

  return reasons.length ? reasons.slice(0, 3) : ['오늘 읽을 만한 후보'];
}

export function recommendNewsItems(items: NewsItem[], profile: RecommendationProfile, limit = 5): RecommendedItem<NewsItem>[] {
  return items
    .filter((item) => isRecommendableNewsItem(item))
    .map((item) => {
      const text = articleText(item);
      const freshness = freshnessScore(item);
      const match = profileMatchScore(text, profile);
      const relevance = Math.min(Number(item.relevance_score ?? 0) * 0.22, 22);
      const build = Math.max(
        item.project_idea ? 12 : item.related_skills?.length ? 6 : 0,
        Math.min(Number(item.project_connect_score ?? 0) * 0.12, 12),
        Math.min(Number(item.buildability_score ?? 0) * 0.1, 10),
      );
      const editorial = Math.min(Number(item.daily_rank_score ?? 0) * 0.28, 28);
      const quality = Math.min(Number(item.source_quality_score ?? 0) * 0.08 + Number(item.novelty_score ?? 0) * 0.08, 14);
      const popularity = Math.min(Number(item.view_count ?? 0) * 0.25 + Number(item.like_count ?? 0) * 2, 12) - Math.min(Number(item.dislike_count ?? 0) * 2, 8);
      const articleQuality = articleQualitySignals(item);
      const track = trackMatchScore(item, profile);
      const score = freshness + match + relevance + build + quality + editorial + popularity + articleQuality.score + track;
      const generatedReasons = [
        articleQuality.track ? `${articleQuality.track} 트랙` : null,
        articleQuality.sourceCount >= 3 ? `${articleQuality.sourceCount}개 소스 기반` : null,
        articleQuality.sourceTypes.length >= 2 ? '뉴스/제품/GitHub/논문 신호 종합' : null,
        articleQuality.isLongform ? '장문 전문가 해설' : null,
      ].filter(Boolean) as string[];

      return {
        item,
        score,
        reasons: generatedReasons.length
          ? generatedReasons.slice(0, 3)
          : item.recommendation_reasons?.length
          ? item.recommendation_reasons.slice(0, 3)
          : recommendationReasons(item, profile, text, { freshness, match, relevance, build }),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function isRecommendableNewsItem(item: NewsItem) {
  const contentLength = item.content?.trim().length ?? 0;
  if (contentLength === 0) return false;
  if (contentLength < 900 && item.source === 'Seedup') return false;

  const text = [
    item.title,
    item.summary,
    item.beginner_summary,
    item.content,
    ...(item.quality_notes ?? []),
  ].join(' ');

  if (/기반 미니 (데모|프로젝트) 만들기|논문 아이디어를 활용한 개발자 생산성 도구|arxiv:\d{4}\.\d+/i.test(text)) return false;
  return true;
}

export function recommendResearchPapers(items: ResearchPaper[], profile: RecommendationProfile, limit = 3): RecommendedItem<ResearchPaper>[] {
  return items
    .filter(isRecommendableResearchPaper)
    .map((item) => {
      const text = articleText(item);
      const freshness = freshnessScore(item);
      const match = profileMatchScore(text, profile);
      const relevance = Math.min(Number(item.relevance_score ?? 0) * 0.2, 20);
      const build = item.implementation_idea || item.service_idea || item.code_url ? 12 : 0;
      const depth = Math.min(Number(item.research_depth_score ?? 0) + Number(item.buildability_score ?? 0), 14);
      const engagement = Math.min(Number(item.like_count ?? 0) * 2, 8) - Math.min(Number(item.dislike_count ?? 0) * 2, 6);
      const score = freshness + match + relevance + build + depth + engagement;

      return {
        item,
        score,
        reasons: recommendationReasons(item, profile, text, { freshness, match, relevance, build }),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function isRecommendableResearchPaper(item: ResearchPaper) {
  const visible = [item.beginner_summary, item.expert_summary, item.why_it_matters, item.implementation_idea, item.service_idea].join('\n');
  const text = [item.title, item.abstract, visible, ...(item.categories ?? []), ...(item.related_skills ?? [])].join(' ').toLowerCase();
  if (/기반\s+미니\s+데모|논문 아이디어를 활용한|arxiv:\S+|announce type|abstract:/i.test(visible)) return false;
  if ((item.expert_summary?.length ?? 0) < 500 || (item.beginner_summary?.length ?? 0) < 160 || (item.why_it_matters?.length ?? 0) < 70) return false;
  const offDomain = /medical|clinical|medicine|patient|public health|healthcare|health question|disease|diagnosis|protein|genomics|molecule|drug discovery|biology/.test(text);
  if (offDomain && !/coding agent|software engineering|developer tool|code generation|api|sdk|cli|backend|frontend|database|devops|observability/.test(text)) return false;
  return Number(item.relevance_score ?? 0) >= 55;
}

export function recommendProjectIdeas(items: ProjectIdea[], profile: RecommendationProfile, limit = 3): RecommendedItem<ProjectIdea>[] {
  return items
    .map((item) => {
      const text = [
        item.title,
        item.description,
        item.level,
        item.related_trend,
        item.portfolio_value,
        ...(item.stack ?? []),
        ...(item.plan ?? []),
      ].join(' ').toLowerCase();
      const match = profileMatchScore(text, profile);
      const quick = Number(item.duration_days ?? 99) <= 7 ? 18 : 6;
      const level = profile.levels.some((token) => text.includes(token)) ? 12 : 0;
      const trend = item.related_trend ? 10 : 0;
      const engagement = Math.min(Number(item.like_count ?? 0) * 2, 8) - Math.min(Number(item.dislike_count ?? 0) * 2, 6);
      const score = match + quick + level + trend + engagement;
      const reasons = [
        quick >= 18 ? '7일 안에 시도 가능' : null,
        match > 0 ? '관심사와 연결' : null,
        level > 0 ? '선호 난이도와 맞음' : null,
        trend > 0 ? '트렌드 기반 아이디어' : null,
      ].filter(Boolean) as string[];

      return { item, score, reasons: reasons.length ? reasons.slice(0, 3) : ['오늘 도전할 만한 후보'] };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function recommendAIProducts(items: AIProduct[], profile: RecommendationProfile, limit = 4): RecommendedItem<AIProduct>[] {
  return items
    .map((item) => {
      const text = [
        item.name,
        item.category,
        item.description,
        item.target_user,
        ...(item.use_cases ?? []),
        ...(item.related_project_ideas ?? []),
      ].join(' ').toLowerCase();
      const match = profileMatchScore(text, profile);
      const productScore = Math.min(Number(item.score ?? 0) * 6, 36);
      const reviewSignal = Math.min(Number(item.rating_count ?? 0) * 2, 14);
      const project = item.related_project_ideas?.length ? 10 : 0;
      const engagement = Math.min(Number(item.like_count ?? 0) * 2, 8) - Math.min(Number(item.dislike_count ?? 0) * 2, 6);
      const score = match + productScore + reviewSignal + project + engagement;
      const reasons = [
        match > 0 ? '관심 카테고리와 일치' : null,
        productScore >= 24 ? '제품 점수 높음' : null,
        reviewSignal > 0 ? '사용자 반응 있음' : null,
        project > 0 ? '프로젝트에 활용 가능' : null,
      ].filter(Boolean) as string[];

      return { item, score, reasons: reasons.length ? reasons.slice(0, 3) : ['검토할 만한 AI 제품'] };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function recommendGitHubRepos(items: GitHubTrend[], profile: RecommendationProfile, limit = 3): RecommendedItem<GitHubTrend>[] {
  return items
    .filter(isRecommendableGitHubRepo)
    .map((item) => {
      const text = [
        item.repo_full_name,
        item.description,
        item.beginner_summary,
        item.language,
        item.project_idea,
        ...(item.topics ?? []),
      ].join(' ').toLowerCase();
      const match = profileMatchScore(text, profile);
      const popularity = Math.min(Math.log10(Number(item.stars ?? 0) + 1) * 10, 45);
      const relevance = Math.min(Number(item.relevance_score ?? 0) * 0.16, 16);
      const project = item.project_idea ? 10 : 0;
      const engagement = Math.min(Number(item.like_count ?? 0) * 2, 8) - Math.min(Number(item.dislike_count ?? 0) * 2, 6);
      const score = match + popularity + relevance + project + engagement;
      const reasons = [
        match > 0 ? '관심 기술과 일치' : null,
        popularity >= 25 ? 'GitHub 관심도 높음' : null,
        project > 0 ? '미니 프로젝트로 확장 가능' : null,
      ].filter(Boolean) as string[];

      return { item, score, reasons: reasons.length ? reasons.slice(0, 3) : ['살펴볼 만한 저장소'] };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function isRecommendableGitHubRepo(item: GitHubTrend) {
  const stars = Number(item.stars ?? 0);
  const text = [
    item.repo_full_name,
    item.description,
    item.short_summary,
    item.beginner_summary,
    item.project_idea,
    item.language,
    ...(item.topics ?? []),
  ].join(' ').toLowerCase();
  if (stars < 50) return false;
  if (/이 저장소를 활용하여|이 저장소처럼|핵심 기능 만들어보기/i.test(text)) return false;
  if (!/agent|llm|mcp|rag|vector|developer tool|devtool|cli|sdk|workflow|automation|ai coding|codegen|next|react|supabase|vercel ai/.test(text)) return false;
  return Number(item.relevance_score ?? 0) >= 60;
}

export function toNewsletterContentItems({
  news,
  products,
  repos,
  projects,
  papers,
}: {
  news: NewsItem[];
  products: AIProduct[];
  repos: GitHubTrend[];
  projects: ProjectIdea[];
  papers: ResearchPaper[];
}) {
  const items: NewsletterContentItem[] = [
    ...news
      .filter((item) => Number(item.relevance_score ?? 0) >= 60 && isRecommendableNewsItem(item))
      .map((item) => {
        const priority = Math.max(Number(item.daily_rank_score ?? 0), Number(item.relevance_score ?? 0), 55);
        const articleTrack = getArticleTrack(item);
        const metadata: RecommendationMetadata = {
          content_type: (item.content_type as ContentType | null) ?? 'news',
          newsletter_section: (item.newsletter_section as NewsletterSection | null) ?? (item.project_idea ? 'build_idea' : 'daily_briefing'),
          newsletter_priority: Number(item.newsletter_priority ?? priority),
          short_summary: item.short_summary ?? item.summary ?? item.beginner_summary ?? item.ai_summary ?? '오늘 확인할 만한 개발 뉴스입니다.',
          topic_tags: articleTrack ? [articleTrack, ...(item.topic_tags ?? [])] : item.topic_tags ?? [item.category ?? '개발 트렌드'],
          skill_tags: item.skill_tags ?? item.related_skills ?? [],
          intent_tags: item.intent_tags ?? (item.project_idea ? ['프로젝트 연결 가능'] : ['최신 기술 공부']),
          audience_tags: item.audience_tags ?? item.target_levels ?? [],
          related_roles: item.related_roles?.length ? item.related_roles : inferRoles([...item.target_interests ?? [], ...item.skill_tags ?? [], item.category ?? '']),
          target_levels: item.target_levels ?? ['초보자'],
          target_goals: item.target_goals ?? (item.project_idea ? ['포트폴리오 만들기'] : ['최신 기술 공부']),
          target_interests: item.target_interests ?? [item.category ?? '개발 트렌드'],
          learning_topics: item.learning_topics?.length ? item.learning_topics : item.related_skills ?? item.skill_tags ?? [],
          project_convertible: Boolean(item.project_convertible ?? item.project_idea) || Number(item.project_connect_score ?? 0) >= 65,
          personalization_hooks: item.personalization_hooks?.length ? item.personalization_hooks : item.recommendation_reasons ?? [],
          source_quality_score: Number(item.source_quality_score ?? 60),
          novelty_score: Number(item.novelty_score ?? 55),
          buildability_score: Number(item.buildability_score ?? (item.project_idea ? 70 : 45)),
          project_connect_score: Number(item.project_connect_score ?? (item.project_idea ? 70 : 45)),
          recommendation_reasons: item.recommendation_reasons ?? [],
          relevance_score: item.relevance_score,
        };

        return {
          id: `news:${item.id}`,
          title: item.title,
          href: `/news/${item.id}`,
          sourceLabel: item.source ?? 'News',
          publishedAt: item.published_at,
          metadata,
          raw: item,
        };
      }),
    ...products.map((item) => ({
      id: `product:${item.id}`,
      title: item.name,
      href: `/ai-products/${item.id}`,
      sourceLabel: 'AI Product',
      metadata: {
        content_type: 'ai_product',
        newsletter_section: (item.newsletter_section as NewsletterSection | null) ?? 'ai_product_radar',
        newsletter_priority: Number(item.newsletter_priority ?? Math.round(Number(item.score ?? 7) * 10)),
        short_summary: item.short_summary ?? item.description ?? item.target_user ?? '새로 확인할 만한 AI 제품입니다.',
        topic_tags: item.topic_tags?.length ? item.topic_tags : [item.category ?? 'AI 제품'],
        skill_tags: item.skill_tags?.length ? item.skill_tags : item.use_cases ?? [],
        intent_tags: item.intent_tags?.length ? item.intent_tags : item.related_project_ideas?.length ? ['프로젝트 연결 가능'] : ['제품 탐색'],
        audience_tags: item.audience_tags?.length ? item.audience_tags : [item.target_user ?? '개발자'],
        related_roles: item.related_roles?.length ? item.related_roles : inferRoles([item.category ?? '', item.target_user ?? '', ...(item.use_cases ?? [])]),
        target_levels: ['초보자', '중급자'],
        target_goals: item.related_project_ideas?.length ? ['사이드 프로젝트', '창업 아이디어 검증'] : ['최신 기술 공부'],
        target_interests: [item.category ?? 'AI 제품'],
        learning_topics: item.learning_topics?.length ? item.learning_topics : item.use_cases ?? [],
        project_convertible: Boolean(item.project_convertible ?? item.related_project_ideas?.length),
        personalization_hooks: item.personalization_hooks?.length ? item.personalization_hooks : item.related_project_ideas ?? [],
        source_quality_score: Number(item.source_quality_score ?? 68),
        novelty_score: Number(item.novelty_score ?? Math.round(Number(item.score ?? 7) * 10)),
        buildability_score: Number(item.buildability_score ?? (item.related_project_ideas?.length ? 72 : 48)),
        project_connect_score: Number(item.project_connect_score ?? (item.related_project_ideas?.length ? 72 : 48)),
        recommendation_reasons: item.recommendation_reasons?.length ? item.recommendation_reasons : item.related_project_ideas?.length ? ['제품을 프로젝트 아이디어로 확장 가능'] : ['새 AI 제품 탐색에 적합'],
        relevance_score: Math.round(Number(item.score ?? 7) * 10),
      },
      raw: item,
    } satisfies NewsletterContentItem)),
    ...repos
      .filter((item) => Number(item.relevance_score ?? 0) >= 55 && isRecommendableGitHubRepo(item))
      .map((item) => ({
        id: `repo:${item.id}`,
        title: item.repo_full_name,
        href: `/github-trends/${item.id}`,
        sourceLabel: 'GitHub',
        publishedAt: item.pushed_at,
        metadata: {
          content_type: (item.content_type as ContentType | null) ?? 'github_repo',
          newsletter_section: (item.newsletter_section as NewsletterSection | null) ?? 'github_project_pick',
          newsletter_priority: Number(item.newsletter_priority ?? Math.min(95, Math.round(Math.log10(Number(item.stars ?? 0) + 1) * 20))),
          short_summary: item.short_summary ?? item.beginner_summary ?? item.description ?? '프로젝트 참고 가치가 있는 오픈소스 저장소입니다.',
          topic_tags: item.topic_tags?.length ? item.topic_tags : item.topics ?? [],
          skill_tags: item.skill_tags?.length ? item.skill_tags : [item.language, ...(item.topics ?? [])].filter(Boolean) as string[],
          intent_tags: item.intent_tags?.length ? item.intent_tags : item.project_idea ? ['프로젝트 연결 가능', '포트폴리오 추천'] : ['오픈소스 학습'],
          audience_tags: item.audience_tags?.length ? item.audience_tags : ['개발자'],
          related_roles: item.related_roles?.length ? item.related_roles : inferRoles([item.language ?? '', ...(item.topics ?? [])]),
          target_levels: ['초보자', '중급자'],
          target_goals: item.project_idea ? ['포트폴리오 만들기'] : ['최신 기술 공부'],
          target_interests: item.topics ?? [item.language ?? '오픈소스'],
          learning_topics: item.learning_topics?.length ? item.learning_topics : [item.language, ...(item.topics ?? [])].filter(Boolean) as string[],
          project_convertible: Boolean(item.project_convertible ?? item.project_idea),
          personalization_hooks: item.personalization_hooks?.length ? item.personalization_hooks : item.project_idea ? [item.project_idea] : [],
          source_quality_score: Number(item.source_quality_score ?? 70),
          novelty_score: Number(item.novelty_score ?? 62),
          buildability_score: Number(item.buildability_score ?? (item.project_idea ? 74 : 58)),
          project_connect_score: Number(item.project_connect_score ?? (item.project_idea ? 76 : 55)),
          recommendation_reasons: item.recommendation_reasons?.length ? item.recommendation_reasons : item.project_idea ? ['미니 프로젝트로 확장 가능'] : ['오픈소스 학습에 적합'],
          relevance_score: item.relevance_score,
        },
        raw: item,
      } satisfies NewsletterContentItem)),
    ...projects.map((item) => ({
      id: `project:${item.id}`,
      title: item.title,
      href: `/projects/${item.id}`,
      sourceLabel: 'Build Idea',
      metadata: {
        content_type: 'build_idea',
        newsletter_section: 'build_idea',
        newsletter_priority: Number(item.duration_days ?? 14) <= 7 ? 78 : 62,
        short_summary: item.description ?? item.portfolio_value ?? '직접 만들어볼 만한 프로젝트 아이디어입니다.',
        topic_tags: [item.related_trend ?? '프로젝트'],
        skill_tags: item.stack ?? [],
        intent_tags: ['프로젝트 연결 가능', '포트폴리오 추천'],
        audience_tags: [item.level ?? '초보자'],
        related_roles: inferRoles([item.related_trend ?? '', ...(item.stack ?? [])]),
        target_levels: [item.level ?? '초보자'],
        target_goals: ['포트폴리오 만들기', '사이드 프로젝트'],
        target_interests: [item.related_trend ?? '프로젝트'],
        learning_topics: item.stack ?? [],
        project_convertible: true,
        personalization_hooks: [item.portfolio_value ?? '프로젝트로 바로 실행할 수 있습니다.'],
        source_quality_score: 64,
        novelty_score: 55,
        buildability_score: Number(item.duration_days ?? 14) <= 7 ? 82 : 68,
        project_connect_score: 86,
        recommendation_reasons: ['실제로 만들어볼 수 있는 실행 아이디어'],
        relevance_score: 72,
      },
      raw: item,
    } satisfies NewsletterContentItem)),
    ...papers
      .filter((item) => Number(item.relevance_score ?? 0) >= 55 && isRecommendableResearchPaper(item))
      .map((item) => ({
        id: `paper:${item.id}`,
        title: item.title,
        href: `/papers/${item.id}`,
        sourceLabel: 'Paper',
        publishedAt: item.published_at,
        metadata: {
          content_type: 'paper',
          newsletter_section: item.implementation_idea || item.service_idea ? 'paper_to_project' : 'deep_dive',
          newsletter_priority: Number(item.trend_score ?? item.relevance_score ?? 60),
          short_summary: item.beginner_summary ?? item.expert_summary ?? item.abstract ?? '프로젝트 아이디어로 연결할 만한 논문입니다.',
          topic_tags: item.categories ?? [],
          skill_tags: item.related_skills ?? item.categories ?? [],
          intent_tags: item.implementation_idea ? ['프로젝트 연결 가능'] : ['심화 학습'],
          audience_tags: [item.difficulty ?? item.target_reader ?? '개발자'],
          related_roles: inferRoles([...(item.related_skills ?? []), ...(item.categories ?? [])]),
          target_levels: item.target_levels ?? ['중급자'],
          target_goals: item.target_goals ?? ['최신 기술 공부'],
          target_interests: item.target_interests ?? ['논문 쉽게 읽기'],
          learning_topics: item.related_skills ?? item.categories ?? [],
          project_convertible: Boolean(item.implementation_idea || item.service_idea || item.code_url),
          personalization_hooks: [item.why_it_matters ?? '심화 학습에 적합합니다.'],
          source_quality_score: 72,
          novelty_score: Number(item.trend_score ?? 65),
          buildability_score: Number(item.buildability_score ?? 60),
          project_connect_score: item.implementation_idea || item.service_idea ? 76 : 50,
          recommendation_reasons: item.implementation_idea ? ['논문을 구현 아이디어로 연결 가능'] : ['심화 학습에 적합'],
          relevance_score: item.relevance_score,
        },
        raw: item,
      } satisfies NewsletterContentItem)),
  ];

  return dedupeNewsletterItems(items);
}

export function scoreNewsletterItems(items: NewsletterContentItem[], profile: UserNewsletterProfile): ScoredNewsletterItem[] {
  return items
    .map((content) => {
      const score = scoreContentForProfile(content.metadata, profile);
      const reasons = buildNewsletterReasons(content.metadata, profile);
      return { content, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}

export function pickNewsletterSections(scoredItems: ScoredNewsletterItem[]) {
  return {
    dailyBriefing: pickTopBySection(scoredItems, 'daily_briefing', 3),
    productRadar: pickTopBySection(scoredItems, 'ai_product_radar', 1),
    githubPick: pickTopBySection(scoredItems, 'github_project_pick', 1),
    buildIdea: pickTopBySection(scoredItems, 'build_idea', 1),
    careerTip: pickTopBySection(scoredItems, 'career_tip', 1),
    deepDive: pickTopBySection(scoredItems, 'deep_dive', 1),
    paperToProject: pickTopBySection(scoredItems, 'paper_to_project', 1),
  };
}

function pickTopBySection(scoredItems: ScoredNewsletterItem[], section: NewsletterSection, limit: number) {
  return scoredItems.filter(({ content }) => content.metadata.newsletter_section === section).slice(0, limit);
}

function buildNewsletterReasons(content: RecommendationMetadata, profile: UserNewsletterProfile) {
  const reasons = [
    fuzzyOverlap(content.topic_tags, profile.interests) > 0 ? `${profile.interests.slice(0, 2).join(', ')} 관심사와 맞습니다.` : null,
    fuzzyOverlap(content.skill_tags, profile.preferred_stack) > 0 ? `${profile.preferred_stack.slice(0, 2).join(', ')} 스택 학습에 연결됩니다.` : null,
    fuzzyOverlap(content.target_goals, profile.goals) > 0 ? `${profile.goals[0]} 목표에 적합합니다.` : null,
    overlap(content.related_roles, profile.preferred_roles) > 0 ? '선호 직무와 연결됩니다.' : null,
    content.project_convertible ? '프로젝트나 포트폴리오로 확장할 수 있습니다.' : null,
    content.recommendation_reasons[0] ?? content.personalization_hooks[0] ?? null,
  ].filter(Boolean) as string[];

  return reasons.length ? Array.from(new Set(reasons)).slice(0, 3) : ['프로필 기준으로 읽어볼 만한 콘텐츠입니다.'];
}

function dedupeNewsletterItems(items: NewsletterContentItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const raw = item.raw as Partial<NewsItem> & Partial<ResearchPaper> & Partial<GitHubTrend> & Partial<AIProduct>;
    const key = normalize(raw.original_url ?? raw.source_url ?? raw.repo_url ?? raw.website_url ?? item.title);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferRoles(values: string[]) {
  const text = values.join(' ').toLowerCase();
  const roles = new Set<string>();
  if (/front|react|next|ui|ux|프론트|디자인/.test(text)) roles.add('frontend_developer');
  if (/back|api|db|database|server|node|postgres|supabase|백엔드/.test(text)) roles.add('backend_developer');
  if (/ai|llm|agent|openrouter|model|rag|머신러닝|인공지능/.test(text)) roles.add('ai_builder');
  if (/startup|product|saas|창업|제품|사이드/.test(text)) roles.add('startup_builder');
  if (!roles.size) roles.add('developer');
  return [...roles];
}
