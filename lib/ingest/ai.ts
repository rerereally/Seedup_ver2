import { clampScore, containsHangul, ensureKoreanTitle } from './ai-shared';
import type { NewsAnalysis, ProductAnalysis, RepoAnalysis } from './ai-types';
import { callOpenRouter, getPreprocessModels } from '../llm';
import { fallbackSummary, truncate } from './text';

export type * from './ai-types';
export { analyzePaper } from './ai-paper';
export { generateProjectIdea } from './ai-project';
export { generateArticleDraft, validateArticleLinks, validateGeneratedArticleDraft } from './ai-article';
export { answerArticleQuestion } from './ai-qa';

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
    ], { models: getPreprocessModels(), jsonMode: true });

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
      models: getPreprocessModels(),
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
    ], { models: getPreprocessModels() });

    return { analysis: { ...fallback, ...result }, model };
  } catch (error) {
    console.error('OpenRouter product analysis failed', error);
    return { analysis: fallback, model: null };
  }
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
