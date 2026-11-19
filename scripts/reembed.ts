// Run after changing RAG_EMBEDDING_MODEL: vectors from two models cannot be compared, so every stored one is made again.
// Overwrites content_embeddings rows in place, opportunities.embedding, and lib/opportunities/data/embeddings.json.
// npx tsx --env-file=.env scripts/reembed.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { syncRagEmbeddings } from '../lib/ingest/rag';
import { createEmbedding } from '../lib/llm';
import type { Opportunity, OpportunitySnapshot } from '../lib/opportunities/types';
import { createAdminClient } from '../lib/supabase/admin';

const DATA_DIR = resolve(process.cwd(), 'lib/opportunities/data');

// The same text the opportunity engine embeds (lib/opportunities/engine.ts).
const opportunityText = (item: Opportunity) => `${item.name}. ${item.problem}. ${item.problemEn ?? ''}. ${(item.keywords ?? []).map((word) => word.toLowerCase().trim()).filter(Boolean).slice(0, 14).join(', ')}`;

async function embedOpportunity(item: Opportunity) {
  // Free models limit requests a minute; a one-off run can afford to wait.
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const vector = await createEmbedding(opportunityText(item), { timeoutMs: 30_000 });
    if (vector) return vector.map((value) => Number(value.toFixed(5)));
    await new Promise((done) => setTimeout(done, 20_000));
  }
  return null;
}

async function main() {
  console.log('model:', process.env.RAG_EMBEDDING_MODEL);
  const content = await syncRagEmbeddings({ perSource: 5_000, maxDocuments: 20_000, force: true });
  console.log('content:', content);

  const vectors: Record<string, number[]> = {};
  const service = createAdminClient();
  if (service) {
    const { data, error } = await service.from('opportunities').select('slug,data').eq('published', true);
    if (error) throw error;
    let failed = 0;
    for (const row of data ?? []) {
      const vector = await embedOpportunity(row.data as Opportunity);
      if (!vector) { failed += 1; continue; }
      const { error: updateError } = await service.from('opportunities').update({ embedding: vector }).eq('slug', row.slug);
      if (updateError) { failed += 1; console.error(row.slug, updateError.message); } else vectors[row.slug as string] = vector;
    }
    console.log(`opportunities in database: ${Object.keys(vectors).length} embedded, ${failed} failed`);
  }

  const snapshot = JSON.parse(readFileSync(resolve(DATA_DIR, 'snapshot.json'), 'utf8')) as OpportunitySnapshot;
  const local: Record<string, number[]> = {};
  for (const item of snapshot.opportunities) {
    const vector = vectors[item.slug] ?? (await embedOpportunity(item));
    if (vector) local[item.slug] = vector;
  }
  console.log(`embeddings.json: ${Object.keys(local).length}/${snapshot.opportunities.length}`);
  // A partial file would mix in missing problems silently; leave it for the next run instead.
  if (Object.keys(local).length === snapshot.opportunities.length) writeFileSync(resolve(DATA_DIR, 'embeddings.json'), JSON.stringify(local));
  else process.exitCode = 1;
  if (content?.failed) process.exitCode = 1;
}

void main();
