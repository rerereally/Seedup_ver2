import { clampScore, containsHangul } from './ai-shared';
import type { PaperAnalysis, PaperAnalysisResult } from './ai-types';
import { callOpenRouter, getPreprocessModels } from './openrouter-client';
import { truncate } from './text';

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
    ], { models: getPreprocessModels(), jsonMode: true, maxTokens: 6500 });

    const analysis = normalizePaperAnalysis(result, fallback);
    const quality = validatePaperAnalysisQuality(analysis, input);
    return { analysis, model, ok: quality.ok, qualityReason: quality.reason };
  } catch (error) {
    console.error('OpenRouter paper analysis failed', error);
    return { analysis: fallback, model: null, ok: false, qualityReason: 'ai_generation_failed' };
  }
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
