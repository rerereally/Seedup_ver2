// npx tsx --env-file=.env scripts/eval-rag.ts [--threshold 0.30 --threshold 0.40] [--model vendor/id --corpus-model vendor/id] [--yes]
import { parseArgs } from 'node:util';
import { openRagCorpus, RPC_MATCH_LIMIT } from '../lib/db/rag-eval';
import { ragMetrics } from '../lib/rag-eval/metrics';
import { BASELINE_THRESHOLD, loadRagLabels, ragModel, ragOptions } from './rag-eval-input';

async function main() {
  const { values } = parseArgs({ options: { ...ragOptions, threshold: { type: 'string', multiple: true } } });
  const all = loadRagLabels(values.labels);
  const labeled = all.flatMap(({ relevant, ...row }) => relevant === null ? [] : [{ ...row, relevant }]);
  const model = ragModel(values);
  const extra = (values.threshold ?? []).map((value) => value.trim() ? Number(value) : NaN);
  if (extra.some((value) => !Number.isFinite(value) || value < -1 || value > 1)) throw new Error('--threshold must be a number in [-1, 1].');
  const thresholds = [...new Set([BASELINE_THRESHOLD, ...extra])].sort((a, b) => a - b);
  console.log(`Estimated: ${labeled.length} embedding calls with ${model} and ${labeled.length} read-only vector searches. ${all.length - labeled.length} unlabeled cases excluded.`);
  if (!labeled.length) throw new Error('Add human-verified document IDs to relevant before scoring. Use [] for a reviewed idea with no relevant documents.');
  if (!values.yes) return console.log('Pass --yes to authorize these calls.');

  const search = openRagCorpus(model);
  const cases: Parameters<typeof ragMetrics>[0] = [];
  for (const row of labeled) cases.push({ ...row, matches: await search(row.idea, thresholds[0]) });
  console.log(JSON.stringify({
    model,
    searchDepth: RPC_MATCH_LIMIT,
    baseline: BASELINE_THRESHOLD,
    unlabeled: all.length - labeled.length,
    metrics: thresholds.map((threshold) => ({ threshold, ...ragMetrics(cases, threshold) })),
  }, null, 2));
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
