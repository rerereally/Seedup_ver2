import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSpec } from '../lib/opportunities/spec';
import { auditDiff, parseDiff, scrubSecrets } from '../lib/supervisor/diff-audit';
import { findDrift } from '../lib/supervisor/drift';
import { readVerificationToken, signVerificationToken } from '../lib/supervisor/verify-token';

const diff = (path: string, lines: string[], isNew = false) => [
  `diff --git a/${path} b/${path}`,
  ...(isNew ? ['new file mode 100644', '--- /dev/null'] : [`--- a/${path}`]),
  `+++ b/${path}`,
  `@@ -0,0 +1,${lines.length} @@`,
  ...lines.map((line) => `+${line}`),
].join('\n');

const codes = (text: string) => auditDiff(text).findings.filter((row) => !row.allowed).map((row) => `${row.severity}:${row.code}`);
// Built at run time so this file holds no secret-shaped literal or skipped-test call of its own.
const skipCall = ['test', 'skip'].join('.');
const fakeKey = ['sk', 'ant', 'api03', 'A'.repeat(40)].join('-');

test('parses added lines with their new-file line numbers', () => {
  const [file] = parseDiff(['diff --git a/a.ts b/a.ts', '--- a/a.ts', '+++ b/a.ts', '@@ -3,2 +3,3 @@', ' keep', '-gone', '+added', ' tail', '+last'].join('\n'));
  assert.deepEqual(file.added.map((row) => [row.line, row.text]), [[4, 'added'], [6, 'last']]);
});

test('blockers: a known secret shape, a NEXT_PUBLIC_ secret, a new skipped test, a not-implemented throw', () => {
  assert.deepEqual(codes(diff('lib/a.ts', [`const key = '${fakeKey}';`])), ['blocker:SEC_SECRET_LEAK']);
  assert.deepEqual(codes(diff('lib/a.ts', ['const url = process.env.NEXT_PUBLIC_SUPABASE_SECRET;'])), ['blocker:SEC_CLIENT_SECRET']);
  assert.deepEqual(codes(diff('tests/a.test.ts', [`${skipCall}('flaky', () => {});`])), ['blocker:LIE_SKIPPED_TEST']);
  assert.deepEqual(codes(diff('lib/a.ts', ["  throw new Error('not implemented');"])), ['blocker:LIE_EMPTY_IMPL']);
  assert.equal(auditDiff(diff('lib/a.ts', [`const key = '${fakeKey}';`])).passed, false);
});

test('warnings go to the verifier; JSX placeholder, commented catch, tests and docs do not count', () => {
  assert.deepEqual(codes(diff('lib/a.ts', ['// TODO wire this up', 'try { run(); } catch {}', 'el.innerHTML = html;'])), ['warning:LIE_TODO', 'warning:LIE_EMPTY_CATCH', 'warning:SEC_XSS']);
  assert.deepEqual(codes(diff('components/A.tsx', ['<input placeholder="이메일" />', 'try { run(); } catch { /* offline is fine */ }'])), []);
  assert.deepEqual(codes(diff('tests/a.test.ts', ['// TODO later', 'const mock = {};'])), []);
  assert.deepEqual(codes(diff('docs/a.md', ['TODO: write'])), []);
  assert.deepEqual(codes(diff('lib/q.ts', ['const sql = `select * from users where id = ${id}`;'])), ['warning:SEC_SQLI']);
});

test('a new write route without an auth check is flagged; with one it is not', () => {
  assert.deepEqual(codes(diff('app/api/items/route.ts', ['export async function POST(request: Request) {', '  return Response.json({});', '}'], true)), ['warning:SEC_NO_AUTH']);
  assert.deepEqual(codes(diff('app/api/items/route.ts', ['export async function POST() {', '  const user = await getCurrentUser();', '}'], true)), []);
});

test('seedup-allow on the line or the line above keeps the finding listed but uncounted', () => {
  const result = auditDiff(diff('lib/a.ts', ['// seedup-allow: LIE_TODO tracked in F-03', '// TODO wire this up']));
  assert.equal(result.warningCount, 0);
  assert.equal(result.findings[0].allowed, 'tracked in F-03');
});

test('secrets are masked in the diff for the model and counted', () => {
  const { scrubbed, count } = scrubSecrets(diff('lib/a.ts', [`const key = '${fakeKey}';`, "const apiToken = 'q8Zr2LmX9vB4nT7kW1pY6sJ3';"]));
  assert.equal(count, 2);
  assert.ok(!scrubbed.includes(fakeKey));
  assert.ok(!scrubbed.includes('q8Zr2LmX9vB4nT7kW1pY6sJ3'));
  assert.equal(auditDiff('').diffHash.length, 64);
});

test('verification token binds user, project, feature and SHA, and expires', () => {
  const claim = { userId: 'u1', projectKey: 'prd:00000000-0000-0000-0000-000000000001', featureId: 'F-01', sha: 'ABC123' };
  const token = signVerificationToken(claim, 'secret', 0);
  assert.ok(readVerificationToken(token, { ...claim, sha: 'abc123' }, 'secret', 1000));
  assert.equal(readVerificationToken(token, { ...claim, sha: 'def456' }, 'secret', 1000), null);
  assert.equal(readVerificationToken(token, { ...claim, featureId: 'F-02' }, 'secret', 1000), null);
  assert.equal(readVerificationToken(token, claim, 'other', 1000), null);
  assert.equal(readVerificationToken(`${token}x`, claim, 'secret', 1000), null);
  assert.equal(readVerificationToken(token, claim, 'secret', 31 * 24 * 60 * 60 * 1000), null);
});

test('drift: unlinked commit, route and table outside the spec, non-goal work, edits to done features', () => {
  const spec = normalizeSpec({
    summary: 'Rent reminders',
    requirements: [{ title: 'Reminders before rent is due', evidence: [1] }],
    features: [{ title: 'Reminder schedule', detail: 'Sends reminder emails', requirements: [1] }],
    screens: [{ name: 'Settings', does: 'Pick reminder days', features: [1] }],
  }, 1);
  const goal = { outOfScope: ['bank transfers'] };
  const findings = findDrift([
    { sha: 'a1', message: 'tweak copy', files: ['lib/copy.ts'], featureIds: [] },
    { sha: 'b2', message: 'add reminder settings', files: ['app/settings/page.tsx'], featureIds: ['F-01'], addedFiles: ['app/(app)/settings/page.tsx', 'app/api/invoices/[id]/route.ts'], addedTables: ['reminder_days', 'invoices'] },
    { sha: 'c3', message: 'start bank transfer flow', files: ['lib/bank.ts'], featureIds: ['F-01'] },
    { sha: 'd4', message: 'refactor', files: ['lib/reminder.ts'], featureIds: ['F-02'] },
  ], spec, goal, { 'F-01': ['lib/reminder.ts'] });
  assert.deepEqual(findings.map((row) => `${row.sha}:${row.kind}`), ['a1:unlinked_commit', 'b2:out_of_spec', 'c3:non_goal', 'd4:touched_done']);
  assert.deepEqual(findings[1].files, ['app/api/invoices/[id]/route.ts', 'table:invoices']);
  assert.deepEqual(findings[3].featureIds, ['F-02', 'F-01']);
});
