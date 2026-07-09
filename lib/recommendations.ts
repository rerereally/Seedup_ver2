import type { AIProduct, GitHubTrend, NewsItem, ProjectIdea, ResearchPaper, ScrapItem } from '@/lib/data';

export type RecommendationProfile = {
  tokens: string[];
  levels: string[];
  goals: string[];
  interests: string[];
};

export type RecommendedItem<T> = {
  item: T;
  score: number;
  reasons: string[];
};

type RecommendableArticle = NewsItem | ResearchPaper;

function normalize(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function unique(values: string[]) {
  return Array.from(new Set(values.map(normalize).filter(Boolean)));
}

export function buildRecommendationProfile(answers: Record<string, unknown> | null | undefined, extraTokens: string[] = []): RecommendationProfile {
  const values = Object.values(answers ?? {}).flatMap((value) => Array.isArray(value) ? value : [value]);
  const tokens = unique([...values.map(String), ...extraTokens]);

  return {
    tokens,
    levels: tokens.filter((token) => ['beginner', 'intermediate', 'advanced', '초급', '중급', '고급'].includes(token)),
    goals: tokens.filter((token) => ['portfolio', 'project', 'startup', 'career', '포트폴리오', '프로젝트', '창업', '커리어'].includes(token)),
    interests: tokens.filter((token) => !['beginner', 'intermediate', 'advanced', '초급', '중급', '고급'].includes(token)),
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
    ...(paper.related_skills ?? []),
    ...(news.target_levels ?? []),
    ...(paper.target_levels ?? []),
    ...(news.target_goals ?? []),
    ...(paper.target_goals ?? []),
    ...(news.target_interests ?? []),
    ...(paper.target_interests ?? []),
    ...(paper.categories ?? []),
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
    .map((item) => {
      const text = articleText(item);
      const freshness = freshnessScore(item);
      const match = profileMatchScore(text, profile);
      const relevance = Math.min(Number(item.relevance_score ?? 0) * 0.22, 22);
      const build = item.project_idea ? 12 : item.related_skills?.length ? 6 : 0;
      const popularity = Math.min(Number(item.view_count ?? 0) * 0.25 + Number(item.like_count ?? 0) * 2, 12);
      const score = freshness + match + relevance + build + popularity;

      return {
        item,
        score,
        reasons: recommendationReasons(item, profile, text, { freshness, match, relevance, build }),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export function recommendResearchPapers(items: ResearchPaper[], profile: RecommendationProfile, limit = 3): RecommendedItem<ResearchPaper>[] {
  return items
    .map((item) => {
      const text = articleText(item);
      const freshness = freshnessScore(item);
      const match = profileMatchScore(text, profile);
      const relevance = Math.min(Number(item.relevance_score ?? 0) * 0.2, 20);
      const build = item.implementation_idea || item.service_idea || item.code_url ? 12 : 0;
      const depth = Math.min(Number(item.research_depth_score ?? 0) + Number(item.buildability_score ?? 0), 14);
      const score = freshness + match + relevance + build + depth;

      return {
        item,
        score,
        reasons: recommendationReasons(item, profile, text, { freshness, match, relevance, build }),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
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
      const score = match + quick + level + trend;
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
      const score = match + productScore + reviewSignal + project;
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
      const score = match + popularity + relevance + project;
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
