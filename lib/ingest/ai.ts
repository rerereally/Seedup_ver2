import { fallbackSummary, truncate } from './text';
import type { ContentType, NewsletterSection } from '@/lib/recommendations';

export type NewsAnalysis = {
  translated_title: string;
  content_type: ContentType;
  newsletter_section: NewsletterSection;
  newsletter_priority: number;
  category: string;
  relevance_score: number;
  short_summary: string;
  ai_summary: string;
  article_markdown?: string;
  beginner_summary: string;
  why_it_matters: string;
  key_points: string[];
  related_skills: string[];
  project_idea: string;
  difficulty: string;
  target_levels: string[];
  target_goals: string[];
  target_interests: string[];
  content_depth: string;
  topic_tags: string[];
  skill_tags: string[];
  intent_tags: string[];
  audience_tags: string[];
  related_roles: string[];
  learning_topics: string[];
  project_convertible: boolean;
  personalization_hooks: string[];
  source_quality_score: number;
  novelty_score: number;
  buildability_score: number;
  project_connect_score: number;
  recommendation_reasons: string[];
};

export type RepoAnalysis = {
  relevance_score: number;
  ai_review: string;
  beginner_summary: string;
  project_idea: string;
};

export type ProductAnalysis = {
  category: string;
  description: string;
  score: number;
  status: string;
  use_cases: string[];
  pricing_type: string;
  target_user: string;
  related_project_ideas: string[];
};

export type GeneratedProjectIdea = {
  title: string;
  description: string;
  level: string;
  duration_days: number;
  stack: string[];
  related_trend: string;
  target_user_level: string;
  recommended_for: string[];
  portfolio_value: string;
  plan: string[];
  duration_estimate?: ProjectDurationEstimate;
  scope?: ProjectScope;
  build_plan?: BuildPlanStep[];
  prerequisites?: string[];
  difficulty_reasons?: string[];
  mvp_acceptance?: string;
  expansion_ideas?: string[];
  stack_details?: ProjectStackDetail[];
  project_constraints?: ProjectConstraints;
  technical_limitations?: string[];
  assumptions?: string[];
  excluded_scope?: string[];
  complexity_reasons?: string[];
  schedule_reasoning?: string;
  validation_metrics?: ProjectValidationMetric[];
};

export type ProjectDurationEstimate = {
  recommended_days: number;
  minimum_days: number;
  maximum_days: number;
  estimated_hours_min: number;
  estimated_hours_max: number;
  assumed_hours_per_day: number;
  reasoning: string;
};

export type ProjectScope = {
  must_have: string[];
  should_have: string[];
  excluded: string[];
};

export type BuildPlanStep = {
  order: number;
  title: string;
  objective: string;
  tasks: string[];
  tools: string[];
  deliverable: string;
  done_when: string;
  estimated_hours_min: number;
  estimated_hours_max: number;
  dependencies?: number[];
  acceptance_criteria?: string[];
  risks?: string[];
};

export type ProjectConstraints = {
  target_level: 'beginner' | 'intermediate' | 'advanced';
  duration_days_min: number;
  duration_days_max: number;
  estimated_hours_min: number;
  estimated_hours_max: number;
  primary_language: string;
  core_feature_count: number;
  integration_count: number;
  excluded_features: string[];
};

export type ProjectValidationMetric = {
  metric: string;
  target: string;
  method: string;
};

export type ProjectStackDetail = {
  name: string;
  category: 'core' | 'optional' | 'alternative' | 'scale';
  reason: string;
};

export type GeneratedArticleDraft = {
  title: string;
  summary: string;
  content_markdown: string;
  category: string;
  content_type: ContentType;
  newsletter_section: NewsletterSection;
  newsletter_priority: number;
  tags: string[];
  related_skills: string[];
  project_idea: string;
  why_it_matters: string;
  key_points: string[];
  difficulty: string;
  target_levels: string[];
  target_goals: string[];
  target_interests: string[];
  referenced_tools: string[];
  source_links: string[];
  editorial_angle: string;
  core_claims?: ArticleCoreClaim[];
  technical_limitations?: string[];
  assumptions?: string[];
  mvp_scope?: string[];
  excluded_scope?: string[];
  measurable_acceptance_criteria?: string[];
  evidence?: ArticleEvidence;
  link_warnings?: string[];
};

export type ArticleCoreClaim = {
  claim: string;
  evidence_type: 'source' | 'general_knowledge' | 'inference';
  source_urls: string[];
  confidence: 'low' | 'medium' | 'high';
};

export type ArticleEvidence = {
  source_count: number;
  source_type_count: number;
  direct_metric_count: number;
  has_primary_source: boolean;
  confidence: 'low' | 'medium' | 'high';
  limitations: string[];
};

export type ArticleSourceBundleItem = {
  title: string;
  source_type: string;
  source_role: 'primary' | 'independent' | 'supporting' | 'context';
  url?: string | null;
  summary: string;
};

export type ScoreBreakdown = {
  feasibility?: number;
  differentiation?: number;
  market?: number;
  portfolio?: number;
  mvp_clarity?: number;
};

export type EvaluationConfidence = {
  level: 'high' | 'medium' | 'low';
  reason: string;
};

export type EvaluationScoreReason = {
  positive: string[];
  deductions: string[];
  evidence: string[];
};

export type EvaluationMvpScope = {
  team_size: string;
  duration_weeks: number;
  core_user_flow: string;
  excluded_scope: string[];
};

export type EvaluationEvidence = {
  type: 'news' | 'paper' | 'github' | 'product' | 'other';
  title: string;
  source?: string;
  url?: string;
  published_at?: string;
  relevance: string;
};

export type RecommendedTechnology = {
  name: string;
  category: 'required' | 'optional' | 'scale';
  reason: string;
};

export type EvaluationRisk = {
  title: string;
  severity: 'high' | 'medium' | 'low';
  impact: string;
  mitigation: string;
};

export type EvaluationNextStep = {
  order: number;
  title: string;
  description: string;
  deliverable: string;
  done_when: string;
};

export type IdeaEvaluation = {
  score: number;
  verdict: string;
  portfolio_value: string;
  difficulty: string;
  market_fit: string;
  recommended_stack: string[];
  risks: string[];
  next_steps: string[];
  score_breakdown?: ScoreBreakdown;
  strengths?: string[];
  weaknesses?: string[];
  recommended_technologies?: RecommendedTechnology[];
  structured_risks?: EvaluationRisk[];
  structured_next_steps?: EvaluationNextStep[];
  confidence?: EvaluationConfidence;
  evidence?: EvaluationEvidence[];
  missing_data?: string[];
  user_stated?: string[];
  inferred_assumptions?: string[];
  mvp_scope?: EvaluationMvpScope;
  score_reasons?: Partial<Record<keyof ScoreBreakdown, EvaluationScoreReason>>;
};

export type ArticleQuestionAnswer = {
  answer: string;
};

export type PaperAnalysis = {
  relevance_score: number;
  review_type: string;
  beginner_summary: string;
  expert_summary: string;
  why_it_matters: string;
  key_points: string[];
  related_skills: string[];
  implementation_idea: string;
  service_idea: string;
  difficulty: string;
  target_reader: string;
  trend_score: number;
  buildability_score: number;
  beginner_score: number;
  business_score: number;
  research_depth_score: number;
  target_levels: string[];
  target_goals: string[];
  target_interests: string[];
  content_depth: string;
};

export type PaperAnalysisResult = {
  analysis: PaperAnalysis;
  model: string | null;
  ok: boolean;
  qualityReason?: string;
};

const DEFAULT_MODEL = 'anthropic/claude-sonnet-5';
const FALLBACK_MODEL = 'anthropic/claude-sonnet-5';
const OPENROUTER_TIMEOUT_MS = Number(process.env.OPENROUTER_TIMEOUT_MS ?? 45_000);
const ARTICLE_OPENROUTER_TIMEOUT_MS = Number(process.env.OPENROUTER_ARTICLE_TIMEOUT_MS ?? 75_000);
const MODEL_ROUTES = {
  preprocess: ['google/gemini-3.5-flash'],
  writing: ['anthropic/claude-sonnet-5'],
};

const REPO_ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['relevance_score', 'ai_review', 'beginner_summary', 'project_idea'],
  properties: {
    relevance_score: { type: 'number', minimum: 0, maximum: 100 },
    ai_review: { type: 'string', maxLength: 500 },
    beginner_summary: { type: 'string', maxLength: 400 },
    project_idea: { type: 'string', maxLength: 500 },
  },
} as const;

export async function analyzeNews(input: { title: string; content: string; source: string; sourceLanguage?: string }) {
  const fallback = buildFallbackNewsAnalysis(input.title, input.content);
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { analysis: fallback, model: null };

  try {
    const { result, model } = await callOpenRouter<NewsAnalysis>(apiKey, [
      {
        role: 'system',
        content: '너는 개인 맞춤 개발 뉴스레터를 위한 콘텐츠 전처리 엔진이다. 영어/한국어 원문을 한국어 추천 메타데이터로 구조화한다. 반드시 JSON만 반환한다. 원문에 없는 수치, 인용, 사실은 만들지 않는다.',
      },
      {
        role: 'user',
        content: `아래 뉴스가 개발, 코딩, AI 제품, 개발 트렌드, 개발자 도구와 관련 있는지 판단하고 한국어 JSON으로 분석하라.

목표:
- 원문을 긴 글로 재작성하지 않는다.
- 뉴스레터 추천과 개인화 매칭에 필요한 구조화 데이터를 만든다.
- 개발 관련성, 직무, 수준, 목표, 태그, 프로젝트 연결 가능성을 판단한다.

규칙:
- 원문 언어가 영어이거나 제목/본문에 영어가 섞여 있으면 제목과 모든 설명을 자연스러운 한국어로 번역한다.
- translated_title은 반드시 한국어 기사 제목이어야 한다. 영어 원문 제목을 그대로 복사하지 않는다.
- short_summary, ai_summary, beginner_summary, why_it_matters, key_points, project_idea, tags는 모두 한국어로 작성한다. 고유명사, 제품명, 프레임워크명만 원문 표기를 유지할 수 있다.
- article_markdown은 기본적으로 빈 문자열로 둔다. 긴 글 작성은 별도 writing 단계에서만 한다.
- 초보 개발자가 이해할 수 있도록 용어를 풀어쓴다.
- 확실하지 않은 내용은 단정하지 말고 "원문 기준으로는"처럼 표현한다.
- 광고 문구, 구독 유도 문구, 저작권 문구, 메뉴 텍스트는 요약에 포함하지 않는다.
- topic_tags는 5개 이하, skill_tags는 5개 이하, intent_tags는 3개 이하, audience_tags는 3개 이하로 제한한다.
- related_roles는 frontend_developer, backend_developer, ai_builder, startup_builder, developer 중에서 고른다.
- newsletter_priority는 뉴스레터에 넣을 우선순위이며 0~100 정수다.
	
	출력 JSON 스키마:
	{
  "translated_title": "한국어 기사 제목",
  "content_type": "news",
  "newsletter_section": "daily_briefing | ai_product_radar | github_project_pick | build_idea | career_tip | deep_dive | paper_to_project",
  "newsletter_priority": 0,
  "category": "AI Agent | Frontend | Backend | DevTools | Product | Trend | Paper | Career | Other",
  "relevance_score": 0,
  "short_summary": "뉴스레터에 넣을 2~3문장 요약",
  "ai_summary": "전문가용 2~3문장 요약",
  "article_markdown": "",
  "beginner_summary": "초보자용 쉬운 설명",
  "why_it_matters": "왜 중요한지",
  "key_points": ["핵심 1", "핵심 2", "핵심 3"],
  "related_skills": ["기술 1", "기술 2"],
  "project_idea": "작게 만들 수 있는 프로젝트",
  "difficulty": "초급 | 중급 | 고급",
  "target_levels": ["완전 처음 | 입문자 | 초보자 | 중급자 | 실무 경험 있음"],
	  "target_goals": ["포트폴리오 만들기 | 취업/이직 준비 | 사이드 프로젝트 | 창업 아이디어 검증 | 최신 기술 공부 | 팀 프로젝트 주제 찾기"],
	  "target_interests": ["프론트엔드 | 백엔드 | 풀스택 | AI/API 연동 | 데이터/DB | 모바일 | 디자인/UI | DevOps/배포 | 오픈소스 | 논문 쉽게 읽기"],
	  "content_depth": "짧고 쉽게 | 핵심과 예시 중심 | 기술 배경까지 자세히 | 실무 적용 관점으로 깊게",
	  "topic_tags": ["AI", "Open Source"],
	  "skill_tags": ["Next.js", "Supabase"],
	  "intent_tags": ["프로젝트 연결 가능", "초보자 추천"],
	  "audience_tags": ["초급", "포트폴리오 준비"],
	  "related_roles": ["frontend_developer", "ai_builder"],
	  "learning_topics": ["API 호출", "Tool Calling"],
	  "project_convertible": true,
	  "source_quality_score": 0,
	  "novelty_score": 0,
	  "buildability_score": 0,
	  "project_connect_score": 0,
	  "recommendation_reasons": ["최근 신호", "프로젝트로 확장 가능"],
	  "personalization_hooks": ["AI 앱 개발에 관심 있는 사용자에게 적합"]
	}

source: ${input.source}
source_language: ${input.sourceLanguage ?? 'unknown'}
title: ${input.title}
content: ${truncate(input.content, 5200)}`,
      },
    ], { models: MODEL_ROUTES.preprocess, jsonMode: true });

    return { analysis: normalizeNewsAnalysis(result, fallback), model };
  } catch (error) {
    console.error('OpenRouter news analysis failed', error);
    return { analysis: fallback, model: null };
  }
}

export async function analyzeRepo(input: { fullName: string; description: string | null; language: string | null; topics: string[] }) {
  const fallback = buildFallbackRepoAnalysis(input);
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { analysis: fallback, model: null };

  try {
    const { result, model } = await callOpenRouter<RepoAnalysis>(apiKey, [
      { role: 'system', content: '너는 Seedup의 오픈소스 큐레이터다. GitHub 저장소를 개발자 뉴스레터에 실을 가치가 있는지 엄격하게 판단한다. 반드시 JSON만 반환한다. 마크다운, 코드블록, 설명문, 따옴표가 깨질 수 있는 긴 문장은 금지한다.' },
      {
        role: 'user',
        content: `이 GitHub 저장소를 Seedup에 저장할지 평가하고 한국어로 리뷰하라.

Seedup에 맞는 저장소:
- AI agent, MCP, RAG, AI coding, developer tool, CLI/SDK, 앱 개발 생산성, 실전 템플릿/프레임워크와 관련 있어야 한다.
- 단순 awesome list, 알고리즘 풀이, 일반 언어/프레임워크 예제, 설명이 빈약한 저장소는 relevance_score를 40 이하로 준다.
- "이 저장소를 활용하여" 같은 일반 표현 금지. 실제 무엇을 만들 수 있는지 구체적으로 쓴다.
- 모든 설명은 한국어로 쓴다. 프로젝트명/기술명만 원문을 유지한다.

출력 JSON:
{
  "relevance_score": 0,
  "ai_review": "무엇을 하는 프로젝트인지와 왜 지금 볼 가치가 있는지 2~4문장. 500자 이하.",
  "beginner_summary": "초보자용 쉬운 설명 2문장 이하. 400자 이하.",
  "project_idea": "이 저장소에서 참고할 수 있는 구체적인 작은 프로젝트 1개. 500자 이하."
}

추가 규칙:
- JSON 외 텍스트 금지.
- 코드블록 금지.
- 줄바꿈이 많은 긴 문단 금지.
- relevance_score는 0~100 숫자.
- 저장소 설명이 부족하거나 Seedup 주제와 맞지 않으면 relevance_score를 40 이하로 준다.

repo: ${input.fullName}
description: ${input.description ?? ''}
language: ${input.language ?? ''}
topics: ${input.topics.join(', ')}`,
      },
    ], {
      models: MODEL_ROUTES.preprocess,
      maxTokens: 1200,
      jsonMode: true,
      jsonSchema: {
        name: 'repo_analysis',
        schema: REPO_ANALYSIS_JSON_SCHEMA,
      },
    });

    return { analysis: normalizeRepoAnalysis(result, fallback), model };
  } catch (error) {
    console.error('OpenRouter repo analysis failed', error);
    return { analysis: fallback, model: null, fallback: true };
  }
}

