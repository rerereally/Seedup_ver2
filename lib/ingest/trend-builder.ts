// Signal extraction, candidate scoring, and trend ranking helpers for /api/ingest/trends.
export type TrendCategory =
  | '개발 워크플로우'
  | 'AI 도구·모델'
  | '구현 패턴'
  | '오픈소스 프로젝트'
  | '빌드 아이디어';

export type TrendEntityType =
  | 'workflow'
  | 'tool'
  | 'model'
  | 'skill'
  | 'architecture'
  | 'pattern'
  | 'open_source_project'
  | 'build_idea';

type TrendStatus = 'hot' | 'rising' | 'steady' | 'new' | 'cooling' | 'watch';
type TrendDirection = 'up' | 'down' | 'flat' | 'new';
type TrendSourceType = 'github' | 'npm' | 'huggingface' | 'devto' | 'stackoverflow' | 'product_hunt' | 'hackernews' | 'rss' | 'paper';

export type TrendCandidate = {
  keyword: string;
  normalizedName: string;
  displayName: string;
  category: TrendCategory;
  entityType: TrendEntityType;
  score: number;
  news: number;
  products: number;
  repos: number;
  papers: number;
  signalStrength: number;
  relatedSkills: Set<string>;
  relatedTools: Set<string>;
  sourceKeys: Set<string>;
  recentSourceKeys: Set<string>;
  previousSourceKeys: Set<string>;
  sourceMix: Partial<Record<TrendSourceType, number>>;
  sourceIds: Partial<Record<TrendSourceType, Set<string>>>;
  refs: Array<{ type: string; id: string; title: string; url?: string | null; source_name?: string | null }>;
  projectIdeas: Set<string>;
};

export type KeywordSignalInput = {
  keyword: string;
  normalized_keyword: string;
  source_type: TrendSourceType;
  source_id: string;
  source_title: string;
  source_url: string | null;
  weight: number;
  metadata: {
    category: TrendCategory;
    entity_type: TrendEntityType;
    display_name: string;
    project_idea?: string;
    related_skills?: string[];
    related_tools?: string[];
    source_name?: string | null;
  };
  detected_at: string;
};

export const DAY_MS = 24 * 60 * 60 * 1000;
export const CATEGORIES: TrendCategory[] = ['개발 워크플로우', 'AI 도구·모델', '구현 패턴', '오픈소스 프로젝트', '빌드 아이디어'];

const SOURCE_WEIGHTS: Record<TrendSourceType, number> = {
  github: 1.28,
  npm: 1.22,
  huggingface: 1.24,
  devto: 1.08,
  stackoverflow: 1.08,
  product_hunt: 1.28,
  hackernews: 1.16,
  rss: 1,
  paper: 1.14,
};

export const GENERIC_TITLE_BLOCKLIST = new Set([
  'ai',
  'llm',
  'agent',
  'coding agent',
  'ai agent',
  'developer',
  'development',
  'tool',
  'tools',
  'app',
  'service',
  'product',
  'python',
  'javascript',
  'typescript',
  'react',
  'next.js',
  'nextjs',
  'node.js',
  'nodejs',
  'node',
  'rust',
  'supabase',
  'api',
  'github',
  'open source',
  'rag',
  'mcp',
  'mcp server',
  'automation',
  'workflow',
  'dashboard',
  'template',
  'starter',
  'boilerplate',
  'framework',
  'cli',
  'core',
  'sdk',
  'utils',
  'util',
  'common',
  'shared',
  'types',
  'client',
  'server',
  'observability',
  'runtime',
  'lib',
  'package',
  'plugin',
  'module',
  'config',
  'helper',
  'helpers',
  'index',
  'main',
  'web',
  'ui',
  'kit',
  'tui',
  'benchmark',
  'search',
  'saas',
  'productivity',
  'news',
  'paper',
]);

