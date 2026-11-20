import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { auditDiff } from '../lib/supervisor/diff-audit';
import { hookBundle } from '../lib/supervisor/hook-bundle';
import { localAuditScript } from '../lib/supervisor/local-audit';
import type { ProjectGoal } from '../lib/supervisor/types';

const unix = process.platform !== 'win32';
const diff = (path: string, lines: string[], isNew = false) => [
  `diff --git a/${path} b/${path}`,
  ...(isNew ? ['new file mode 100644', '--- /dev/null'] : [`--- a/${path}`]),
  `+++ b/${path}`,
  `@@ -0,0 +1,${lines.length} @@`,
  ...lines.map((line) => `+${line}`),
].join('\n');
// Built at run time so this file holds no secret-shaped literal or skipped-test call of its own.
const skipCall = ['test', 'skip'].join('.');
const fakeKey = ['sk', 'ant', 'api03', 'B'.repeat(40)].join('-');

const cases = [
  diff('lib/a.ts', [`const key = '${fakeKey}';`, "const apiToken = 'q8Zr2LmX9vB4nT7kW1pY6sJ3';", 'const url = process.env.NEXT_PUBLIC_SUPABASE_SECRET;']),
  diff('tests/a.test.ts', [`${skipCall}('flaky', () => {});`, '// TODO later']),
  diff('lib/b.ts', ["  throw new Error('not implemented');", '// TODO wire', 'try { run(); } catch {}', 'el.innerHTML = html;', 'const sql = `select * from t where id = ${id}`;', 'function noop() {}', 'const mock = 1;']),
  diff('components/A.tsx', ['<input placeholder="이메일" />', '// seedup-allow: LIE_TODO tracked in F-03', '// TODO wire this up']),
  diff('app/api/items/route.ts', ['export async function POST(request: Request) {', '  return Response.json({});', '}'], true),
  diff('docs/a.md', ['TODO: write', `key ${fakeKey}`]),
  diff('lib/c.ts', ['try {', '  run();', '} catch (error) {', '}', 'const mockRows = [];', 'const providerKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;']),
];

const runScript = (dir: string, input: string, mode?: string) =>
  spawnSync('node', [join(dir, 'audit.mjs'), ...(mode ? [mode] : [])], { input, encoding: 'utf8' });

test('the local script finds exactly what auditDiff finds, on every rule', { skip: !unix }, () => {
  const dir = mkdtempSync(join(tmpdir(), 'seedup-audit-'));
  writeFileSync(join(dir, 'audit.mjs'), localAuditScript());
  for (const input of cases) {
    const local = JSON.parse(runScript(dir, input, '--json').stdout) as Array<{ code: string; severity: string; file: string; line: number; allowed?: string }>;
    const server = auditDiff(input).findings.map(({ code, severity, file, line, allowed }) => ({ code, severity, file, line, ...(allowed ? { allowed } : {}) }));
    assert.deepEqual(local.map(({ code, severity, file, line, allowed }) => ({ code, severity, file, line, ...(allowed ? { allowed } : {}) })), server, input.split('\n')[0]);
  }
  assert.equal(runScript(dir, cases[0], '--count').stdout, '3');
  assert.equal(runScript(dir, cases[3]).status, 0);
  const blocked = runScript(dir, cases[0]);
  assert.equal(blocked.status, 1);
  assert.ok(!blocked.stdout.includes(fakeKey), 'the script never prints the secret');
});

test('pre-commit stops a staged secret and lets a clean commit through', { skip: !unix }, () => {
  const goal: ProjectGoal = { projectKey: 'demo', version: 1, track: 'personal', statement: 's', criteria: [], inScope: [], outOfScope: [], lockedAt: '', changeReason: null };
  const dir = mkdtempSync(join(tmpdir(), 'seedup-precommit-'));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  for (const file of hookBundle('demo', goal)) {
    mkdirSync(join(dir, file.path, '..'), { recursive: true });
    writeFileSync(join(dir, file.path), file.content);
    if (file.executable) chmodSync(join(dir, file.path), 0o755);
  }
  const preCommit = () => spawnSync('sh', ['.seedup/pre-commit.sh'], { cwd: dir, encoding: 'utf8' });
  writeFileSync(join(dir, 'ok.ts'), 'export const n = 1;\n');
  git('add', 'ok.ts');
  assert.equal(preCommit().status, 0);
  writeFileSync(join(dir, 'leak.ts'), `export const key = '${fakeKey}';\n`);
  git('add', 'leak.ts');
  const result = preCommit();
  assert.equal(result.status, 1);
  assert.match(result.stdout, /SEC_SECRET_LEAK leak\.ts:1/);
});