export async function analyzeProduct(input: { name: string; content: string; url: string | null }) {
  const fallback: ProductAnalysis = {
    category: 'AI Product',
    description: fallbackSummary(input.name, input.content),
    score: 7.5,
    status: 'New',
    use_cases: ['생산성 향상', '업무 자동화'],
    pricing_type: 'Unknown',
    target_user: '개발자와 초기 제품 빌더',
    related_project_ideas: [input.name + ' 참고 미니 SaaS 만들기'],
  };
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { analysis: fallback, model: null };

  try {
    const { result, model } = await callOpenRouter<ProductAnalysis>(apiKey, [
      { role: 'system', content: '너는 AI 제품 분석가다. Product Hunt 제품을 초보 개발자와 제품 빌더 관점에서 분석한다. 반드시 JSON만 반환한다.' },
      {
        role: 'user',
        content: `아래 제품을 분석하라.

출력 JSON:
{
  "category": "AI Search | AI Coding | Productivity | Design | DevTools | Automation | Other",
  "description": "한국어 한두 문장 설명",
  "score": 0,
  "status": "Hot | Rising | New | Watch",
  "use_cases": ["활용 사례"],
  "pricing_type": "Free | Freemium | Paid | Unknown",
  "target_user": "주요 사용자",
  "related_project_ideas": ["이 제품을 참고해 만들 수 있는 프로젝트"]
}

name: ${input.name}
url: ${input.url ?? ''}
content: ${truncate(input.content, 2500)}`,
      },
    ], { models: MODEL_ROUTES.preprocess });

    return { analysis: { ...fallback, ...result }, model };
  } catch (error) {
    console.error('OpenRouter product analysis failed', error);
    return { analysis: fallback, model: null };
  }
}

export async function analyzePaper(input: {
  title: string;
  abstract: string;
  authors: string[];
  categories: string[];
  source: string;
  hasCode: boolean;
}): Promise<PaperAnalysisResult> {
  const fallback = buildFallbackPaperAnalysis(input);
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { analysis: fallback, model: null, ok: false, qualityReason: 'missing_api_key' };

  try {
    const { result, model } = await callOpenRouter<PaperAnalysis>(apiKey, [
      { role: 'system', content: '너는 Seedup의 시니어 AI/개발 리서치 에디터다. 논문을 단순 요약하지 않고, 개발자와 제품 빌더가 읽을 만한 견해와 판단이 있는 한국어 미니 아티클로 바꾼다. 반드시 JSON만 반환한다.' },
      {
        role: 'user',
        content: `아래 논문을 Seedup 자체 콘텐츠로 리뷰하라. 결과는 "요약문"이 아니라 전문가가 쓴 짧은 논문 해설/오피니언이어야 한다.

Seedup에 맞는 관점:
- 초보/중급 개발자가 AI 앱, 개발자 도구, 자동화, 오픈소스, 포트폴리오 프로젝트로 연결할 수 있어야 한다.
- 순수 이론/비개발 도메인은 개발자가 만들 수 있는 구현 포인트가 명확할 때만 다룬다.
- 모든 필드는 한국어로 쓴다. 논문 제목과 고유명사만 영어를 유지할 수 있다.
- arXiv 메타 텍스트나 Abstract 원문을 그대로 복사하지 않는다.
- 영어 abstract 문장을 그대로 번역투로 붙이지 말고, "이 논문이 어떤 흐름에서 중요한지", "실제로 만들면 어디가 어려운지", "무엇을 과장하면 안 되는지"를 포함한다.
- implementation_idea는 제목 일부를 붙인 표현 금지. 실제로 만들 수 있는 구체적인 도구/대시보드/검증 앱 이름으로 쓴다.
- service_idea는 "논문 아이디어를 활용한..." 같은 일반 문구 금지. 누가 왜 쓸지 드러나는 제품 아이디어로 쓴다.
- beginner_summary는 250~500자 분량으로, 초보 개발자가 이 논문의 문제의식을 이해할 수 있게 쓴다.
- expert_summary는 700~1200자 분량으로, 실무자가 읽는 논문 리뷰처럼 문제 배경, 접근법, 장점, 한계, 서비스 적용 판단을 모두 포함한다.
- why_it_matters는 2~4문장으로, 지금 Seedup 독자가 시간을 써서 읽을 이유를 구체적으로 쓴다.
- key_points는 제목 복사 금지. 논문에서 가져갈 판단/인사이트 3~5개를 한국어로 쓴다.
- 품질이 낮거나 Seedup과 맞지 않으면 relevance_score를 30 이하로 낮게 준다.

출력 JSON:
{
  "relevance_score": 0,
  "review_type": "오늘 볼만한 논문 | 이번 주 집중해야 할 논문 | 코드가 공개된 논문 | 서비스 아이디어로 연결 가능한 논문 | 초보 개발자도 이해할 만한 논문 | 연구자용 고난도 논문",
  "beginner_summary": "초보자용 쉬운 설명 250~500자",
  "expert_summary": "실무자용 논문 리뷰 700~1200자",
  "why_it_matters": "왜 지금 봐야 하는지 2~4문장",
  "key_points": ["핵심 1", "핵심 2", "핵심 3"],
  "related_skills": ["기술"],
  "implementation_idea": "작게 구현할 수 있는 프로젝트",
  "service_idea": "서비스 아이디어",
  "difficulty": "초급 | 중급 | 고급 | 연구자",
  "target_reader": "추천 독자",
  "trend_score": 0,
  "buildability_score": 0,
  "beginner_score": 0,
  "business_score": 0,
  "research_depth_score": 0,
  "target_levels": ["입문자 | 초보자 | 중급자 | 실무 경험 있음"],
  "target_goals": ["최신 기술 공부 | 포트폴리오 만들기 | 창업 아이디어 검증 | 사이드 프로젝트"],
  "target_interests": ["AI/API 연동 | 논문 쉽게 읽기 | 오픈소스 | 데이터/DB | 개발자 도구"],
  "content_depth": "핵심과 예시 중심 | 기술 배경까지 자세히 | 실무 적용 관점으로 깊게"
}

source: ${input.source}
title: ${input.title}
authors: ${input.authors.join(', ')}
categories: ${input.categories.join(', ')}
has_code: ${input.hasCode}
abstract: ${truncate(input.abstract, 5000)}`,
      },
    ], { models: MODEL_ROUTES.preprocess, jsonMode: true, maxTokens: 6500 });

    const analysis = normalizePaperAnalysis(result, fallback);
    const quality = validatePaperAnalysisQuality(analysis, input);
    return { analysis, model, ok: quality.ok, qualityReason: quality.reason };
  } catch (error) {
    console.error('OpenRouter paper analysis failed', error);
    return { analysis: fallback, model: null, ok: false, qualityReason: 'ai_generation_failed' };
  }
}

export async function generateProjectIdea(input: {
  title: string;
  sourceType: string;
  summary: string;
  trend?: string | null;
  skills?: string[];
}) {
  const estimate = estimateProjectComplexity(input);
  const fallbackDesc = `## 이 프로젝트는 무엇인가요?

${truncate(input.summary, 200)}

## 어떤 문제를 해결하나요?

개발자들이 최신 트렌드를 빠르게 파악하고 실제 결과물로 연결하는 과정에서 겪는 막막함을 해소합니다. 작은 기능부터 시작해 배포까지 경험할 수 있습니다.

## 핵심 기능

- 한 가지 입력을 받아 결과를 만드는 대표 사용자 흐름
- 결과를 다시 확인할 수 있는 최소 저장 또는 화면
- 외부 API 한 곳과 연결하는 보조 기능

## 왜 만들어볼 만한가요?

이 프로젝트는 단순한 클론 코딩이 아니라 실제 문제를 정의하고 해결하는 과정을 담습니다. 포트폴리오에 올릴 때 "왜 만들었는지"를 설명할 수 있어 면접에서도 강점이 됩니다.

## 이 프로젝트로 배울 수 있는 것

- Next.js와 Supabase를 연결하는 풀스택 흐름
- 외부 API를 fetch로 호출하고 데이터를 화면에 표시하는 방법
- Vercel을 통한 자동 배포와 도메인 연결 경험

## 기술적 한계와 제외 범위

초기 MVP는 외부 API 한 곳과 대표 사용자 흐름만 검증합니다. 결제, 팀 권한, 실시간 협업, 고급 운영 분석은 이후 확장 단계에서 검토합니다.`;

  const fallback: GeneratedProjectIdea = {
    title: `${input.title}로 시작하는 실전 미니 프로젝트`,
    description: fallbackDesc,
    level: '초급',
    duration_days: estimate.recommended_days,
    stack: input.skills?.length ? input.skills.slice(0, 5) : ['Next.js', 'Supabase', 'TypeScript'],
    related_trend: input.trend ?? input.title,
    target_user_level: 'beginner-builder',
    recommended_for: ['포트폴리오 만들기', '최신 기술 공부'],
    portfolio_value: '뉴스나 트렌드를 실제 결과물로 바꾸는 과정을 보여줄 수 있습니다.',
    plan: [
      'Phase 1: 문제 정의와 핵심 화면 | 도구: 마크다운, Figma | 방법: 대상 사용자와 핵심 기능 3개를 정하고 제외 범위를 기록한다',
      'Phase 2: 데이터와 핵심 기능 | 도구: Next.js, Supabase, TypeScript | 방법: 핵심 흐름을 실제 데이터와 연결한다',
      'Phase 3: 실패 처리와 검증 | 도구: 브라우저 DevTools | 방법: 빈 값, API 실패, 모바일 화면을 테스트한다',
      'Phase 4: 배포와 README | 도구: Vercel | 방법: 배포 URL과 실행 방법, 제한 사항을 문서화한다',
    ],
    build_plan: [
      { order: 1, title: 'MVP 범위와 화면 흐름 고정', objective: '대표 사용자 흐름 한 개와 제외 범위를 정합니다.', tasks: ['대상 사용자와 입력·결과 화면 정의', '핵심 기능을 3개 이하로 기록'], tools: ['Markdown', 'Figma'], deliverable: '화면 흐름과 범위 문서', done_when: '대표 사용자 흐름 1개와 제외 기능 3개가 문서에 기록된다.', estimated_hours_min: 3, estimated_hours_max: 5, acceptance_criteria: ['핵심 기능이 3개 이하로 정리된다.'], risks: ['기능을 너무 많이 넣으면 이후 단계의 기간이 늘어납니다.'] },
      { order: 2, title: '입력과 결과 화면 구현', objective: '사용자가 대표 작업을 시작하고 결과를 확인하게 합니다.', tasks: ['입력 폼 구현', '결과 상태와 빈 상태 구현'], tools: ['Next.js', 'TypeScript'], deliverable: '입력·결과 화면', done_when: '테스트 입력 3건 중 3건이 결과 화면에 표시된다.', estimated_hours_min: 5, estimated_hours_max: 9, acceptance_criteria: ['테스트 입력 3건이 결과 화면에 표시된다.'], risks: ['빈 값과 잘못된 입력을 별도로 처리해야 합니다.'] },
      { order: 3, title: '외부 연동과 실패 처리', objective: '외부 API 한 곳을 연결하고 실패 상황을 안내합니다.', tasks: ['API 호출 함수 작성', '오류 메시지와 재시도 안내 추가'], tools: ['fetch', '환경 변수'], deliverable: '외부 API 연동', done_when: '정상 요청 3건이 처리되고 실패 요청 1건에 안내 메시지가 표시된다.', estimated_hours_min: 4, estimated_hours_max: 8, acceptance_criteria: ['정상 요청 3건과 실패 요청 1건을 확인한다.'], risks: ['외부 API 호출 제한과 응답 형식 변경 가능성이 있습니다.'] },
      { order: 4, title: '검증과 배포 문서화', objective: '대표 흐름을 점검하고 재현 가능한 실행 방법을 남깁니다.', tasks: ['모바일과 오류 상태 확인', 'README와 배포 환경 변수 정리'], tools: ['Browser DevTools', 'Vercel'], deliverable: '배포 URL과 README', done_when: '배포 URL에서 대표 흐름 1개가 완료되고 README에 실행 방법이 기록된다.', estimated_hours_min: 4, estimated_hours_max: 7, acceptance_criteria: ['배포 URL에서 대표 흐름을 1회 완료한다.'], risks: ['배포 환경 변수 누락으로 기능이 동작하지 않을 수 있습니다.'] },
    ],
    duration_estimate: estimate,
    scope: {
      must_have: ['핵심 사용자 흐름 1개', '입력·결과 화면', '배포 가능한 실행 경로'],
      should_have: ['기본 오류 처리', 'README와 시연 데이터'],
      excluded: ['결제', '멀티테넌트', '고급 운영 분석', '실제 외부 서비스의 모든 예외 처리'],
    },
    prerequisites: ['TypeScript 기본 문법', 'REST API와 비동기 처리', '환경 변수와 배포 기초'],
    difficulty_reasons: ['외부 데이터와 AI 응답을 화면 상태로 변환해야 합니다.', '실패 응답과 빈 데이터를 별도로 처리해야 합니다.'],
    mvp_acceptance: '핵심 사용자가 한 가지 대표 작업을 완료하고, 배포된 URL에서 결과를 확인할 수 있어야 합니다.',
    expansion_ideas: ['사용자 인증', '고급 검색 또는 RAG', '운영 로그와 관리자 화면'],
    stack_details: [
      { name: 'Next.js + TypeScript', category: 'core', reason: '입력 화면과 서버 요청을 하나의 웹 앱에서 구현합니다.' },
      { name: 'Supabase', category: 'core', reason: '최소 데이터 저장과 사용자별 기록에 사용합니다.' },
      { name: 'RAG', category: 'optional', reason: '핵심 흐름을 검증한 후 참고 자료 검색이 필요할 때 추가합니다.' },
      { name: 'Queue', category: 'scale', reason: '처리량이 늘어 비동기 작업이 필요할 때 검토합니다.' },
    ],
    project_constraints: {
      target_level: 'beginner',
      duration_days_min: estimate.minimum_days,
      duration_days_max: estimate.maximum_days,
      estimated_hours_min: estimate.estimated_hours_min,
      estimated_hours_max: estimate.estimated_hours_max,
      primary_language: 'TypeScript',
      core_feature_count: 3,
      integration_count: 1,
      excluded_features: ['결제', '다중 사용자 권한', '실시간 협업'],
    },
    technical_limitations: ['외부 API의 응답 형식과 호출 제한에 따라 결과 품질이 달라질 수 있습니다.', '초기 버전은 대표 사용 흐름 한 개만 검증하며 모든 예외 상황을 다루지 않습니다.'],
    assumptions: ['개발자가 기본적인 JavaScript 또는 TypeScript 문법을 알고 있습니다.', '외부 API 키와 테스트용 데이터를 준비할 수 있습니다.'],
    excluded_scope: ['결제', '팀 단위 권한 관리', '실시간 동기화'],
    complexity_reasons: ['입력부터 결과 확인까지 하나의 사용자 흐름을 완성해야 합니다.', '외부 API 실패와 빈 결과를 화면에서 처리해야 합니다.'],
    schedule_reasoning: estimate.reasoning,
    validation_metrics: [
      { metric: '대표 사용자 흐름', target: '테스트 입력 3건 중 3건 완료', method: '브라우저에서 입력부터 결과 확인까지 직접 실행' },
      { metric: '오류 처리', target: 'API 실패 시 안내 메시지 1종 표시', method: '잘못된 API 키 또는 네트워크 오류로 확인' },
    ],
  };
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { idea: fallback, model: null };

  try {
    const { result, model } = await callOpenRouter<GeneratedProjectIdea>(apiKey, [
      { role: 'system', content: '너는 초보 개발자를 위한 프로젝트 코치다. 뉴스/제품/오픈소스 신호를 포트폴리오 프로젝트로 바꾼다. 반드시 JSON만 반환한다.' },
      {
        role: 'user',
        content: `아래 소스를 기반으로 만들 만한 프로젝트 1개를 JSON으로 제안하라.

엄격한 프로젝트 설계 규칙:
- 먼저 MVP 범위를 고정한다. must_have는 최대 3개, 주 언어는 1개, 실제 외부 연동은 최대 1개만 MVP에 포함한다. 나머지는 expansion_ideas 또는 excluded_scope로 보낸다.
- Neo4j, LangChain, LlamaIndex, OCR, 벡터 DB, 다중 에이전트, 실시간 협업은 입력 소스에 직접 필요성이 있어도 기본 스택으로 넣지 말고 optional 또는 scale로 분리한다.
- "정확히", "완벽하게", "누락 없이", "사이드 이펙트 없는", "최적의", "가장 정확한", "혁신적인", "압도적인" 같은 과장 또는 보장 표현을 쓰지 않는다.
- 기술적 한계와 전제 조건을 숨기지 말고, 시장·성능 수치가 원천에 없으면 단정하지 않는다.
- build_plan의 각 단계에는 수치 또는 관찰 가능한 상태가 포함된 acceptance_criteria와 risks를 반드시 작성한다.
- MVP 완료 조건은 "무엇을, 몇 건, 어떤 상태에서" 확인하는지 측정 가능하게 쓴다.
- description은 마크다운으로 작성하며 반드시 아래 6개 ## 섹션을 모두 포함한다.
  ## 이 프로젝트는 무엇인가요?   → 2~3문장으로 서비스 개요
  ## 어떤 문제를 해결하나요?    → 어떤 불편함/필요를 해결하는지 구체적으로
  ## 핵심 기능                  → bullet list로 최대 3개 기능 나열
  ## 왜 만들어볼 만한가요?       → 학습 가치, 포트폴리오 차별점
  ## 이 프로젝트로 배울 수 있는 것 → bullet list로 3~5개 학습 포인트
  ## 기술적 한계와 제외 범위       → 외부 의존성, 검증하지 않은 가정, 이번 MVP에서 제외한 것
- description 전체 길이는 600~1200자(한국어 기준)
- plan 배열은 각 Day를 "Day N: 작업 제목 | 도구: 사용할 도구명 | 언어: 사용 언어 | 방법: 구체적인 구현 방법" 형식으로 작성한다.
- plan은 최소 5개, 최대 7개 항목으로 작성한다.
- stack은 실제로 plan에서 사용하는 기술만 포함한다.

출력 JSON:
{
  "title": "프로젝트명",
  "description": "## 이 프로젝트는 무엇인가요?\n\n설명...\n\n## 어떤 문제를 해결하나요?\n\n설명...\n\n## 핵심 기능\n\n- 기능1\n- 기능2\n\n## 왜 만들어볼 만한가요?\n\n설명...\n\n## 이 프로젝트로 배울 수 있는 것\n\n- 학습1\n- 학습2",
  "level": "초급 | 중급 | 고급",
  "duration_days": 14,
  "duration_estimate": {"recommended_days": 14, "minimum_days": 10, "maximum_days": 18, "estimated_hours_min": 20, "estimated_hours_max": 36, "assumed_hours_per_day": 2, "reasoning": "외부 API와 데이터 저장을 포함한 MVP 기준"},
  "scope": {"must_have": ["핵심 기능"], "should_have": ["선택 기능"], "excluded": ["이번 플랜에서 제외할 기능"]},
  "stack": ["사용 기술"],
  "related_trend": "관련 트렌드",
  "target_user_level": "beginner-builder | portfolio-seeker | ai-tool-maker | startup-explorer",
  "recommended_for": ["목적"],
  "portfolio_value": "포트폴리오 가치 설명 (2~3문장)",
  "plan": ["기존 호환용 요약 문자열"],
  "build_plan": [{"order": 1, "title": "핵심 기능 구현", "objective": "대표 흐름을 만든다", "tasks": ["작업"], "tools": ["기술"], "deliverable": "산출물", "done_when": "완료 조건", "estimated_hours_min": 4, "estimated_hours_max": 8, "dependencies": [], "acceptance_criteria": ["테스트 입력 3건이 결과 화면에 표시된다"], "risks": ["외부 API 호출 제한"]}],
  "prerequisites": ["선행 지식"],
  "difficulty_reasons": ["추천 수준 판단 이유"],
  "mvp_acceptance": "검증 가능한 MVP 완료 기준",
  "expansion_ideas": ["추후 확장"],
  "stack_details": [{"name": "기술", "category": "core | optional | alternative | scale", "reason": "추천 이유"}],
  "project_constraints": {"target_level": "beginner | intermediate | advanced", "duration_days_min": 10, "duration_days_max": 18, "estimated_hours_min": 20, "estimated_hours_max": 36, "primary_language": "TypeScript", "core_feature_count": 3, "integration_count": 1, "excluded_features": ["제외 기능"]},
  "technical_limitations": ["외부 API 또는 데이터 측면의 한계"],
  "assumptions": ["개발 전제 조건"],
  "excluded_scope": ["이번 MVP에서 제외할 기능"],
  "complexity_reasons": ["난이도 판단 근거"],
  "schedule_reasoning": "기간을 계산한 근거",
  "validation_metrics": [{"metric": "대표 흐름", "target": "테스트 입력 3건 중 3건 완료", "method": "브라우저에서 직접 실행"}]
}

source_type: ${input.sourceType}
title: ${input.title}
trend: ${input.trend ?? ''}
skills: ${(input.skills ?? []).join(', ')}
summary: ${truncate(input.summary, 2500)}`,
      },
    ], { maxTokens: 3500, models: getWritingModels() });

    const generated = normalizeGeneratedProjectIdea({ ...fallback, ...result }, estimate);
    return { idea: generated, model };
  } catch (error) {
    console.error('OpenRouter project idea generation failed', error);
    return { idea: fallback, model: null };
  }
}

