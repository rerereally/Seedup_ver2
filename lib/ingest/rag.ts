import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';

export type RagReference = {
  source_table: string;
  source_id: string;
  content: string;
  metadata: {
    title?: string;
    url?: string | null;
    source?: string | null;
    published_at?: string | null;
    similarity?: number;
  };
  similarity: number;
};

type RagDocument = {
  source_table: string;
  source_id: string;
  content: string;
  metadata: Record<string, unknown>;
  content_hash: string;
};

const EMBEDDING_MODEL = process.env.RAG_EMBEDDING_MODEL ?? 'openai/text-embedding-3-small';
// Keep evaluation requests bounded. New embeddings are synced lazily, so a
// large historical table should not consume the whole request timeout.
const MAX_DOCUMENTS_PER_SOURCE = 18;

export async function retrieveIdeaContext(idea: string): Promise<RagReference[]> {
  const supabase = createAdminClient();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!supabase || !apiKey) return [];

  try {
    const documents = await loadRagDocuments(supabase);
    await syncMissingEmbeddings(supabase, apiKey, documents);
    const [queryEmbedding] = await createEmbeddings(apiKey, [idea]);
    if (!queryEmbedding?.length) return [];

    const { data, error } = await supabase.rpc('match_seedup_content', {
      query_embedding: queryEmbedding,
      match_count: 12,
      min_similarity: 0.55,
    });
    if (error) {
      console.error('RAG similarity search failed', error);
      return [];
    }

    const matches = ((data ?? []) as Array<Record<string, unknown>>).map((item) => ({
      source_table: String(item.source_table ?? ''),
      source_id: String(item.source_id ?? ''),
      content: String(item.content ?? ''),
      metadata: {
        ...((item.metadata as Record<string, unknown> | null) ?? {}),
        similarity: Number(item.similarity ?? 0),
      },
      similarity: Number(item.similarity ?? 0),
    })).filter((item) => item.content && item.similarity >= 0.55);

    // A source can have more than one embedding after its content changes.
    // Keep the strongest match so the evaluator and UI see one document once.
    const uniqueMatches = new Map<string, RagReference>();
    for (const match of matches) {
      const key = `${match.source_table}:${match.source_id}`;
      const current = uniqueMatches.get(key);
      if (!current || match.similarity > current.similarity) uniqueMatches.set(key, match);
    }
    return [...uniqueMatches.values()].sort((left, right) => right.similarity - left.similarity);
  } catch (error) {
    console.error('RAG context retrieval failed', error);
    return [];
  }
}

