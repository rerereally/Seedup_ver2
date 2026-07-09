import { assertIngestAuth } from '@/lib/ingest/auth';
import { analyzePaper } from '@/lib/ingest/ai';
import { ARXIV_FEED_SOURCES, RESEARCH_QUERIES, RESEARCH_SOURCE_INFO } from '@/lib/ingest/research-sources';
import { getRunStatus, recordIngestRun } from '@/lib/ingest/runs';
import { stripHtml } from '@/lib/ingest/text';
import { createAdminClient } from '@/lib/supabase/admin';
import Parser from 'rss-parser';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 90;

type ArxivItem = Parser.Item & {
  id?: string;
  isoDate?: string;
  categories?: unknown[];
  author?: unknown;
  creator?: unknown;
};

const parser = new Parser({
  timeout: 10000,
  customFields: {
    item: [
      ['id', 'id'],
      ['summary', 'summary'],
      ['category', 'categories', { keepArray: true }],
    ],
  },
  headers: {
    'user-agent': 'SeedupBot/1.0 (research ingestion)',
  },
});

const RESEARCH_FETCH_TIMEOUT_MS = 20000;

export async function POST(request: Request) {
  return ingest(request);
}

export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get('limit') ?? 12);
  const minScore = Number(url.searchParams.get('minScore') ?? 55);
  const minFitScore = Number(url.searchParams.get('minFitScore') ?? 18);
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  let candidates: Awaited<ReturnType<typeof fetchArxivPapers>> = [];
  let hfTitles: string[] = [];

  try {
    candidates = await fetchArxivPapers(limit);
    hfTitles = await fetchHuggingFacePaperTitles();
  } catch (error) {
    errors += 1;
    console.error('Research source fetch failed', error);
  }

  if (!candidates.length) {
    errors += 1;
  }

  for (const paper of candidates) {
    try {
      if (!paper.title || !paper.paperUrl) {
        skipped += 1;
        continue;
      }

      const fit = evaluateSeedupResearchFit(paper);
      if (fit.score < minFitScore) {
        skipped += 1;
        continue;
      }

      const codeUrl = await findPapersWithCodeUrl(paper.title);
      const hasCode = Boolean(codeUrl);
      const isHuggingFaceTrending = hfTitles.some((title) => similarTitle(title, paper.title));
      const { analysis, model, ok, qualityReason } = await analyzePaper({
        title: paper.title,
        abstract: paper.abstract,
        authors: paper.authors,
        categories: paper.categories,
        source: paper.source,
        hasCode,
      });
      if (!ok) {
        skipped += 1;
        console.warn('Research paper skipped after AI quality check', paper.title, qualityReason);
        continue;
      }

      const boostedRelevance = Math.min(100, analysis.relevance_score + (hasCode ? 8 : 0) + (isHuggingFaceTrending ? 8 : 0));
      if (boostedRelevance < minScore) {
        skipped += 1;
        continue;
      }

      const { error } = await supabase.from('research_papers').upsert(
        {
          title: paper.title,
          abstract: analysis.expert_summary || analysis.beginner_summary || paper.abstract,
          authors: paper.authors,
          source: paper.source,
          source_url: RESEARCH_SOURCE_INFO.arxiv.url,
          paper_url: paper.paperUrl,
          pdf_url: paper.pdfUrl,
          code_url: codeUrl,
          categories: paper.categories,
          review_type: hasCode ? '코드가 공개된 논문' : analysis.review_type,
          beginner_summary: analysis.beginner_summary,
          expert_summary: analysis.expert_summary,
          why_it_matters: analysis.why_it_matters,
          key_points: analysis.key_points,
          related_skills: analysis.related_skills,
          implementation_idea: analysis.implementation_idea,
          service_idea: analysis.service_idea,
          difficulty: analysis.difficulty,
          target_reader: analysis.target_reader,
          relevance_score: boostedRelevance,
          trend_score: Math.min(100, analysis.trend_score + (isHuggingFaceTrending ? 10 : 0)),
          buildability_score: Math.min(100, analysis.buildability_score + (hasCode ? 12 : 0)),
          beginner_score: analysis.beginner_score,
          business_score: analysis.business_score,
          research_depth_score: analysis.research_depth_score,
          target_levels: analysis.target_levels,
          target_goals: analysis.target_goals,
          target_interests: analysis.target_interests,
          content_depth: analysis.content_depth,
          has_code: hasCode,
          is_huggingface_trending: isHuggingFaceTrending,
          ai_model: model,
          processed_at: new Date().toISOString(),
          published_at: paper.publishedAt,
        },
        { onConflict: 'paper_url' },
      );

      if (error) {
        errors += 1;
        console.error('Research upsert failed', paper.title, error);
      } else {
        inserted += 1;
      }
    } catch (error) {
      errors += 1;
      console.error('Research item failed', paper.title, error);
    }
  }

  try {
    await linkPapersToNews(supabase);
  } catch (error) {
    errors += 1;
    console.error('Research news link failed', error);
  }

  const status = getRunStatus(errors, inserted);

  await recordIngestRun(supabase, {
    source: 'research',
    status,
    inserted,
    skipped,
    errors,
    durationMs: Date.now() - startedAt,
    detail: { limit, minScore, minFitScore, candidates: candidates.length },
  });

  return NextResponse.json(
    {
      ok: status !== 'failed',
      status,
      error: status === 'failed' ? '논문 후보를 가져오지 못했거나 저장 중 오류가 발생했습니다. arXiv 접근, Supabase 테이블, service role key를 확인하세요.' : null,
      inserted,
      skipped,
      errors,
      candidates: candidates.length,
    },
    { status: status === 'failed' ? 500 : 200 },
  );
}