export async function generateArticleDraft(input: {
  title: string;
  sourceType: string;
  summary: string;
  trend?: string | null;
  skills?: string[];
  track?: string | null;
  difficultyTarget?: '초급' | '중급' | '고급';
  sourceBundle?: ArticleSourceBundleItem[];
}) {
  const articleEvidence = calculateArticleEvidence(input.sourceBundle ?? []);
  const allowedSourceUrls = uniqueAllowedUrls((input.sourceBundle ?? []).map((source) => source.url));
  const allowedMetricValues = extractAllowedMetricValues(input.sourceBundle ?? []);
  const fallback: GeneratedArticleDraft = {
    title: `${ensureKoreanTitle(input.title)} 정리`,
    summary: fallbackSummary(input.title, input.summary),
    content_markdown: '',
    category: input.trend ?? 'Trend',
    content_type: input.sourceType === 'trend_bundle' ? 'deep_dive' : 'article',
    newsletter_section: input.sourceType === 'trend_bundle' ? 'deep_dive' : input.sourceType === 'paper' ? 'paper_to_project' : input.sourceType === 'github' ? 'github_project_pick' : 'daily_briefing',
    newsletter_priority: 76,
    tags: [input.trend, input.sourceType, ...(input.skills ?? [])].filter(Boolean).slice(0, 6) as string[],
    related_skills: input.skills?.length ? input.skills.slice(0, 6) : ['Research', 'Web', 'API'],
    project_idea: `${ensureKoreanTitle(input.title)} 기반 미니 프로젝트`,
    why_it_matters: '수집된 뉴스, 제품, 오픈소스, 논문, 트렌드 신호를 실제 학습과 프로젝트로 연결할 수 있습니다.',
    key_points: ['통합 데이터 기반으로 작성된 글입니다.', '프로젝트 아이디어로 확장할 수 있습니다.', '개인 맞춤 뉴스레터 소재로 활용할 수 있습니다.'],
    difficulty: input.difficultyTarget ?? '중급',
    target_levels: input.difficultyTarget === '초급' ? ['입문자', '초보자'] : input.difficultyTarget === '고급' ? ['중급자', '실무자'] : ['초보자', '중급자'],
    target_goals: ['최신 개발 트렌드 파악', '포트폴리오 만들기', '사이드 프로젝트 만들기'],
    target_interests: ['AI/LLM', '오픈소스', '사이드프로젝트'],
    referenced_tools: input.skills?.slice(0, 6) ?? [],
    source_links: [],
    editorial_angle: 'AI 생성 실패',
    core_claims: [],
    technical_limitations: ['원천 자료에 없는 성능, 가격, 호환성은 별도 검증이 필요합니다.'],
    assumptions: [],
    mvp_scope: ['대표 사용자 흐름 1개', '핵심 기능 최대 3개', '외부 연동 1개'],
    excluded_scope: ['다중 모델·다중 클라이언트 연동', '고급 운영 자동화'],
    measurable_acceptance_criteria: ['테스트 입력 3건 중 3건이 결과 화면에 표시된다.'],
    evidence: articleEvidence,
    link_warnings: [],
  };
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { draft: fallback, model: null };

  try {
    const trackGuide = getArticleTrackGuide(input.track);
    const { result, model } = await callOpenRouter<GeneratedArticleDraft>(apiKey, [
      {
        role: 'system',
        content: '너는 Seedup의 시니어 테크 에디터다. 긴 한국어 개발자 에세이를 쓰되, 제공된 근거 밖의 수치·링크·제품 정보는 만들지 않는다. 확인된 사실, 일반 기술 해설, AI의 해석·제안을 구분하고 한계와 검증 방법을 명시한다. 반드시 JSON만 반환한다.',
      },
      {
        role: 'user',
        content: `아래 전처리 데이터를 기반으로 /news 아티클 페이지에 발행할 긴 한국어 전문가 글을 작성하라.

발행 트랙: ${input.track ?? '공통'}
권장 난이도: ${input.difficultyTarget ?? '중급'}

트랙별 에디토리얼 전략:
${trackGuide}

규칙:
- 제목, 요약, 본문은 모두 자연스러운 한국어로 작성한다.
- source_type이 cluster이면 content_type은 반드시 "article"이고 newsletter_section은 "deep_dive"가 아니어야 한다.
- source_type이 trend_bundle일 때만 content_type과 newsletter_section에 "deep_dive"를 사용할 수 있다.
- 영어 제목/요약은 한국어로 번역하되, 고유명사와 제품명은 유지한다.
- content_markdown은 4,500~7,500자 분량의 긴 마크다운 글이어야 한다.
- 단순 요약 금지. 전문가가 직접 읽고 판단한 듯한 논지, 의견, 주의점, 반론, 실행 조언을 포함한다.
- 원천 데이터에 있는 제품/도구/오픈소스/논문/트렌드를 함께 엮어 쓴다.
- 아래 source bundle에 포함된 URL만 본문 마크다운 링크와 source_links에 사용할 수 있다. URL이 없으면 링크를 만들지 않는다.
- source bundle에 없는 구체적인 수치, 증가율, 시장 점유율, 다운로드 수, 스타 수, 지연 시간, 비용 절감률을 만들지 않는다. 근거가 부족하면 "직접 확인 가능한 근거가 부족하다"고 쓴다.
- 확인된 사실은 "수집 자료에서 확인되는 내용", 일반 해설은 "일반적으로", 제안은 "MVP에서는"처럼 문장 역할을 드러낸다.
- MCP, RAG, Vector DB, Tool Calling, AI Agent는 서로 다른 역할로 설명하고, 입력 근거에 없는 세부 표준·프로토콜 규격을 단정하지 않는다.
- "최적의", "완벽한", "가장 정확한", "압도적인", "혁신적인", "누락 없이", "사이드 이펙트 없는", "무조건", "반드시 성공", "업계 표준", "핵심 경쟁력"을 사용하지 않는다.
- 관련 제품/도구가 데이터에 있으면 "함께 봐야 할 도구" 섹션에서 실제 활용 관점으로 설명한다.
- "왜 중요한가/개발자가 볼 포인트/작게 만들어볼 아이디어" 같은 짧은 템플릿만 반복하지 않는다.
- 데일리 글은 최소 6개, Deep Dive는 최소 9개의 ## 섹션을 가진다. 한계와 주의점, 현실적인 MVP 범위, 제외 범위, 측정 가능한 완료 조건, 출처/근거 부족 안내는 반드시 포함한다.
- 독자가 바로 따라 할 수 있는 체크리스트, 구현 순서, 평가 기준을 포함한다.
- 과장 금지. 아직 검증이 필요한 부분과 실패 가능성도 적는다.
- “이런 프로젝트를 만들어보세요”에서 끝내지 말고, 데이터 모델/API/화면/평가 지표까지 구체화한다.
- 트랙별 에디토리얼 전략을 반드시 반영한다. 모든 트랙에 같은 구조/톤을 반복하지 않는다.
- difficulty는 권장 난이도와 일치시킨다. 튜토리얼·실습형 자료는 초급, 운영·성능·보안·분산 시스템 자료는 고급, 그 외는 중급으로 판단한다.
- tags와 related_skills는 각각 6개 이하로 제한한다.
- MVP 핵심 기능은 최대 3개, 외부 연동은 1개로 제한한다. LangChain, LlamaIndex, Neo4j, Ollama, OCR 등은 실제 핵심 근거가 없으면 선택 또는 확장 단계로 분리한다.

권장 글 구조: 한 문장 요약, 왜 지금 보는가, 해결하는 문제, 핵심 동작 방식, 적합한 상황, 한계와 주의점, 현실적인 MVP 범위, 구현 단계, 완료 조건, 추천/비추천 대상, 다음 행동, 출처 및 근거.

출력 JSON:
{
  "title": "한국어 제목",
  "summary": "3~5문장 executive summary",
  "content_markdown": "# 제목\\n\\n긴 전문가 글...",
  "category": "AI Agent | Frontend | Backend | DevTools | Product | Trend | Paper | Open Source | Other",
  "content_type": "article | deep_dive | build_idea",
  "newsletter_section": "daily_briefing | ai_product_radar | github_project_pick | build_idea | deep_dive | paper_to_project",
  "newsletter_priority": 0,
  "tags": ["태그"],
  "related_skills": ["기술"],
  "project_idea": "작게 만들어볼 프로젝트 아이디어",
  "why_it_matters": "왜 중요한지",
  "key_points": ["핵심 1", "핵심 2", "핵심 3"],
  "difficulty": "초급 | 중급 | 고급",
  "target_levels": ["입문자 | 초보자 | 중급자 | 실무자"],
  "target_goals": ["포트폴리오 만들기 | 사이드 프로젝트 만들기 | 최신 개발 트렌드 파악 | 논문/연구 흐름 파악 | 실무 역량 강화"],
  "target_interests": ["AI/LLM | 프론트엔드 | 백엔드 | 데이터/ML | DevOps/클라우드 | 오픈소스 | 창업/사이드프로젝트"],
  "referenced_tools": ["본문에서 다룬 제품/도구/오픈소스"],
  "source_links": ["본문에 실제로 사용한 URL"],
  "editorial_angle": "이 글의 핵심 관점 한 문장",
  "core_claims": [{"claim": "주장", "evidence_type": "source | general_knowledge | inference", "source_urls": ["source bundle URL만"], "confidence": "low | medium | high"}],
  "technical_limitations": ["기술적 한계"],
  "assumptions": ["전제 조건"],
  "mvp_scope": ["MVP 핵심 기능 최대 3개"],
  "excluded_scope": ["이번 MVP 제외 범위"],
  "measurable_acceptance_criteria": ["테스트 입력 3건 중 3건 결과 확인"],
  "evidence": {"source_count": 0, "source_type_count": 0, "direct_metric_count": 0, "has_primary_source": false, "confidence": "low", "limitations": ["근거 부족"]},
  "link_warnings": []
}

source_type: ${input.sourceType}
title: ${input.title}
trend: ${input.trend ?? ''}
skills: ${(input.skills ?? []).join(', ')}
source_data:
${truncate(input.summary, 9000)}

source_bundle (URL과 수치는 아래 항목 안에서만 사용):
${JSON.stringify(input.sourceBundle ?? [], null, 2)}`,
      },
    ], { maxTokens: 6000, models: getWritingModels(), jsonMode: true, timeoutMs: ARTICLE_OPENROUTER_TIMEOUT_MS });

    const draft = normalizeArticleDraft(result, fallback, { allowedSourceUrls, allowedMetricValues, evidence: articleEvidence });
    if (input.difficultyTarget) {
      draft.difficulty = input.difficultyTarget;
      draft.target_levels = input.difficultyTarget === '초급'
        ? ['입문자', '초보자']
        : input.difficultyTarget === '고급'
          ? ['중급자', '실무자']
          : ['초보자', '중급자'];
    }
    return { draft, model };
  } catch (error) {
    console.error('OpenRouter article draft generation failed', error);
    return { draft: fallback, model: null };
  }
}