async function loadRagDocuments(supabase: NonNullable<ReturnType<typeof createAdminClient>>) {
  const [news, products, repos, papers, ideas] = await Promise.all([
    supabase.from('news_items').select('id,title,short_summary,summary,why_it_matters,project_idea,topic_tags,skill_tags,source,source_url,original_url,published_at').order('published_at', { ascending: false }).limit(MAX_DOCUMENTS_PER_SOURCE),
    supabase.from('ai_products').select('id,name,short_summary,description,use_cases,related_project_ideas,category,website_url,product_hunt_url,created_at').order('created_at', { ascending: false }).limit(MAX_DOCUMENTS_PER_SOURCE),
    supabase.from('github_trends').select('id,repo_full_name,short_summary,beginner_summary,description,project_idea,topics,language,repo_url,stars,stars_delta_7d,last_seen_at').order('last_seen_at', { ascending: false }).limit(MAX_DOCUMENTS_PER_SOURCE),
    supabase.from('research_papers').select('id,title,beginner_summary,expert_summary,abstract,implementation_idea,service_idea,categories,related_skills,paper_url,published_at').order('published_at', { ascending: false }).limit(MAX_DOCUMENTS_PER_SOURCE),
    supabase.from('project_ideas').select('id,title,description,level,duration_days,stack,related_trend,target_user_level,portfolio_value,created_at').order('created_at', { ascending: false }).limit(MAX_DOCUMENTS_PER_SOURCE),
  ]);

  return [
    ...(news.data ?? []).map((item) => document('news_items', item.id, [
      `제목: ${item.title}`,
      `요약: ${item.short_summary ?? item.summary ?? ''}`,
      item.why_it_matters ? `중요한 이유: ${item.why_it_matters}` : null,
      item.project_idea ? `프로젝트 연결: ${item.project_idea}` : null,
      `태그: ${[...(item.topic_tags ?? []), ...(item.skill_tags ?? [])].join(', ')}`,
    ], { title: item.title, url: item.original_url ?? item.source_url, source: item.source, published_at: item.published_at })),
    ...(products.data ?? []).map((item) => document('ai_products', item.id, [
      `제품: ${item.name}`,
      `설명: ${item.short_summary ?? item.description ?? ''}`,
      `분류: ${item.category ?? ''}`,
      `사용 사례: ${(item.use_cases ?? []).join(', ')}`,
      `관련 프로젝트: ${(item.related_project_ideas ?? []).join(', ')}`,
    ], { title: item.name, url: item.website_url ?? item.product_hunt_url, source: 'Product Hunt', published_at: item.created_at })),
    ...(repos.data ?? []).map((item) => document('github_trends', item.id, [
      `저장소: ${item.repo_full_name}`,
      `설명: ${item.short_summary ?? item.beginner_summary ?? item.description ?? ''}`,
      `프로젝트 연결: ${item.project_idea ?? ''}`,
      `기술: ${(item.topics ?? []).join(', ')} ${item.language ?? ''}`,
      `스타: ${item.stars ?? 0}, 7일 증가: ${item.stars_delta_7d ?? 0}`,
    ], { title: item.repo_full_name, url: item.repo_url, source: 'GitHub', published_at: item.last_seen_at })),
    ...(papers.data ?? []).map((item) => document('research_papers', item.id, [
      `논문: ${item.title}`,
      `초보자 해설: ${item.beginner_summary ?? ''}`,
      `전문가 요약: ${item.expert_summary ?? ''}`,
      `초록: ${item.abstract ?? ''}`,
      `구현 아이디어: ${item.implementation_idea ?? ''}`,
      `서비스 아이디어: ${item.service_idea ?? ''}`,
      `분야: ${(item.categories ?? []).join(', ')}`,
    ], { title: item.title, url: item.paper_url, source: 'arXiv', published_at: item.published_at })),
    ...(ideas.data ?? []).map((item) => document('project_ideas', item.id, [
      `프로젝트: ${item.title}`,
      `설명: ${item.description ?? ''}`,
      `난이도: ${item.level ?? ''}, 기간: ${item.duration_days ?? ''}일`,
      `스택: ${(item.stack ?? []).join(', ')}`,
      `대상 사용자: ${item.target_user_level ?? ''}`,
      `포트폴리오 가치: ${item.portfolio_value ?? ''}`,
    ], { title: item.title, source: 'Seedup 프로젝트 아이디어', published_at: item.created_at })),
  ];
}

function document(sourceTable: string, sourceId: string, lines: Array<string | null>, metadata: Record<string, unknown>): RagDocument {
  const content = lines.filter(Boolean).join('\n').trim();
  return {
    source_table: sourceTable,
    source_id: String(sourceId),
    content,
    metadata,
    content_hash: createHash('sha256').update(content).digest('hex'),
  };
}

async function syncMissingEmbeddings(
  supabase: NonNullable<ReturnType<typeof createAdminClient>>,
  apiKey: string,
  documents: RagDocument[],
) {
  const missing: RagDocument[] = [];
  for (const sourceTable of [...new Set(documents.map((item) => item.source_table))]) {
    const sourceDocuments = documents.filter((item) => item.source_table === sourceTable);
    const { data } = await supabase.from('content_embeddings').select('source_id,content_hash').eq('source_table', sourceTable).in('source_id', sourceDocuments.map((item) => item.source_id));
    const existing = new Set((data ?? []).map((item) => `${item.source_id}:${item.content_hash}`));
    missing.push(...sourceDocuments.filter((item) => !existing.has(`${item.source_id}:${item.content_hash}`)));
  }

  for (let index = 0; index < missing.length; index += 40) {
    const batch = missing.slice(index, index + 40);
    const embeddings = await createEmbeddings(apiKey, batch.map((item) => item.content));
    const rows = batch.flatMap((item, itemIndex) => embeddings[itemIndex]?.length ? [{ ...item, embedding: embeddings[itemIndex] }] : []);
    if (rows.length) {
      const { error } = await supabase.from('content_embeddings').upsert(rows, { onConflict: 'source_table,source_id,content_hash' });
      if (error) console.error('RAG embedding upsert failed', error);
    }
  }
}

async function createEmbeddings(apiKey: string, input: string[]): Promise<number[][]> {
  const response = await fetch('https://openrouter.ai/api/v1/embeddings', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
      'http-referer': process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000',
      'x-title': 'Seedup',
    },
    body: JSON.stringify({ model: EMBEDDING_MODEL, input }),
  });
  if (!response.ok) throw new Error(`Embedding request failed: ${response.status}`);
  const json = await response.json() as { data?: Array<{ embedding?: number[] }> };
  return (json.data ?? []).map((item) => item.embedding ?? []);
}
