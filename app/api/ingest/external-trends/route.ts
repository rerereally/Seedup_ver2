import { assertIngestAuth } from '@/lib/ingest/auth';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { createAdminClient } from '@/lib/supabase/admin';
import { createHash } from 'crypto';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

type ExternalSourceType = 'npm' | 'huggingface' | 'devto' | 'stackoverflow' | 'product_hunt' | 'hackernews';
type TrendCategory = '개발 워크플로우' | 'AI 도구·모델' | '구현 패턴' | '오픈소스 프로젝트' | '빌드 아이디어';
type TrendEntityType = 'workflow' | 'tool' | 'model' | 'architecture' | 'pattern' | 'build_idea';

type SourceConfig = {
  name: string;
  url: string;
  language: string;
  sourceType: ExternalSourceType;
};

type ExternalItem = {
  title: string;
  url: string | null;
  description: string;
  tags: string[];
  score: number;
  detectedAt: string;
  sourceName: string;
  sourceType: ExternalSourceType;
};

type Signal = {
  keyword: string;
  normalized_keyword: string;
  source_type: ExternalSourceType;
  source_id: string;
  source_title: string;
  source_url: string | null;
  weight: number;
  metadata: {
    category: TrendCategory;
    entity_type: TrendEntityType;
    display_name: string;
    related_skills: string[];
    related_tools: string[];
    source_name: string;
    project_idea?: string;
  };
  detected_at: string;
};

const FETCH_TIMEOUT_MS = 18_000;

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
  [/code review|pull request review|pr review|코드 리뷰/i, 'AI Code Review'],
  [/codebase q&a|ask.*codebase|코드베이스.*질문|코드베이스.*q&a/i, 'Codebase Q&A'],
  [/test generation|generate tests?|테스트.*생성/i, 'Test Generation'],
  [/design to code|figma to code|디자인.*코드|figma.*code/i, 'Design to Code'],
  [/prompt to app|text to app|프롬프트.*앱/i, 'Prompt to App'],
  [/pair programming|페어 프로그래밍/i, 'AI Pair Programming'],
  [/qa agent|quality assurance agent|browser.*qa|qa.*agent/i, 'AI QA Agent'],
  [/automated refactoring|refactor|리팩터링/i, 'Automated Refactoring'],
  [/debugging|debug agent|디버깅/i, 'AI-assisted Debugging'],
  [/documentation|docs agent|문서화/i, 'AI 기반 문서화'],
  [/\bprd\b|product requirement|requirements? to code|기획서.*코드/i, 'PRD to Code'],
];

const PATTERN_ENTITIES: Array<[RegExp, string, TrendEntityType]> = [
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
  [/eval pipeline|evaluation pipeline|benchmark/i, 'Eval Pipeline', 'pattern'],
  [/rate limit|rate limiting/i, 'Rate Limit Handling', 'pattern'],
];

const GENERIC = new Set(['ai', 'llm', 'agent', 'coding agent', 'ai agent', 'developer', 'development', 'tool', 'tools', 'app', 'service', 'product', 'python', 'javascript', 'typescript', 'react', 'next.js', 'supabase', 'api', 'github', 'open source', 'rag', 'mcp', 'automation', 'workflow', 'dashboard', 'template', 'starter', 'boilerplate', 'framework']);

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

  const sources = getExternalSources();
  const signals: Signal[] = [];
  let errors = 0;
  let skipped = 0;

  for (const source of sources) {
    try {
      const items = await fetchExternalItems(source);
      for (const item of items) {
        const itemSignals = buildSignalsForItem(item);
        if (!itemSignals.length) skipped += 1;
        signals.push(...itemSignals);
      }
    } catch (error) {
      errors += 1;
      console.error('External trend source failed', source.name, error);
    }
  }

  const deduped = dedupeSignals(signals);
  let inserted = 0;
  const BATCH_SIZE = 200;
  for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
    const batch = deduped.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('keyword_signals')
      .upsert(batch, { onConflict: 'source_type,source_id,normalized_keyword' });

    if (error) {
      errors += 1;
      console.error('External keyword signal upsert failed', error);
    } else {
      inserted += batch.length;
    }
  }

  await recordIngestRun(supabase, {
    source: 'external-trends',
    status: getRunStatus(errors, inserted),
    inserted,
    skipped,
    errors,
    durationMs: Date.now() - startedAt,
    detail: { sources: sources.length, signals: signals.length, deduplicated: deduped.length },
  });

  return NextResponse.json({ ok: errors === 0, sources: sources.length, signals: signals.length, inserted, skipped, errors });
}

