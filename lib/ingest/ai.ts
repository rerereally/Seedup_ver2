import { fallbackSummary, truncate } from './text';

export type NewsAnalysis = {
  category: string;
  relevance_score: number;
  ai_summary: string;
  beginner_summary: string;
  why_it_matters: string;
  key_points: string[];
  related_skills: string[];
  project_idea: string;
  difficulty: string;
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
};

const DEFAULT_MODEL = 'nvidia/nemotron-3-ultra-550b-a55b:free';

export async function analyzeNews(input: { title: string; content: string; source: string }) {
  const fallback = buildFallbackNewsAnalysis(input.title, input.content);
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { analysis: fallback, model: null };

  try {
    const result = await callOpenRouter<NewsAnalysis>(apiKey, [
      {
        role: 'system',
        content: '너는 초보 개발자를 위한 기술 뉴스 큐레이터다. 반드시 JSON만 반환한다.',
      },
      {
        role: 'user',
        content: `아래 뉴스가 개발, 코딩, AI 제품, 개발 트렌드, 개발자 도구와 관련 있는지 판단하고 JSON으로 분석하라.

출력 JSON 스키마:
{
  "category": "AI Agent | Frontend | Backend | DevTools | Product | Trend | Other",
  "relevance_score": 0,
  "ai_summary": "전문가용 3문장 요약",
  "beginner_summary": "초보자용 쉬운 설명",
  "why_it_matters": "왜 중요한지",
  "key_points": ["핵심 1", "핵심 2", "핵심 3"],
  "related_skills": ["기술 1", "기술 2"],
  "project_idea": "작게 만들 수 있는 프로젝트",
  "difficulty": "초급 | 중급 | 고급"
}

source: ${input.source}
title: ${input.title}
content: ${truncate(input.content, 6000)}`,
      },
    ]);

    return { analysis: normalizeNewsAnalysis(result, fallback), model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL };
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
    project_idea: `${input.fullName}을 참고한 미니 클론 만들기`,
  };
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { analysis: fallback, model: null };

  try {
    const result = await callOpenRouter<RepoAnalysis>(apiKey, [
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
    ]);

    return { analysis: { ...fallback, ...result }, model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL };
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
    const result = await callOpenRouter<ProductAnalysis>(apiKey, [
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
    ]);

    return { analysis: { ...fallback, ...result }, model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL };
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
    const result = await callOpenRouter<PaperAnalysis>(apiKey, [
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
  "research_depth_score": 0
}

source: ${input.source}
title: ${input.title}
authors: ${input.authors.join(', ')}
categories: ${input.categories.join(', ')}
has_code: ${input.hasCode}
abstract: ${truncate(input.abstract, 5000)}`,
      },
    ]);

    return { analysis: normalizePaperAnalysis(result, fallback), model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL };
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
  const fallback: GeneratedProjectIdea = {
    title: `${input.title} 기반 미니 프로젝트`,
    description: truncate(input.summary, 240),
    level: '초급',
    duration_days: 7,
    stack: input.skills?.length ? input.skills.slice(0, 5) : ['Next.js', 'Supabase', 'API'],
    related_trend: input.trend ?? input.title,
    target_user_level: 'beginner-builder',
    recommended_for: ['포트폴리오 만들기', '최신 기술 공부'],
    portfolio_value: '뉴스나 트렌드를 실제 결과물로 바꾸는 과정을 보여줄 수 있습니다.',
    plan: ['문제 정의', '데이터 모델 설계', '화면 구현', 'API 연결', '상태 처리', '배포', 'README 작성'],
  };
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) return { idea: fallback, model: null };

  try {
    const result = await callOpenRouter<GeneratedProjectIdea>(apiKey, [
      { role: 'system', content: '너는 초보 개발자를 위한 프로젝트 코치다. 뉴스/제품/오픈소스 신호를 포트폴리오 프로젝트로 바꾼다. 반드시 JSON만 반환한다.' },
      {
        role: 'user',
        content: `아래 소스를 기반으로 만들 만한 프로젝트 1개를 JSON으로 제안하라.

출력 JSON:
{
  "title": "프로젝트명",
  "description": "설명",
  "level": "초급 | 중급 | 고급",
  "duration_days": 7,
  "stack": ["기술"],
  "related_trend": "관련 트렌드",
  "target_user_level": "beginner-builder | portfolio-seeker | ai-tool-maker | startup-explorer",
  "recommended_for": ["목적"],
  "portfolio_value": "포트폴리오 가치",
  "plan": ["Day 1", "Day 2", "Day 3"]
}

source_type: ${input.sourceType}
title: ${input.title}
trend: ${input.trend ?? ''}
skills: ${(input.skills ?? []).join(', ')}
summary: ${truncate(input.summary, 2500)}`,
      },
    ]);

    return { idea: { ...fallback, ...result }, model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL };
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
    const result = await callOpenRouter<IdeaEvaluation>(apiKey, [
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

    return { evaluation: normalizeIdeaEvaluation(result, fallback), model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL };
  } catch (error) {
    console.error('OpenRouter idea evaluation failed', error);
    return { evaluation: fallback, model: null };
  }
}

async function callOpenRouter<T>(apiKey: string, messages: Array<{ role: 'system' | 'user'; content: string }>) {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      'http-referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001',
      'x-title': 'Seedup',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL,
      messages,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter request failed: ${response.status} ${body}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenRouter returned empty content');

  return parseJsonResponse<T>(content);
}

function parseJsonResponse<T>(content: string) {
  try {
    return JSON.parse(content) as T;
  } catch {
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('OpenRouter returned non-JSON content');
    }

    return JSON.parse(content.slice(start, end + 1)) as T;
  }
}

function buildFallbackNewsAnalysis(title: string, content: string): NewsAnalysis {
  return {
    category: 'Trend',
    relevance_score: 60,
    ai_summary: fallbackSummary(title, content),
    beginner_summary: fallbackSummary(title, content),
    why_it_matters: '개발자가 최신 동향을 이해하고 작은 프로젝트 아이디어로 연결할 수 있는 내용입니다.',
    key_points: [title, fallbackSummary(title, content), '상세 내용을 읽고 관련 기술을 실습해볼 수 있습니다.'],
    related_skills: ['Research', 'Web', 'API'],
    project_idea: '뉴스 요약 및 학습 노트 앱',
    difficulty: '초급',
  };
}

function normalizeNewsAnalysis(result: Partial<NewsAnalysis>, fallback: NewsAnalysis): NewsAnalysis {
  return {
    category: result.category ?? fallback.category,
    relevance_score: Number(result.relevance_score ?? fallback.relevance_score),
    ai_summary: result.ai_summary ?? fallback.ai_summary,
    beginner_summary: result.beginner_summary ?? fallback.beginner_summary,
    why_it_matters: result.why_it_matters ?? fallback.why_it_matters,
    key_points: Array.isArray(result.key_points) ? result.key_points : fallback.key_points,
    related_skills: Array.isArray(result.related_skills) ? result.related_skills : fallback.related_skills,
    project_idea: result.project_idea ?? fallback.project_idea,
    difficulty: result.difficulty ?? fallback.difficulty,
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
  };
}

function clampScore(value: unknown) {
  return Math.max(0, Math.min(100, Number(value ?? 0)));
}
