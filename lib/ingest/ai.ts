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
};

export type ArticleQuestionAnswer = {
  answer: string;
  project_prompt?: string;
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

const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';
const FALLBACK_MODEL = 'google/gemini-3.5-flash';
const OPENROUTER_TIMEOUT_MS = 45_000;
const MODEL_ROUTES = {
  preprocess: [
    'google/gemini-2.5-flash',
  ],
  writing: [
    'google/gemini-3.5-flash',
  ],
};

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
    ], { models: MODEL_ROUTES.preprocess });

    return { analysis: normalizeNewsAnalysis(result, fallback), model };
  } catch (error) {
    console.error('OpenRouter news analysis failed', error);
    return { analysis: fallback, model: null };
  }
}

export async function analyzeRepo(input: { fullName: string; description: string | null; language: string | null; topics: string[] }) {
  const fallback = {
    relevance_score: 70,
    ai_review: `${input.fullName}은 ${input.language ?? '여러 기술'} 기반의 GitHub 프로젝트입니다.`,
    beginner_summary: input.description ?? '프로젝트 설명이 제공되지 않았습니다.',
    project_idea: `${input.fullName}처럼 핵심 기능 만들어보기`,
  };
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { analysis: fallback, model: null };

  try {
    const { result, model } = await callOpenRouter<RepoAnalysis>(apiKey, [
      { role: 'system', content: '너는 초보 개발자를 위한 GitHub 오픈소스 리뷰어다. 반드시 JSON만 반환한다.' },
      {
        role: 'user',
        content: `이 GitHub 저장소를 초보 개발자 관점에서 리뷰하라.

출력 JSON:
{
  "relevance_score": 0,
  "ai_review": "무엇을 하는 프로젝트인지",
  "beginner_summary": "초보자용 쉬운 설명",
  "project_idea": "이 저장소를 참고해 만들 수 있는 작은 프로젝트"
}

repo: ${input.fullName}
description: ${input.description ?? ''}
language: ${input.language ?? ''}
topics: ${input.topics.join(', ')}`,
      },
    ], { models: MODEL_ROUTES.preprocess });

    return { analysis: { ...fallback, ...result }, model };
  } catch (error) {
    console.error('OpenRouter repo analysis failed', error);
    return { analysis: fallback, model: null };
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
}) {
  const fallback = buildFallbackPaperAnalysis(input);
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { analysis: fallback, model: null };

  try {
    const { result, model } = await callOpenRouter<PaperAnalysis>(apiKey, [
      { role: 'system', content: '너는 초보 개발자와 제품 빌더를 위한 AI/개발 논문 리뷰어다. 논문을 만들 수 있는 프로젝트와 서비스 아이디어로 바꾼다. 반드시 JSON만 반환한다.' },
      {
        role: 'user',
        content: `아래 논문을 Seedup 자체 콘텐츠로 리뷰하라.

출력 JSON:
{
  "relevance_score": 0,
  "review_type": "오늘 볼만한 논문 | 이번 주 집중해야 할 논문 | 코드가 공개된 논문 | 서비스 아이디어로 연결 가능한 논문 | 초보 개발자도 이해할 만한 논문 | 연구자용 고난도 논문",
  "beginner_summary": "초보자용 쉬운 설명",
  "expert_summary": "연구자/실무자용 요약",
  "why_it_matters": "왜 지금 봐야 하는지",
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
    ], { models: MODEL_ROUTES.preprocess });

    return { analysis: normalizePaperAnalysis(result, fallback), model };
  } catch (error) {
    console.error('OpenRouter paper analysis failed', error);
    return { analysis: fallback, model: null };
  }
}

export async function generateProjectIdea(input: {
  title: string;
  sourceType: string;
  summary: string;
  trend?: string | null;
  skills?: string[];
}) {
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
    duration_days: 7,
    stack: input.skills?.length ? input.skills.slice(0, 5) : ['Next.js', 'Supabase', 'TypeScript'],
    related_trend: input.trend ?? input.title,
    target_user_level: 'beginner-builder',
    recommended_for: ['포트폴리오 만들기', '최신 기술 공부'],
    portfolio_value: '뉴스나 트렌드를 실제 결과물로 바꾸는 과정을 보여줄 수 있습니다.',
    plan: [
      'Day 1: 문제 정의 & 기획 | 도구: 노션 or 마크다운 | 방법: 해결할 문제 1가지를 한 문장으로 적고, 핵심 기능 3개로 범위를 제한한다',
      'Day 2: 데이터 모델 설계 | 도구: Supabase Table Editor | 언어: SQL | 방법: 테이블 2~3개를 설계하고 Supabase에서 직접 생성한다',
      'Day 3: 기본 UI 구현 | 도구: Next.js, Tailwind CSS | 언어: TypeScript, JSX | 방법: 메인 페이지 레이아웃과 컴포넌트 구조를 잡는다',
      'Day 4: 핵심 기능 구현 | 도구: Next.js API Route, Supabase Client | 언어: TypeScript | 방법: 데이터 CRUD 로직을 작성하고 화면과 연결한다',
      'Day 5: API 연결 & 상태 처리 | 도구: OpenRouter API 또는 외부 API | 언어: TypeScript | 방법: fetch로 API를 호출하고 로딩/에러 상태를 처리한다',
      'Day 6: UI 다듬기 & 테스트 | 도구: 브라우저 DevTools | 방법: 모바일 반응형을 확인하고 엣지 케이스를 테스트한다',
      'Day 7: 배포 & README | 도구: Vercel 또는 Cloudflare Pages | 방법: main 브랜치를 연결해 자동 배포하고 README에 스크린샷과 기능 설명을 작성한다',
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
  "duration_days": 7,
  "stack": ["사용 기술"],
  "related_trend": "관련 트렌드",
  "target_user_level": "beginner-builder | portfolio-seeker | ai-tool-maker | startup-explorer",
  "recommended_for": ["목적"],
  "portfolio_value": "포트폴리오 가치 설명 (2~3문장)",
  "plan": [
    "Day 1: 문제 정의 & 기획 | 도구: 노션 or 마크다운 | 방법: 해결할 문제를 정의하고 핵심 기능 3개로 범위를 좁힌다",
    "Day N: ..."
  ]
}

source_type: ${input.sourceType}
title: ${input.title}
trend: ${input.trend ?? ''}
skills: ${(input.skills ?? []).join(', ')}
summary: ${truncate(input.summary, 2500)}`,
      },
    ], { maxTokens: 3500, models: MODEL_ROUTES.writing });

    return { idea: { ...fallback, ...result }, model };
  } catch (error) {
    console.error('OpenRouter project idea generation failed', error);
    return { idea: fallback, model: null };
  }
}