function getExternalSources() {
  return [
    ...parseSources(process.env.INGEST_NPM_SOURCES, 'npm'),
    ...parseSources(process.env.INGEST_HUGGINGFACE_SOURCES, 'huggingface'),
    ...parseSources(process.env.INGEST_DEVTO_SOURCES, 'devto'),
    ...parseSources(process.env.INGEST_STACKOVERFLOW_SOURCES, 'stackoverflow'),
    ...parseSources(process.env.INGEST_PRODUCT_SOURCES, 'product_hunt'),
    ...parseSources(process.env.INGEST_HACKERNEWS_SOURCES, 'hackernews'),
  ];
}

function parseSources(value: string | undefined, sourceType: ExternalSourceType): SourceConfig[] {
  if (!value?.trim()) return [];
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, url, language = 'en'] = line.split('|').map((part) => part.trim());
      return name && url ? { name, url, language, sourceType } : null;
    })
    .filter((item): item is SourceConfig => Boolean(item));
}

async function fetchExternalItems(source: SourceConfig): Promise<ExternalItem[]> {
  if (source.sourceType === 'npm') return fetchNpmItems(source);
  if (source.sourceType === 'devto') return fetchDevToItems(source);
  if (source.sourceType === 'stackoverflow') return fetchStackOverflowItems(source);
  if (source.sourceType === 'hackernews') return fetchHackerNewsItems(source);
  if (source.sourceType === 'product_hunt') return fetchRssItems(source);
  return fetchHuggingFaceItems(source);
}

async function fetchJson<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: getRequestHeaders(url),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return await response.json() as T;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: getRequestHeaders(url),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

function getRequestHeaders(url: string): HeadersInit {
  const headers: HeadersInit = { 'user-agent': 'SeedupBot/1.0 (external trends)' };
  if (url.includes('huggingface.co') && process.env.HUGGINGFACE_TOKEN) {
    headers.authorization = `Bearer ${process.env.HUGGINGFACE_TOKEN}`;
  }
  return headers;
}

function withStackExchangeKey(url: string) {
  const key = process.env.STACKEXCHANGE_KEY?.trim();
  if (!key) return url;
  const parsed = new URL(url);
  if (!parsed.searchParams.has('key')) parsed.searchParams.set('key', key);
  return parsed.toString();
}

async function fetchNpmItems(source: SourceConfig): Promise<ExternalItem[]> {
  const json = await fetchJson<{ objects?: Array<{ package?: { name?: string; description?: string; links?: { npm?: string; repository?: string }; keywords?: string[] }; score?: { final?: number } }> }>(source.url);
  return (json.objects ?? []).map((item) => ({
    title: item.package?.name ?? '',
    url: item.package?.links?.npm ?? item.package?.links?.repository ?? null,
    description: item.package?.description ?? '',
    tags: item.package?.keywords ?? [],
    score: Math.round(Number(item.score?.final ?? 0.4) * 100),
    detectedAt: new Date().toISOString(),
    sourceName: source.name,
    sourceType: source.sourceType,
  })).filter((item) => item.title);
}