export const TOOL_MODEL_NAMES = [
  'Codex',
  'Claude Code',
  'Cursor',
  'Windsurf',
  'Gemini CLI',
  'Qwen',
  'DeepSeek',
  'Kimi',
  'Ollama',
  'v0',
  'Lovable',
  'Bolt',
  'Aider',
  'OpenHands',
  'Cline',
  'Continue',
  'Devin',
  'Perplexity',
  'Grok',
  'Hugging Face Spaces',
  'LiteLLM',
  'Dify',
  'Flowise',
];

export const WORKFLOW_PATTERNS: Array<[RegExp, string]> = [
  [/spec[-\s]?driven|specification driven|명세/i, 'Spec-driven Development'],
  [/\bprd\b|product requirement|requirements? to code|기획서.*코드/i, 'PRD to Code'],
  [/code review|pull request review|pr review|코드 리뷰/i, 'AI Code Review'],
  [/codebase q&a|codebase qa|ask.*codebase|코드베이스.*질문|코드베이스.*q&a/i, 'Codebase Q&A'],
  [/test generation|generate tests?|테스트.*생성/i, 'Test Generation'],
  [/design to code|figma to code|디자인.*코드|figma.*code/i, 'Design to Code'],
  [/prompt to app|text to app|프롬프트.*앱/i, 'Prompt to App'],
  [/pair programming|페어 프로그래밍/i, 'AI Pair Programming'],
  [/qa agent|quality assurance agent|브라우저.*qa|qa.*agent/i, 'AI QA Agent'],
  [/automated refactoring|refactor|리팩터링/i, 'Automated Refactoring'],
  [/debugging|debug agent|디버깅/i, 'AI-assisted Debugging'],
  [/documentation|docs agent|문서화/i, 'AI 기반 문서화'],
  [/figma.*workflow|figma.*code/i, 'Figma to Code Workflow'],
  [/pull request|github pr|pr summary|pr 요약/i, 'GitHub PR 요약'],
];

export const IMPLEMENTATION_PATTERNS: Array<[RegExp, string, TrendEntityType]> = [
  [/\bmcp\b|model context protocol/i, 'MCP Server Design', 'architecture'],
  [/\brag\b|retrieval augmented|retrieval-augmented/i, 'RAG Evaluation', 'pattern'],
  [/agent memory|long[-\s]term memory|memory layer/i, 'Agent Memory', 'pattern'],
  [/tool calling|function calling/i, 'Tool Calling', 'pattern'],
  [/vector search|vector database|embedding search/i, 'Vector Search', 'architecture'],
  [/observability|tracing|telemetry/i, 'LLM Observability', 'architecture'],
  [/prompt caching|semantic cach/i, 'Prompt Caching', 'pattern'],
  [/streaming ui|streaming response/i, 'Streaming UI', 'pattern'],
  [/structured output|json schema|schema output/i, 'Structured Output', 'pattern'],
  [/browser automation|browser agent|computer use/i, 'Browser Automation', 'pattern'],
  [/multi[-\s]?agent|orchestration/i, 'Multi-Agent Workflow', 'architecture'],
  [/human[-\s]?in[-\s]?the[-\s]?loop|hitl/i, 'Human-in-the-loop', 'pattern'],
  [/retrieval pipeline|indexing pipeline/i, 'Retrieval Pipeline', 'architecture'],
  [/eval pipeline|evaluation pipeline|benchmark/i, 'Eval Pipeline', 'pattern'],
  [/background job|queue|worker/i, 'Background Job Queue', 'architecture'],
  [/rate limit|rate limiting/i, 'Rate Limit Handling', 'pattern'],
];

export function addWorkflowSignals(
  signals: KeywordSignalInput[],
  text: string,
  weight: number,
  sourceType: TrendSourceType,
  sourceId: string,
  sourceTitle: string,
  sourceUrl?: string | null,
  detectedAt?: string | null,
  relatedSkills: string[] = [],
  relatedTools: string[] = [],
  sourceName?: string | null,
) {
  for (const [pattern, name] of WORKFLOW_PATTERNS) {
    if (pattern.test(text)) {
      addSignal(signals, name, '개발 워크플로우', 'workflow', weight, sourceType, sourceId, sourceTitle, sourceUrl, detectedAt, null, relatedSkills, relatedTools, sourceName);
    }
  }
}