export async function evaluateIdea(input: { idea: string }) {
  const fallback: IdeaEvaluation = {
    score: 72,
    verdict: '작게 범위를 줄이면 7일 안에 포트폴리오 프로젝트로 만들기 좋은 아이디어입니다.',
    portfolio_value: '문제 정의, 데이터 처리, UI 구현, 배포까지 보여줄 수 있습니다.',
    difficulty: '중급',
    market_fit: '최근 개발 생산성 및 자동화 흐름과 연결할 수 있습니다.',
    recommended_stack: ['Next.js', 'Supabase', 'OpenRouter API', 'Vercel'],
    risks: ['초기 범위가 커질 수 있음', '데이터 품질 관리가 필요함'],
    next_steps: ['핵심 사용자 1명을 정하기', 'MVP 기능 3개로 줄이기', '데이터 구조 설계하기', '첫 화면 와이어프레임 만들기', '7일 빌드 플랜 작성하기'],
  };
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { evaluation: fallback, model: null };

  try {
    const { result, model } = await callOpenRouter<IdeaEvaluation>(apiKey, [
      { role: 'system', content: '너는 초보 개발자를 위한 스타트업/포트폴리오 아이디어 평가 코치다. 반드시 JSON만 반환한다.' },
      {
        role: 'user',
        content: `아래 프로젝트 아이디어를 평가하라.

출력 JSON:
{
  "score": 0,
  "verdict": "한 문장 총평",
  "portfolio_value": "포트폴리오 가치",
  "difficulty": "초급 | 중급 | 고급",
  "market_fit": "시장성과 트렌드 연결",
  "recommended_stack": ["기술"],
  "risks": ["리스크"],
  "next_steps": ["다음 단계"]
}

idea: ${truncate(input.idea, 2500)}`,
      },
    ]);

    return { evaluation: normalizeIdeaEvaluation(result, fallback), model };
  } catch (error) {
    console.error('OpenRouter idea evaluation failed', error);
    return { evaluation: fallback, model: null };
  }
}

