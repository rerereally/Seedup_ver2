import { clampScore, containsHangul, ensureKoreanTitle, isContentType, isNewsletterSection } from './ai-shared';
import type {
  ArticleCoreClaim,
  ArticleEvidence,
  ArticleSourceBundleItem,
  GeneratedArticleDraft,
} from './ai-types';
import { ARTICLE_OPENROUTER_TIMEOUT_MS, callOpenRouter, getWritingModels } from './openrouter-client';
import { fallbackSummary, truncate } from './text';

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
