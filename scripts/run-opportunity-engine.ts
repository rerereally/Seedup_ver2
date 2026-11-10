// Runs the opportunity engine outside the Worker runtime, because a full run takes several minutes.
// npm run engine               writes the demo snapshot only
// npm run engine -- --persist  also publishes the result to Supabase
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { runOpportunityEngine } from '../lib/opportunities/engine';
import type { EngineCheckpointStore } from '../lib/opportunities/engine';

const SNAPSHOT_DIR = resolve(process.cwd(), 'lib/opportunities/data');
const MIN_CANDIDATES_TO_REPLACE = 4;
const timestamp = () => new Date().toTimeString().slice(0, 8);

async function publish(snapshot: Awaited<ReturnType<typeof runOpportunityEngine>>['snapshot'], embeddings: Record<string, number[]>) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required to persist');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const rows = snapshot.opportunities.map((opportunity) => ({
    slug: opportunity.slug,
    data: opportunity,
    embedding: embeddings[opportunity.slug] ?? null,
    qualified: opportunity.qualified,
    status: opportunity.status,
    generated_at: snapshot.generatedAt,
    published: true,
  }));
  const upserted = await supabase.from('opportunities').upsert(rows, { onConflict: 'slug' });
  if (upserted.error) throw new Error(`opportunities upsert failed: ${upserted.error.message}`);

  // Anything the latest run did not find is hidden, not deleted, so saved dossiers keep working.
  const hidden = await supabase.from('opportunities').update({ published: false }).lt('generated_at', snapshot.generatedAt);
  if (hidden.error) throw new Error(`opportunities unpublish failed: ${hidden.error.message}`);

  const history = await supabase.from('opportunity_history').insert(snapshot.opportunities.map((opportunity) => ({
    slug: opportunity.slug,
    generated_at: snapshot.generatedAt,
    status: opportunity.status,
    qualified: opportunity.qualified,
    evidence_count: opportunity.evidence.length,
    direct_count: opportunity.directCount,
    followers_after_signal: opportunity.followersAfterSignal,
  })));
  if (history.error) throw new Error(`opportunity_history insert failed: ${history.error.message}`);

  await supabase.from('ingest_runs').insert({
    source: 'opportunity-engine',
    status: snapshot.stats.actors.some((actor) => actor.status !== 'ok') ? 'partial' : 'success',
    inserted_count: rows.length,
    skipped_count: 0,
    error_count: snapshot.stats.llmFailures,
    duration_ms: 0,
    detail: snapshot.stats,
  });
}

// ENGINE_CHECKPOINT=/path/file.json lets a failed run restart after the slow collection step.
function checkpointStore(): EngineCheckpointStore | undefined {
  const file = process.env.ENGINE_CHECKPOINT;
  if (!file) return undefined;
  return {
    load: () => (existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null),
    save: (checkpoint) => writeFileSync(file, JSON.stringify(checkpoint)),
  };
}

async function main() {
  const { snapshot, embeddings } = await runOpportunityEngine((message) => console.log(timestamp(), message), checkpointStore());

  if (snapshot.opportunities.length < MIN_CANDIDATES_TO_REPLACE) {
    throw new Error(`Only ${snapshot.opportunities.length} candidates were produced; keeping the previous result.`);
  }

  writeFileSync(resolve(SNAPSHOT_DIR, 'snapshot.json'), `${JSON.stringify(snapshot, null, 1)}\n`);
  writeFileSync(resolve(SNAPSHOT_DIR, 'embeddings.json'), JSON.stringify(embeddings));
  if (process.argv.includes('--persist')) await publish(snapshot, embeddings);

  const { stats } = snapshot;
  console.log(`\ncollected ${stats.collected} | sampled ${stats.sampled} | pains ${stats.painsVerified} | quotes rejected ${stats.quotesRejected} | candidates ${stats.candidates} | qualified ${stats.qualified} | llm ${stats.llmCalls} (failed ${stats.llmFailures})`);
  for (const item of snapshot.opportunities) {
    console.log(`${item.qualified ? '[통과]' : '[미달]'} ${item.status.padEnd(9)} ${item.name} | 근거 ${item.evidence.length} | 플랫폼 ${item.platforms.join('+')} | 직접 ${item.directCount} | 이후 등장 ${item.followersAfterSignal}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
