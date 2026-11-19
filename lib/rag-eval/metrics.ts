export type DocumentId = { source_table: string; source_id: string };
export type RankedDocument = DocumentId & { similarity: number };
export type RagLabel = { id: string; idea: string; relevant: DocumentId[] | null };

const documentKey = (row: DocumentId) => JSON.stringify([row.source_table, row.source_id]);

export function rankRagMatches<T extends RankedDocument>(matches: T[], threshold: number) {
  const unique = new Map<string, T>();
  for (const match of matches) {
    if (!Number.isFinite(match.similarity) || match.similarity < threshold) continue;
    const key = documentKey(match);
    const previous = unique.get(key);
    if (!previous || previous.similarity < match.similarity) unique.set(key, match);
  }
  return [...unique.values()].sort((a, b) => b.similarity - a.similarity);
}

export function ragMetrics(
  cases: Array<{ relevant: DocumentId[]; matches: RankedDocument[] }>,
  threshold: number,
) {
  let recall = 0;
  let recallCases = 0;
  let precision = 0;
  let reciprocalRank = 0;
  for (const { relevant, matches } of cases) {
    const expected = new Set(relevant.map(documentKey));
    const retrieved = rankRagMatches(matches, threshold);
    const hitsAt5 = retrieved.slice(0, 5).filter((doc) => expected.has(documentKey(doc))).length;
    if (expected.size) {
      recall += hitsAt5 / expected.size;
      recallCases++;
    }
    precision += hitsAt5 / 5;
    const rank = retrieved.findIndex((doc) => expected.has(documentKey(doc)));
    if (rank >= 0) reciprocalRank += 1 / (rank + 1);
  }
  return {
    cases: cases.length,
    recallCases,
    recallAt5: recallCases ? recall / recallCases : null,
    precisionAt5: cases.length ? precision / cases.length : null,
    mrr: cases.length ? reciprocalRank / cases.length : null,
  };
}
