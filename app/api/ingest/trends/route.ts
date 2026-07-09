import { assertIngestAuth } from '@/lib/ingest/auth';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

type TrendCategory =
  | '개발 워크플로우'
  | 'AI 도구·모델'
  | '구현 패턴'
  | '오픈소스 프로젝트'
  | '빌드 아이디어';

type TrendEntityType =
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

type TrendCandidate = {
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

type KeywordSignalInput = {
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

const DAY_MS = 24 * 60 * 60 * 1000;
const CATEGORIES: TrendCategory[] = ['개발 워크플로우', 'AI 도구·모델', '구현 패턴', '오픈소스 프로젝트', '빌드 아이디어'];

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

const GENERIC_TITLE_BLOCKLIST = new Set([
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
  'supabase',
  'api',
  'github',
  'open source',
  'rag',
  'mcp',
  'automation',
  'workflow',
  'dashboard',
  'template',
  'starter',
  'boilerplate',
  'framework',
]);

const TOOL_MODEL_NAMES = [
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

const WORKFLOW_PATTERNS: Array<[RegExp, string]> = [
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

const IMPLEMENTATION_PATTERNS: Array<[RegExp, string, TrendEntityType]> = [
  [/\bmcp\b|model context protocol/i, 'MCP Server Design', 'architecture'],
  [/\brag\b|retrieval augmented|retrieval-augmented/i, 'RAG Evaluation', 'pattern'],
  [/agent memory|memory/i, 'Agent Memory', 'pattern'],
  [/tool calling|function calling|tools/i, 'Tool Calling', 'pattern'],
  [/vector search|vector database|embedding search/i, 'Vector Search', 'architecture'],
  [/observability|tracing|telemetry/i, 'LLM Observability', 'architecture'],
  [/prompt caching|cache/i, 'Prompt Caching', 'pattern'],
  [/streaming ui|streaming response|stream/i, 'Streaming UI', 'pattern'],
  [/structured output|json schema|schema output/i, 'Structured Output', 'pattern'],
  [/browser automation|browser agent|computer use/i, 'Browser Automation', 'pattern'],
  [/multi[-\s]?agent|orchestration/i, 'Multi-Agent Workflow', 'architecture'],
  [/human[-\s]?in[-\s]?the[-\s]?loop|hitl/i, 'Human-in-the-loop', 'pattern'],
  [/retrieval pipeline|indexing pipeline/i, 'Retrieval Pipeline', 'architecture'],
  [/eval pipeline|evaluation pipeline|benchmark/i, 'Eval Pipeline', 'pattern'],
  [/background job|queue|worker/i, 'Background Job Queue', 'architecture'],
  [/rate limit|rate limiting/i, 'Rate Limit Handling', 'pattern'],
];

export async function GET(request: Request) {
  return ingest(request);
}

export async function POST(request: Request) {
  return ingest(request);
}

async function ingest(request: Request) {
  const startedAt = Date.now();
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: 'Missing Supabase server configuration' }, { status: 500 });
  }

  const [newsResult, productsResult, reposResult, papersResult] = await Promise.all([
    supabase.from('news_items').select('id,title,category,related_skills,topic_tags,skill_tags,intent_tags,project_idea,relevance_score,daily_rank_score,original_url,source,published_at,created_at').order('published_at', { ascending: false }).limit(220),
    supabase.from('ai_products').select('id,name,category,use_cases,topic_tags,skill_tags,related_project_ideas,score,website_url,product_hunt_url,created_at').order('created_at', { ascending: false }).limit(140),
    supabase.from('github_trends').select('id,repo_full_name,repo_url,topics,language,short_summary,beginner_summary,project_idea,relevance_score,stars,stars_delta_7d,pushed_at,created_at').order('stars', { ascending: false }).limit(180),
    supabase.from('research_papers').select('id,title,categories,related_skills,implementation_idea,service_idea,relevance_score,trend_score,buildability_score,paper_url,published_at,created_at').order('published_at', { ascending: false }).limit(120),
  ]);

  const signals: KeywordSignalInput[] = [];

  for (const item of newsResult.data ?? []) {
    const text = [item.title, item.category, item.project_idea, ...(item.topic_tags ?? []), ...(item.intent_tags ?? []), ...(item.related_skills ?? []), ...(item.skill_tags ?? [])].join(' ');
    const sourceType = inferNewsSourceType(item.source);
    const weight = 12 + Number(item.relevance_score ?? 50) / 10 + Number(item.daily_rank_score ?? 0) / 9;
    const skills = [...(item.related_skills ?? []), ...(item.skill_tags ?? [])];
    addWorkflowSignals(signals, text, weight, sourceType, item.id, item.title, item.original_url, item.published_at ?? item.created_at, skills, [], item.source);
    addImplementationPatternSignals(signals, text, weight * 0.92, sourceType, item.id, item.title, item.original_url, item.published_at ?? item.created_at, skills, [], item.source);
    addBuildIdeaSignals(signals, item.project_idea ?? text, weight * 0.82, sourceType, item.id, item.title, item.original_url, item.published_at ?? item.created_at, skills, [], item.source);
  }

  for (const item of productsResult.data ?? []) {
    const url = item.product_hunt_url ?? item.website_url;
    const text = [item.name, item.category, ...(item.use_cases ?? []), ...(item.topic_tags ?? []), ...(item.related_project_ideas ?? [])].join(' ');
    const weight = 18 + Number(item.score ?? 7);
    const skills = item.skill_tags ?? [];
    addToolModelSignal(signals, item.name, weight * 1.25, 'product_hunt', item.id, item.name, url, item.created_at, skills, [item.name], 'Product Hunt');
    addKnownToolModelSignals(signals, text, weight, 'product_hunt', item.id, item.name, url, item.created_at, skills, [item.name], 'Product Hunt');
    addWorkflowSignals(signals, text, weight * 0.75, 'product_hunt', item.id, item.name, url, item.created_at, skills, [item.name], 'Product Hunt');
    for (const idea of item.related_project_ideas ?? []) {
      addBuildIdeaSignals(signals, idea, weight, 'product_hunt', item.id, item.name, url, item.created_at, skills, [item.name], 'Product Hunt');
    }
  }

  for (const repo of reposResult.data ?? []) {
    const stars = Number(repo.stars ?? 0);
    const starDelta = Number(repo.stars_delta_7d ?? 0);
    if (stars < 50) continue;

    const displayName = repoDisplayName(repo.repo_full_name);
    const text = [repo.repo_full_name, repo.short_summary, repo.beginner_summary, repo.project_idea, ...(repo.topics ?? [])].join(' ');
    const weight = 18 + Math.min(stars / 800, 16) + Math.min(Math.max(starDelta, 0) / 5, 14) + Number(repo.relevance_score ?? 50) / 18;
    const skills = [repo.language, ...(repo.topics ?? [])].filter(Boolean) as string[];
    addOpenSourceSignal(signals, displayName, weight * 1.35, 'github', repo.id, repo.repo_full_name, repo.repo_url, repo.pushed_at ?? repo.created_at, skills, [displayName], 'GitHub');
    addKnownToolModelSignals(signals, text, weight * 0.82, 'github', repo.id, repo.repo_full_name, repo.repo_url, repo.pushed_at ?? repo.created_at, skills, [displayName], 'GitHub');
    addWorkflowSignals(signals, text, weight * 0.7, 'github', repo.id, repo.repo_full_name, repo.repo_url, repo.pushed_at ?? repo.created_at, skills, [displayName], 'GitHub');
    addImplementationPatternSignals(signals, text, weight * 0.9, 'github', repo.id, repo.repo_full_name, repo.repo_url, repo.pushed_at ?? repo.created_at, skills, [displayName], 'GitHub');
    addBuildIdeaSignals(signals, repo.project_idea ?? text, weight * 0.82, 'github', repo.id, repo.repo_full_name, repo.repo_url, repo.pushed_at ?? repo.created_at, skills, [displayName], 'GitHub');
  }

  for (const paper of papersResult.data ?? []) {
    const text = [paper.title, paper.implementation_idea, paper.service_idea, ...(paper.categories ?? []), ...(paper.related_skills ?? [])].join(' ');
    const weight = 12 + Number(paper.trend_score ?? paper.relevance_score ?? 55) / 9 + Number(paper.buildability_score ?? 0) / 18;
    const skills = paper.related_skills ?? paper.categories ?? [];
    addImplementationPatternSignals(signals, text, weight * 1.18, 'paper', paper.id, paper.title, paper.paper_url, paper.published_at ?? paper.created_at, skills, [], 'arXiv');
    addBuildIdeaSignals(signals, paper.implementation_idea ?? paper.service_idea ?? text, weight, 'paper', paper.id, paper.title, paper.paper_url, paper.published_at ?? paper.created_at, skills, [], 'arXiv');
  }

  const deduplicatedSignals = dedupeSignals(signals);
  const BATCH_SIZE = 200;
  let errors = 0;
  for (let i = 0; i < deduplicatedSignals.length; i += BATCH_SIZE) {
    const batch = deduplicatedSignals.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('keyword_signals')
      .upsert(batch, { onConflict: 'source_type,source_id,normalized_keyword' });
    if (error) {
      const legacyBatch = batch.map((signal) => ({ ...signal, source_type: legacySourceType(signal.source_type) }));
      const retry = /source_type|check constraint|violates/i.test(error.message)
        ? await supabase.from('keyword_signals').upsert(legacyBatch, { onConflict: 'source_type,source_id,normalized_keyword' })
        : { error };
      if (retry.error) {
        errors += 1;
        console.error('Keyword signal upsert batch failed', retry.error);
      }
    }
  }

  const since30Days = new Date(Date.now() - 30 * DAY_MS).toISOString();
  const { data: storedSignals, error: readError } = await supabase
    .from('keyword_signals')
    .select('keyword,normalized_keyword,source_type,source_id,source_title,source_url,weight,metadata,detected_at')
    .gte('detected_at', since30Days)
    .order('detected_at', { ascending: false })
    .limit(5000);

  if (readError) {
    return NextResponse.json({ error: 'Keyword signal read failed', detail: readError.message }, { status: 500 });
  }

  const candidates = [...buildTrendCandidates(storedSignals ?? []).values()]
    .filter(isTrendCandidateStrongEnough)
    .sort((a, b) => b.score - a.score);

  const maxScore = Math.max(1, ...candidates.map((candidate) => candidate.score));
  const rankedCandidates = pickTopByCategory(candidates, 30);
  const ranked = rankedCandidates.map((candidate, index) => {
    const displayScore = normalizeDisplayScore(candidate.score, maxScore);
    const previousScore = candidate.previousSourceKeys.size
      ? normalizeDisplayScore(candidate.previousSourceKeys.size * 18 + candidate.signalStrength * 0.15, maxScore)
      : 0;
    const weeklyGrowthRate = getWeeklyGrowthRate(candidate.recentSourceKeys.size, candidate.previousSourceKeys.size);
    const trendDirection = getTrendDirection(weeklyGrowthRate, previousScore === 0 && candidate.recentSourceKeys.size > 0);
    const status = getTrendStatus(displayScore, weeklyGrowthRate, candidate.sourceKeys.size, trendDirection === 'new');
    return { candidate, rank: index + 1, displayScore, previousScore, weeklyGrowthRate, trendDirection, status };
  });

  let upserted = 0;
  for (const item of ranked) {
    const { candidate } = item;
    const payload = {
      keyword: candidate.displayName,
      display_name: candidate.displayName,
      normalized_name: candidate.normalizedName,
      entity_type: candidate.entityType,
      rank: item.rank,
      trend_type: candidate.entityType,
      category: candidate.category,
      summary: buildSummary(candidate),
      raw_score: Number(candidate.score.toFixed(2)),
      display_score: item.displayScore,
      previous_score: item.previousScore,
      weekly_growth_rate: item.weeklyGrowthRate,
      trend_direction: item.trendDirection,
      score: item.displayScore,
      status: item.status,
      bars: buildBars(item.displayScore),
      why_trending: buildWhyTrending(candidate, item.weeklyGrowthRate),
      related_skills: [...candidate.relatedSkills].filter((skill) => !isGenericTitle(skill)).slice(0, 10),
      related_tools: [...candidate.relatedTools].filter((tool) => !isGenericTitle(tool)).slice(0, 8),
      target_roles: inferTargetRoles(candidate.category, candidate.entityType),
      project_ideas: buildNextActions(candidate).slice(0, 5),
      sources_count: candidate.sourceKeys.size,
      news_count: candidate.news,
      product_count: candidate.products,
      github_repo_count: candidate.repos,
      paper_count: candidate.papers,
      source_mix: candidate.sourceMix,
      detected_sources: candidate.refs.slice(0, 12),
      source_refs: candidate.refs.slice(0, 12),
    };
    const result = await supabase.from('trends').upsert(payload, { onConflict: 'keyword' });
    const fallbackPayload = {
      keyword: payload.keyword,
      rank: payload.rank,
      trend_type: payload.trend_type,
      category: payload.category,
      summary: payload.summary,
      score: payload.score,
      status: payload.status,
      bars: payload.bars,
      project_ideas: payload.project_ideas,
      sources_count: payload.sources_count,
      news_count: payload.news_count,
      product_count: payload.product_count,
      github_repo_count: payload.github_repo_count,
      paper_count: payload.paper_count,
      source_refs: payload.source_refs,
    };
    const fallbackResult = result.error && /column|schema|paper_count|trend_type|display_score|weekly_growth_rate|entity_type|display_name|normalized_name|source_mix|detected_sources/i.test(result.error.message)
      ? await supabase.from('trends').upsert(fallbackPayload, { onConflict: 'keyword' })
      : result;

    if (fallbackResult.error) {
      errors += 1;
      console.error('Trend upsert failed', candidate.displayName, fallbackResult.error);
    } else {
      upserted += 1;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const snapshotPayload = ranked.slice(0, 150).map(({ candidate, displayScore }) => ({
    keyword: candidate.displayName,
    snapshot_date: today,
    score: displayScore,
    signal_count: candidate.sourceKeys.size,
    news_count: candidate.news,
    product_count: candidate.products,
    github_repo_count: candidate.repos,
    paper_count: candidate.papers,
    source_refs: candidate.refs.slice(0, 8),
  }));
  const snapshotResult = await supabase.from('trend_snapshots').upsert(snapshotPayload, { onConflict: 'keyword,snapshot_date' });
  const fallbackSnapshotResult = snapshotResult.error && /column|schema|paper_count/i.test(snapshotResult.error.message)
    ? await supabase.from('trend_snapshots').upsert(snapshotPayload.map(({ paper_count, ...snapshot }) => snapshot), { onConflict: 'keyword,snapshot_date' })
    : snapshotResult;

  if (fallbackSnapshotResult.error) {
    errors += 1;
    console.error('Trend snapshot upsert failed', fallbackSnapshotResult.error);
  }

  await recordIngestRun(supabase, {
    source: 'trends',
    status: getRunStatus(errors, upserted),
    inserted: upserted,
    skipped: Math.max(0, candidates.length - ranked.length),
    errors,
    durationMs: Date.now() - startedAt,
    detail: { signals: signals.length, deduplicated: deduplicatedSignals.length, ranked: ranked.length, categories: CATEGORIES },
  });

  return NextResponse.json({ ok: errors === 0, signals: signals.length, upserted, errors, ranked: ranked.length });
}

function addWorkflowSignals(
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

function addKnownToolModelSignals(
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

function addToolModelSignal(
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

function addImplementationPatternSignals(
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

function addOpenSourceSignal(
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

function addBuildIdeaSignals(
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

function dedupeSignals(signals: KeywordSignalInput[]) {
  const signalMap = new Map<string, KeywordSignalInput>();
  for (const signal of signals) {
    const key = `${signal.source_type}::${signal.source_id}::${signal.normalized_keyword}`;
    const existing = signalMap.get(key);
    if (!existing || signal.weight > existing.weight) signalMap.set(key, signal);
  }
  return [...signalMap.values()];
}

function buildTrendCandidates(signals: Array<Record<string, any>>) {
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

function pickTopByCategory(candidates: TrendCandidate[], perCategory: number) {
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

function isTrendCandidateStrongEnough(candidate: TrendCandidate) {
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
  return candidate.entityType === 'build_idea' && sourceCount >= 2 && sourceDiversity >= 2 && candidate.score >= 36;
}

function normalizeEntityName(value: string | null | undefined) {
  if (!value) return '';
  return value
    .replace(/[\"“”‘’]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 64);
}

function normalizeNameKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function isAllowedEntityTitle(value: string, category: TrendCategory) {
  const normalized = normalizeNameKey(value);
  if (!normalized || isGenericTitle(value)) return false;
  if (/(이\s*저장소|이\s*프로젝트|활용하여|참고하여|핵심\s*기능\s*만들어보기|this repository|this project)/i.test(value)) return false;
  if (category === '구현 패턴') return /design|evaluation|memory|calling|search|observability|caching|streaming|output|automation|workflow|loop|pipeline|queue|limit|pattern|architecture|설계|평가|검색|파이프라인|캐싱|자동화/i.test(value);
  if (category === '빌드 아이디어') return /(봇|대시보드|앱|도구|에이전트|분석기|추천기|검색|모니터링|workflow|bot|dashboard|app|agent|monitor|tracker|builder)/i.test(value);
  if (category === '개발 워크플로우') return /development|review|q&a|generation|code|programming|debugging|documentation|workflow|refactoring|qa|prd|figma|prompt|문서화|디버깅|리뷰|요약/i.test(value);
  return true;
}

function isGenericTitle(value: string) {
  const normalized = normalizeNameKey(value);
  if (GENERIC_TITLE_BLOCKLIST.has(normalized)) return true;
  return /^(ai|llm|agent|coding agent|ai agent|developer tool|rag|mcp|workflow|automation|dashboard|template|starter|boilerplate|framework)$/i.test(value.trim());
}

function extractBuildIdeas(value: string | null | undefined) {
  if (!value) return [];
  const text = value.toLowerCase();
  const ideas = new Set<string>();
  if (/\bmcp\b|model context protocol/i.test(text)) ideas.add('MCP 서버 만들기');
  if (/code review|pull request|github pr|pr summary|코드 리뷰|pr 요약/i.test(text)) ideas.add('AI 코드 리뷰 봇');
  if (/\brag\b|retrieval|vector/i.test(text)) ideas.add('RAG 품질 평가 대시보드');
  if (/news|curation|newsletter|뉴스|큐레이션/i.test(text)) ideas.add('AI 뉴스 큐레이션 에이전트');
  if (/figma|design to code|디자인/i.test(text)) ideas.add('Figma to Code 워크플로우');
  if (/document|knowledge base|문서|검색/i.test(text)) ideas.add('개인 문서 기반 AI 검색 앱');
  if (/browser|qa|computer use/i.test(text)) ideas.add('브라우저 자동화 QA 에이전트');
  if (/cost|pricing|token|latency|비용/i.test(text)) ideas.add('LLM 비용 모니터링 대시보드');
  if (/product hunt|ai product|제품/i.test(text)) ideas.add('AI 제품 비교 대시보드');
  if (/paper|research|논문/i.test(text)) ideas.add('논문 to 프로젝트 추천기');
  if (/codebase|repository|repo|코드베이스/i.test(text)) ideas.add('코드베이스 Q&A 챗봇');
  return [...ideas].filter((idea) => isAllowedEntityTitle(idea, '빌드 아이디어'));
}

function repoDisplayName(fullName: string | null | undefined) {
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

function inferNewsSourceType(source: string | null | undefined): TrendSourceType {
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

function legacySourceType(value: TrendSourceType) {
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

function normalizeDisplayScore(rawScore: number, maxScore: number) {
  return Math.max(25, Math.min(100, Math.round((rawScore / maxScore) * 100)));
}

function getWeeklyGrowthRate(recent: number, previous: number) {
  if (!previous) return recent > 0 ? 100 : 0;
  return Math.round(((recent - previous) / previous) * 100);
}

function getTrendDirection(weeklyGrowthRate: number, isNew: boolean): TrendDirection {
  if (isNew) return 'new';
  if (weeklyGrowthRate >= 20) return 'up';
  if (weeklyGrowthRate <= -20) return 'down';
  return 'flat';
}

function getTrendStatus(displayScore: number, weeklyGrowthRate: number, sourceDiversity: number, isNew: boolean): TrendStatus {
  if (isNew) return 'new';
  if (displayScore >= 85 && sourceDiversity >= 3) return 'hot';
  if (weeklyGrowthRate >= 30) return 'rising';
  if (weeklyGrowthRate <= -20) return 'cooling';
  if (displayScore >= 60) return 'steady';
  return 'watch';
}

function buildSummary(candidate: TrendCandidate) {
  return `${candidate.displayName}는 ${candidate.category} 카테고리에서 감지된 구체 트렌드입니다. GitHub ${candidate.sourceMix.github ?? 0}개, Product Hunt ${candidate.sourceMix.product_hunt ?? 0}개, RSS/HN/커뮤니티 ${candidate.news}개, 논문 ${candidate.papers}개 신호를 조합해 점수화했습니다.`;
}

function buildWhyTrending(candidate: TrendCandidate, growth: number) {
  return [
    candidate.category === '오픈소스 프로젝트' ? '실제 GitHub 프로젝트 신호를 기준으로만 집계했습니다.' : null,
    candidate.sourceMix.github ? `GitHub 구현/활동 신호 ${candidate.sourceMix.github}개가 있습니다.` : null,
    candidate.sourceMix.product_hunt ? `Product Hunt 제품 출시 신호 ${candidate.sourceMix.product_hunt}개가 있습니다.` : null,
    candidate.sourceMix.huggingface ? `Hugging Face 모델/데모 신호 ${candidate.sourceMix.huggingface}개가 있습니다.` : null,
    candidate.news ? `뉴스/커뮤니티/튜토리얼 신호 ${candidate.news}개와 연결됩니다.` : null,
    candidate.papers ? `논문 ${candidate.papers}개가 구현 패턴 근거를 보강합니다.` : null,
    growth >= 30 ? `최근 7일 관심도가 ${growth}% 상승했습니다.` : null,
  ].filter(Boolean) as string[];
}

function buildNextActions(candidate: TrendCandidate) {
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

function inferTargetRoles(category: TrendCategory, entityType: TrendEntityType) {
  if (category === 'AI 도구·모델') return ['AI 앱 빌더', '풀스택 개발자', '창업자/메이커'];
  if (category === '오픈소스 프로젝트') return ['오픈소스 관심 개발자', '백엔드 개발자', 'AI 앱 빌더'];
  if (category === '구현 패턴' || entityType === 'architecture') return ['AI 앱 빌더', '백엔드 개발자', '실무자'];
  if (category === '개발 워크플로우') return ['프론트엔드 개발자', '풀스택 개발자', '메이커'];
  return ['창업자/메이커', '풀스택 개발자', 'AI 앱 빌더'];
}

function buildBars(score: number) {
  return [0.42, 0.5, 0.58, 0.68, 0.78, 0.9, 1].map((ratio) => Math.max(10, Math.round(score * ratio)));
}
