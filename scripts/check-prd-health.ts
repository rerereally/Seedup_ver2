// Fails when PRD generation mostly failed over the last day, so a broken model or key shows up as an issue.
import { createClient } from '@supabase/supabase-js';
import { loadFunnelRows, usageFunnel } from '../lib/metrics';

const MIN_RUNS = 3;
const MIN_SUCCESS = 80;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return console.log('::warning::Supabase settings missing; PRD health not checked.');
  const service = createClient(url, key, { auth: { persistSession: false } });
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const funnel = usageFunnel(await loadFunnelRows(service, 1), since);
  console.log(`PRD runs in the last day: ${funnel.prdRuns}, success ${funnel.prdSuccessRate ?? '-'}%, median ${funnel.prdMedianSeconds ?? '-'}s`);
  if (funnel.prdRuns >= MIN_RUNS && (funnel.prdSuccessRate ?? 100) < MIN_SUCCESS) {
    console.log(`::error::PRD generation succeeded ${funnel.prdSuccessRate}% of ${funnel.prdRuns} runs in the last day (target ${MIN_SUCCESS}%+). Check the model policy at /admin/ingest.`);
    process.exitCode = 1;
  }
}

void main();