async function fetchArxivPapers(limit: number) {
  const feedPapers = await fetchArxivFeedPapers(limit);
  if (feedPapers.length) return feedPapers;
  return fetchArxivApiPapers(limit);
}

async function fetchArxivFeedPapers(limit: number) {
  const seen = new Set<string>();
  const papers: Array<{
    title: string;
    abstract: string;
    authors: string[];
    categories: string[];
    source: string;
    paperUrl: string;
    pdfUrl: string | null;
    publishedAt: string;
  }> = [];
  const perSource = Math.max(2, Math.ceil(limit / ARXIV_FEED_SOURCES.length));

  for (const source of ARXIV_FEED_SOURCES) {
    try {
      const feed = await fetchAndParseFeed(source.url);
      let picked = 0;
      for (const item of feed.items as ArxivItem[]) {
        const paperUrl = normalizeArxivPaperUrl(item.id || item.link || '');
        if (!paperUrl || seen.has(paperUrl)) continue;
        seen.add(paperUrl);

        papers.push({
          title: cleanText(item.title ?? ''),
          abstract: cleanArxivAbstract(item.contentSnippet || item.content || getItemField(item, 'summary') || ''),
          authors: parseAuthors(item),
          categories: parseCategories(item).length ? parseCategories(item) : [source.name.replace(/^arXiv\s+/i, '')],
          source: source.name,
          paperUrl,
          pdfUrl: paperUrl.replace('/abs/', '/pdf/'),
          publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
        });
        picked += 1;
        if (papers.length >= limit || picked >= perSource) break;
      }
    } catch (error) {
      console.error('Research feed skipped', source.name, error);
    }

    if (papers.length >= limit) return papers;
  }

  return papers;
}

async function fetchArxivApiPapers(limit: number) {
  const seen = new Set<string>();
  const papers: Array<{
    title: string;
    abstract: string;
    authors: string[];
    categories: string[];
    source: string;
    paperUrl: string;
    pdfUrl: string | null;
    publishedAt: string;
  }> = [];
  const perQuery = Math.max(3, Math.ceil(limit / RESEARCH_QUERIES.length));

  for (const query of RESEARCH_QUERIES) {
    try {
      const params = new URLSearchParams({
        search_query: query,
        start: '0',
        max_results: String(perQuery),
        sortBy: 'submittedDate',
        sortOrder: 'descending',
      });
      const feed = await fetchAndParseFeed(`${RESEARCH_SOURCE_INFO.arxiv.url}?${params.toString()}`);

      for (const item of feed.items as ArxivItem[]) {
        const paperUrl = normalizeArxivPaperUrl(item.id || item.link || '');
        if (!paperUrl || seen.has(paperUrl)) continue;
        seen.add(paperUrl);

        papers.push({
          title: cleanText(item.title ?? ''),
          abstract: cleanArxivAbstract(item.contentSnippet || item.content || getItemField(item, 'summary') || ''),
          authors: parseAuthors(item),
          categories: parseCategories(item),
          source: RESEARCH_SOURCE_INFO.arxiv.name,
          paperUrl,
          pdfUrl: paperUrl ? paperUrl.replace('/abs/', '/pdf/') : null,
          publishedAt: item.isoDate ?? item.pubDate ?? new Date().toISOString(),
        });
        if (papers.length >= limit) return papers;
      }
    } catch (error) {
      console.error('Research API query skipped', query, error);
    }
  }

  return papers;
}

function normalizeArxivPaperUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (trimmed.includes('/pdf/')) return trimmed.replace('/pdf/', '/abs/').replace(/\.pdf$/i, '');
  return trimmed;
}

async function fetchAndParseFeed(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESEARCH_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'user-agent': 'SeedupBot/1.0 (research ingestion)' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Feed request failed: ${response.status}`);
    return parser.parseString(await response.text());
  } finally {
    clearTimeout(timeout);
  }
}

function evaluateSeedupResearchFit(paper: { title: string; abstract: string; categories: string[] }) {
  const text = `${paper.title} ${paper.abstract} ${paper.categories.join(' ')}`.toLowerCase();
  let score = 0;

  const strongSignals = [
    /coding agent|code agent|software engineering|program repair|code generation|developer tool|devtool/,
    /agentic|ai agent|tool use|workflow|automation|orchestration/,
    /retrieval|rag|vector database|knowledge base|search/,
    /api|sdk|framework|library|cli|ide|editor|debug|test generation/,
    /web app|application|service|product|prototype|user interface|human computer interaction/,
    /database|backend|frontend|cloud|devops|deployment|observability/,
  ];
  for (const pattern of strongSignals) {
    if (pattern.test(text)) score += 8;
  }

  const categoryBoost = paper.categories.some((category) => /cs\.se|cs\.ai|cs\.cl|cs\.db|cs\.hc/i.test(category)) ? 5 : 0;
  score += categoryBoost;

  const weakSignals = ['llm', 'language model', 'benchmark', 'evaluation', 'reasoning', 'multi-agent', 'prompt', 'fine-tuning'];
  for (const signal of weakSignals) {
    if (text.includes(signal)) score += 2;
  }

  const offDomain = [
    /medical|clinical|medicine|patient|public health|healthcare|health question|disease|diagnosis|protein|genomics|molecule|drug discovery|biology/,
    /satellite|astronomy|quantum|particle|robotics navigation/,
    /pure mathematics|theorem proving only|fluid dynamics/,
  ].some((pattern) => pattern.test(text));
  const hasStrongDeveloperAnchor = [
    /coding agent|code agent|software engineering|developer tool|devtool|code generation/,
    /api|sdk|cli|ide|editor|debug|test generation|deployment|observability/,
    /web app|application framework|backend|frontend|database|devops/,
  ].some((pattern) => pattern.test(text));

  if (offDomain && !hasStrongDeveloperAnchor) return { score: 0 };

  const irrelevantPenalty = offDomain ? 30 : 0;

  return { score: Math.max(0, score - irrelevantPenalty) };
}

async function findPapersWithCodeUrl(title: string) {
  try {
    const params = new URLSearchParams({ q: title });
    const response = await fetch(`${RESEARCH_SOURCE_INFO.papersWithCode.url}?${params.toString()}`, {
      headers: { 'user-agent': 'SeedupBot/1.0' },
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const json = await response.json() as { results?: Array<{ url_abs?: string; paper_url?: string; title?: string }> };
    const match = json.results?.find((paper) => paper.title && similarTitle(paper.title, title));
    const url = match?.url_abs ?? match?.paper_url;
    return url ? new URL(url, 'https://paperswithcode.com').toString() : null;
  } catch {
    return null;
  }
}

async function fetchHuggingFacePaperTitles() {
  try {
    const response = await fetch(RESEARCH_SOURCE_INFO.huggingFacePapers.url, {
      headers: { 'user-agent': 'SeedupBot/1.0' },
      cache: 'no-store',
    });
    if (!response.ok) return [];
    const html = await response.text();
    return Array.from(html.matchAll(/<h3[^>]*>(.*?)<\/h3>/g))
      .map((match) => cleanText(stripHtml(match[1])))
      .filter(Boolean)
      .slice(0, 40);
  } catch {
    return [];
  }
}

async function linkPapersToNews(supabase: NonNullable<ReturnType<typeof createAdminClient>>) {
  const [{ data: news }, { data: papers }] = await Promise.all([
    supabase.from('news_items').select('id,title,category,related_skills,ai_summary,beginner_summary').order('published_at', { ascending: false }).limit(80),
    supabase.from('research_papers').select('id,title,categories,related_skills,beginner_summary,relevance_score').order('published_at', { ascending: false }).limit(80),
  ]);

  for (const newsItem of news ?? []) {
    const newsText = [newsItem.title, newsItem.category, newsItem.ai_summary, newsItem.beginner_summary, ...(newsItem.related_skills ?? [])].join(' ').toLowerCase();
    const matches = (papers ?? [])
      .map((paper) => {
        const paperTerms = [paper.title, paper.beginner_summary, ...(paper.categories ?? []), ...(paper.related_skills ?? [])]
          .join(' ')
          .toLowerCase()
          .split(/[^a-z0-9가-힣]+/)
          .filter((term) => term.length >= 3);
        const overlap = new Set(paperTerms.filter((term) => newsText.includes(term))).size;
        const score = Math.min(100, overlap * 12 + Number(paper.relevance_score ?? 0) * 0.35);
        return { paper, score };
      })
      .filter((item) => item.score >= 35)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    for (const match of matches) {
      await supabase.from('news_paper_links').upsert(
        {
          news_id: newsItem.id,
          paper_id: match.paper.id,
          relevance_score: Math.round(match.score),
          relevance_reason: '뉴스 키워드와 논문 주제/기술 키워드가 겹쳐 Seedup이 자동 연결했습니다.',
        },
        { onConflict: 'news_id,paper_id' },
      );
    }
  }
}

function parseAuthors(item: ArxivItem) {
  const creators = [item.creator, item.author].flatMap(normalizeUnknownText).filter(Boolean);
  if (creators.length) return creators.flatMap((value) => value.split(',').map((name) => name.trim())).filter(Boolean);
  return [];
}

function parseCategories(item: ArxivItem) {
  const raw = item.categories ?? [];
  return raw.flatMap(normalizeUnknownText).filter(Boolean);
}

function getItemField(item: Parser.Item, key: string) {
  const record = item as Parser.Item & Record<string, unknown>;
  const value = record[key];
  return typeof value === 'string' ? value : '';
}

function cleanText(value: string) {
  return value.replace(/\s+/g, ' ').trim();
}

function cleanArxivAbstract(value: string) {
  return cleanText(stripHtml(value))
    .replace(/^arxiv:\S+\s*/i, '')
    .replace(/^announce\s+type:\s*\w+\s*/i, '')
    .replace(/^abstract:\s*/i, '')
    .replace(/\s+comments:\s+.*$/i, '')
    .replace(/\s+subjects:\s+.*$/i, '')
    .trim();
}

function normalizeUnknownText(value: unknown): string[] {
  if (typeof value === 'string') return [cleanText(value)].filter(Boolean);
  if (Array.isArray(value)) return value.flatMap(normalizeUnknownText);
  if (!value || typeof value !== 'object') return [];

  const record = value as Record<string, unknown>;
  const candidates = [
    record.term,
    record.label,
    record.name,
    record._,
    record['#'],
    record['$'] && typeof record['$'] === 'object' ? (record['$'] as Record<string, unknown>).term : null,
    record['$'] && typeof record['$'] === 'object' ? (record['$'] as Record<string, unknown>).label : null,
  ];

  return candidates.flatMap(normalizeUnknownText);
}

function similarTitle(a: string, b: string) {
  const left = tokenizeTitle(a);
  const right = tokenizeTitle(b);
  if (!left.size || !right.size) return false;
  const overlap = Array.from(left).filter((token) => right.has(token)).length;
  return overlap / Math.min(left.size, right.size) >= 0.55;
}

function tokenizeTitle(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s]/g, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 3),
  );
}