export async function evaluateIdea(input: { idea: string; context?: string }) {
  const fallback: IdeaEvaluation = {
    score: 0,
    verdict: '평가에 필요한 근거를 만들지 못했습니다.',
    portfolio_value: '입력 내용을 구체화한 뒤 다시 평가해주세요.',
    difficulty: '판단 보류',
    market_fit: '근거 부족',
    recommended_stack: [],
    risks: ['입력 정보 부족'],
    next_steps: ['대상 사용자와 해결할 문제를 한 문장으로 정의하기'],
    score_breakdown: { feasibility: 0, differentiation: 0, market: 0, portfolio: 0, mvp_clarity: 0 },
    strengths: [],
    weaknesses: ['평가 결과를 만들기 위한 구조화된 입력이 부족합니다.'],
    recommended_technologies: [],
    structured_risks: [],
    structured_next_steps: [],
    confidence: { level: 'low', reason: '평가 결과를 확인할 수 없습니다.' },
    missing_data: ['대상 사용자', '해결할 문제', '핵심 기능'],
    user_stated: [input.idea],
    inferred_assumptions: [],
    mvp_scope: { team_size: '1~2명', duration_weeks: 2, core_user_flow: '입력한 아이디어의 핵심 사용자 흐름 1개 정의', excluded_scope: ['복잡한 자동화', '여러 외부 서비스 동시 연동'] },
    score_reasons: {},
  };
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { evaluation: null, model: null, error: '평가 모델 설정이 없습니다.' };

  try {
    const { result, model } = await callOpenRouter<IdeaEvaluation>(apiKey, [
      { role: 'system', content: '너는 Seedup의 근거 기반 스타트업/포트폴리오 아이디어 평가 코치다. 반드시 JSON만 반환한다. 동일한 아이디어와 동일한 근거에는 항상 같은 평가 기준과 점수 체계를 적용한다. 제공된 참고 자료에 없는 최신 사실은 단정하지 않는다.' },
      {
        role: 'user',
        content: `아래 프로젝트 아이디어를 평가하라. 참고 자료가 있으면 경쟁 제품, 기술 선택, 시장성, 트렌드 판단에 반드시 활용하라. 참고 자료의 URL을 직접 열었다고 주장하지 말고, 자료에 없는 수치나 사실은 만들지 마라.

출력 JSON:
{
  "score": 0,
  "verdict": "한 문장 총평",
  "portfolio_value": "포트폴리오 가치",
  "difficulty": "초급 | 중급 | 고급",
  "market_fit": "시장성과 트렌드 연결",
  "recommended_stack": ["기술"],
  "risks": ["리스크"],
  "next_steps": ["다음 단계"],
  "score_breakdown": {"feasibility": 0, "differentiation": 0, "market": 0, "portfolio": 0, "mvp_clarity": 0},
  "strengths": ["확인된 강점"],
  "weaknesses": ["확인된 약점"],
  "recommended_technologies": [{"name": "기술명", "category": "required | optional | scale", "reason": "이유"}],
  "structured_risks": [{"title": "위험 제목", "severity": "high | medium | low", "impact": "영향", "mitigation": "대응 방법"}],
  "structured_next_steps": [{"order": 1, "title": "단계", "description": "작업", "deliverable": "산출물", "done_when": "완료 조건"}],
  "confidence": {"level": "high | medium | low", "reason": "근거 충분도"},
  "missing_data": ["추가 검증이 필요한 데이터"],
  "user_stated": ["사용자가 직접 입력한 사실만"],
  "inferred_assumptions": ["참고 자료 또는 AI가 확장한 가설, 확정 사실처럼 쓰지 않음"],
  "mvp_scope": {"team_size": "1~2명", "duration_weeks": 2, "core_user_flow": "핵심 사용자 흐름 1개", "excluded_scope": ["이번 MVP에서 제외할 범위"]},
  "score_reasons": {"feasibility": {"positive": ["긍정 요인"], "deductions": ["감점 요인"], "evidence": ["근거 또는 근거 부족"]}}
}

idea: ${truncate(input.idea, 2500)}

추가 규칙:
- 점수는 구현 가능성, 차별성, 시장성, 포트폴리오 가치, MVP 명확성을 종합하되 임의의 세부 점수를 UI에서 만들지 않는다.
- 각 세부 점수는 0~100 정수다. 종합 점수는 feasibility 25%, differentiation 20%, market 20%, portfolio 20%, mvp_clarity 15%의 가중 평균을 반올림해 계산한다.
- 문제, 대상 사용자, 해결 방식 중 둘 이상이 명확하지 않으면 MVP 명확성과 시장성에 40점을 넘기지 않는다. 근거가 부족하면 높게 추정하지 말고 낮은 신뢰도와 보완 질문을 제시한다.
- 참고 자료에 직접 근거가 없으면 시장성은 "근거 부족" 또는 "AI 추론"으로 표현한다.
- user_stated에는 사용자가 실제로 입력한 대상 사용자, 문제, 기능만 적는다. inferred_assumptions에는 참고 자료에서 확장한 가설만 적고, 사용자 입력 사실과 섞지 않는다.
- MVP는 1~2명이 2~4주 안에 구현 가능한 범위여야 한다. mvp_scope에는 핵심 사용자 흐름을 정확히 1개 쓰고, 이번 MVP에서 제외할 범위를 명시한다.
- recommended_technologies는 MVP 필수(required), 선택(optional), 확장(scale)으로 구분하고 기술마다 이유를 쓴다. required는 최대 4개다. Neo4j, LangChain, LlamaIndex, OCR, 벡터 DB 같은 기술은 입력과 근거가 직접 요구하지 않으면 optional 또는 scale로 분리한다.
- structured_risks는 위험마다 심각도, 영향, 현실적인 대응 방법을 포함한다.
- structured_next_steps는 작업, 산출물, 완료 조건을 포함한다. done_when에는 "사용자 3명", "결과 10건", "오류 없이 1회 완료"처럼 측정 가능한 수치와 상태를 반드시 넣는다. 근거 없는 기간이나 시장 규모를 만들지 않는다.
- score_reasons에는 구현 가능성, 차별성, 시장성, 포트폴리오, MVP 명확성 각각의 긍정 요인, 감점 요인, 근거 또는 근거 부족을 적는다.
- 시장·경쟁 관련 참고 자료가 없으면 market 점수는 절대 60점 이상 주지 않는다.
- confidence는 참고 자료 수와 출처 종류 수를 기준으로 판단한다. 자료 5개 이상·출처 3종 이상만 high, 자료 2개 이상·출처 2종 이상은 medium, 나머지는 low다.
- 결과는 한국어로 작성하고 기술명만 원문 표기를 유지한다.
- 응답을 짧고 구조적으로 유지한다. verdict, portfolio_value, market_fit은 각각 2문장 이하, 배열은 각각 최대 3개(추천 기술은 최대 4개), 각 배열 항목은 120자 이하로 작성한다.
- structured_risks는 최대 2개, structured_next_steps는 최대 3개만 작성한다. 각 항목의 impact, mitigation, description, deliverable, done_when은 한 문장으로 제한한다.

참고 자료:
${input.context || '관련 자료를 찾지 못했다. 일반론을 최신 사실처럼 말하지 말고 불확실성을 표시하라.'}`,
      },
    ], { models: getWritingModels(), jsonMode: true, temperature: 0, timeoutMs: 50_000, maxTokens: 3_600 });

    return { evaluation: normalizeIdeaEvaluation(result, fallback), model };
  } catch (error) {
    console.error('OpenRouter idea evaluation failed', error);
    // Some OpenRouter providers ignore json_object mode. Give the same
    // prompt one repair attempt without response_format before failing.
    try {
      const { result, model } = await callOpenRouter<IdeaEvaluation>(apiKey, [
        { role: 'system', content: '너는 Seedup의 근거 기반 아이디어 평가 코치다. JSON 객체 하나만 반환하라. 마크다운과 설명 문장은 반환하지 마라.' },
        {
          role: 'user',
          content: `다음 아이디어를 평가하고 아래 필드를 포함한 JSON 객체 하나만 반환하라. 점수는 0~100 정수다. 참고 자료가 있으면 활용하고, 없는 사실은 만들지 마라.
필수 필드: score, verdict, portfolio_value, difficulty, market_fit, recommended_stack, risks, next_steps, score_breakdown, strengths, weaknesses, recommended_technologies, structured_risks, structured_next_steps, confidence, missing_data
모든 문자열은 120자 이하, 배열은 최대 3개(추천 기술 최대 4개), structured_risks는 최대 2개, structured_next_steps는 최대 3개로 제한한다.
아이디어: ${truncate(input.idea, 2500)}
참고 자료:
${input.context || '관련 자료 없음'}`,
        },
    ], { models: getWritingModels(), temperature: 0, timeoutMs: 30_000, maxTokens: 2_600 });
      return { evaluation: normalizeIdeaEvaluation(result, fallback), model };
    } catch (retryError) {
      console.error('OpenRouter idea evaluation retry failed', retryError);
      return {
        evaluation: {
          ...fallback,
          verdict: 'AI 평가 응답이 중단되어 자동 점수는 보류했습니다. 입력한 문제와 대상 사용자를 조금 더 구체화한 뒤 다시 평가해주세요.',
          weaknesses: ['평가 모델 응답을 끝까지 받지 못했습니다.'],
          confidence: { level: 'low' as const, reason: '모델 응답이 중단되어 근거 기반 평가를 완료하지 못했습니다.' },
        },
        model: null,
        error: getIdeaEvaluationErrorMessage(retryError),
      };
    }
  }
}

function getIdeaEvaluationErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes('abort') || message.includes('timeout')) return '평가 응답 시간이 초과되었습니다. 근거 자료를 줄여 다시 시도해주세요.';
  if (message.includes('429') || message.includes('rate') || message.includes('quota')) return 'AI 평가 요청이 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.';
  if (message.includes('json') || message.includes('non-json')) return '평가 결과 형식을 처리하지 못했습니다. 다시 시도해주세요.';
  return '평가 모델에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
}

export async function answerArticleQuestion(input: {
  title: string;
  summary: string;
  content: string;
  question: string;
}) {
  const fallback: ArticleQuestionAnswer = { answer: buildArticleQuestionFallback(input) };
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { result: fallback, model: null };

  try {
    const { result, model } = await callOpenRouter<ArticleQuestionAnswer>(apiKey, [
      { role: 'system', content: '너는 Seedup 아티클을 읽는 개발자를 돕는 정확한 Q&A 튜터다. 반드시 JSON만 반환한다. 원문에 없는 사실은 만들지 않으며, 사용자가 개념을 물으면 먼저 그 개념을 직접 설명한다.' },
      {
        role: 'user',
        content: `아래 아티클 내용만 근거로 사용자의 질문에 한국어로 짧게 답하라.

규칙:
- 답변은 3~6문장으로 간결하게 작성한다. 첫 문장에서 질문에 직접 답한다.
- "질문을 더 구체적으로 해달라" 또는 제목을 반복하는 것으로 답변을 대신하지 않는다. 질문이 짧아도 글의 문맥에서 가장 자연스러운 의미를 해석해 설명한다.
- 용어 질문에는 "무엇인지 → 이 글에서 왜 나오는지 → 개발자가 이해할 포인트" 순서로 설명한다.
- 글에 없는 수치·제품 기능·최신 사실은 추측하지 않는다. 글에 근거가 부족하면 모르는 부분만 명확히 밝히되, 이미 설명 가능한 부분은 답한다.

출력 JSON:
{
  "answer": "질문에 대한 답변"
}

title: ${input.title}
summary: ${truncate(input.summary, 700)}
content: ${truncate(input.content, 2200)}
question: ${truncate(input.question, 500)}`,
      },
    ], {
      models: getWritingModels(),
      jsonSchema: {
        name: 'article_question_answer',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['answer'],
          properties: { answer: { type: 'string', minLength: 30, maxLength: 1200 } },
        },
      },
      temperature: 0.2,
      timeoutMs: 25_000,
      maxTokens: 700,
    });

    const answer = typeof result.answer === 'string' && result.answer.trim().length >= 30
      ? result.answer.trim()
      : fallback.answer;
    return { result: { answer }, model };
  } catch (error) {
    console.error('OpenRouter article question failed', error);
    return { result: fallback, model: null };
  }
}

function buildArticleQuestionFallback(input: { title: string; summary: string; content: string; question: string }): string {
  const question = input.question.toLowerCase();
  if (/\bmcp\b|model context protocol|모델 컨텍스트 프로토콜/.test(question)) {
    return 'MCP(Model Context Protocol)는 AI가 파일, 데이터베이스, API 같은 외부 도구와 정해진 방식으로 연결되도록 만드는 표준입니다. 쉽게 말해 AI에게 필요한 정보를 찾아오거나 작업을 요청할 수 있게 하는 연결 규칙입니다. 이 글에서는 MCP 서버를 Go로 구현해 도구 호출을 빠르고 안정적으로 처리하는 방법을 다룹니다. 개발자는 서버가 어떤 도구를 노출할지, 권한과 입력 검증을 어떻게 제한할지를 먼저 설계하는 것이 핵심입니다.';
  }
  if (/\brag\b|검색 증강|retrieval/.test(question)) {
    return 'RAG는 답변을 만들기 전에 관련 문서나 데이터를 검색해 그 내용을 근거로 활용하는 방식입니다. 모델이 기억만으로 답하지 않게 해 최신 문서나 내부 지식을 연결할 수 있습니다. 이 글의 맥락에서는 검색 결과의 품질, 어떤 문서를 가져오는지, 그리고 근거가 답변에 제대로 반영되는지가 중요합니다. 따라서 먼저 작은 문서 집합으로 검색 정확도와 답변 품질을 함께 확인하는 편이 좋습니다.';
  }
  if (/에이전트|agent/.test(question)) {
    return 'AI 에이전트는 답변만 생성하는 모델을 넘어, 필요한 정보를 찾고 도구를 호출하며 여러 단계를 수행하도록 구성한 프로그램입니다. 이 글에서의 핵심은 에이전트가 MCP를 통해 외부 도구를 안전하게 사용할 수 있도록 서버와 인터페이스를 설계하는 것입니다. 자동화 범위를 넓히기 전에 허용할 도구와 실패 시 동작을 제한해야 실제 서비스에서 관리하기 쉽습니다.';
  }
  if (/쉽게|요약|핵심/.test(question)) {
    const summary = stripAssistantMarkup(input.summary || input.content).slice(0, 500);
    return summary
      ? `쉽게 말하면, ${summary} 이 글은 기술을 소개하는 데서 끝나지 않고 개발 환경에서 어떤 문제를 해결하는지와 구현할 때 확인할 조건을 함께 다룹니다.`
      : `이 글은 "${input.title}"의 핵심 개념과 실제 구현 시 확인할 조건을 설명합니다. 먼저 문제를 해결하는 가장 작은 흐름을 만들고, 성능·보안·운영 조건은 그 다음 단계에서 검증하는 방식으로 이해하면 됩니다.`;
  }
  return `질문하신 "${input.question.trim()}"은 이 글의 주제인 "${input.title}"와 연결해 보면 됩니다. 글에서 직접 확인되는 내용과 일반적인 구현 원칙을 구분해 설명하려면, 궁금한 문장이나 용어를 함께 보내주시면 그 부분을 기준으로 더 정확히 풀어드릴 수 있습니다.`;
}

