import type {
  EvaluationConfidence,
  EvaluationMvpScope,
  EvaluationNextStep,
  EvaluationRisk,
  EvaluationScoreReason,
  IdeaEvaluation,
  RecommendedTechnology,
  ScoreBreakdown,
} from './ai-types';
import { callOpenRouter, getIdeaEvaluationModels } from '../llm';
import { truncate } from './text';

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

  const compactSchema = `{
  "score": 0,
  "verdict": "한 문장 총평",
  "portfolio_value": "포트폴리오 가치",
  "difficulty": "초급 | 중급 | 고급",
  "market_fit": "시장성과 트렌드 연결",
  "score_breakdown": {"feasibility": 0, "differentiation": 0, "market": 0, "portfolio": 0, "mvp_clarity": 0},
  "strengths": ["확인된 강점"],
  "weaknesses": ["확인된 약점"],
  "recommended_technologies": [{"name": "기술명", "category": "required | optional | scale", "reason": "이유"}],
  "missing_data": ["추가 검증이 필요한 데이터"],
  "user_stated": ["사용자가 직접 입력한 사실만"],
  "inferred_assumptions": ["참고 자료 또는 AI가 확장한 가설"],
  "mvp_scope": {"team_size": "1~2명", "duration_weeks": 2, "core_user_flow": "핵심 사용자 흐름 1개", "excluded_scope": ["이번 MVP에서 제외할 범위"]}
}`;
  const compactRules = `
- 세부 점수는 0~100 정수다. 종합 점수는 feasibility 25%, differentiation 20%, market 20%, portfolio 20%, mvp_clarity 15% 가중 평균이다.
- 문제, 대상 사용자, 해결 방식 중 둘 이상이 불명확하면 MVP 명확성과 시장성은 40점 이하로 둔다. 시장·경쟁 근거가 없으면 market은 59점 이하로 둔다.
- user_stated에는 사용자 입력 사실만, inferred_assumptions에는 검증 전 가설만 적는다. MVP는 1~2명이 2~4주 안에 만들 수 있는 흐름 하나로 제한한다.
- required 기술은 최대 4개다. Neo4j, LangChain, LlamaIndex, OCR, 벡터 DB는 직접 근거가 없으면 optional 또는 scale로 둔다.
- 각 문자열은 80자 이하, strengths·weaknesses·missing_data·user_stated·inferred_assumptions은 각각 최대 2개, 추천 기술은 최대 4개다.
- verdict, portfolio_value, market_fit은 각각 한 문장만 쓴다. JSON 외의 문장이나 마크다운을 절대 추가하지 않는다.
- 위험, 다음 단계, 신뢰도, 점수 사유는 서버가 근거 기준으로 만들므로 출력하지 않는다. JSON을 끝까지 닫는 것이 가장 중요하다.`;

  try {
    const { result, model } = await callOpenRouter<IdeaEvaluation>(apiKey, [
      { role: 'system', content: '너는 Seedup의 근거 기반 스타트업/포트폴리오 아이디어 평가 코치다. 반드시 JSON만 반환한다. 동일한 아이디어와 동일한 근거에는 항상 같은 평가 기준과 점수 체계를 적용한다. 제공된 참고 자료에 없는 최신 사실은 단정하지 않는다.' },
      {
        role: 'user',
        content: `아래 프로젝트 아이디어를 평가하라. 참고 자료가 있으면 경쟁 제품, 기술 선택, 시장성, 트렌드 판단에 반드시 활용하라. 참고 자료의 URL을 직접 열었다고 주장하지 말고, 자료에 없는 수치나 사실은 만들지 마라.

출력 JSON:
${compactSchema}

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
- 위 JSON 스키마에 없는 structured_risks, structured_next_steps, confidence, score_reasons는 출력하지 않는다. 화면용 위험, 다음 단계, 신뢰도, 점수 사유는 서버가 근거 기준으로 만든다.
- JSON을 끝까지 닫는 것이 가장 중요하다. 위의 compactRules를 우선 적용하고, 빈 배열 대신 짧은 항목을 채운다.
${compactRules}

참고 자료:
${input.context || '관련 자료를 찾지 못했다. 일반론을 최신 사실처럼 말하지 말고 불확실성을 표시하라.'}`,
      },
    ], { models: getIdeaEvaluationModels(), jsonMode: true, temperature: 0, timeoutMs: 20_000, maxTokens: 1_100 });

    return { evaluation: normalizeIdeaEvaluation(result, fallback), model };
  } catch (error) {
    console.error('OpenRouter idea evaluation failed', error);
    return {
      evaluation: null,
      model: null,
      error: getIdeaEvaluationErrorMessage(error),
    };
  }
}

function getIdeaEvaluationErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  if (message.includes('401') || message.includes('403') || message.includes('unauthorized') || message.includes('forbidden')) return '배포 환경의 OpenRouter API 키를 확인해주세요.';
  if (message.includes('404') || message.includes('not found') || message.includes('model not')) return '배포 환경의 AI 평가 모델 이름을 확인해주세요.';
  if (message.includes('abort') || message.includes('timeout')) return '평가 응답 시간이 초과되었습니다. 근거 자료를 줄여 다시 시도해주세요.';
  if (message.includes('429') || message.includes('rate') || message.includes('quota')) return 'AI 평가 요청이 잠시 제한되었습니다. 잠시 후 다시 시도해주세요.';
  if (message.includes('empty content') || message.includes('empty response')) return '평가 모델이 빈 응답을 반환했습니다. 잠시 후 다시 시도해주세요.';
  if (message.includes('json') || message.includes('non-json')) return '평가 결과 형식을 처리하지 못했습니다. 다시 시도해주세요.';
  if (message.includes('fetch failed') || message.includes('network')) return 'AI 평가 서버와 통신하지 못했습니다. 배포 환경의 외부 요청 설정을 확인해주세요.';
  return 'AI 평가 요청을 처리하지 못했습니다. 배포 로그에서 OpenRouter 오류를 확인해주세요.';
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
  const strengths = normalizeStringList(result.strengths, fallback.strengths);
  const weaknesses = normalizeStringList(result.weaknesses, fallback.weaknesses);
  const missingData = normalizeStringList(result.missing_data, fallback.missing_data);
  const mvpScope = normalizeMvpScope(result.mvp_scope, fallback.mvp_scope, fallback.user_stated?.[0]);
  const derivedRisks = structuredRisks.length ? structuredRisks : buildFallbackEvaluationRisks(weaknesses, missingData);
  const derivedNextSteps = structuredNextSteps.length ? structuredNextSteps : buildFallbackEvaluationNextSteps(mvpScope, missingData);
  const scoreReasons = normalizeScoreReasons(result.score_reasons);
  return {
    score: weightedIdeaScore(scoreBreakdown),
    verdict: result.verdict ?? fallback.verdict,
    portfolio_value: result.portfolio_value ?? fallback.portfolio_value,
    difficulty: result.difficulty ?? fallback.difficulty,
    market_fit: result.market_fit ?? fallback.market_fit,
    recommended_stack: technologies.length
      ? technologies.filter((item) => item.category === 'required').map((item) => item.name)
      : (Array.isArray(result.recommended_stack) ? result.recommended_stack.slice(0, 4) : fallback.recommended_stack),
    risks: derivedRisks.map((risk) => risk.title),
    next_steps: derivedNextSteps.map((step) => step.title),
    score_breakdown: scoreBreakdown,
    strengths,
    weaknesses,
    recommended_technologies: technologies.length ? technologies : fallback.recommended_technologies,
    structured_risks: derivedRisks,
    structured_next_steps: derivedNextSteps,
    confidence: result.confidence ?? fallback.confidence,
    evidence: Array.isArray(result.evidence) ? result.evidence : fallback.evidence,
    missing_data: missingData,
    user_stated: normalizeStringList(result.user_stated, fallback.user_stated),
    inferred_assumptions: normalizeStringList(result.inferred_assumptions, fallback.inferred_assumptions),
    mvp_scope: mvpScope,
    score_reasons: Object.keys(scoreReasons).length ? scoreReasons : buildFallbackScoreReasons(scoreBreakdown, strengths, weaknesses, missingData),
  };
}

function buildFallbackEvaluationRisks(weaknesses: string[], missingData: string[]): EvaluationRisk[] {
  const candidates = [...weaknesses, ...missingData.map((item) => `${item} 검증 부족`)].filter(Boolean).slice(0, 2);
  return (candidates.length ? candidates : ['핵심 가설 검증 부족']).map((title, index) => ({
    title,
    severity: index === 0 ? 'medium' : 'low',
    impact: '핵심 사용자 흐름과 범위가 불명확해 구현 비용이 커질 수 있습니다.',
    mitigation: '대표 사용자 3명에게 문제와 핵심 흐름을 먼저 확인한 뒤 범위를 고정합니다.',
  }));
}

function buildFallbackEvaluationNextSteps(scope: EvaluationMvpScope, missingData: string[]): EvaluationNextStep[] {
  const validationTarget = missingData[0] ?? '핵심 사용자 흐름';
  return [
    { order: 1, title: '문제와 대상 사용자 고정', description: '대표 사용자와 해결할 문제를 한 문장으로 정리합니다.', deliverable: '문제 정의 1장', done_when: '대상 사용자 3명에게 문제 정의를 확인받고 의견 3건을 기록' },
    { order: 2, title: '핵심 흐름 프로토타입', description: scope.core_user_flow, deliverable: '대표 흐름 프로토타입 1개', done_when: '테스트 입력 3건이 오류 없이 결과 화면까지 도달' },
    { order: 3, title: `${validationTarget} 검증`, description: '가장 불확실한 가설을 작은 사용자 테스트로 검증합니다.', deliverable: '검증 결과 메모', done_when: '사용자 피드백 3건과 다음 개선 우선순위 1개를 기록' },
  ];
}

function buildFallbackScoreReasons(breakdown: ScoreBreakdown, strengths: string[], weaknesses: string[], missingData: string[]): Partial<Record<keyof ScoreBreakdown, EvaluationScoreReason>> {
  const positive = strengths.length ? strengths.slice(0, 1) : ['입력된 문제를 작은 MVP 흐름으로 제한할 수 있습니다.'];
  const deductions = weaknesses.length ? weaknesses.slice(0, 1) : ['추가 검증 자료가 부족합니다.'];
  const evidence = missingData.length ? [`추가 확인 필요: ${missingData.slice(0, 2).join(', ')}`] : ['사용자 입력과 검색된 참고 자료를 기반으로 한 예비 판단입니다.'];
  return (['feasibility', 'differentiation', 'market', 'portfolio', 'mvp_clarity'] as Array<keyof ScoreBreakdown>).reduce((reasons, dimension) => {
    reasons[dimension] = {
      positive: dimension === 'market' && missingData.length ? [] : positive,
      deductions: dimension === 'market' && missingData.length ? ['시장·경쟁 근거가 충분하지 않습니다.'] : deductions,
      evidence: [`${Math.round(Number(breakdown[dimension] ?? 0))}점 기준. ${evidence[0]}`],
    };
    return reasons;
  }, {} as Partial<Record<keyof ScoreBreakdown, EvaluationScoreReason>>);
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
