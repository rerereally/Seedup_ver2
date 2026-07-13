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

- 트렌드 신호를 수집하고 저장하는 기본 CRUD 기능
- 사용자가 결과를 확인할 수 있는 간단한 UI 화면
- 외부 API 또는 AI를 활용한 분석 또는 자동화 기능

## 왜 만들어볼 만한가요?

이 프로젝트는 단순한 클론 코딩이 아니라 실제 문제를 정의하고 해결하는 과정을 담습니다. 포트폴리오에 올릴 때 "왜 만들었는지"를 설명할 수 있어 면접에서도 강점이 됩니다.

## 이 프로젝트로 배울 수 있는 것

- Next.js와 Supabase를 연결하는 풀스택 흐름
- 외부 API를 fetch로 호출하고 데이터를 화면에 표시하는 방법
- Vercel을 통한 자동 배포와 도메인 연결 경험`;

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
    duration_estimate: estimate,
    scope: {
      must_have: ['핵심 사용자 흐름 1개', '입력·결과 화면', '최소 데이터 저장', '배포 가능한 실행 경로'],
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
  };
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { idea: fallback, model: null };

  try {
    const { result, model } = await callOpenRouter<GeneratedProjectIdea>(apiKey, [
      { role: 'system', content: '너는 초보 개발자를 위한 프로젝트 코치다. 뉴스/제품/오픈소스 신호를 포트폴리오 프로젝트로 바꾼다. 반드시 JSON만 반환한다.' },
      {
        role: 'user',
        content: `아래 소스를 기반으로 만들 만한 프로젝트 1개를 JSON으로 제안하라.