function stripAssistantMarkup(value: string) {
  return value.replace(/[#>*_`\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();
}

async function callOpenRouter<T>(
  apiKey: string,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  options?: {
    maxTokens?: number;
    timeoutMs?: number;
    models?: string[];
    temperature?: number;
    jsonMode?: boolean;
    jsonSchema?: { name: string; schema: Record<string, unknown> };
  },
) {
  const models = options?.models?.length ? options.models : getOpenRouterModels();
  const errors: string[] = [];
  const maxTokens = options?.maxTokens ?? 2400;

  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? OPENROUTER_TIMEOUT_MS);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
          'http-referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001',
          'x-title': 'Seedup',
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: options?.temperature ?? 0.2,
          max_tokens: maxTokens,
          ...(options?.jsonSchema
            ? {
                response_format: {
                  type: 'json_schema',
                  json_schema: {
                    name: options.jsonSchema.name,
                    strict: true,
                    schema: options.jsonSchema.schema,
                  },
                },
              }
            : options?.jsonMode
              ? { response_format: { type: 'json_object' } }
              : {}),
        }),
      });

      if (!response.ok) {
        const body = await response.text();
        throw new Error(`OpenRouter request failed: ${response.status} ${body}`);
      }

      const json = await response.json();

      // OpenRouter sometimes returns 200 OK with an error object (quota/rate-limit)
      if (json.error) {
        throw new Error(`OpenRouter API error: ${json.error.message ?? JSON.stringify(json.error)}`);
      }

      const rawContent = json.choices?.[0]?.message?.content;
      const content = typeof rawContent === 'string'
        ? rawContent
        : Array.isArray(rawContent)
          ? rawContent.map((part: unknown) => typeof part === 'string' ? part : (part && typeof part === 'object' && 'text' in part ? String((part as { text?: unknown }).text ?? '') : '')).join('')
          : '';
      if (!content) throw new Error('OpenRouter returned empty content');

      try {
        return { result: parseJsonResponse<T>(content), model };
      } catch (parseError) {
        const preview = content.slice(0, 500).replace(/\s+/g, ' ');
        console.warn('OpenRouter JSON parse failed preview:', { model, preview });
        throw parseError;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${model}: ${message}`);
      console.warn('OpenRouter model failed, trying fallback if available', { model, message });
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`All OpenRouter models failed. ${errors.join(' | ')}`);
}

function getOpenRouterModels() {
  return [
    process.env.OPENROUTER_MODEL,
    ...(process.env.OPENROUTER_FALLBACK_MODELS ?? '').split(','),
    DEFAULT_MODEL,
    FALLBACK_MODEL,
  ]
    .map((model) => model?.trim())
    .filter((model): model is string => Boolean(model))
    .filter((model, index, models) => models.indexOf(model) === index);
}

function getWritingModels() {
  return [
    ...MODEL_ROUTES.writing,
    ...(process.env.OPENROUTER_FALLBACK_MODELS ?? '').split(','),
  ]
    .map((model) => model.trim())
    .filter(Boolean)
    .filter((model, index, models) => models.indexOf(model) === index);
}

function parseJsonResponse<T>(content: string) {
  // Log a short preview when parsing fails to help debugging without dumping the full model output.
  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  const stripped = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  // Detect HTML responses (rate-limit pages, error pages from provider)
  if (/^<!DOCTYPE|^<html/i.test(stripped)) {
    const preview = stripped.slice(0, 120).replace(/\s+/g, ' ');
    console.warn('OpenRouter returned HTML instead of JSON:', preview);
    throw new Error('OpenRouter returned HTML (rate-limit or quota exceeded)');
  }

  // Log first 200 chars when parsing fails to help debugging
  try {
    return JSON.parse(stripped) as T;
  } catch {
    const start = stripped.indexOf('{');
    if (start === -1) {
      console.warn('OpenRouter non-JSON preview:', stripped.slice(0, 500));
      throw new Error('OpenRouter returned non-JSON content');
    }

    // Models occasionally append a second JSON object or a short explanation.
    // Parse only the first balanced object instead of combining it with the tail.
    const candidate = extractFirstJsonObject(stripped.slice(start));
    if (!candidate) {
      console.warn('OpenRouter incomplete JSON preview:', stripped.slice(0, 500));
      throw new Error('OpenRouter returned incomplete JSON content');
    }
    try {
      return JSON.parse(candidate) as T;
    } catch {
      return JSON.parse(repairJsonCandidate(candidate)) as T;
    }
  }
}

function extractFirstJsonObject(value: string) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === '\\') {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === '{') {
      depth += 1;
    } else if (character === '}') {
      depth -= 1;
      if (depth === 0) return value.slice(0, index + 1);
    }
  }

  return null;
}

function repairJsonCandidate(value: string) {
  return value
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[\u0000-\u0019]+/g, ' ')
    .trim();
}

function buildFallbackRepoAnalysis(input: { fullName: string; description: string | null; language: string | null; topics: string[] }): RepoAnalysis {
  const description = input.description?.trim();
  const topics = input.topics.filter(Boolean).slice(0, 5);
  const topicText = topics.length ? ` 관련 토픽은 ${topics.join(', ')}입니다.` : '';
  const languageText = input.language ? `${input.language} 기반 ` : '';

  return {
    relevance_score: /agent|mcp|rag|llm|ai|coding|developer|devtool|automation|workflow|sdk|cli/i.test(
      `${input.fullName} ${description ?? ''} ${topics.join(' ')}`,
    )
      ? 55
      : 35,
    ai_review: description
      ? `${input.fullName}은 ${languageText}오픈소스 프로젝트입니다. ${truncate(description, 220)}${topicText}`
      : `${input.fullName}은 GitHub에서 수집된 오픈소스 프로젝트입니다.${topicText} 설명이 부족해 자세한 평가는 나중에 다시 분석하는 것이 좋습니다.`,
    beginner_summary: description
      ? `초보자는 이 저장소가 어떤 문제를 해결하는지와 README의 사용 예제를 먼저 확인하면 좋습니다. 관심 있는 기능 하나만 골라 작게 따라 만들어보세요.`
      : `초보자는 저장소 설명과 README가 충분한지 먼저 확인하는 것이 좋습니다. 설명이 부족하면 프로젝트 참고용 가치가 낮을 수 있습니다.`,
    project_idea: description
      ? `${input.fullName.split('/').at(-1) ?? input.fullName}의 핵심 기능 하나를 골라 작은 대시보드나 자동화 도구로 재구현해보세요.`
      : `이 저장소의 README를 확인한 뒤 핵심 기능 1개만 골라 미니 프로젝트로 따라 만들어보세요.`,
  };
}

function normalizeRepoAnalysis(result: Partial<RepoAnalysis>, fallback: RepoAnalysis): RepoAnalysis {
  return {
    relevance_score: clampScore(result.relevance_score ?? fallback.relevance_score),
    ai_review: truncate(String(result.ai_review ?? fallback.ai_review), 500),
    beginner_summary: truncate(String(result.beginner_summary ?? fallback.beginner_summary), 400),
    project_idea: truncate(String(result.project_idea ?? fallback.project_idea), 500),
  };
}

function buildFallbackNewsAnalysis(title: string, content: string): NewsAnalysis {
  const rawSummary = fallbackSummary(title, content);
  const translatedTitle = ensureKoreanTitle(title);
  const summary = containsHangul(rawSummary)
    ? rawSummary
    : `${translatedTitle}에 관한 기술 뉴스입니다. 원문을 바탕으로 개발자가 확인할 핵심 흐름과 프로젝트로 연결할 포인트를 정리합니다.`;

  return {
    translated_title: translatedTitle,
    content_type: 'news',
    newsletter_section: 'daily_briefing',
    newsletter_priority: 62,
    category: 'Trend',
    relevance_score: 60,
    short_summary: summary,
    ai_summary: summary,
    article_markdown: '',
    beginner_summary: summary,
    why_it_matters: '개발자가 최신 동향을 이해하고 작은 프로젝트 아이디어로 연결할 수 있는 내용입니다.',
    key_points: [translatedTitle, summary, '상세 내용을 읽고 관련 기술을 실습해볼 수 있습니다.'],
    related_skills: ['Research', 'Web', 'API'],
    project_idea: '뉴스 요약 및 학습 노트 앱',
    difficulty: '초급',
    target_levels: ['입문자', '초보자'],
    target_goals: ['최신 기술 공부', '포트폴리오 만들기'],
    target_interests: ['뉴스/콘텐츠 서비스', 'AI/API 연동'],
    content_depth: '핵심과 예시 중심',
    topic_tags: ['개발 트렌드', '기술 뉴스'],
    skill_tags: ['Web', 'API'],
    intent_tags: ['초보자 추천', '프로젝트 연결 가능'],
    audience_tags: ['초급', '포트폴리오 준비'],
    related_roles: ['developer'],
    learning_topics: ['기술 뉴스 읽기', '프로젝트 아이디어 발굴'],
    project_convertible: true,
    source_quality_score: 55,
    novelty_score: 50,
    buildability_score: 65,
    project_connect_score: 70,
    recommendation_reasons: ['프로젝트로 확장 가능', '초보자도 읽기 좋음'],
    personalization_hooks: ['최신 기술을 프로젝트로 연결하고 싶은 사용자에게 적합합니다.'],
  };
}

function normalizeNewsAnalysis(result: Partial<NewsAnalysis>, fallback: NewsAnalysis): NewsAnalysis {
  return {
    translated_title: ensureKoreanTitle(result.translated_title ?? fallback.translated_title),
    content_type: result.content_type ?? fallback.content_type,
    newsletter_section: result.newsletter_section ?? fallback.newsletter_section,
    newsletter_priority: clampScore(result.newsletter_priority ?? fallback.newsletter_priority),
    category: result.category ?? fallback.category,
    relevance_score: Number(result.relevance_score ?? fallback.relevance_score),
    short_summary: result.short_summary ?? result.ai_summary ?? fallback.short_summary,
    ai_summary: result.ai_summary ?? fallback.ai_summary,
    article_markdown: result.article_markdown ?? fallback.article_markdown,
    beginner_summary: result.beginner_summary ?? fallback.beginner_summary,
    why_it_matters: result.why_it_matters ?? fallback.why_it_matters,
    key_points: Array.isArray(result.key_points) ? result.key_points : fallback.key_points,
    related_skills: Array.isArray(result.related_skills) ? result.related_skills : fallback.related_skills,
    project_idea: result.project_idea ?? fallback.project_idea,
    difficulty: result.difficulty ?? fallback.difficulty,
    target_levels: Array.isArray(result.target_levels) ? result.target_levels : fallback.target_levels,
    target_goals: Array.isArray(result.target_goals) ? result.target_goals : fallback.target_goals,
    target_interests: Array.isArray(result.target_interests) ? result.target_interests : fallback.target_interests,
    content_depth: result.content_depth ?? fallback.content_depth,
    topic_tags: Array.isArray(result.topic_tags) ? result.topic_tags.slice(0, 5) : fallback.topic_tags,
    skill_tags: Array.isArray(result.skill_tags) ? result.skill_tags.slice(0, 5) : fallback.skill_tags,
    intent_tags: Array.isArray(result.intent_tags) ? result.intent_tags.slice(0, 3) : fallback.intent_tags,
    audience_tags: Array.isArray(result.audience_tags) ? result.audience_tags.slice(0, 3) : fallback.audience_tags,
    related_roles: Array.isArray(result.related_roles) ? result.related_roles.slice(0, 5) : fallback.related_roles,
    learning_topics: Array.isArray(result.learning_topics) ? result.learning_topics.slice(0, 6) : fallback.learning_topics,
    project_convertible: Boolean(result.project_convertible ?? fallback.project_convertible),
    source_quality_score: clampScore(result.source_quality_score ?? fallback.source_quality_score),
    novelty_score: clampScore(result.novelty_score ?? fallback.novelty_score),
    buildability_score: clampScore(result.buildability_score ?? fallback.buildability_score),
    project_connect_score: clampScore(result.project_connect_score ?? fallback.project_connect_score),
    recommendation_reasons: Array.isArray(result.recommendation_reasons) ? result.recommendation_reasons.slice(0, 4) : fallback.recommendation_reasons,
    personalization_hooks: Array.isArray(result.personalization_hooks) ? result.personalization_hooks.slice(0, 4) : fallback.personalization_hooks,
  };
}

function normalizeArticleDraft(
  result: Partial<GeneratedArticleDraft>,
  fallback: GeneratedArticleDraft,
  context: { allowedSourceUrls: string[]; allowedMetricValues: string[]; evidence: ArticleEvidence },
): GeneratedArticleDraft {
  const title = softenArticleClaims(ensureKoreanTitle(result.title ?? fallback.title));
  const summary = softenArticleClaims(result.summary ?? fallback.summary);
  const rawContent = result.content_markdown?.trim() || fallback.content_markdown;
  const linkValidation = validateArticleLinks({ contentMarkdown: rawContent, allowedSourceUrls: context.allowedSourceUrls });
  const content = sanitizeUnsupportedArticleMetrics(softenArticleClaims(linkValidation.content_markdown), context.allowedMetricValues);
  const sourceLinks = uniqueAllowedUrls((result.source_links ?? []).map(String)).filter((url) => context.allowedSourceUrls.includes(url));
  const priority = normalizeEditorialPriority(result.newsletter_priority, fallback.newsletter_priority);
  const technicalLimitations = normalizeArticleList(result.technical_limitations, fallback.technical_limitations, 4);
  const assumptions = normalizeArticleList(result.assumptions, fallback.assumptions, 4);
  const mvpScope = normalizeArticleList(result.mvp_scope, fallback.mvp_scope, 3);
  const excludedScope = normalizeArticleList(result.excluded_scope, fallback.excluded_scope, 5);
  const acceptanceCriteria = normalizeArticleAcceptanceCriteria(result.measurable_acceptance_criteria, fallback.measurable_acceptance_criteria);
  const normalizedContent = ensureArticleRealitySections(content.startsWith('#') ? content : `# ${title}\n\n${content}`, {
    technicalLimitations,
    mvpScope,
    excludedScope,
    acceptanceCriteria,
    evidence: context.evidence,
  });
  const keyPoints = normalizeReadingPoints(result.key_points, fallback.key_points, normalizedContent, technicalLimitations);

  return {
    title,
    summary,
    content_markdown: normalizedContent,
    category: result.category ?? fallback.category,
    content_type: isContentType(result.content_type) ? result.content_type : fallback.content_type,
    newsletter_section: isNewsletterSection(result.newsletter_section) ? result.newsletter_section : fallback.newsletter_section,
    newsletter_priority: priority,
    tags: Array.isArray(result.tags) ? result.tags.slice(0, 6) : fallback.tags,
    related_skills: Array.isArray(result.related_skills) ? result.related_skills.slice(0, 6) : fallback.related_skills,
    project_idea: result.project_idea ?? fallback.project_idea,
    why_it_matters: result.why_it_matters ?? fallback.why_it_matters,
    key_points: keyPoints,
    difficulty: result.difficulty ?? fallback.difficulty,
    target_levels: Array.isArray(result.target_levels) ? result.target_levels.slice(0, 4) : fallback.target_levels,
    target_goals: Array.isArray(result.target_goals) ? result.target_goals.slice(0, 5) : fallback.target_goals,
    target_interests: Array.isArray(result.target_interests) ? result.target_interests.slice(0, 5) : fallback.target_interests,
    referenced_tools: Array.isArray(result.referenced_tools) ? result.referenced_tools.slice(0, 10) : fallback.referenced_tools,
    source_links: sourceLinks,
    editorial_angle: softenArticleClaims(result.editorial_angle ?? fallback.editorial_angle),
    core_claims: normalizeArticleClaims(result.core_claims, context.allowedSourceUrls),
    technical_limitations: technicalLimitations,
    assumptions,
    mvp_scope: mvpScope,
    excluded_scope: excludedScope,
    measurable_acceptance_criteria: acceptanceCriteria,
    evidence: context.evidence,
    link_warnings: [...linkValidation.warnings, ...uniqueArticleStrings(result.link_warnings ?? [])].slice(0, 6),
  };
}

function ensureArticleRealitySections(
  content: string,
  input: { technicalLimitations: string[]; mvpScope: string[]; excludedScope: string[]; acceptanceCriteria: string[]; evidence: ArticleEvidence },
) {
  const sections: Array<[RegExp, string]> = [
    [/##\s*(한계|주의|제약)/i, `## 한계와 주의점\n\n${input.technicalLimitations.map((item) => `- ${item}`).join('\n')}`],
    [/##\s*(MVP|구현 범위|현실적인 MVP)/i, `## 현실적인 MVP 범위\n\n${input.mvpScope.map((item) => `- ${item}`).join('\n')}`],
    [/##\s*(제외 범위|제외할)/i, `## 이번 단계에서 제외\n\n${input.excludedScope.map((item) => `- ${item}`).join('\n')}`],
    [/##\s*(완료 조건|검증|측정)/i, `## 측정 가능한 완료 조건\n\n${input.acceptanceCriteria.map((item) => `- ${item}`).join('\n')}`],
    [/##\s*(출처|근거)/i, `## 출처 및 근거\n\n- 이 글은 ${input.evidence.source_count}개의 수집 자료와 ${input.evidence.source_type_count}종의 출처를 참고했습니다.\n${input.evidence.limitations.map((item) => `- ${item}`).join('\n')}`],
  ];
  return sections.reduce((result, [pattern, section]) => pattern.test(result) ? result : `${result.trim()}\n\n${section}`, content);
}

export function validateArticleLinks({ contentMarkdown, allowedSourceUrls }: { contentMarkdown: string; allowedSourceUrls: string[] }) {
  const allowed = new Set(uniqueAllowedUrls(allowedSourceUrls));
  const warnings: string[] = [];
  const validLinks: string[] = [];
  const removedLinks: string[] = [];
  const content_markdown = contentMarkdown.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (full, label: string, url: string) => {
    const normalizedUrl = normalizeUrl(url);
    if (!normalizedUrl || !allowed.has(normalizedUrl)) {
      removedLinks.push(url);
      warnings.push(`허용되지 않은 링크 제거: ${label}`);
      return label;
    }
    if (!isLinkLabelConsistent(label, normalizedUrl)) {
      removedLinks.push(url);
      warnings.push(`표시명과 대상이 맞지 않는 링크 제거: ${label}`);
      return label;
    }
    validLinks.push(normalizedUrl);
    return `[${label}](${normalizedUrl})`;
  }).replace(/(?<!\]\()https?:\/\/[^\s)<]+/g, (url) => {
    const normalizedUrl = normalizeUrl(url);
    if (normalizedUrl && allowed.has(normalizedUrl)) {
      validLinks.push(normalizedUrl);
      return normalizedUrl;
    }
    removedLinks.push(url);
    warnings.push('허용되지 않은 URL 제거');
    return '';
  });
  return { content_markdown, validLinks: [...new Set(validLinks)], removedLinks: [...new Set(removedLinks)], warnings: [...new Set(warnings)] };
}

function isLinkLabelConsistent(label: string, url: string) {
  const lowerLabel = label.toLowerCase();
  const lowerUrl = url.toLowerCase();
  const expectedHosts: Array<[RegExp, RegExp]> = [
    [/\bollama\b/i, /ollama\.com|github\.com\/ollama/i],
    [/\bopenai\b/i, /openai\.com|github\.com\/openai/i],
    [/\banthropic\b|\bclaude\b/i, /anthropic\.com|github\.com\/anthropics/i],
    [/\bvercel\b/i, /vercel\.com|github\.com\/vercel/i],
    [/\bgithub\b/i, /github\.com/i],
    [/\bhugging\s*face\b/i, /huggingface\.co/i],
  ];
  return expectedHosts.every(([labelPattern, urlPattern]) => !labelPattern.test(lowerLabel) || urlPattern.test(lowerUrl));
}

function uniqueAllowedUrls(values: Array<string | null | undefined>) {
  return [...new Set(values.map(normalizeUrl).filter((value): value is string => Boolean(value)))];
}

function normalizeUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    url.hash = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    return null;
  }
}

function calculateArticleEvidence(sources: ArticleSourceBundleItem[]): ArticleEvidence {
  const actual = sources.filter((source) => source.source_type !== 'trend_bundle');
  const sourceTypeCount = new Set(actual.map((source) => source.source_type)).size;
  const hasPrimarySource = actual.some((source) => source.source_role === 'primary');
  const directMetricCount = actual.reduce((count, source) => count + ((source.summary.match(/(?:stars?|downloads?|7일 스타 변화|점수|score)\s*[:：]?\s*\d+(?:\.\d+)?|\b\d+(?:\.\d+)?(?:%|ms|초|분|시간|개|건|회)\b/gi) ?? []).length), 0);
  const confidence: ArticleEvidence['confidence'] = actual.length >= 4 && sourceTypeCount >= 2 && directMetricCount > 0 && hasPrimarySource
    ? 'high'
    : actual.length >= 2 ? 'medium' : 'low';
  const limitations = [
    directMetricCount === 0 ? '직접 인용할 수 있는 정량 근거가 부족합니다.' : null,
    !hasPrimarySource ? '공식 원천이 없어 기술 세부 사항은 추가 확인이 필요합니다.' : null,
    actual.length < 2 ? '참고 자료 수가 적어 해석 범위가 제한적입니다.' : null,
  ].filter((value): value is string => Boolean(value));
  return { source_count: actual.length, source_type_count: sourceTypeCount, direct_metric_count: directMetricCount, has_primary_source: hasPrimarySource, confidence, limitations };
}

function normalizeArticleClaims(value: unknown, allowedUrls: string[]): ArticleCoreClaim[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const claim = item as Partial<ArticleCoreClaim>;
    if (!claim.claim) return [];
    const evidenceType = claim.evidence_type === 'source' || claim.evidence_type === 'inference' ? claim.evidence_type : 'general_knowledge';
    return [{
      claim: softenArticleClaims(String(claim.claim)),
      evidence_type: evidenceType as ArticleCoreClaim['evidence_type'],
      source_urls: uniqueAllowedUrls(Array.isArray(claim.source_urls) ? claim.source_urls : []).filter((url) => allowedUrls.includes(url)),
      confidence: (claim.confidence === 'high' || claim.confidence === 'medium' ? claim.confidence : 'low') as ArticleCoreClaim['confidence'],
    }];
  }).slice(0, 6);
}