export function addKnownToolModelSignals(
  signals: KeywordSignalInput[],
  text: string,
  weight: number,
  sourceType: TrendSourceType,
  sourceId: string,
  sourceTitle: string,
  sourceUrl?: string | null,
  detectedAt?: string | null,
  relatedSkills: string[] = [],
  relatedTools: string[] = [],
  sourceName?: string | null,
) {
  const lower = text.toLowerCase();
  for (const name of TOOL_MODEL_NAMES) {
    if (lower.includes(name.toLowerCase())) {
      addToolModelSignal(signals, name, weight, sourceType, sourceId, sourceTitle, sourceUrl, detectedAt, relatedSkills, relatedTools, sourceName);
    }
  }
}

export function addToolModelSignal(
  signals: KeywordSignalInput[],
  name: string,
  weight: number,
  sourceType: TrendSourceType,
  sourceId: string,
  sourceTitle: string,
  sourceUrl?: string | null,
  detectedAt?: string | null,
  relatedSkills: string[] = [],
  relatedTools: string[] = [],
  sourceName?: string | null,
) {
  const displayName = normalizeEntityName(name);
  if (!displayName || isGenericTitle(displayName)) return;
  const entityType: TrendEntityType = /qwen|deepseek|kimi|grok|gemini|claude|llama|mistral|gpt/i.test(displayName) ? 'model' : 'tool';
  addSignal(signals, displayName, 'AI 도구·모델', entityType, weight, sourceType, sourceId, sourceTitle, sourceUrl, detectedAt, null, relatedSkills, relatedTools, sourceName);
}

export function addImplementationPatternSignals(
  signals: KeywordSignalInput[],
  text: string,
  weight: number,
  sourceType: TrendSourceType,
  sourceId: string,
  sourceTitle: string,
  sourceUrl?: string | null,
  detectedAt?: string | null,
  relatedSkills: string[] = [],
  relatedTools: string[] = [],
  sourceName?: string | null,
) {
  for (const [pattern, name, entityType] of IMPLEMENTATION_PATTERNS) {
    if (pattern.test(text)) {
      addSignal(signals, name, '구현 패턴', entityType, weight, sourceType, sourceId, sourceTitle, sourceUrl, detectedAt, null, relatedSkills, relatedTools, sourceName);
    }
  }
}

export function addOpenSourceSignal(
  signals: KeywordSignalInput[],
  name: string,
  weight: number,
  sourceType: TrendSourceType,
  sourceId: string,
  sourceTitle: string,
  sourceUrl?: string | null,
  detectedAt?: string | null,
  relatedSkills: string[] = [],
  relatedTools: string[] = [],
  sourceName?: string | null,
) {
  const displayName = normalizeEntityName(name);
  if (!displayName || isGenericTitle(displayName)) return;
  addSignal(signals, displayName, '오픈소스 프로젝트', 'open_source_project', weight, sourceType, sourceId, sourceTitle, sourceUrl, detectedAt, null, relatedSkills, relatedTools, sourceName);
}

export function addBuildIdeaSignals(
  signals: KeywordSignalInput[],
  text: string,
  weight: number,
  sourceType: TrendSourceType,
  sourceId: string,
  sourceTitle: string,
  sourceUrl?: string | null,
  detectedAt?: string | null,
  relatedSkills: string[] = [],
  relatedTools: string[] = [],
  sourceName?: string | null,
) {
  for (const idea of extractBuildIdeas(text)) {
    addSignal(signals, idea, '빌드 아이디어', 'build_idea', weight, sourceType, sourceId, sourceTitle, sourceUrl, detectedAt, idea, relatedSkills, relatedTools, sourceName);
  }
}