export async function answerArticleQuestion(input: {
  title: string;
  summary: string;
  content: string;
  question: string;
}) {
  const fallback: ArticleQuestionAnswer = {
    answer: `이 글의 핵심은 "${input.title}"와 관련된 흐름을 이해하고, 작은 프로젝트로 실험해보는 것입니다. 질문을 조금 더 구체적으로 적으면 기술 선택이나 구현 순서까지 좁혀볼 수 있어요.`,
    project_prompt: `${input.title}를 참고해서 초보자도 만들 수 있는 7일짜리 미니 프로젝트를 평가해줘.`,
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
- 프로젝트 관련 질문이면 idea evaluation 페이지로 넘길 수 있는 project_prompt를 함께 작성한다.

출력 JSON:
{
  "answer": "질문에 대한 답변",
  "project_prompt": "프로젝트 평가에 넘길 질문. 프로젝트 질문이 아니면 빈 문자열"
}

title: ${input.title}
summary: ${truncate(input.summary, 700)}
content: ${truncate(input.content, 2200)}
question: ${truncate(input.question, 500)}`,
      },
    ]);

    return { result: { ...fallback, ...result }, model };
  } catch (error) {
    console.error('OpenRouter article question failed', error);
    return { result: fallback, model: null };
  }
}

async function callOpenRouter<T>(
  apiKey: string,
  messages: Array<{ role: 'system' | 'user'; content: string }>,
  options?: { maxTokens?: number; models?: string[] },
) {
  const models = options?.models?.length ? options.models : getOpenRouterModels();
  const errors: string[] = [];
  const maxTokens = options?.maxTokens ?? 2400;

  for (const model of models) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

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
          temperature: 0.2,
          max_tokens: maxTokens,
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

      return { result: parseJsonResponse<T>(content), model };
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

function parseJsonResponse<T>(content: string) {
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
    const end = stripped.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      console.warn('OpenRouter non-JSON preview:', stripped.slice(0, 200));
      throw new Error('OpenRouter returned non-JSON content');
    }

    return JSON.parse(stripped.slice(start, end + 1)) as T;
  }
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

function normalizeIdeaEvaluation(result: Partial<IdeaEvaluation>, fallback: IdeaEvaluation): IdeaEvaluation {
  return {
    score: Math.max(0, Math.min(100, Number(result.score ?? fallback.score))),
    verdict: result.verdict ?? fallback.verdict,
    portfolio_value: result.portfolio_value ?? fallback.portfolio_value,
    difficulty: result.difficulty ?? fallback.difficulty,
    market_fit: result.market_fit ?? fallback.market_fit,
    recommended_stack: Array.isArray(result.recommended_stack) ? result.recommended_stack : fallback.recommended_stack,
    risks: Array.isArray(result.risks) ? result.risks : fallback.risks,
    next_steps: Array.isArray(result.next_steps) ? result.next_steps : fallback.next_steps,
  };
}

function buildFallbackPaperAnalysis(input: { title: string; abstract: string; categories: string[]; hasCode: boolean }): PaperAnalysis {
  const beginnerScore = input.abstract.length < 1200 ? 72 : 54;
  const buildabilityScore = input.hasCode ? 82 : 62;
  const businessScore = /agent|rag|retrieval|tool|workflow|code|ui|app|search|automation/i.test(`${input.title} ${input.abstract}`) ? 78 : 56;
  const researchDepthScore = /theorem|proof|optimization|benchmark|architecture|training|loss/i.test(input.abstract) ? 82 : 60;
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
    beginner_summary: fallbackSummary(input.title, input.abstract),
    expert_summary: fallbackSummary(input.title, input.abstract),
    why_it_matters: 'AI와 개발 트렌드를 이해하고 작은 구현 프로젝트로 연결할 수 있는 연구입니다.',
    key_points: [input.title, fallbackSummary(input.title, input.abstract), input.categories.join(', ') || 'AI/CS research'],
    related_skills: ['Paper Reading', 'AI', 'Prototype'],
    implementation_idea: `${input.title.slice(0, 48)} 기반 미니 데모 만들기`,
    service_idea: '논문 아이디어를 활용한 개발자 생산성 도구 만들기',
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