function normalizeArticleList(value: unknown, fallback: string[] | undefined, max: number) {
  const list = Array.isArray(value) ? value : fallback ?? [];
  return uniqueArticleStrings(list).slice(0, max).map(softenArticleClaims);
}

function normalizeArticleAcceptanceCriteria(value: unknown, fallback: string[] | undefined) {
  const criteria = normalizeArticleList(value, fallback, 3);
  return criteria.length
    ? criteria.map((item) => /\d/.test(item) && /(건|회|초|분|표시|저장|완료|응답|확인)/.test(item) ? item : '테스트 입력 3건 중 3건이 결과 화면에 표시되고 오류 입력 1건에는 안내가 표시된다.')
    : ['테스트 입력 3건 중 3건이 결과 화면에 표시되고 오류 입력 1건에는 안내가 표시된다.'];
}

function normalizeReadingPoints(value: unknown, fallback: string[], content: string, limitations: unknown) {
  const candidates = normalizeArticleList(value, fallback, 5);
  const roles = ['왜 지금 봐야 하는가', '핵심 기술 판단', '프로젝트 연결', '구현 전 주의점', '추천 독자와 다음 행동'];
  const limitation = normalizeArticleList(limitations, [], 1)[0] ?? '직접 확인 가능한 근거가 부족한 부분은 구현 전에 별도로 검증해야 합니다.';
  const defaults = [
    '수집 자료에서 확인되는 최신 신호를 바탕으로, 이 주제를 지금 검토할 이유를 정리합니다.',
    '도구 이름보다 실제 아키텍처 선택과 실패 조건을 먼저 판단하는 것이 중요합니다.',
    '프로젝트 연결: 대표 사용자 흐름 1개와 외부 연동 1개로 MVP를 시작합니다.',
    `주의점: ${limitation}`,
    '추천 독자: 현재 기술 선택의 근거와 구현 범위를 함께 검토하려는 개발자입니다.',
  ];
  return roles.map((role, index) => {
    const candidate = candidates[index];
    const text = candidate && !content.slice(0, 700).includes(candidate) ? candidate : defaults[index];
    return `${role}: ${text.replace(new RegExp(`^${role}:\\s*`), '')}`;
  });
}

function uniqueArticleStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function softenArticleClaims(value: string) {
  return value
    .replace(/최적의|완벽한|가장 정확한|압도적인|혁신적인|누락 없이|사이드 이펙트 없는|무조건|반드시 성공|업계 표준|핵심 경쟁력|시니어 개발자도 탐낼/gi, '검토할 만한')
    .replace(/기하급수적으로 증가/gi, '증가 신호가 관찰될 수 있는');
}

function extractAllowedMetricValues(sources: ArticleSourceBundleItem[]) {
  return [...new Set(sources.flatMap((source) => source.summary.match(/\b\d+(?:\.\d+)?(?:%|ms|밀리초|초|분|시간|개|건|회|stars?|downloads?)\b|(?:stars?|downloads?|7일 스타 변화|점수|score)\s*[:：]?\s*\d+(?:\.\d+)?/gi) ?? []))];
}

function sanitizeUnsupportedArticleMetrics(content: string, allowedMetricValues: string[]) {
  return content.replace(/^.*(?:\d+(?:\.\d+)?%|\d+\s*(?:ms|밀리초|요청|다운로드|스타|stars?|배)).*$/gmi, (line) => {
    const metrics = line.match(/\b\d+(?:\.\d+)?(?:%|ms|밀리초|요청|다운로드|스타|stars?|배)\b/gi) ?? [];
    return metrics.every((metric) => allowedMetricValues.includes(metric))
      ? line
      : '구체적인 성능·사용량 수치는 제공된 원천 자료에서 직접 확인할 필요가 있습니다.';
  });
}

function normalizeEditorialPriority(value: unknown, fallback: number) {
  const candidate = clampScore(value ?? fallback);
  // The writing model occasionally returns a 1-10 scale despite the requested
  // 0-100 scale. Do not let that malformed value sink a finished article.
  return candidate < 40 ? clampScore(fallback) : candidate;
}

