import assert from 'node:assert/strict';
import test from 'node:test';
import { ragMetrics, rankRagMatches } from '../lib/rag-eval/metrics';
import { loadRagLabels } from '../scripts/rag-eval-input';

const doc = (source_id: string, similarity: number, source_table = 'news_items') => ({ source_table, source_id, similarity });

test('the RAG label set has 30 distinct prompts with valid relevance labels', () => {
  const rows = loadRagLabels('lib/rag-eval/labels.json');
  assert.equal(rows.length, 30);
  assert.equal(new Set(rows.map(({ idea }) => idea)).size, 30);
});

test('RAG metrics deduplicate documents and apply the cutoff before computing rank', () => {
  const correct = doc('matching', 0.35, 'ai_products');
  const irrelevant = doc('matching', 0.6);
  const matches = [doc('matching', 0.2, 'ai_products'), correct, irrelevant, doc('extra', 0.3)];
  assert.deepEqual(rankRagMatches(matches, -1), [irrelevant, correct, doc('extra', 0.3)]);
  const cases = [{ relevant: [correct, correct, doc('missed', 0)], matches }, { relevant: [], matches }];
  assert.deepEqual(ragMetrics(cases, 0.35), { cases: 2, recallCases: 1, recallAt5: 0.5, precisionAt5: 0.1, mrr: 0.25 });
  assert.deepEqual(ragMetrics(cases, 0.36), { cases: 2, recallCases: 1, recallAt5: 0, precisionAt5: 0, mrr: 0 });
});