async function fetchDevToItems(source: SourceConfig): Promise<ExternalItem[]> {
  const json = await fetchJson<Array<{ id: number; title: string; description?: string; url?: string; tag_list?: string[]; public_reactions_count?: number; comments_count?: number; published_at?: string }>>(source.url);
  return json.map((item) => ({
    title: item.title,
    url: item.url ?? null,
    description: item.description ?? '',
    tags: item.tag_list ?? [],
    score: Number(item.public_reactions_count ?? 0) + Number(item.comments_count ?? 0) * 2,
    detectedAt: item.published_at ?? new Date().toISOString(),
    sourceName: source.name,
    sourceType: source.sourceType,
  }));
}

async function fetchStackOverflowItems(source: SourceConfig): Promise<ExternalItem[]> {
  const json = await fetchJson<{ items?: Array<{ question_id: number; title: string; link?: string; tags?: string[]; score?: number; view_count?: number; last_activity_date?: number }> }>(withStackExchangeKey(source.url));
  return (json.items ?? []).map((item) => ({
    title: decodeHtml(item.title),
    url: item.link ?? null,
    description: '',
    tags: item.tags ?? [],
    score: Number(item.score ?? 0) * 3 + Math.min(40, Number(item.view_count ?? 0) / 80),
    detectedAt: item.last_activity_date ? new Date(item.last_activity_date * 1000).toISOString() : new Date().toISOString(),
    sourceName: source.name,
    sourceType: source.sourceType,
  }));
}

async function fetchHackerNewsItems(source: SourceConfig): Promise<ExternalItem[]> {
  const json = await fetchJson<{ hits?: Array<{ objectID: string; title?: string; story_title?: string; url?: string; story_url?: string; points?: number; num_comments?: number; created_at?: string }> }>(source.url);
  return (json.hits ?? []).map((item) => ({
    title: item.title ?? item.story_title ?? '',
    url: item.url ?? item.story_url ?? null,
    description: '',
    tags: [],
    score: Number(item.points ?? 0) + Number(item.num_comments ?? 0) * 2,
    detectedAt: item.created_at ?? new Date().toISOString(),
    sourceName: source.name,
    sourceType: source.sourceType,
  })).filter((item) => item.title);
}

async function fetchRssItems(source: SourceConfig): Promise<ExternalItem[]> {
  const xml = await fetchText(source.url);
  const items = Array.from(xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)).slice(0, 30);
  return items.map((match) => {
    const raw = match[0];
    return {
      title: decodeHtml(readXmlTag(raw, 'title')),
      url: readXmlTag(raw, 'link') || null,
      description: decodeHtml(stripTags(readXmlTag(raw, 'description') || readXmlTag(raw, 'content:encoded'))),
      tags: Array.from(raw.matchAll(/<category[^>]*>([\s\S]*?)<\/category>/gi)).map((item) => decodeHtml(stripTags(item[1]))).filter(Boolean),
      score: 25,
      detectedAt: readXmlTag(raw, 'pubDate') ? new Date(readXmlTag(raw, 'pubDate')).toISOString() : new Date().toISOString(),
      sourceName: source.name,
      sourceType: source.sourceType,
    };
  }).filter((item) => item.title);
}