export function validateGeneratedArticleDraft(draft: GeneratedArticleDraft, options?: { mode?: 'daily' | 'deep-dive'; track?: string; allowedSourceUrls?: string[] }) {
  const content = draft.content_markdown.trim();
  const sectionCount = (content.match(/^##\s+/gm) ?? []).length;
  const linkCount = (content.match(/\]\(https?:\/\//g) ?? []).length;
  const isDeepDive = options?.mode === 'deep-dive';
  const isProductBrief = options?.track === '제품/빌드 아이디어';
  const minimumCharacters = isDeepDive ? 5500 : isProductBrief ? 2500 : options?.track === '논문/리서치' ? 3500 : 3500;
  const minimumSections = isDeepDive ? 7 : isProductBrief ? 4 : 6;

  if (content.length < minimumCharacters) return { ok: false, reason: `too_short:${minimumCharacters}` };
  if (sectionCount < minimumSections) return { ok: false, reason: `too_few_sections:${minimumSections}` };
  if (/## 왜 중요한가\s*[\s\S]{0,500}## 개발자가 볼 포인트\s*[\s\S]{0,500}## 작게 만들어볼 아이디어/i.test(content)) {
    return { ok: false, reason: 'template_article' };
  }
  if (/기반\s+미니\s+프로젝트|기반\s+미니\s+데모|논문 아이디어를 활용한/i.test(content + draft.project_idea)) {
    return { ok: false, reason: 'generic_project_phrase' };
  }
  if (/(생산성을 높일 수 있습니다|포트폴리오에 도움이 됩니다|최신 트렌드를 파악할 수 있습니다)/g.test(content)) {
    return { ok: false, reason: 'generic_editorial_language' };
  }
  if (!containsHangul(content) || !containsHangul(draft.summary)) {
    return { ok: false, reason: 'not_korean' };
  }
  if (draft.source_links.length > 0 && linkCount === 0) {
    return { ok: false, reason: 'links_not_used' };
  }
  const allowedLinks = uniqueAllowedUrls(options?.allowedSourceUrls ?? []);
  const linkCheck = validateArticleLinks({ contentMarkdown: content, allowedSourceUrls: allowedLinks });
  if (linkCheck.removedLinks.length > 0) return { ok: false, reason: 'unapproved_link' };
  if (/최적의|완벽한|가장 정확한|압도적인|혁신적인|누락 없이|사이드 이펙트 없는|무조건|반드시 성공|업계 표준|핵심 경쟁력|시니어 개발자도 탐낼/i.test(`${draft.title}\n${content}`)) {
    return { ok: false, reason: 'unsupported_hype' };
  }
  if (!/##\s*(한계|주의|제약)/i.test(content) || !/##\s*(MVP|구현 범위|현실적인 MVP)/i.test(content) || !/##\s*(제외 범위|제외할)/i.test(content) || !/##\s*(완료 조건|검증|측정)/i.test(content) || !/##\s*(출처|근거)/i.test(content)) {
    return { ok: false, reason: 'missing_reality_sections' };
  }
  if ((draft.mvp_scope?.length ?? 0) > 3) return { ok: false, reason: 'mvp_scope_too_large' };
  if (!(draft.measurable_acceptance_criteria ?? []).some((criterion) => /\d/.test(criterion) && /(건|회|초|분|표시|저장|완료|응답|확인)/.test(criterion))) {
    return { ok: false, reason: 'unmeasurable_acceptance_criteria' };
  }
  if (!draft.technical_limitations?.length) return { ok: false, reason: 'missing_technical_limitations' };
  if (draft.evidence && draft.evidence.confidence === 'high' && (!draft.evidence.has_primary_source || draft.evidence.direct_metric_count === 0)) {
    return { ok: false, reason: 'invalid_evidence_confidence' };
  }
  const compactPoints = (draft.key_points ?? []).map((point) => point.replace(/^.*?:\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 80));
  if (new Set(compactPoints).size !== compactPoints.length) return { ok: false, reason: 'duplicate_reading_points' };
  return { ok: true };
}

function getArticleTrackGuide(track?: string | null) {
  if (track === 'AI/LLM') {
    return `AI/LLM 트랙:
- 핵심 질문: 이 기술/모델/에이전트 흐름이 실제 AI 앱의 품질, 비용, 신뢰도, 운영 방식에 어떤 변화를 만드는가?
- 반드시 다룰 것: 모델 선택 기준, agent/RAG/tool calling/eval/observability 중 해당되는 축, 비용과 지연시간, 환각/보안/평가 리스크.
- 좋은 글의 형태: "새 도구 소개"가 아니라 어떤 아키텍처 결정을 바꿔야 하는지 설명한다.
- 실행 섹션: 작은 eval 세트 만들기, 로그 스키마, 실패 케이스 수집, 모델 비교 기준을 구체화한다.
- 피해야 할 것: AI가 좋아진다, 생산성이 오른다 같은 일반론.`;
  }
  if (track === '프론트엔드') {
    return `프론트엔드 트랙:
- 핵심 질문: 이 흐름이 사용자의 첫 경험, 인터랙션, 상태 처리, UI 품질, 프론트엔드 개발 속도를 어떻게 바꾸는가?
- 반드시 다룰 것: UX/DX, 컴포넌트 구조, 상태 관리, 로딩/에러/빈 상태, 접근성, 배포와 성능.
- 좋은 글의 형태: 도구를 나열하지 말고 실제 화면/플로우를 어떻게 바꿀지 설명한다.
- 실행 섹션: Next.js/React 기준 화면 구조, 컴포넌트 단위, API boundary, 사용자 이벤트/분석 지표를 제시한다.
- 피해야 할 것: 예쁜 UI 만들기 수준의 얕은 조언.`;
  }
  if (track === '백엔드') {
    return `백엔드 트랙:
- 핵심 질문: 이 흐름이 데이터 모델, API, 큐/잡, 인증, 관찰 가능성, 비용, 확장성에 어떤 요구를 만드는가?
- 반드시 다룰 것: DB 스키마, API 설계, 비동기 작업, 캐싱, rate limit, 장애/재시도, 보안과 운영 지표.
- 좋은 글의 형태: 아이디어가 아니라 운영 가능한 시스템으로 바꿔 설명한다.
- 실행 섹션: 테이블/엔드포인트/잡/로그/알림/평가 지표를 구체적으로 제안한다.
- 피해야 할 것: "서버를 만든다", "DB에 저장한다" 같은 추상 문장.`;
  }
  if (track === '오픈소스/GitHub') {
    return `오픈소스/GitHub 트랙:
- 핵심 질문: 이 저장소가 해결하는 문제와 프로젝트 구조가 실제 개발자의 선택을 어떻게 바꾸는가?
- 반드시 다룰 것: 저장소의 핵심 기능, 아키텍처, 성숙도와 활동성, 라이선스, 도입 비용, 비슷한 도구와의 차이.
- 좋은 글의 형태: 스타 수를 소개하는 글이 아니라 어떤 팀이 어떤 조건에서 채택해야 하는지 판단한다.
- 실행 섹션: 로컬 실행 흐름, 최소 통합 예시, 운영 전에 확인할 이슈와 기여할 지점을 제시한다.
- 피해야 할 것: README를 번역하거나 스타 수만 나열하기.`;
  }
  if (track === '제품/빌드 아이디어') {
    return `제품/빌드 아이디어 트랙:
- 핵심 질문: 이 신호가 누구의 반복적인 문제를 해결하며, 작게 팔거나 배포할 수 있는 제품으로 바뀔 수 있는가?
- 반드시 다룰 것: 타깃 사용자, 기존 대안, 차별점, MVP 범위, 가격/유통/검증 방법, 실패 가능성.
- 좋은 글의 형태: 기술 설명보다 "왜 이걸 만들면 사람들이 쓸지"를 판단한다.
- 실행 섹션: 7일 MVP, 랜딩/온보딩/핵심 기능/결제 또는 대기 리스트/첫 유저 확보 방법을 제안한다.
- 피해야 할 것: 포트폴리오용으로 좋다는 말만 반복하기.`;
  }
  if (track === '논문/리서치') {
    return `논문/리서치 트랙:
- 핵심 질문: 이 연구가 제안한 방법이 어떤 문제를 해결하고, 개발자가 실제 시스템에 옮길 때 무엇이 달라지는가?
- 반드시 다룰 것: 연구 질문, 기존 방법의 한계, 제안 방법, 평가 설계, 결과의 의미와 한계, 재현 가능성.
- 좋은 글의 형태: 초록을 번역하지 말고 개념을 직관적인 예시와 시스템 설계 관점으로 풀어낸다.
- 실행 섹션: 논문의 핵심 아이디어를 검증할 작은 실험과 필요한 데이터, 지표, 구현 단계를 제시한다.
- 피해야 할 것: 논문 제목과 초록을 반복하거나 근거 없이 서비스 아이디어를 붙이기.`;
  }
  return `공통 트랙:
- 핵심 질문, 구현 난이도, 실사용 가치, 실패 가능성을 균형 있게 다룬다.
- 데이터에 있는 여러 source를 종합해 단일 관점을 만든다.`;
}

function normalizeScoreBreakdown(value: ScoreBreakdown | undefined, fallback: ScoreBreakdown | undefined, baseline?: number): ScoreBreakdown {
  const clamp = (score: unknown) => Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  const fallbackScore = clamp(baseline);
  // A provider can return a valid top-level score while truncating the nested
  // score_breakdown object. Missing dimensions must not silently become zero.
  const pick = (score: unknown, fallbackScoreValue: unknown) => {
    if (typeof score === 'number' && Number.isFinite(score)) return clamp(score);
    if (typeof fallbackScoreValue === 'number' && Number.isFinite(fallbackScoreValue) && fallbackScoreValue > 0) return clamp(fallbackScoreValue);
    return fallbackScore;
  };
  return {
    feasibility: pick(value?.feasibility, fallback?.feasibility),
    differentiation: pick(value?.differentiation, fallback?.differentiation),
    market: pick(value?.market, fallback?.market),
    portfolio: pick(value?.portfolio, fallback?.portfolio),
    mvp_clarity: pick(value?.mvp_clarity, fallback?.mvp_clarity),
  };
}

function weightedIdeaScore(breakdown: ScoreBreakdown) {
  return Math.round(
    Number(breakdown.feasibility ?? 0) * 0.25
    + Number(breakdown.differentiation ?? 0) * 0.2
    + Number(breakdown.market ?? 0) * 0.2
    + Number(breakdown.portfolio ?? 0) * 0.2
    + Number(breakdown.mvp_clarity ?? 0) * 0.15,
  );
}

function normalizeIdeaEvaluation(result: Partial<IdeaEvaluation>, fallback: IdeaEvaluation): IdeaEvaluation {
  const responseScore = typeof result.score === 'number' && Number.isFinite(result.score)
    ? Math.max(0, Math.min(100, Math.round(result.score)))
    : undefined;
  const scoreBreakdown = normalizeScoreBreakdown(result.score_breakdown, fallback.score_breakdown, responseScore);
  const technologies = normalizeRecommendedTechnologies(result.recommended_technologies, result.recommended_stack);
  const structuredRisks = normalizeRisks(result.structured_risks, result.risks);
  const structuredNextSteps = normalizeNextSteps(result.structured_next_steps, result.next_steps);
  return {
    score: weightedIdeaScore(scoreBreakdown),
    verdict: result.verdict ?? fallback.verdict,
    portfolio_value: result.portfolio_value ?? fallback.portfolio_value,
    difficulty: result.difficulty ?? fallback.difficulty,
    market_fit: result.market_fit ?? fallback.market_fit,
    recommended_stack: technologies.length
      ? technologies.filter((item) => item.category === 'required').map((item) => item.name)
      : (Array.isArray(result.recommended_stack) ? result.recommended_stack.slice(0, 4) : fallback.recommended_stack),
    risks: Array.isArray(result.risks) ? result.risks : fallback.risks,
    next_steps: Array.isArray(result.next_steps) ? result.next_steps : fallback.next_steps,
    score_breakdown: scoreBreakdown,
    strengths: Array.isArray(result.strengths) ? result.strengths.filter((item): item is string => typeof item === 'string') : fallback.strengths,
    weaknesses: Array.isArray(result.weaknesses) ? result.weaknesses.filter((item): item is string => typeof item === 'string') : fallback.weaknesses,
    recommended_technologies: technologies.length ? technologies : fallback.recommended_technologies,
    structured_risks: structuredRisks.length ? structuredRisks : fallback.structured_risks,
    structured_next_steps: structuredNextSteps.length ? structuredNextSteps : fallback.structured_next_steps,
    confidence: result.confidence ?? fallback.confidence,
    evidence: Array.isArray(result.evidence) ? result.evidence : fallback.evidence,
    missing_data: Array.isArray(result.missing_data) ? result.missing_data.filter((item): item is string => typeof item === 'string') : fallback.missing_data,
    user_stated: normalizeStringList(result.user_stated, fallback.user_stated),
    inferred_assumptions: normalizeStringList(result.inferred_assumptions, fallback.inferred_assumptions),
    mvp_scope: normalizeMvpScope(result.mvp_scope, fallback.mvp_scope, fallback.user_stated?.[0]),
    score_reasons: normalizeScoreReasons(result.score_reasons),
  };
}

export function applyIdeaEvidencePolicy(evaluation: IdeaEvaluation, input: { referenceCount: number; sourceTypeCount: number; marketEvidenceCount: number }) {
  const breakdown = normalizeScoreBreakdown(evaluation.score_breakdown, evaluation.score_breakdown);
  if (input.marketEvidenceCount === 0) breakdown.market = Math.min(Number(breakdown.market ?? 0), 59);

  const level: EvaluationConfidence['level'] = input.referenceCount >= 5 && input.sourceTypeCount >= 3
    ? 'high'
    : input.referenceCount >= 2 && input.sourceTypeCount >= 2
      ? 'medium'
      : 'low';
  const reason = input.referenceCount
    ? `참고 자료 ${input.referenceCount}개와 출처 ${input.sourceTypeCount}종을 기준으로 판단했습니다.${input.marketEvidenceCount === 0 ? ' 제품·시장 근거가 없어 시장성 점수는 59점 이하로 제한했습니다.' : ''}`
    : '직접 연결된 참고 자료가 없어 시장성과 경쟁 환경은 검증 전 가설로만 다뤘습니다.';

  return {
    ...evaluation,
    score: weightedIdeaScore(breakdown),
    score_breakdown: breakdown,
    confidence: { level, reason },
    market_fit: input.marketEvidenceCount === 0 && !/근거 부족|검증 전|ai 추론/i.test(evaluation.market_fit)
      ? `근거 부족. ${evaluation.market_fit}`
      : evaluation.market_fit,
  };
}

function normalizeStringList(value: unknown, fallback: string[] | undefined) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 5)
    : (fallback ?? []);
}

function normalizeMvpScope(value: unknown, fallback: EvaluationMvpScope | undefined, idea?: string): EvaluationMvpScope {
  const record = value && typeof value === 'object' ? value as Partial<EvaluationMvpScope> : {};
  const weeks = Math.max(2, Math.min(4, Math.round(Number(record.duration_weeks) || Number(fallback?.duration_weeks) || 2)));
  const fallbackFlow = inferMvpCoreUserFlow(idea);
  return {
    team_size: '1~2명',
    duration_weeks: weeks,
    core_user_flow: String(record.core_user_flow ?? (fallback?.core_user_flow?.includes('핵심 사용자 흐름 1개 정의') ? fallbackFlow : fallback?.core_user_flow) ?? fallbackFlow).trim(),
    excluded_scope: normalizeStringList(record.excluded_scope, fallback?.excluded_scope).slice(0, 5),
  };
}

function inferMvpCoreUserFlow(idea?: string) {
  const text = String(idea ?? '').toLowerCase();
  if (/api.*(문서|명세)|컴포넌트|frontend|프론트엔드/.test(text)) {
    return '개발자가 프로젝트 경로를 입력하면 관련 API 문서와 재사용 가능한 컴포넌트를 검색해 확인한다.';
  }
  return '사용자가 핵심 입력을 제출하면 한 가지 결과를 확인하고 다음 행동을 선택한다.';
}

function normalizeScoreReasons(value: unknown): Partial<Record<keyof ScoreBreakdown, EvaluationScoreReason>> {
  if (!value || typeof value !== 'object') return {};
  const record = value as Record<string, unknown>;
  const dimensions: Array<keyof ScoreBreakdown> = ['feasibility', 'differentiation', 'market', 'portfolio', 'mvp_clarity'];
  return Object.fromEntries(dimensions.flatMap((dimension) => {
    const item = record[dimension];
    if (!item || typeof item !== 'object') return [];
    const reason = item as Partial<EvaluationScoreReason>;
    return [[dimension, {
      positive: normalizeStringList(reason.positive, []),
      deductions: normalizeStringList(reason.deductions, []),
      evidence: normalizeStringList(reason.evidence, []),
    }]];
  })) as Partial<Record<keyof ScoreBreakdown, EvaluationScoreReason>>;
}

function estimateProjectComplexity(input: { title: string; summary: string; skills?: string[] }): ProjectDurationEstimate {
  const text = `${input.title} ${input.summary} ${(input.skills ?? []).join(' ')}`.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(text);
  let complexity = 0;
  let integrationCount = 0;
  const reasons: string[] = ['핵심 사용자 흐름, 기본 테스트, 배포 문서를 포함한 MVP 기준으로 계산했습니다.'];
  if (has(/ast|compiler|컴파일러|정적 분석|parser|파서/)) { complexity += 2; reasons.push('AST·파서·정적 분석 작업이 포함됩니다.'); }
  if (has(/graph|그래프|workflow|워크플로우/)) { complexity += 1; reasons.push('그래프 또는 흐름 모델링이 필요합니다.'); }
  if (has(/api|연동|slack|github|product hunt|외부|oauth|webhook/)) { complexity += 1; integrationCount += 1; reasons.push('외부 서비스 연동과 실패 처리가 필요합니다.'); }
  if (has(/mcp|model context protocol/)) { complexity += 1; reasons.push('MCP 도구 연결과 권한 확인이 필요합니다.'); }
  if (has(/python.*typescript|typescript.*python|다중 언어|multi.?language/)) { complexity += 2; reasons.push('다중 언어 실행 환경을 맞춰야 합니다.'); }
  if (has(/pdf|ocr|문서 추출/)) { complexity += 2; reasons.push('문서 추출 또는 PDF 처리 품질을 검증해야 합니다.'); }
  if (has(/knowledge graph|지식 그래프|neo4j/)) { complexity += 2; reasons.push('관계 데이터 모델과 조회 품질 검증이 필요합니다.'); }
  if (has(/benchmark|evaluation|평가 데이터|dataset|데이터셋/)) { complexity += 1; reasons.push('평가 기준과 테스트 데이터가 필요합니다.'); }
  if (has(/real.?time|실시간|협업|채팅/)) { complexity += 1; reasons.push('실시간 상태 동기화가 필요합니다.'); }
  if (has(/auth|인증|로그인|사용자/)) { complexity += 1; reasons.push('인증 또는 사용자 상태 처리가 필요합니다.'); }

  const setupHours = 4;
  const coreFeatureHours = 8 * 3;
  const integrationHours = integrationCount ? 6 : 0;
  const complexityHours = complexity * 5;
  const testingHours = Math.ceil((setupHours + coreFeatureHours + integrationHours + complexityHours) * 0.2);
  const documentationHours = 5;
  const baseHours = setupHours + coreFeatureHours + integrationHours + complexityHours + testingHours + documentationHours;
  const estimatedHoursMin = Math.max(18, Math.round(baseHours * 0.85));
  const estimatedHoursMax = Math.max(estimatedHoursMin + 6, Math.round(baseHours * 1.2));
  const assumedHoursPerDay = 3;
  const recommendedDays = Math.max(7, Math.ceil(((estimatedHoursMin + estimatedHoursMax) / 2) / assumedHoursPerDay));
  return {
    recommended_days: recommendedDays,
    minimum_days: Math.max(7, Math.ceil(estimatedHoursMin / 4)),
    maximum_days: Math.max(recommendedDays + 2, Math.ceil(estimatedHoursMax / 2.5)),
    estimated_hours_min: estimatedHoursMin,
    estimated_hours_max: estimatedHoursMax,
    assumed_hours_per_day: assumedHoursPerDay,
    reasoning: reasons.join(' '),
  };
}

function normalizeGeneratedProjectIdea(result: GeneratedProjectIdea, estimate: ProjectDurationEstimate): GeneratedProjectIdea {
  const rawScope = result.scope ?? { must_have: [], should_have: [], excluded: [] };
  const mustHave = uniqueProjectList(rawScope.must_have).slice(0, 3);
  const overflowFeatures = uniqueProjectList(rawScope.must_have).slice(3);
  const shouldHave = uniqueProjectList(rawScope.should_have).slice(0, 4);
  const excluded = uniqueProjectList([...(rawScope.excluded ?? []), ...(result.excluded_scope ?? []), ...overflowFeatures, '결제와 다중 사용자 권한', '실시간 협업과 운영 자동화']).slice(0, 7);
  const corpus = `${result.title} ${result.description} ${mustHave.join(' ')} ${(result.stack ?? []).join(' ')}`.toLowerCase();
  const complexity = projectComplexityScore(corpus);
  const level = complexity <= 2 ? '초급' : complexity <= 5 ? '중급' : '고급';
  const primaryLanguage = inferPrimaryLanguage(result.stack);
  const rawPlan = Array.isArray(result.build_plan) && result.build_plan.length ? result.build_plan.slice(0, 5) : [];
  const buildPlan = rawPlan.map((step, index) => normalizeProjectBuildStep(step, index));
  const planHours = buildPlan.reduce((total, step) => total + step.estimated_hours_max, 0);
  const deterministic = estimate;
  const estimatedHoursMin = Math.max(deterministic.estimated_hours_min, Math.round(planHours * 0.85));
  const estimatedHoursMax = Math.max(deterministic.estimated_hours_max, planHours);
  const recommendedDays = Math.max(7, Math.ceil(((estimatedHoursMin + estimatedHoursMax) / 2) / deterministic.assumed_hours_per_day));
  const constraints: ProjectConstraints = {
    target_level: level === '초급' ? 'beginner' : level === '중급' ? 'intermediate' : 'advanced',
    duration_days_min: Math.max(7, Math.ceil(estimatedHoursMin / 4)),
    duration_days_max: Math.max(recommendedDays + 2, Math.ceil(estimatedHoursMax / 2.5)),
    estimated_hours_min: estimatedHoursMin,
    estimated_hours_max: estimatedHoursMax,
    primary_language: primaryLanguage,
    core_feature_count: mustHave.length || Math.min(3, Math.max(1, (result.scope?.must_have ?? []).length)),
    integration_count: countProjectIntegrations(corpus),
    excluded_features: excluded,
  };
  const stackDetails = normalizeProjectStackDetails(result.stack_details, result.stack, primaryLanguage);
  const technicalLimitations = uniqueProjectList(result.technical_limitations).length
    ? uniqueProjectList(result.technical_limitations).slice(0, 4)
    : ['외부 API 응답 형식과 호출 제한에 따라 결과가 달라질 수 있습니다.', '초기 버전은 대표 사용자 흐름 한 개만 검증하며 모든 예외 상황을 다루지 않습니다.'];
  const validationMetrics = normalizeValidationMetrics(result.validation_metrics);
  return {
    ...result,
    title: removeProjectHype(result.title),
    description: removeProjectHype(result.description),
    level,
    duration_days: recommendedDays,
    duration_estimate: {
      recommended_days: recommendedDays,
      minimum_days: constraints.duration_days_min,
      maximum_days: constraints.duration_days_max,
      estimated_hours_min: estimatedHoursMin,
      estimated_hours_max: estimatedHoursMax,
      assumed_hours_per_day: deterministic.assumed_hours_per_day,
      reasoning: deterministic.reasoning,
    },
    scope: { must_have: mustHave, should_have: shouldHave, excluded },
    build_plan: buildPlan,
    stack: stackDetails.map((item) => item.name).slice(0, 6),
    stack_details: stackDetails,
    mvp_acceptance: measurableProjectAcceptance(result.mvp_acceptance),
    difficulty_reasons: uniqueProjectList([...(result.difficulty_reasons ?? []), ...complexityReasons(corpus, complexity)]).slice(0, 4),
    expansion_ideas: uniqueProjectList([...(result.expansion_ideas ?? []), ...overflowFeatures]).slice(0, 5),
    project_constraints: constraints,
    technical_limitations: technicalLimitations.map(removeProjectHype),
    assumptions: uniqueProjectList(result.assumptions).slice(0, 4),
    excluded_scope: excluded,
    complexity_reasons: uniqueProjectList([...(result.complexity_reasons ?? []), ...complexityReasons(corpus, complexity)]).slice(0, 4),
    schedule_reasoning: removeProjectHype(result.schedule_reasoning || deterministic.reasoning),
    validation_metrics: validationMetrics,
  };
}

function uniqueProjectList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
}

function projectComplexityScore(text: string) {
  const checks: Array<[RegExp, number]> = [
    [/ast|compiler|컴파일러|정적 분석|parser|파서/, 2], [/graph|그래프/, 1], [/mcp|model context protocol/, 1],
    [/python.*typescript|typescript.*python|다중 언어|multi.?language/, 2], [/pdf|ocr|문서 추출/, 2],
    [/knowledge graph|지식 그래프|neo4j/, 2], [/benchmark|evaluation|평가 데이터|dataset|데이터셋/, 1], [/real.?time|실시간|협업|채팅/, 1],
  ];
  return checks.reduce((score, [pattern, points]) => score + (pattern.test(text) ? points : 0), 0);
}

function countProjectIntegrations(text: string) {
  const matches = text.match(/github api|slack|product hunt|openai api|anthropic|openrouter|oauth|webhook|외부 api|external api|api 연동/g) ?? [];
  return Math.min(1, new Set(matches).size);
}

function inferPrimaryLanguage(stack: string[] | undefined) {
  const text = (stack ?? []).join(' ').toLowerCase();
  if (/python|fastapi|django/.test(text)) return 'Python';
  if (/go|golang/.test(text)) return 'Go';
  if (/rust/.test(text)) return 'Rust';
  if (/java|spring/.test(text)) return 'Java';
  return 'TypeScript';
}

function normalizeProjectStackDetails(details: ProjectStackDetail[] | undefined, stack: string[] | undefined, primaryLanguage: string): ProjectStackDetail[] {
  const complex = /neo4j|langchain|llamaindex|ocr|vector|pinecone|weaviate|multi.?agent/i;
  const source = details?.length ? details : (stack ?? []).map((name) => ({ name, category: 'core' as const, reason: 'MVP 구현에 필요한 기술입니다.' }));
  const normalized = source.flatMap((item) => {
    const name = String(item.name ?? '').trim();
    if (!name) return [];
    const category = complex.test(name) ? 'optional' : item.category === 'scale' || item.category === 'alternative' || item.category === 'optional' ? item.category : 'core';
    return [{ name, category: category as ProjectStackDetail['category'], reason: removeProjectHype(String(item.reason ?? 'MVP 구현에 사용하는 기술입니다.')) }];
  });
  if (!normalized.some((item) => item.name.toLowerCase().includes(primaryLanguage.toLowerCase()))) normalized.unshift({ name: primaryLanguage, category: 'core', reason: 'MVP의 주 구현 언어입니다.' });
  const core = normalized.filter((item) => item.category === 'core').slice(0, 4);
  const rest = normalized.filter((item) => item.category !== 'core').slice(0, 3);
  return [...new Map([...core, ...rest].map((item) => [item.name.toLowerCase(), item])).values()];
}

function normalizeProjectBuildStep(step: BuildPlanStep, index: number): BuildPlanStep {
  const min = Math.max(3, Math.round(Number(step.estimated_hours_min) || 4));
  const max = Math.max(min + 1, Math.round(Number(step.estimated_hours_max) || min + 4));
  const acceptance = uniqueProjectList(step.acceptance_criteria);
  return {
    ...step,
    order: index + 1,
    title: removeProjectHype(String(step.title || `실행 단계 ${index + 1}`)),
    objective: removeProjectHype(String(step.objective || '대표 사용자 흐름을 구현하고 확인합니다.')),
    tasks: uniqueProjectList(step.tasks).slice(0, 4),
    tools: uniqueProjectList(step.tools).slice(0, 4),
    deliverable: removeProjectHype(String(step.deliverable || '실행 가능한 기능 1개')),
    done_when: measurableProjectAcceptance(step.done_when),
    estimated_hours_min: min,
    estimated_hours_max: max,
    acceptance_criteria: acceptance.length ? acceptance.slice(0, 3).map(measurableProjectAcceptance) : [measurableProjectAcceptance('')],
    risks: uniqueProjectList(step.risks).slice(0, 3),
  };
}

function measurableProjectAcceptance(value: unknown) {
  const text = removeProjectHype(String(value ?? '').trim());
  if (/\d/.test(text) && /(건|회|초|분|표시|저장|완료|응답|확인)/.test(text)) return text;
  return '테스트 입력 3건 중 3건이 결과 화면에 표시되고, 오류 입력 1건에는 안내 메시지가 표시된다.';
}

function normalizeValidationMetrics(value: unknown): ProjectValidationMetric[] {
  if (!Array.isArray(value)) return [{ metric: '대표 사용자 흐름', target: '테스트 입력 3건 중 3건 완료', method: '브라우저에서 입력부터 결과 확인까지 직접 실행' }];
  const metrics = value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Partial<ProjectValidationMetric>;
    if (!record.metric || !record.target || !record.method) return [];
    return [{ metric: removeProjectHype(String(record.metric)), target: removeProjectHype(String(record.target)), method: removeProjectHype(String(record.method)) }];
  }).slice(0, 4);
  return metrics.length ? metrics : [{ metric: '대표 사용자 흐름', target: '테스트 입력 3건 중 3건 완료', method: '브라우저에서 입력부터 결과 확인까지 직접 실행' }];
}