규칙:
- description은 마크다운으로 작성하며 반드시 아래 5개 ## 섹션을 모두 포함한다.
  ## 이 프로젝트는 무엇인가요?   → 2~3문장으로 서비스 개요
  ## 어떤 문제를 해결하나요?    → 어떤 불편함/필요를 해결하는지 구체적으로
  ## 핵심 기능                  → bullet list로 3~5개 기능 나열
  ## 왜 만들어볼 만한가요?       → 학습 가치, 포트폴리오 차별점
  ## 이 프로젝트로 배울 수 있는 것 → bullet list로 3~5개 학습 포인트
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
  "build_plan": [{"order": 1, "title": "핵심 기능 구현", "objective": "대표 흐름을 만든다", "tasks": ["작업"], "tools": ["기술"], "deliverable": "산출물", "done_when": "완료 조건", "estimated_hours_min": 4, "estimated_hours_max": 8, "dependencies": []}],
  "prerequisites": ["선행 지식"],
  "difficulty_reasons": ["추천 수준 판단 이유"],
  "mvp_acceptance": "검증 가능한 MVP 완료 기준",
  "expansion_ideas": ["추후 확장"],
  "stack_details": [{"name": "기술", "category": "core | optional | alternative | scale", "reason": "추천 이유"}]
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
}) {
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
  };
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { draft: fallback, model: null };

  try {
    const trackGuide = getArticleTrackGuide(input.track);
    const { result, model } = await callOpenRouter<GeneratedArticleDraft>(apiKey, [
      {
        role: 'system',
        content: '너는 Seedup의 시니어 테크 에디터다. Lenny’s Newsletter처럼 길고 실용적인 한국어 개발자 에세이를 쓴다. 단순 요약이 아니라 관점, 판단, 반론, 사례, 실행 방법, 참고 도구가 있는 유료 뉴스레터급 글을 만든다. 반드시 JSON만 반환한다.',
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
- 데이터에 명시된 링크나 출처가 있으면 본문에 마크다운 링크로 넣는다. 링크가 없으면 URL을 지어내지 않는다.
- 관련 제품/도구가 데이터에 있으면 "함께 봐야 할 도구" 섹션에서 실제 활용 관점으로 설명한다.
- "왜 중요한가/개발자가 볼 포인트/작게 만들어볼 아이디어" 같은 짧은 템플릿만 반복하지 않는다.
- 본문은 최소 7개 이상의 ## 섹션을 가진다.
- 독자가 바로 따라 할 수 있는 체크리스트, 구현 순서, 평가 기준을 포함한다.
- 과장 금지. 아직 검증이 필요한 부분과 실패 가능성도 적는다.
- “이런 프로젝트를 만들어보세요”에서 끝내지 말고, 데이터 모델/API/화면/평가 지표까지 구체화한다.
- 트랙별 에디토리얼 전략을 반드시 반영한다. 모든 트랙에 같은 구조/톤을 반복하지 않는다.
- difficulty는 권장 난이도와 일치시킨다. 튜토리얼·실습형 자료는 초급, 운영·성능·보안·분산 시스템 자료는 고급, 그 외는 중급으로 판단한다.
- tags와 related_skills는 각각 6개 이하로 제한한다.

권장 글 구조:
1. 도입: 이 흐름이 왜 지금 나타났는지
2. 핵심 주장: Seedup 독자가 가져가야 할 관점
3. 현재 선택지/제품/오픈소스/논문 신호 정리
4. 실제로 만들면 어디가 어려운지
5. 써볼 만한 도구와 링크
6. 7일 안에 만들 수 있는 MVP 설계
7. 평가 지표와 실패 조건
8. 누구에게 추천하고 누구에게는 아직 이른지
9. 마무리: 다음 액션

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
  "editorial_angle": "이 글의 핵심 관점 한 문장"
}

source_type: ${input.sourceType}
title: ${input.title}
trend: ${input.trend ?? ''}
skills: ${(input.skills ?? []).join(', ')}
source_data:
${truncate(input.summary, 9000)}`,
      },
    ], { maxTokens: 6000, models: getWritingModels(), jsonMode: true, timeoutMs: ARTICLE_OPENROUTER_TIMEOUT_MS });

    const draft = normalizeArticleDraft(result, fallback);
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
  "missing_data": ["추가 검증이 필요한 데이터"]
}

idea: ${truncate(input.idea, 2500)}

추가 규칙:
- 점수는 구현 가능성, 차별성, 시장성, 포트폴리오 가치, MVP 명확성을 종합하되 임의의 세부 점수를 UI에서 만들지 않는다.
- 각 세부 점수는 0~100 정수다. 종합 점수는 feasibility 25%, differentiation 20%, market 20%, portfolio 20%, mvp_clarity 15%의 가중 평균을 반올림해 계산한다.
- 문제, 대상 사용자, 해결 방식 중 둘 이상이 명확하지 않으면 MVP 명확성과 시장성에 40점을 넘기지 않는다. 근거가 부족하면 높게 추정하지 말고 낮은 신뢰도와 보완 질문을 제시한다.
- 참고 자료에 직접 근거가 없으면 시장성은 "근거 부족" 또는 "AI 추론"으로 표현한다.
- recommended_technologies는 MVP 필수(required), 선택(optional), 확장(scale)으로 구분하고 기술마다 이유를 쓴다. 한 MVP에 불필요한 기술을 과도하게 넣지 않는다.
- structured_risks는 위험마다 심각도, 영향, 현실적인 대응 방법을 포함한다.
- structured_next_steps는 작업, 산출물, 완료 조건을 포함한다. 근거 없는 기간이나 시장 규모를 만들지 않는다.
- 결과는 한국어로 작성하고 기술명만 원문 표기를 유지한다.

참고 자료:
${input.context || '관련 자료를 찾지 못했다. 일반론을 최신 사실처럼 말하지 말고 불확실성을 표시하라.'}`,
      },
    ], { models: getWritingModels(), jsonMode: true, temperature: 0 });

    return { evaluation: normalizeIdeaEvaluation(result, fallback), model };
  } catch (error) {
    console.error('OpenRouter idea evaluation failed', error);
    return { evaluation: null, model: null, error: '평가 모델 응답을 만들지 못했습니다.' };
  }
}

