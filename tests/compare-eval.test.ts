import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { compareEvalFiles } from '../scripts/compare-eval';

test('comparison aggregates two result files by audit mode and excludes failed cases from time', (t) => {
  const folder = mkdtempSync(join(tmpdir(), 'seedup-audit-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const on = join(folder, 'on.json');
  const off = join(folder, 'off.json');
  const rows = [
    { id: 'a', ok: true, seconds: 20, p0Total: 2, auditDemoted: 1, auditNarrowed: 0 },
    { id: 'b', ok: true, seconds: 40, p0Total: 1, auditDemoted: 0, auditNarrowed: 2 },
    { id: 'c', ok: false, seconds: 120 },
  ];
  writeFileSync(on, JSON.stringify({ auditP0: true, rows }));
  writeFileSync(off, JSON.stringify({ auditP0: false, rows: rows.map((row) => ({ ...row, seconds: row.seconds / 2, p0Total: 2 })) }));
  assert.deepEqual(compareEvalFiles(off, on), {
    on: { passed: 2, cases: 3, p0: 3, demoted: 1, narrowed: 2, median: 30 },
    off: { passed: 2, cases: 3, p0: 4, demoted: 0, narrowed: 0, median: 15 },
  });
  writeFileSync(on, JSON.stringify({ auditP0: true, rows: rows.map(({ auditNarrowed: _old, ...row }) => row) }));
  assert.equal(compareEvalFiles(on, off).on.narrowed, null);
  writeFileSync(on, JSON.stringify({ auditP0: true, rows: rows.slice(1) }));
  assert.throws(() => compareEvalFiles(on, off), /same case IDs/);
});
