import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { auditDiff } from '../lib/supervisor/diff-audit';
import type { AuditCode } from '../lib/supervisor/types';

export type BadDiffExpectation = 'block' | 'warn' | 'clean';

export type BadDiffFixture = {
  id: string;
  label: string;
  expect: BadDiffExpectation;
  expectedCodes: AuditCode[];
  diff: string;
};

const fixtures = JSON.parse(
  readFileSync(resolve(process.cwd(), 'tests/fixtures/bad-diffs.json'), 'utf8'),
) as BadDiffFixture[];

test('bad-diffs.json holds 25 realistic fixtures (10 lie, 10 sec, 5 clean)', () => {
  assert.equal(fixtures.length, 25);
  assert.equal(fixtures.filter((row) => row.id.startsWith('lie-')).length, 10);
  assert.equal(fixtures.filter((row) => row.id.startsWith('sec-')).length, 10);
  assert.equal(fixtures.filter((row) => row.id.startsWith('clean-')).length, 5);
});

for (const fixture of fixtures) {
  test(`fixture ${fixture.id}: ${fixture.label} (expect ${fixture.expect})`, () => {
    const result = auditDiff(fixture.diff);
    const counted = result.findings.filter((row) => !row.allowed);
    const actual: BadDiffExpectation =
      result.blockerCount > 0 ? 'block' : result.warningCount > 0 ? 'warn' : 'clean';
    const actualCodes = [...new Set(counted.map((row) => row.code))];

    assert.equal(
      actual,
      fixture.expect,
      `${fixture.id} expected ${fixture.expect} (${fixture.expectedCodes.join(', ') || 'none'}), got ${actual} (${actualCodes.join(', ') || 'none'})`,
    );

    if (fixture.expect === 'clean') {
      assert.deepEqual(actualCodes, []);
    } else {
      for (const expectedCode of fixture.expectedCodes) {
        assert.ok(
          actualCodes.includes(expectedCode),
          `${fixture.id} missing expected code ${expectedCode}; got [${actualCodes.join(', ')}]`,
        );
      }
    }
  });
}