function complexityReasons(text: string, score: number) {
  const reasons = ['핵심 기능을 최대 3개로 제한하고 대표 사용자 흐름을 먼저 검증합니다.'];
  if (/ast|compiler|컴파일러|정적 분석|parser|파서/.test(text)) reasons.push('AST·파서·정적 분석이 난이도를 올립니다.');
  if (/mcp|model context protocol|외부 api|github api|slack|webhook/.test(text)) reasons.push('외부 프로토콜 또는 API 실패 처리가 필요합니다.');
  if (score > 5) reasons.push('복잡한 요소가 겹쳐 고급 수준으로 분류했습니다.');
  return reasons;
}

function removeProjectHype(value: string) {
  return value.replace(/정확히|완벽하게|누락 없이|사이드 이펙트 없는|최적의|가장 정확한|시니어 개발자도 탐낼|혁신적인|압도적인/g, '현실적으로');
}

function normalizeRecommendedTechnologies(value: unknown, legacy: unknown): RecommendedTechnology[] {
  const raw: RecommendedTechnology[] = Array.isArray(value)
    ? value.flatMap<RecommendedTechnology>((item) => {
      if (typeof item === 'string') return [{ name: item, category: 'required' as const, reason: 'MVP 구현에 사용할 핵심 기술입니다.' }];
      if (!item || typeof item !== 'object') return [];
      const record = item as Partial<RecommendedTechnology>;
      if (!record.name) return [];
      const category: RecommendedTechnology['category'] = record.category === 'optional' || record.category === 'scale' ? record.category : 'required';
      return [{ name: String(record.name), category, reason: String(record.reason ?? '이 아이디어에 사용할 수 있는 기술입니다.') }];
    })
    : Array.isArray(legacy)
      ? legacy.filter((item): item is string => typeof item === 'string').map((name) => ({ name, category: 'required' as const, reason: 'MVP 구현에 사용할 핵심 기술입니다.' }))
      : [];

  const seen = new Set<string>();
  let requiredCount = 0;
  return raw.flatMap((item) => {
    const name = item.name.trim();
    const key = name.toLowerCase();
    if (!name || seen.has(key)) return [];
    seen.add(key);

    if (item.category === 'required') {
      requiredCount += 1;
      if (requiredCount > 4) {
        return [{ ...item, name, category: 'optional' as const, reason: 'MVP 필수 기술은 4개로 제한해 선택 사항으로 분리했습니다.' }];
      }
    }
    return [{ ...item, name }];
  }).slice(0, 8);
}

function normalizeRisks(value: unknown, legacy: unknown): EvaluationRisk[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      if (typeof item === 'string') return [{ title: item, severity: index === 0 ? 'high' as const : 'medium' as const, impact: '구현과 검증 과정에서 추가 확인이 필요합니다.', mitigation: '범위를 줄이고 작은 실험으로 먼저 확인합니다.' }];
      if (!item || typeof item !== 'object') return [];
      const record = item as Partial<EvaluationRisk>;
      if (!record.title) return [];
      const severity = record.severity === 'high' || record.severity === 'low' ? record.severity : 'medium';
      return [{ title: String(record.title), severity, impact: String(record.impact ?? '영향을 추가로 확인해야 합니다.'), mitigation: String(record.mitigation ?? '작은 실험으로 위험을 검증합니다.') }];
    });
  }
  if (Array.isArray(legacy)) return normalizeRisks(legacy, undefined);
  return [];
}

function normalizeNextSteps(value: unknown, legacy: unknown): EvaluationNextStep[] {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => {
      if (typeof item === 'string') return [{ order: index + 1, title: item, description: item, deliverable: '작동하는 작은 결과물', done_when: measurableDoneWhen('', index) }];
      if (!item || typeof item !== 'object') return [];
      const record = item as Partial<EvaluationNextStep>;
      if (!record.title) return [];
      return [{ order: Number(record.order ?? index + 1), title: String(record.title), description: String(record.description ?? ''), deliverable: String(record.deliverable ?? '작은 구현 결과물'), done_when: measurableDoneWhen(record.done_when, index) }];
    });
  }
  if (Array.isArray(legacy)) return normalizeNextSteps(legacy, undefined);
  return [];
}

function measurableDoneWhen(value: unknown, index: number) {
  const text = String(value ?? '').trim();
  if (/\d/.test(text) && /(완료|성공|저장|처리|실행|확인|응답|사용자|건)/.test(text)) return text;
  return `${index + 1}개 핵심 흐름을 오류 없이 1회 완료하고 결과 1건을 확인`;
}

function isContentType(value: unknown): value is ContentType {
  return typeof value === 'string' && ['news', 'article', 'ai_product', 'github_repo', 'paper', 'career_tip', 'build_idea', 'deep_dive'].includes(value);
}

function isNewsletterSection(value: unknown): value is NewsletterSection {
  return typeof value === 'string' && ['daily_briefing', 'ai_product_radar', 'github_project_pick', 'build_idea', 'career_tip', 'deep_dive', 'paper_to_project'].includes(value);
}

function buildFallbackPaperAnalysis(input: { title: string; abstract: string; categories: string[]; hasCode: boolean }): PaperAnalysis {
  const cleanAbstract = cleanResearchAbstract(input.abstract);
  const easySummary = buildKoreanPaperFallbackSummary(input.title, cleanAbstract);
  const expertSummary = buildKoreanPaperExpertFallback(input.title, cleanAbstract);
  const implementationIdea = buildPaperImplementationIdea(input.title, cleanAbstract);
  const serviceIdea = buildPaperServiceIdea(input.title, cleanAbstract);
  const beginnerScore = input.abstract.length < 1200 ? 72 : 54;
  const buildabilityScore = input.hasCode ? 82 : 62;
  const businessScore = /agent|rag|retrieval|tool|workflow|code|ui|app|search|automation/i.test(`${input.title} ${cleanAbstract}`) ? 78 : 56;
  const researchDepthScore = /theorem|proof|optimization|benchmark|architecture|training|loss/i.test(cleanAbstract) ? 82 : 60;
  const reviewType = input.hasCode
    ? '코드가 공개된 논문'
    : beginnerScore >= 70
      ? '초보 개발자도 이해할 만한 논문'
      : businessScore >= 70
        ? '서비스 아이디어로 연결 가능한 논문'
        : researchDepthScore >= 80
          ? '연구자용 고난도 논문'
          : '오늘 볼만한 논문';

  return {
    relevance_score: 65,
    review_type: reviewType,
    beginner_summary: easySummary,
    expert_summary: expertSummary,
    why_it_matters: 'AI와 개발 트렌드를 이해하고 작은 구현 프로젝트로 연결할 수 있는 연구입니다.',
    key_points: [input.title, easySummary, input.categories.join(', ') || 'AI/CS research'],
    related_skills: ['Paper Reading', 'AI', 'Prototype'],
    implementation_idea: implementationIdea,
    service_idea: serviceIdea,
    difficulty: beginnerScore >= 70 ? '중급' : '고급',
    target_reader: beginnerScore >= 70 ? '초보 개발자와 제품 빌더' : 'AI 구현 경험이 있는 개발자',
    trend_score: 65,
    buildability_score: buildabilityScore,
    beginner_score: beginnerScore,
    business_score: businessScore,
    research_depth_score: researchDepthScore,
    target_levels: beginnerScore >= 70 ? ['입문자', '초보자'] : ['중급자', '실무 경험 있음'],
    target_goals: ['최신 기술 공부', input.hasCode ? '포트폴리오 만들기' : '사이드 프로젝트'],
    target_interests: ['논문 쉽게 읽기', 'AI/API 연동', input.hasCode ? '오픈소스' : '데이터/DB'],
    content_depth: beginnerScore >= 70 ? '핵심과 예시 중심' : '기술 배경까지 자세히',
  };
}

function cleanResearchAbstract(value: string) {
  return value
    .replace(/^arxiv:\S+\s*/i, '')
    .replace(/^announce\s+type:\s*\w+\s*/i, '')
    .replace(/^abstract:\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildKoreanPaperFallbackSummary(title: string, abstract: string) {
  const lower = `${title} ${abstract}`.toLowerCase();
  if (/agent|coding agent|code agent/.test(lower)) {
    return '이 논문은 코딩 에이전트가 실제 개발 작업에서 얼마나 잘 동작하는지 평가하는 방법을 다룹니다. 초보 개발자는 “AI가 코드를 잘 짜는지”를 단순 정답률이 아니라 작업 과정과 결과물 기준으로 봐야 한다는 관점으로 읽으면 좋습니다.';
  }
  if (/routing|attention|kv-cache|cache|moe|expert/.test(lower)) {
    return '이 논문은 언어 모델을 더 효율적으로 실행하기 위한 라우팅, 어텐션, 캐시 활용 방식을 다룹니다. 초보 개발자는 모델 성능뿐 아니라 추론 비용과 속도를 함께 최적화하는 연구로 이해하면 됩니다.';
  }
  if (/retrieval|rag|vector/.test(lower)) {
    return '이 논문은 검색 기반 생성이나 외부 지식 활용 방식을 더 안정적으로 만드는 방법을 다룹니다. 초보 개발자는 LLM 앱에서 문서 검색과 답변 품질을 연결하는 아이디어로 읽으면 좋습니다.';
  }
  return `${title} 논문은 ${abstract ? truncate(abstract, 180) : 'AI와 컴퓨터공학의 최신 연구 주제'}를 다룹니다. 초보 개발자는 세부 수식보다 어떤 문제를 해결하려는지, 그리고 작은 데모로 구현할 수 있는 부분이 무엇인지에 집중하면 좋습니다.`;
}

function buildKoreanPaperExpertFallback(title: string, abstract: string) {
  const lower = `${title} ${abstract}`.toLowerCase();
  if (/agent|coding agent|code agent/.test(lower)) {
    return '이 연구는 코딩 에이전트의 결과물뿐 아니라 작업 경로와 상호작용 과정을 평가하려는 흐름과 연결됩니다. 실무 관점에서는 에이전트 벤치마크, 로그 기반 평가, 실패 케이스 분석 체계를 설계할 때 참고할 수 있습니다.';
  }
  if (/retrieval|rag|vector/.test(lower)) {
    return '이 연구는 외부 문서 검색과 생성 모델 답변을 연결할 때 신뢰도와 최신성을 높이는 문제를 다룹니다. 실무 관점에서는 문서 인덱싱, 검색 품질 평가, 답변 근거 표시, 환각 감소 설계에 초점을 맞춰 읽을 수 있습니다.';
  }
  if (/routing|attention|kv-cache|cache|moe|expert/.test(lower)) {
    return '이 연구는 모델 추론 과정의 비용, 속도, 품질을 조절하는 시스템 설계와 연결됩니다. 실무 관점에서는 대규모 모델 서빙, 캐시 전략, 라우팅 정책을 평가하는 기준으로 참고할 수 있습니다.';
  }
  return '이 연구는 AI 시스템을 실제 서비스나 개발 워크플로우에 적용할 때 필요한 문제 정의와 평가 관점을 제공합니다. 실무 관점에서는 논문의 세부 알고리즘보다 입력, 출력, 평가 기준을 작은 프로토타입으로 재현할 수 있는지 확인하는 것이 중요합니다.';
}

function buildPaperImplementationIdea(title: string, abstract: string) {
  const lower = `${title} ${abstract}`.toLowerCase();
  if (/agent|coding agent|code agent/.test(lower)) return '코딩 에이전트 실행 로그를 수집하고 성공/실패 이유를 태깅하는 평가 대시보드 만들기';
  if (/retrieval|rag|vector/.test(lower)) return '문서 검색 결과와 LLM 답변 근거를 함께 보여주는 RAG 품질 점검 도구 만들기';
  if (/routing|attention|kv-cache|cache|moe|expert/.test(lower)) return '여러 모델 호출 전략의 비용과 응답 품질을 비교하는 추론 라우팅 실험 도구 만들기';
  return '논문의 입력/출력 구조를 단순화해 작은 웹 데모로 재현하기';
}

function buildPaperServiceIdea(title: string, abstract: string) {
  const lower = `${title} ${abstract}`.toLowerCase();
  if (/agent|coding agent|code agent/.test(lower)) return '팀에서 사용하는 AI 코딩 에이전트의 작업 품질을 리뷰하고 리포트로 남기는 개발 생산성 서비스';
  if (/retrieval|rag|vector/.test(lower)) return '사내 문서 기반 AI 답변의 근거, 최신성, 정확도를 점검하는 RAG 운영 대시보드';
  if (/routing|attention|kv-cache|cache|moe|expert/.test(lower)) return 'LLM API 비용과 품질을 기준으로 모델 라우팅 정책을 추천하는 운영 도구';
  return '논문의 핵심 평가 방식을 제품 아이디어 검증 체크리스트로 바꾼 개발자 도구';
}

function normalizePaperAnalysis(result: Partial<PaperAnalysis>, fallback: PaperAnalysis): PaperAnalysis {
  return {
    relevance_score: clampScore(result.relevance_score ?? fallback.relevance_score),
    review_type: result.review_type ?? fallback.review_type,
    beginner_summary: result.beginner_summary ?? fallback.beginner_summary,
    expert_summary: result.expert_summary ?? fallback.expert_summary,
    why_it_matters: result.why_it_matters ?? fallback.why_it_matters,
    key_points: Array.isArray(result.key_points) ? result.key_points : fallback.key_points,
    related_skills: Array.isArray(result.related_skills) ? result.related_skills : fallback.related_skills,
    implementation_idea: result.implementation_idea ?? fallback.implementation_idea,
    service_idea: result.service_idea ?? fallback.service_idea,
    difficulty: result.difficulty ?? fallback.difficulty,
    target_reader: result.target_reader ?? fallback.target_reader,
    trend_score: clampScore(result.trend_score ?? fallback.trend_score),
    buildability_score: clampScore(result.buildability_score ?? fallback.buildability_score),
    beginner_score: clampScore(result.beginner_score ?? fallback.beginner_score),
    business_score: clampScore(result.business_score ?? fallback.business_score),
    research_depth_score: clampScore(result.research_depth_score ?? fallback.research_depth_score),
    target_levels: Array.isArray(result.target_levels) ? result.target_levels : fallback.target_levels,
    target_goals: Array.isArray(result.target_goals) ? result.target_goals : fallback.target_goals,
    target_interests: Array.isArray(result.target_interests) ? result.target_interests : fallback.target_interests,
    content_depth: result.content_depth ?? fallback.content_depth,
  };
}

function validatePaperAnalysisQuality(analysis: PaperAnalysis, input: { abstract: string }) {
  const combined = [
    analysis.beginner_summary,
    analysis.expert_summary,
    analysis.why_it_matters,
    analysis.implementation_idea,
    analysis.service_idea,
    ...analysis.key_points,
  ].join('\n');
  const lower = combined.toLowerCase();
  const abstractSlice = cleanResearchAbstract(input.abstract).slice(0, 80).toLowerCase();

  if (!containsHangul(analysis.beginner_summary) || !containsHangul(analysis.expert_summary)) {
    return { ok: false, reason: 'not_korean' };
  }
  if (/arxiv:\S+|announce type|abstract:/i.test(combined)) {
    return { ok: false, reason: 'raw_arxiv_metadata' };
  }
  if (abstractSlice.length >= 40 && lower.includes(abstractSlice)) {
    return { ok: false, reason: 'abstract_copy' };
  }
  if (/기반\s+미니\s+데모\s+만들기|논문 아이디어를 활용한|제목.*기반/i.test(combined)) {
    return { ok: false, reason: 'generic_fallback_phrase' };
  }
  if (analysis.expert_summary.length < 500 || analysis.beginner_summary.length < 160 || analysis.why_it_matters.length < 70) {
    return { ok: false, reason: 'too_short' };
  }
  if (analysis.implementation_idea.length < 20 || analysis.service_idea.length < 20) {
    return { ok: false, reason: 'weak_idea' };
  }
  if (analysis.key_points.some((point) => point.length < 18) || new Set(analysis.key_points.map((point) => point.trim())).size < 3) {
    return { ok: false, reason: 'weak_key_points' };
  }
  return { ok: true };
}

function ensureKoreanTitle(title: string) {
  const normalized = title.trim();
  if (!normalized) return '기술 뉴스 요약';
  if (containsHangul(normalized)) return normalized;
  return `영문 아티클 요약: ${truncate(normalized, 90)}`;
}

function containsHangul(value: string) {
  return /[가-힣]/.test(value);
}

function clampScore(value: unknown) {
  return Math.max(0, Math.min(100, Number(value ?? 0)));
}
