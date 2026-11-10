// Runs the opportunity engine outside the Worker runtime, because a full run takes several minutes.
// npm run engine               merges the run into the bundled snapshot only
// npm run engine -- --persist  also publishes the merged result to Supabase
// Every run is folded into the previous result, so evidence adds up and a weak run loses nothing.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { runOpportunityEngine } from '../lib/opportunities/engine';
import { applyMerge, mergeRuns } from '../lib/opportunities/merge';
import type { Opportunity, OpportunitySnapshot } from '../lib/opportunities/types';
import type { EngineCheckpointStore } from '../lib/opportunities/engine';

const SNAPSHOT_DIR = resolve(process.cwd(), 'lib/opportunities/data');
const timestamp = () => new Date().toTimeString().slice(0, 8);

function database() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

type Previous = { generatedAt: string; opportunities: Opportunity[]; embeddings: Record<string, number[]> };

/** The published result when persisting, since a CI checkout only has the snapshot that was last committed. */
async function loadPrevious(persist: boolean): Promise<Previous | null> {
  const supabase = persist ? database() : null;
  if (supabase) {
    const { data, error } = await supabase.from('opportunities').select('slug,data,embedding,generated_at').eq('published', true);
    if (error) throw new Error(`could not read the published result, so nothing was changed: ${error.message}`);
    if (data?.length) {
      return {
        generatedAt: String(data[0].generated_at),
        opportunities: data.map((row) => row.data as Opportunity),
        embeddings: Object.fromEntries(data.flatMap((row) => (Array.isArray(row.embedding) ? [[row.slug as string, row.embedding as number[]]] : []))),
      };
    }
  }
  const snapshotFile = resolve(SNAPSHOT_DIR, 'snapshot.json');
  const embeddingFile = resolve(SNAPSHOT_DIR, 'embeddings.json');
  if (!existsSync(snapshotFile)) return null;
  const snapshot = JSON.parse(readFileSync(snapshotFile, 'utf8')) as OpportunitySnapshot;
  return { generatedAt: snapshot.generatedAt, opportunities: snapshot.opportunities, embeddings: existsSync(embeddingFile) ? JSON.parse(readFileSync(embeddingFile, 'utf8')) : {} };
}

async function publish(snapshot: OpportunitySnapshot, embeddings: Record<string, number[]>) {
  const supabase = database();
  if (!supabase) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required to persist');

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

  // Only opportunities this run actually found again get a new history row.
  const seenNow = snapshot.opportunities.filter((opportunity) => opportunity.lastSeenAt === snapshot.generatedAt);
  const history = await supabase.from('opportunity_history').insert(seenNow.map((opportunity) => ({
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
  const persist = process.argv.includes('--persist');
  const previous = await loadPrevious(persist);
  const knownUrls = new Set((previous?.opportunities ?? []).flatMap((item) => item.evidence.map((evidence) => evidence.url)));
  const run = await runOpportunityEngine((message) => console.log(timestamp(), message), checkpointStore(), knownUrls);

  if (!run.snapshot.opportunities.length) {
    throw new Error('The run produced no opportunities; the previous result is unchanged.');
  }

  const merged = mergeRuns(previous, { opportunities: run.snapshot.opportunities, embeddings: run.embeddings }, run.snapshot.generatedAt);
  const snapshot = applyMerge(run.snapshot, merged.opportunities);
  writeFileSync(resolve(SNAPSHOT_DIR, 'snapshot.json'), `${JSON.stringify(snapshot, null, 1)}\n`);
  writeFileSync(resolve(SNAPSHOT_DIR, 'embeddings.json'), JSON.stringify(merged.embeddings));
  if (persist) await publish(snapshot, merged.embeddings);

  const { stats } = snapshot;
  const { summary } = merged;
  console.log(`\ncollected ${stats.collected} | sampled ${stats.sampled} | pains ${stats.painsVerified} | quotes rejected ${stats.quotesRejected} | found this run ${run.snapshot.opportunities.length} | total ${stats.candidates} | qualified ${stats.qualified} | llm ${stats.llmCalls} (failed ${stats.llmFailures})`);
  console.log(`new ${summary.added.length} | more evidence ${summary.grown.length} | status changed ${summary.statusChanged.length} | carried over ${summary.carried} | expired ${summary.expired.length}`);
  for (const line of [...summary.added.map((name) => `+ ${name}`), ...summary.grown.map((name) => `↑ ${name}`), ...summary.statusChanged.map((name) => `~ ${name}`), ...summary.expired.map((name) => `- ${name}`)]) console.log(line);
  for (const item of snapshot.opportunities) {
    console.log(`${item.qualified ? '[통과]' : '[미달]'} ${item.status.padEnd(9)} ${item.name} | 근거 ${item.evidence.length} | 플랫폼 ${item.platforms.join('+')} | 직접 ${item.directCount} | 이후 등장 ${item.followersAfterSignal}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