function addSignal(
  signals: KeywordSignalInput[],
  rawName: string,
  category: TrendCategory,
  entityType: TrendEntityType,
  weight: number,
  sourceType: TrendSourceType,
  sourceId: string,
  sourceTitle: string,
  sourceUrl?: string | null,
  detectedAt?: string | null,
  projectIdea?: string | null,
  relatedSkills: string[] = [],
  relatedTools: string[] = [],
  sourceName?: string | null,
) {
  const displayName = normalizeEntityName(rawName);
  if (!displayName || !isAllowedEntityTitle(displayName, category)) return;

  signals.push({
    keyword: displayName,
    normalized_keyword: normalizeNameKey(displayName),
    source_type: sourceType,
    source_id: sourceId,
    source_title: sourceTitle,
    source_url: sourceUrl ?? null,
    weight,
    metadata: {
      category,
      entity_type: entityType,
      display_name: displayName,
      ...(projectIdea ? { project_idea: projectIdea } : {}),
      related_skills: relatedSkills.filter(Boolean),
      related_tools: relatedTools.filter(Boolean),
      source_name: sourceName ?? null,
    },
    detected_at: detectedAt ?? new Date().toISOString(),
  });
}

export function dedupeSignals(signals: KeywordSignalInput[]) {
  const signalMap = new Map<string, KeywordSignalInput>();
  for (const signal of signals) {
    const key = `${signal.source_type}::${signal.source_id}::${signal.normalized_keyword}`;
    const existing = signalMap.get(key);
    if (!existing || signal.weight > existing.weight) signalMap.set(key, signal);
  }
  return [...signalMap.values()];
}

export function buildTrendCandidates(signals: Array<Record<string, any>>) {
  const map = new Map<string, TrendCandidate>();
  const now = Date.now();

  for (const signal of signals) {
    const displayName = normalizeEntityName(signal.metadata?.display_name ?? signal.keyword);
    const category = normalizeCategory(signal.metadata?.category);
    const entityType = normalizeEntityType(signal.metadata?.entity_type, category);
    if (!displayName || !isAllowedEntityTitle(displayName, category)) continue;

    const normalizedName = normalizeNameKey(displayName);
    const detectedTime = new Date(signal.detected_at ?? Date.now()).getTime();
    const ageDays = Math.max(0, (now - detectedTime) / DAY_MS);
    const recencyBoost = ageDays <= 2 ? 1.35 : ageDays <= 7 ? 1.15 : ageDays <= 14 ? 0.85 : Math.max(0.35, 1 - ageDays / 45);
    const sourceType = normalizeSourceType(signal.source_type);
    const sourceBoost = SOURCE_WEIGHTS[sourceType] ?? 1;
    const score = Number(signal.weight ?? 1) * recencyBoost * sourceBoost;
    const sourceKey = `${sourceType}:${signal.source_id}`;
    const candidate = map.get(`${category}:${normalizedName}`) ?? {
      keyword: displayName,
      normalizedName,
      displayName,
      category,
      entityType,
      score: 0,
      news: 0,
      products: 0,
      repos: 0,
      papers: 0,
      signalStrength: 0,
      relatedSkills: new Set<string>(),
      relatedTools: new Set<string>(),
      sourceKeys: new Set<string>(),
      recentSourceKeys: new Set<string>(),
      previousSourceKeys: new Set<string>(),
      sourceMix: {},
      sourceIds: {},
      refs: [],
      projectIdeas: new Set<string>(),
    };

    candidate.signalStrength += score;
    candidate.sourceKeys.add(sourceKey);
    candidate.sourceMix[sourceType] = (candidate.sourceMix[sourceType] ?? 0) + 1;
    const sourceIds = candidate.sourceIds[sourceType] ?? new Set<string>();
    sourceIds.add(String(signal.source_id));
    candidate.sourceIds[sourceType] = sourceIds;
    if (ageDays <= 7) candidate.recentSourceKeys.add(sourceKey);
    if (ageDays > 7 && ageDays <= 14) candidate.previousSourceKeys.add(sourceKey);
    if (sourceType === 'rss' || sourceType === 'hackernews' || sourceType === 'devto' || sourceType === 'stackoverflow') candidate.news += 1;
    if (sourceType === 'product_hunt' || sourceType === 'huggingface' || sourceType === 'npm') candidate.products += 1;
    if (sourceType === 'github') candidate.repos += 1;
    if (sourceType === 'paper') candidate.papers += 1;

    for (const skill of signal.metadata?.related_skills ?? []) {
      const clean = normalizeEntityName(String(skill));
      if (clean && !isGenericTitle(clean)) candidate.relatedSkills.add(clean);
    }
    for (const tool of signal.metadata?.related_tools ?? []) {
      const clean = normalizeEntityName(String(tool));
      if (clean && !isGenericTitle(clean)) candidate.relatedTools.add(clean);
    }

    if (!candidate.refs.some((ref) => ref.type === sourceType && ref.id === signal.source_id)) {
      candidate.refs.push({
        type: sourceType,
        id: String(signal.source_id),
        title: String(signal.source_title ?? displayName),
        url: typeof signal.source_url === 'string' ? signal.source_url : null,
        source_name: typeof signal.metadata?.source_name === 'string' ? signal.metadata.source_name : null,
      });
    }
    if (typeof signal.metadata?.project_idea === 'string') candidate.projectIdeas.add(signal.metadata.project_idea);
    map.set(`${category}:${normalizedName}`, candidate);
  }

  for (const candidate of map.values()) {
    const sourceTypeDiversity = Object.values(candidate.sourceMix).filter(Boolean).length;
    const uniqueSources = candidate.sourceKeys.size;
    const recentSources = candidate.recentSourceKeys.size;
    const previousSources = candidate.previousSourceKeys.size;
    const growthRatio = previousSources ? Math.max(0, (recentSources - previousSources) / previousSources) : recentSources >= 2 ? 1 : 0;
    const diversityScore = sourceTypeDiversity * 10;
    const coverageScore = Math.min(34, uniqueSources * 4.5);
    const freshnessScore = Math.min(28, recentSources * 6);
    const momentumScore = Math.min(18, growthRatio * 18);
    const strengthScore = Math.min(38, candidate.signalStrength / 4);
    const marketScore = Math.min(16, (candidate.sourceMix.github ?? 0) * 2 + (candidate.sourceMix.product_hunt ?? 0) * 4 + (candidate.sourceMix.huggingface ?? 0) * 4 + (candidate.sourceMix.npm ?? 0) * 3);

    candidate.score = strengthScore + freshnessScore + diversityScore + coverageScore + momentumScore + marketScore;
  }

  return map;
}

