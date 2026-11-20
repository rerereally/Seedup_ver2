// npx tsx --env-file=.env scripts/rag-label-candidates.ts [--out eval-results/rag-candidates.json] [--yes]
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { parseArgs } from 'node:util';
import { openRagCorpus } from '../lib/db/rag-eval';
import { rankRagMatches } from '../lib/rag-eval/metrics';
import { loadRagLabels, ragModel, ragOptions } from './rag-eval-input';

async function main() {
  const { values } = parseArgs({ options: { ...ragOptions, out: { type: 'string', default: 'eval-results/rag-candidates.json' } } });
  const cases = loadRagLabels(values.labels);
  const model = ragModel(values);
  console.log(`Estimated: ${cases.length} embedding calls with ${model} and ${cases.length} read-only vector searches.`);
  if (!values.yes) return console.log('Pass --yes to authorize these calls.');
  const search = openRagCorpus(model);
  const results = [];
  for (const row of cases) {
    const matches = await search(row.idea, -1);
    const candidates = rankRagMatches(matches, -1).slice(0, 20).map(({ source_table, source_id, similarity, content, metadata }) => ({
      source_table, source_id, similarity, title: metadata?.title, url: metadata?.url, excerpt: content.slice(0, 500),
    }));
    results.push({ ...row, candidates });
  }
  await mkdir(dirname(values.out), { recursive: true });
  await writeFile(values.out, `${JSON.stringify({ model, results }, null, 2)}\n`, { flag: 'wx' });
  console.log(`Saved candidates to ${values.out}. Copy confirmed source_table and source_id pairs into the label file.`);
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