async function fetchHuggingFaceItems(source: SourceConfig): Promise<ExternalItem[]> {
  if (source.url.includes('/api/models')) {
    const json = await fetchJson<Array<{ id?: string; modelId?: string; likes?: number; downloads?: number; pipeline_tag?: string; tags?: string[]; lastModified?: string }>>(source.url);
    return json.map((item) => {
      const id = item.modelId ?? item.id ?? '';
      const tags = ['model', item.pipeline_tag, ...(item.tags ?? [])].filter(Boolean) as string[];
      return {
        title: id.split('/').pop() ?? id,
        url: id ? `https://huggingface.co/${id}` : source.url,
        description: tags.join(' '),
        tags,
        score: Number(item.likes ?? 0) + Math.min(80, Number(item.downloads ?? 0) / 1000),
        detectedAt: item.lastModified ?? new Date().toISOString(),
        sourceName: source.name,
        sourceType: source.sourceType,
      };
    }).filter((item) => item.title);
  }

  if (source.url.includes('/api/spaces')) {
    const json = await fetchJson<Array<{ id?: string; author?: string; title?: string; likes?: number; sdk?: string; tags?: string[]; lastModified?: string }>>(source.url);
    return json.map((item) => {
      const id = item.id ?? '';
      const tags = ['space', item.sdk, ...(item.tags ?? [])].filter(Boolean) as string[];
      return {
        title: item.title ?? id.split('/').pop() ?? id,
        url: id ? `https://huggingface.co/spaces/${id}` : source.url,
        description: tags.join(' '),
        tags,
        score: Number(item.likes ?? 0),
        detectedAt: item.lastModified ?? new Date().toISOString(),
        sourceName: source.name,
        sourceType: source.sourceType,
      };
    }).filter((item) => item.title);
  }

  const html = await fetchText(source.url);
  const cardMatches = Array.from(html.matchAll(/href="\/(models|spaces)\/([^"]+)"[\s\S]{0,500}?<[^>]+>([^<]{2,120})<\/[^>]+>/gi)).slice(0, 30);
  if (cardMatches.length) {
    return cardMatches.map((match) => {
      const path = `${match[1]}/${match[2]}`;
      const title = decodeHtml(match[3]).trim() || match[2].split('/').pop() || path;
      return {
        title,
        url: `https://huggingface.co/${path}`,
        description: path,
        tags: [match[1] === 'models' ? 'model' : 'space'],
        score: 35,
        detectedAt: new Date().toISOString(),
        sourceName: source.name,
        sourceType: source.sourceType,
      };
    }).filter((item) => item.title);
  }

  return Array.from(html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>/gi)).slice(0, 25).map((match) => ({
    title: decodeHtml(stripTags(match[1])),
    url: source.url,
    description: '',
    tags: ['paper'],
    score: 25,
    detectedAt: new Date().toISOString(),
    sourceName: source.name,
    sourceType: source.sourceType,
  })).filter((item) => item.title);
}

function buildSignalsForItem(item: ExternalItem) {
  const text = [item.title, item.description, ...item.tags].join(' ');
  const baseWeight = getSourceBaseWeight(item.sourceType) + Math.min(30, Number(item.score ?? 0) / 4);
  const signals: Signal[] = [];

  for (const name of TOOL_MODEL_NAMES) {
    if (text.toLowerCase().includes(name.toLowerCase())) {
      addSignal(signals, item, name, 'AI 도구·모델', /qwen|deepseek|kimi|grok|gemini|claude|llama|mistral|gpt/i.test(name) ? 'model' : 'tool', baseWeight, [name]);
    }
  }

  if (item.sourceType === 'npm' || item.sourceType === 'huggingface') {
    const entityName = normalizePackageLikeName(item.title);
    if (entityName && !isGeneric(entityName)) {
      addSignal(signals, item, entityName, 'AI 도구·모델', item.sourceType === 'huggingface' && item.tags.includes('model') ? 'model' : 'tool', baseWeight, [entityName]);
    }
  }

  for (const [pattern, name] of WORKFLOW_PATTERNS) {
    if (pattern.test(text)) addSignal(signals, item, name, '개발 워크플로우', 'workflow', baseWeight * 0.9, item.tags);
  }

  for (const [pattern, name, entityType] of PATTERN_ENTITIES) {
    if (pattern.test(text)) addSignal(signals, item, name, '구현 패턴', entityType, baseWeight, item.tags);
  }

  for (const idea of extractBuildIdeas(text)) {
    addSignal(signals, item, idea, '빌드 아이디어', 'build_idea', baseWeight * 0.85, item.tags, idea);
  }

  return signals;
}

