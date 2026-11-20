import { embedTexts } from '../llm';
import { createAdminClient } from '../supabase/admin';
import type { RagReference } from '../ingest/rag';

// Maximum supported by the read-only match_seedup_content RPC.
export const RPC_MATCH_LIMIT = 50;

export function openRagCorpus(model: string, embed: typeof embedTexts = embedTexts) {
  const db = createAdminClient();
  const key = process.env.OPENROUTER_API_KEY;
  if (!db || !key) throw new Error('Configure Supabase and OPENROUTER_API_KEY to run the evaluation.');
  return async (idea: string, minSimilarity: number) => {
    const [vector] = await embed(key, [idea], 0, model);
    if (!vector?.length) throw new Error('Embedding model returned no compatible query vector.');
    const { data, error } = await db.rpc('match_seedup_content', {
      query_embedding: vector,
      match_count: RPC_MATCH_LIMIT,
      min_similarity: minSimilarity,
    });
    if (error) throw new Error(`RAG similarity query failed: ${error.message}`);
    return ((data ?? []) as RagReference[]).filter((row) => row.content);
  };
}
