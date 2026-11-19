import { createHash } from 'node:crypto';
import { embedTexts } from '@/lib/llm';
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

// Keep evaluation requests bounded. New embeddings are synced lazily, so a
// large historical table should not consume the whole request timeout.
const MAX_DOCUMENTS_PER_SOURCE = 18;
// nemotron-3-embed-1b scores sit low: a related idea's best match is 0.25 to 0.46, unrelated ones top out near 0.38.
const MIN_SIMILARITY = 0.35;

export async function retrieveIdeaContext(
  idea: string,
  // throwOnError: callers that tell the person "nothing similar" must not say so when the search itself failed.
  options?: { maxReferences?: number; syncMissing?: boolean; maxSyncDocuments?: number; throwOnError?: boolean },
): Promise<RagReference[]> {
  const supabase = createAdminClient();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!supabase || !apiKey) {
    if (options?.throwOnError) throw new Error('Search is not configured');
    return [];
  }

  try {
    // Interactive evaluation must not wait for the entire historical corpus to
    // embed. Sync a small recent batch; /api/ingest/embeddings fills the rest.
    if (options?.syncMissing !== false) {
      const documents = await loadRagDocuments(supabase, MAX_DOCUMENTS_PER_SOURCE);
      await syncMissingEmbeddings(supabase, apiKey, documents, options?.maxSyncDocuments ?? 8);
    }
    const [queryEmbedding] = await embedTexts(apiKey, [idea]);
    if (!queryEmbedding?.length) throw new Error('No embedding for the idea');

    const { data, error } = await supabase.rpc('match_seedup_content', {
      query_embedding: queryEmbedding,
      match_count: options?.maxReferences ?? 6,
      min_similarity: MIN_SIMILARITY,
    });
    if (error) {
      throw new Error(`RAG similarity search failed: ${error.message}`);
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
    })).filter((item) => item.content && item.similarity >= MIN_SIMILARITY);

    // A source can have more than one embedding after its content changes.
    // Keep the strongest match so the evaluator and UI see one document once.
    const uniqueMatches = new Map<string, RagReference>();
    for (const match of matches) {
      const key = `${match.source_table}:${match.source_id}`;
      const current = uniqueMatches.get(key);
      if (!current || match.similarity > current.similarity) uniqueMatches.set(key, match);
    }
    return [...uniqueMatches.values()].sort((left, right) => right.similarity - left.similarity).slice(0, options?.maxReferences ?? 6);
  } catch (error) {
    console.error('RAG context retrieval failed', error);
    if (options?.throwOnError) throw error;
    return [];
  }
}

/** Embeds content that has no embedding yet (or whose text changed), newest first, round-robin across sources. */
export async function syncRagEmbeddings(options: { perSource: number; maxDocuments: number; force?: boolean }) {
  const supabase = createAdminClient();
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!supabase || !apiKey) return null;
  const documents = await loadRagDocuments(supabase, options.perSource);
  return { scanned: documents.length, ...(await syncMissingEmbeddings(supabase, apiKey, documents, options.maxDocuments, options.force)) };
}

async function loadRagDocuments(supabase: NonNullable<ReturnType<typeof createAdminClient>>, perSource: number) {
  const [news, products, repos, papers, ideas] = await Promise.all([
    supabase.from('news_items').select('id,title,short_summary,summary,why_it_matters,project_idea,topic_tags,skill_tags,source,source_url,original_url,published_at').order('published_at', { ascending: false }).limit(perSource),
    supabase.from('ai_products').select('id,name,short_summary,description,use_cases,related_project_ideas,category,website_url,product_hunt_url,created_at').order('created_at', { ascending: false }).limit(perSource),
    supabase.from('github_trends').select('id,repo_full_name,short_summary,beginner_summary,description,project_idea,topics,language,repo_url,stars,stars_delta_7d,last_seen_at').order('last_seen_at', { ascending: false }).limit(perSource),
    supabase.from('research_papers').select('id,title,beginner_summary,expert_summary,abstract,implementation_idea,service_idea,categories,related_skills,paper_url,published_at').order('published_at', { ascending: false }).limit(perSource),
    supabase.from('project_ideas').select('id,title,description,level,duration_days,stack,related_trend,target_user_level,portfolio_value,created_at').order('created_at', { ascending: false }).limit(perSource),
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
  maxDocuments: number,
  // After the embedding model changes every stored vector is from another model, so all are embedded again.
  force = false,
) {
  const missing: RagDocument[] = [];
  if (force) missing.push(...documents);
  else for (const sourceTable of [...new Set(documents.map((item) => item.source_table))]) {
    const sourceDocuments = documents.filter((item) => item.source_table === sourceTable);
    const existing = new Set<string>();
    // Chunked so a large backfill does not exceed the request URL length.
    for (let index = 0; index < sourceDocuments.length; index += 100) {
      const ids = sourceDocuments.slice(index, index + 100).map((item) => item.source_id);
      const { data } = await supabase.from('content_embeddings').select('source_id,content_hash').eq('source_table', sourceTable).in('source_id', ids);
      for (const item of data ?? []) existing.add(`${item.source_id}:${item.content_hash}`);
    }
    missing.push(...sourceDocuments.filter((item) => !existing.has(`${item.source_id}:${item.content_hash}`)));
  }

  const bySource = new Map<string, RagDocument[]>();
  for (const document of missing) {
    const list = bySource.get(document.source_table) ?? [];
    list.push(document);
    bySource.set(document.source_table, list);
  }
  const selected: RagDocument[] = [];
  while (selected.length < Math.max(0, maxDocuments)) {
    let added = false;
    for (const documentsForSource of bySource.values()) {
      const document = documentsForSource.shift();
      if (!document) continue;
      selected.push(document);
      added = true;
      if (selected.length >= maxDocuments) break;
    }
    if (!added) break;
  }
  let embedded = 0;
  for (let index = 0; index < selected.length; index += 20) {
    const batch = selected.slice(index, index + 20);
    // One failed batch (free-model timeout) is counted and skipped; the next run retries it.
    const embeddings = await embedTexts(apiKey, batch.map((item) => item.content), 3).catch((error) => {
      console.error('RAG embedding batch failed', error);
      return [] as number[][];
    });
    const rows = batch.flatMap((item, itemIndex) => embeddings[itemIndex]?.length ? [{ ...item, embedding: embeddings[itemIndex] }] : []);
    if (rows.length) {
      const { error } = await supabase.from('content_embeddings').upsert(rows, { onConflict: 'source_table,source_id,content_hash' });
      if (error) console.error('RAG embedding upsert failed', error);
      else embedded += rows.length;
    }
  }
  return { missing: missing.length, embedded, failed: selected.length - embedded, remaining: missing.length - embedded };
}