export async function answerArticleQuestion(input: {
  title: string;
  summary: string;
  content: string;
  question: string;
}) {
  const fallback: ArticleQuestionAnswer = {
    answer: `이 글의 핵심은 "${input.title}"와 관련된 기술 흐름을 이해하는 것입니다. 질문을 조금 더 구체적으로 적으면 기술 선택이나 구현 순서까지 좁혀볼 수 있어요.`,
  };
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { result: fallback, model: null };

  try {
    const { result, model } = await callOpenRouter<ArticleQuestionAnswer>(apiKey, [
      { role: 'system', content: '너는 Seedup 아티클을 읽는 초보 개발자를 돕는 짧은 Q&A 튜터다. 반드시 JSON만 반환한다. 원문에 없는 사실은 만들지 않는다.' },
      {
        role: 'user',
        content: `아래 아티클 내용만 근거로 사용자의 질문에 한국어로 짧게 답하라.

규칙:
- 답변은 3~6문장으로 간결하게 작성한다.
- 글에 없는 사실은 추측하지 않는다.

출력 JSON:
{
  "answer": "질문에 대한 답변"
}

title: ${input.title}
summary: ${truncate(input.summary, 700)}
content: ${truncate(input.content, 2200)}
question: ${truncate(input.question, 500)}`,
      },
    ], { models: getWritingModels(), jsonMode: true });

    return { result: { ...fallback, ...result }, model };
  } catch (error) {
    console.error('OpenRouter article question failed', error);
    return { result: fallback, model: null };
  }
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

      const content = json.choices?.[0]?.message?.content;
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

function normalizeArticleDraft(result: Partial<GeneratedArticleDraft>, fallback: GeneratedArticleDraft): GeneratedArticleDraft {
  const title = ensureKoreanTitle(result.title ?? fallback.title);
  const summary = result.summary ?? fallback.summary;
  const content = result.content_markdown?.trim() || fallback.content_markdown;
  const priority = normalizeEditorialPriority(result.newsletter_priority, fallback.newsletter_priority);

  return {
    title,
    summary,
    content_markdown: content.startsWith('#') ? content : `# ${title}\n\n${content}`,
    category: result.category ?? fallback.category,
    content_type: isContentType(result.content_type) ? result.content_type : fallback.content_type,
    newsletter_section: isNewsletterSection(result.newsletter_section) ? result.newsletter_section : fallback.newsletter_section,
    newsletter_priority: priority,
    tags: Array.isArray(result.tags) ? result.tags.slice(0, 6) : fallback.tags,
    related_skills: Array.isArray(result.related_skills) ? result.related_skills.slice(0, 6) : fallback.related_skills,
    project_idea: result.project_idea ?? fallback.project_idea,
    why_it_matters: result.why_it_matters ?? fallback.why_it_matters,
    key_points: Array.isArray(result.key_points) ? result.key_points.slice(0, 5) : fallback.key_points,
    difficulty: result.difficulty ?? fallback.difficulty,
    target_levels: Array.isArray(result.target_levels) ? result.target_levels.slice(0, 4) : fallback.target_levels,
    target_goals: Array.isArray(result.target_goals) ? result.target_goals.slice(0, 5) : fallback.target_goals,
    target_interests: Array.isArray(result.target_interests) ? result.target_interests.slice(0, 5) : fallback.target_interests,
    referenced_tools: Array.isArray(result.referenced_tools) ? result.referenced_tools.slice(0, 10) : fallback.referenced_tools,
    source_links: Array.isArray(result.source_links) ? result.source_links.slice(0, 10) : fallback.source_links,
    editorial_angle: result.editorial_angle ?? fallback.editorial_angle,
  };
}

function normalizeEditorialPriority(value: unknown, fallback: number) {
  const candidate = clampScore(value ?? fallback);
  // The writing model occasionally returns a 1-10 scale despite the requested
  // 0-100 scale. Do not let that malformed value sink a finished article.
  return candidate < 40 ? clampScore(fallback) : candidate;
}

export function validateGeneratedArticleDraft(draft: GeneratedArticleDraft, options?: { mode?: 'daily' | 'deep-dive'; track?: string }) {
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

function normalizeScoreBreakdown(value: ScoreBreakdown | undefined, fallback: ScoreBreakdown | undefined): ScoreBreakdown {
  const clamp = (score: unknown) => Math.max(0, Math.min(100, Math.round(Number(score) || 0)));
  return {
    feasibility: clamp(value?.feasibility ?? fallback?.feasibility),
    differentiation: clamp(value?.differentiation ?? fallback?.differentiation),
    market: clamp(value?.market ?? fallback?.market),
    portfolio: clamp(value?.portfolio ?? fallback?.portfolio),
    mvp_clarity: clamp(value?.mvp_clarity ?? fallback?.mvp_clarity),
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
  const scoreBreakdown = normalizeScoreBreakdown(result.score_breakdown, fallback.score_breakdown);
  const technologies = normalizeRecommendedTechnologies(result.recommended_technologies, result.recommended_stack);
  const structuredRisks = normalizeRisks(result.structured_risks, result.risks);
  const structuredNextSteps = normalizeNextSteps(result.structured_next_steps, result.next_steps);
  return {
    score: weightedIdeaScore(scoreBreakdown),
    verdict: result.verdict ?? fallback.verdict,
    portfolio_value: result.portfolio_value ?? fallback.portfolio_value,
    difficulty: result.difficulty ?? fallback.difficulty,
    market_fit: result.market_fit ?? fallback.market_fit,
    recommended_stack: Array.isArray(result.recommended_stack) ? result.recommended_stack : fallback.recommended_stack,
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
  };
}

function estimateProjectComplexity(input: { title: string; summary: string; skills?: string[] }): ProjectDurationEstimate {
  const text = `${input.title} ${input.summary} ${(input.skills ?? []).join(' ')}`.toLowerCase();
  const has = (pattern: RegExp) => pattern.test(text);
  let hours = 14;
  const reasons: string[] = ['핵심 기능 1개와 최소 화면·배포를 기준으로 계산했습니다.'];
  if (has(/api|연동|slack|github|product hunt|외부/)) { hours += 6; reasons.push('외부 API 연동이 포함되어 있습니다.'); }
  if (has(/auth|인증|로그인|사용자/)) { hours += 5; reasons.push('인증 또는 사용자 상태 처리가 필요합니다.'); }
  if (has(/real.?time|실시간|협업|채팅/)) { hours += 8; reasons.push('실시간 상태 동기화가 필요합니다.'); }
  if (has(/rag|검색 증강|벡터|embedding/)) { hours += 8; reasons.push('RAG 데이터 준비와 검색 품질 검증이 필요합니다.'); }
  if (has(/tool.?calling|에이전트|agent|예약/)) { hours += 8; reasons.push('AI 도구 호출과 실패 응답 검증이 필요합니다.'); }
  if (has(/dashboard|대시보드|관리자|admin/)) { hours += 6; reasons.push('관리 화면과 운영 상태가 필요합니다.'); }
  if (has(/결제|payment|멀티테넌트|multi.?tenant/)) { hours += 12; reasons.push('결제 또는 멀티테넌트 운영은 MVP 범위를 크게 늘립니다.'); }
  const estimatedHoursMin = Math.max(12, Math.round(hours * 0.85));
  const estimatedHoursMax = Math.round(hours * 1.35);
  const assumedHoursPerDay = 2;
  const recommendedDays = Math.max(5, Math.ceil(hours / assumedHoursPerDay));
  return {
    recommended_days: recommendedDays,
    minimum_days: Math.max(3, Math.ceil(estimatedHoursMin / 3)),
    maximum_days: Math.ceil(estimatedHoursMax / 1.5),
    estimated_hours_min: estimatedHoursMin,
    estimated_hours_max: estimatedHoursMax,
    assumed_hours_per_day: assumedHoursPerDay,
    reasoning: reasons.join(' '),
  };
}

function normalizeGeneratedProjectIdea(result: GeneratedProjectIdea, estimate: ProjectDurationEstimate): GeneratedProjectIdea {
  const duration = result.duration_estimate ?? estimate;
  const plan = Array.isArray(result.build_plan) && result.build_plan.length ? result.build_plan : undefined;
  const planHours = plan?.reduce((total, step) => total + (Number(step.estimated_hours_max) || 0), 0) ?? 0;
  const recommendedDays = Math.max(3, Math.ceil(Math.max(Number(duration.recommended_days) || 0, estimate.recommended_days, planHours / estimate.assumed_hours_per_day)));
  return {
    ...result,
    duration_days: recommendedDays,
    duration_estimate: {
      recommended_days: recommendedDays,
      minimum_days: Math.max(3, Math.round(Math.min(recommendedDays, duration.minimum_days || estimate.minimum_days))),
      maximum_days: Math.max(recommendedDays, Math.round(duration.maximum_days || estimate.maximum_days)),
      estimated_hours_min: Math.max(1, Math.round(duration.estimated_hours_min || estimate.estimated_hours_min)),
      estimated_hours_max: Math.max(1, Math.round(duration.estimated_hours_max || estimate.estimated_hours_max)),
      assumed_hours_per_day: Math.max(1, Number(duration.assumed_hours_per_day || estimate.assumed_hours_per_day)),
      reasoning: String(duration.reasoning || estimate.reasoning),
    },
    build_plan: plan,
  };
}

function normalizeRecommendedTechnologies(value: unknown, legacy: unknown): RecommendedTechnology[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      if (typeof item === 'string') return [{ name: item, category: 'required' as const, reason: 'MVP 구현에 사용할 핵심 기술입니다.' }];
      if (!item || typeof item !== 'object') return [];
      const record = item as Partial<RecommendedTechnology>;
      if (!record.name) return [];
      const category = record.category === 'optional' || record.category === 'scale' ? record.category : 'required';
      return [{ name: String(record.name), category, reason: String(record.reason ?? '이 아이디어에 사용할 수 있는 기술입니다.') }];
    });
  }
  if (Array.isArray(legacy)) return legacy.filter((item): item is string => typeof item === 'string').map((name) => ({ name, category: 'required', reason: 'MVP 구현에 사용할 핵심 기술입니다.' }));
  return [];
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
      if (typeof item === 'string') return [{ order: index + 1, title: item, description: item, deliverable: '작동하는 작은 결과물', done_when: '핵심 흐름을 한 번 실행할 수 있음' }];
      if (!item || typeof item !== 'object') return [];
      const record = item as Partial<EvaluationNextStep>;
      if (!record.title) return [];
      return [{ order: Number(record.order ?? index + 1), title: String(record.title), description: String(record.description ?? ''), deliverable: String(record.deliverable ?? '작은 구현 결과물'), done_when: String(record.done_when ?? '핵심 흐름이 동작함') }];
    });
  }
  if (Array.isArray(legacy)) return normalizeNextSteps(legacy, undefined);
  return [];
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
