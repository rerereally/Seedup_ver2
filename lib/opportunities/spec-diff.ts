export type DiffLine = { kind: 'same' | 'added' | 'removed'; text: string };

const MAX_LINES = 400;

/**
 * Line-by-line difference between two versions of a PRD's Markdown (longest common subsequence). Long documents are
 * cut to their first 400 lines each, which covers every PRD this site makes.
 */
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = before.split('\n').slice(0, MAX_LINES);
  const b = after.split('\n').slice(0, MAX_LINES);
  const table = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) table[i][j] = a[i] === b[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] });
      i += 1;
      j += 1;
    } else if (table[i + 1][j] >= table[i][j + 1]) out.push({ kind: 'removed', text: a[i++] });
    else out.push({ kind: 'added', text: b[j++] });
  }
  while (i < a.length) out.push({ kind: 'removed', text: a[i++] });
  while (j < b.length) out.push({ kind: 'added', text: b[j++] });
  return out;
}

/** Only the changed lines, blank lines dropped, for showing what one revision did. */
export const changedLines = (before: string, after: string) => lineDiff(before, after).filter((line) => line.kind !== 'same' && line.text.trim());
