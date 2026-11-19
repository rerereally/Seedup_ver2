// Copies the published opportunities from the database into the bundled fallback (lib/opportunities/data), so the
// site, its tests and a demo without a database show the same problems production does. Run it after an engine run
// and commit the two files. The run statistics stay those of the last local run.
//   npx tsx --env-file=.env scripts/export-snapshot.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createAdminClient } from '../lib/supabase/admin';
import type { Opportunity, OpportunitySnapshot } from '../lib/opportunities/types';

const DIR = resolve(process.cwd(), 'lib/opportunities/data');

async function main() {
  const supabase = createAdminClient();
  if (!supabase) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY are required');
  const { data, error } = await supabase.from('opportunities').select('slug,data,embedding,generated_at').eq('published', true);
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('no published opportunities; nothing was changed');
  const previous = JSON.parse(readFileSync(resolve(DIR, 'snapshot.json'), 'utf8')) as OpportunitySnapshot;
  const snapshot: OpportunitySnapshot = { ...previous, generatedAt: String(data[0].generated_at), opportunities: data.map((row) => row.data as Opportunity) };
  const embeddings = Object.fromEntries(data.flatMap((row) => (Array.isArray(row.embedding) ? [[row.slug as string, row.embedding as number[]]] : [])));
  writeFileSync(resolve(DIR, 'snapshot.json'), `${JSON.stringify(snapshot, null, 1)}\n`);
  writeFileSync(resolve(DIR, 'embeddings.json'), JSON.stringify(embeddings));
  console.log(`exported ${snapshot.opportunities.length} opportunities (${snapshot.opportunities.filter((item) => item.qualified).length} qualified), ${Object.keys(embeddings).length} embeddings, generated ${snapshot.generatedAt}`);
}

main().catch((caught) => {
  console.error(caught instanceof Error ? caught.message : caught);
  process.exitCode = 1;
});