export function pickTopByCategory(candidates: TrendCandidate[], perCategory: number) {
  const selected = new Map<string, TrendCandidate>();
  for (const category of CATEGORIES) {
    for (const candidate of candidates.filter((item) => item.category === category).slice(0, perCategory)) {
      selected.set(`${candidate.category}:${candidate.normalizedName}`, candidate);
    }
  }
  return [...selected.values()].sort((a, b) => {
    const categoryDiff = CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category);
    if (categoryDiff) return categoryDiff;
    return b.score - a.score;
  });
}

export function isTrendCandidateStrongEnough(candidate: TrendCandidate) {
  if (!isAllowedEntityTitle(candidate.displayName, candidate.category)) return false;
  const sourceDiversity = Object.values(candidate.sourceMix).filter(Boolean).length;
  const sourceCount = candidate.sourceKeys.size;

  if (candidate.category === '오픈소스 프로젝트') {
    return candidate.entityType === 'open_source_project' && Number(candidate.sourceMix.github ?? 0) >= 1 && candidate.score >= 32;
  }
  if (candidate.category === 'AI 도구·모델') {
    return ['tool', 'model'].includes(candidate.entityType) && candidate.score >= 34 && ((candidate.sourceMix.product_hunt ?? 0) + (candidate.sourceMix.github ?? 0) + (candidate.sourceMix.huggingface ?? 0) + (candidate.sourceMix.npm ?? 0) >= 1);
  }
  if (candidate.category === '구현 패턴') {
    return ['skill', 'architecture', 'pattern'].includes(candidate.entityType) && sourceCount >= 2 && sourceDiversity >= 1 && candidate.score >= 34;
  }
  if (candidate.category === '개발 워크플로우') {
    return candidate.entityType === 'workflow' && sourceCount >= 1 && candidate.score >= 30;
  }
  return candidate.entityType === 'build_idea' && sourceCount >= 2 && candidate.score >= 32;
}

