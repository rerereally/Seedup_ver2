import type {
  BuildPlanStep,
  GeneratedProjectIdea,
  ProjectConstraints,
  ProjectDurationEstimate,
  ProjectStackDetail,
  ProjectValidationMetric,
} from './ai-types';
import { callOpenRouter, getWritingModels } from './openrouter-client';
import { truncate } from './text';

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