function addSignal(signals: Signal[], item: ExternalItem, name: string, category: TrendCategory, entityType: TrendEntityType, weight: number, relatedSkills: string[] = [], projectIdea?: string) {
  const displayName = cleanName(name);
  if (!displayName || isGeneric(displayName)) return;

  signals.push({
    keyword: displayName,
    normalized_keyword: normalizeKey(displayName),
    source_type: item.sourceType,
    source_id: deterministicUuid(`${item.sourceType}:${item.url ?? item.title}`),
    source_title: item.title,
    source_url: item.url,
    weight,
    metadata: {
      category,
      entity_type: entityType,
      display_name: displayName,
      related_skills: relatedSkills.filter((skill) => !isGeneric(skill)).slice(0, 8),
      related_tools: category === 'AI 도구·모델' ? [displayName] : [],
      source_name: item.sourceName,
      ...(projectIdea ? { project_idea: projectIdea } : {}),
    },
    detected_at: item.detectedAt,
  });
}

function extractBuildIdeas(text: string) {
  const lower = text.toLowerCase();
  const ideas = new Set<string>();
  if (/\bmcp\b|model context protocol/i.test(lower)) ideas.add('MCP 서버 만들기');
  if (/code review|pull request|github pr|pr summary|코드 리뷰|pr 요약/i.test(lower)) ideas.add('AI 코드 리뷰 봇');
  if (/\brag\b|retrieval|vector/i.test(lower)) ideas.add('RAG 품질 평가 대시보드');
  if (/news|curation|newsletter|뉴스|큐레이션/i.test(lower)) ideas.add('AI 뉴스 큐레이션 에이전트');
  if (/figma|design to code|디자인/i.test(lower)) ideas.add('Figma to Code 워크플로우');
  if (/document|knowledge base|문서|검색/i.test(lower)) ideas.add('개인 문서 기반 AI 검색 앱');
  if (/browser|qa|computer use/i.test(lower)) ideas.add('브라우저 자동화 QA 에이전트');
  if (/cost|pricing|token|latency|비용/i.test(lower)) ideas.add('LLM 비용 모니터링 대시보드');
  if (/product hunt|ai product|제품/i.test(lower)) ideas.add('AI 제품 비교 대시보드');
  if (/paper|research|논문/i.test(lower)) ideas.add('논문 to 프로젝트 추천기');
  if (/codebase|repository|repo|코드베이스/i.test(lower)) ideas.add('코드베이스 Q&A 챗봇');
  return [...ideas];
}

function getSourceBaseWeight(sourceType: ExternalSourceType) {
  if (sourceType === 'npm' || sourceType === 'product_hunt' || sourceType === 'huggingface') return 20;
  if (sourceType === 'hackernews') return 17;
  return 14;
}

function normalizePackageLikeName(value: string) {
  const name = value
    .replace(/^@/, '')
    .split('/')
    .pop()
    ?.replace(/^hf[-_]/i, '')
    .trim() ?? '';
  if (!name || name.length > 48) return '';
  return cleanName(name);
}

function cleanName(value: string) {
  return decodeHtml(value).replace(/\s+/g, ' ').trim().slice(0, 64);
}

function normalizeKey(value: string) {
  return cleanName(value).toLowerCase().replace(/[^a-z0-9가-힣]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function isGeneric(value: string) {
  const normalized = normalizeKey(value);
  return GENERIC.has(normalized) || /^(ai|llm|agent|rag|mcp|tool|app|api|sdk|framework|starter|template|dashboard)$/i.test(value.trim());
}

function dedupeSignals(signals: Signal[]) {
  const seen = new Map<string, Signal>();
  for (const signal of signals) {
    const key = `${signal.source_type}:${signal.source_id}:${signal.normalized_keyword}`;
    const existing = seen.get(key);
    if (!existing || signal.weight > existing.weight) seen.set(key, signal);
  }
  return [...seen.values()];
}

function deterministicUuid(value: string) {
  const hash = createHash('sha1').update(value).digest('hex').slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${((parseInt(hash.slice(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0')}${hash.slice(18, 20)}-${hash.slice(20, 32)}`;
}

function readXmlTag(xml: string, tag: string) {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
  return match ? stripCdata(match[1]).trim() : '';
}

function stripCdata(value: string) {
  return value.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '');
}

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, ' ');
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x2F;/g, '/');
}