function normalizeEntityName(value: string | null | undefined) {
  if (!value) return '';
  return value
    .replace(/[\"“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
}

export function normalizeNameKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function isAllowedEntityTitle(value: string, category: TrendCategory) {
  const normalized = normalizeNameKey(value);
  if (!normalized || isGenericTitle(value)) return false;
  if (/(이\s*저장소|이\s*프로젝트|활용하여|참고하여|핵심\s*기능\s*만들어보기|this repository|this project)/i.test(value)) return false;
  if (category === '구현 패턴') return /design|evaluation|memory|calling|search|observability|caching|streaming|output|automation|workflow|loop|pipeline|queue|limit|pattern|architecture|설계|평가|검색|파이프라인|캐싱|자동화/i.test(value);
  if (category === '빌드 아이디어') return /(봇|대시보드|앱|도구|에이전트|분석기|추천기|검색|모니터링|서버|만들기|워크플로우|생성기|빌더|workflow|bot|dashboard|app|agent|monitor|tracker|builder|server)/i.test(value);
  if (category === '개발 워크플로우') return /development|review|q&a|generation|code|programming|debugging|documentation|workflow|refactoring|qa|prd|figma|prompt|문서화|디버깅|리뷰|요약/i.test(value);
  return true;
}

export function isGenericTitle(value: string) {
  const normalized = normalizeNameKey(value);
  if (!normalized) return true;
  if (GENERIC_TITLE_BLOCKLIST.has(normalized)) return true;
  if (/^ai\s+(search|tool|tools|product|products|app|apps|software|service|services)$/i.test(normalized)) return true;
  return /^(ai|llm|agent|coding agent|ai agent|developer tool|rag|mcp|mcp-server|workflow|automation|dashboard|template|starter|boilerplate|framework|cli|core|sdk|utils?|common|shared|types|client|server|observability|runtime)$/i.test(value.trim());
}

/**
 * Preserves scoped npm package identities like `@ai-sdk/core` instead of stripping them down
 * to generic names (`core`), while filtering out unscoped generic package names (`cli`, `sdk`).
 */
export function normalizePackageLikeName(value: string) {
  const trimmed = normalizeEntityName(value);
  if (!trimmed) return '';
  if (/^@[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(trimmed)) {
    return trimmed.length <= 48 ? trimmed : '';
  }
  const name = trimmed
    .split('/')
    .pop()
    ?.replace(/^hf[-_]/i, '')
    .trim() ?? '';
  if (!name || name.length > 48 || isGenericTitle(name)) return '';
  return normalizeEntityName(name);
}

export function extractBuildIdeas(value: string | null | undefined) {
  if (!value) return [];
  const text = value.toLowerCase();
  const ideas = new Set<string>();
  if (/\bmcp\b|model context protocol/i.test(text)) ideas.add('MCP 서버 만들기');
  if (/code review|pull request|github pr|pr summary|코드 리뷰|pr 요약/i.test(text)) ideas.add('AI 코드 리뷰 봇');
  if (/\brag\b|retrieval|vector/i.test(text)) ideas.add('RAG 품질 평가 대시보드');
  if (/news curation|news aggregator|newsletter|큐레이션/i.test(text)) ideas.add('AI 뉴스 큐레이션 에이전트');
  if (/figma|design to code|디자인/i.test(text)) ideas.add('Figma to Code 워크플로우');
  if (/document|knowledge base|문서|검색/i.test(text)) ideas.add('개인 문서 기반 AI 검색 앱');
  if (/browser automation|browser agent|qa agent|computer use/i.test(text)) ideas.add('브라우저 자동화 QA 에이전트');
  if (/cost|pricing|token|latency|비용/i.test(text)) ideas.add('LLM 비용 모니터링 대시보드');
  if (/product hunt|ai product|제품/i.test(text)) ideas.add('AI 제품 비교 대시보드');
  if (/paper|research|논문/i.test(text)) ideas.add('논문 to 프로젝트 추천기');
  if (/codebase|repository|repo|코드베이스/i.test(text)) ideas.add('코드베이스 Q&A 챗봇');
  return [...ideas].filter((idea) => isAllowedEntityTitle(idea, '빌드 아이디어'));
}

export function repoDisplayName(fullName: string | null | undefined) {
  const raw = fullName?.split('/').pop()?.trim() ?? '';
  if (!raw) return '';
  const special: Record<string, string> = {
    'browser-use': 'browser-use',
    openhands: 'OpenHands',
    aider: 'Aider',
    cline: 'Cline',
    continue: 'Continue',
    langgraph: 'LangGraph',
    llamaindex: 'LlamaIndex',
    crewai: 'CrewAI',
    n8n: 'n8n',
    composio: 'Composio',
    supergateway: 'Supergateway',
    'open-webui': 'Open WebUI',
    litellm: 'LiteLLM',
    dify: 'Dify',
    flowise: 'Flowise',
  };
  return special[raw.toLowerCase()] ?? raw;
}

export function inferNewsSourceType(source: string | null | undefined): TrendSourceType {
  const lower = (source ?? '').toLowerCase();
  if (lower.includes('hacker news')) return 'hackernews';
  if (lower.includes('dev.to')) return 'devto';
  return 'rss';
}

function normalizeSourceType(value: unknown): TrendSourceType {
  const source = String(value ?? '').toLowerCase();
  if (source === 'product') return 'product_hunt';
  if (source === 'news') return 'rss';
  if (['github', 'npm', 'huggingface', 'devto', 'stackoverflow', 'product_hunt', 'hackernews', 'rss', 'paper'].includes(source)) return source as TrendSourceType;
  return 'rss';
}

export function legacySourceType(value: TrendSourceType) {
  if (value === 'product_hunt' || value === 'huggingface' || value === 'npm') return 'product';
  if (value === 'hackernews' || value === 'devto' || value === 'stackoverflow' || value === 'rss') return 'news';
  return value;
}

function normalizeCategory(value: unknown): TrendCategory {
  if (CATEGORIES.includes(value as TrendCategory)) return value as TrendCategory;
  if (value === 'AI 개발 방식') return '개발 워크플로우';
  if (value === 'AI 도구/모델') return 'AI 도구·모델';
  if (value === '스킬/아키텍처') return '구현 패턴';
  if (value === '오픈소스/GitHub') return '오픈소스 프로젝트';
  return '구현 패턴';
}

function normalizeEntityType(value: unknown, category: TrendCategory): TrendEntityType {
  if (['workflow', 'tool', 'model', 'skill', 'architecture', 'pattern', 'open_source_project', 'build_idea'].includes(String(value))) return value as TrendEntityType;
  if (category === '개발 워크플로우') return 'workflow';
  if (category === 'AI 도구·모델') return 'tool';
  if (category === '오픈소스 프로젝트') return 'open_source_project';
  if (category === '빌드 아이디어') return 'build_idea';
  return 'pattern';
}

export function normalizeDisplayScore(rawScore: number, maxScore: number) {
  return Math.max(25, Math.min(100, Math.round((rawScore / maxScore) * 100)));
}

export function getWeeklyGrowthRate(recent: number, previous: number) {
  if (!previous || previous <= 0) return 0;
  return Math.round(((recent - previous) / previous) * 100);
}

export function getTrendDirection(weeklyGrowthRate: number, isNew: boolean): TrendDirection {
  if (isNew) return 'new';
  if (weeklyGrowthRate >= 20) return 'up';
  if (weeklyGrowthRate <= -20) return 'down';
  return 'flat';
}

export function getTrendStatus(displayScore: number, weeklyGrowthRate: number, sourceDiversity: number, isNew: boolean): TrendStatus {
  if (isNew) return 'new';
  if (displayScore >= 85 && sourceDiversity >= 3) return 'hot';
  if (weeklyGrowthRate >= 30) return 'rising';
  if (weeklyGrowthRate <= -20) return 'cooling';
  if (displayScore >= 60) return 'steady';
  return 'watch';
}

export function buildSummary(candidate: TrendCandidate) {
  return `${candidate.displayName}는 ${candidate.category} 카테고리에서 감지된 구체 트렌드입니다. GitHub ${candidate.sourceMix.github ?? 0}개, Product Hunt ${candidate.sourceMix.product_hunt ?? 0}개, RSS/HN/커뮤니티 ${candidate.news}개, 논문 ${candidate.papers}개 신호를 조합해 점수화했습니다.`;
}

export function buildWhyTrending(candidate: TrendCandidate, growth: number, isNew = false) {
  const hasPreviousBaseline = candidate.previousSourceKeys.size > 0;
  return [
    candidate.category === '오픈소스 프로젝트' ? '실제 GitHub 프로젝트 신호를 기준으로만 집계했습니다.' : null,
    candidate.sourceMix.github ? `GitHub 구현/활동 신호 ${candidate.sourceMix.github}개가 있습니다.` : null,
    candidate.sourceMix.product_hunt ? `Product Hunt 제품 출시 신호 ${candidate.sourceMix.product_hunt}개가 있습니다.` : null,
    candidate.sourceMix.huggingface ? `Hugging Face 모델/데모 신호 ${candidate.sourceMix.huggingface}개가 있습니다.` : null,
    candidate.news ? `뉴스/커뮤니티/튜토리얼 신호 ${candidate.news}개와 연결됩니다.` : null,
    candidate.papers ? `논문 ${candidate.papers}개가 구현 패턴 근거를 보강합니다.` : null,
    !isNew && hasPreviousBaseline && growth >= 30 ? `최근 7일 관심도가 ${growth}% 상승했습니다.` : null,
    isNew && candidate.recentSourceKeys.size > 0 ? '최근 7일 새로 등장한 주제입니다.' : null,
  ].filter(Boolean) as string[];
}

export function buildNextActions(candidate: TrendCandidate) {
  if (candidate.category === '빌드 아이디어') return [candidate.displayName, ...[...candidate.projectIdeas]].slice(0, 5);
  if (candidate.projectIdeas.size) return [...candidate.projectIdeas].slice(0, 5);
  return [
    `${candidate.displayName} 관련 실제 소스 3개 읽기`,
    `${candidate.displayName}를 작은 데모로 검증하기`,
    '사용자 문제와 연결되는지 체크하기',
    '비슷한 도구/프로젝트와 비교하기',
    '7일 MVP 범위로 줄이기',
  ];
}

export function inferTargetRoles(category: TrendCategory, entityType: TrendEntityType) {
  if (category === 'AI 도구·모델') return ['AI 앱 빌더', '풀스택 개발자', '창업자/메이커'];
  if (category === '오픈소스 프로젝트') return ['오픈소스 관심 개발자', '백엔드 개발자', 'AI 앱 빌더'];
  if (category === '구현 패턴' || entityType === 'architecture') return ['AI 앱 빌더', '백엔드 개발자', '실무자'];
  if (category === '개발 워크플로우') return ['프론트엔드 개발자', '풀스택 개발자', '메이커'];
  return ['창업자/메이커', '풀스택 개발자', 'AI 앱 빌더'];
}

/**
 * Only returns real multi-day snapshot scores (never fabricates a synthetic upward slope from one score).
 */
export function buildBars(snapshotScores: number[] = []) {
  const valid = snapshotScores
    .filter((value) => Number.isFinite(value) && value >= 0)
    .slice(-7)
    .map((value) => Math.max(0, Math.min(100, Math.round(value))));
  return valid.length >= 2 ? valid : [];
}

/** Keywords stored in `trends` from previous runs that are no longer in the current ranked set. */
export function staleTrendKeywords(existingKeywords: string[], activeKeywords: Iterable<string>) {
  const active = new Set(activeKeywords);
  return existingKeywords.filter((keyword) => !active.has(keyword));
}

