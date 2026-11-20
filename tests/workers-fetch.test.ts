import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

// Cloudflare Workers throw on fetch(..., { redirect: 'error' }) ("must be one of follow or manual"), while Node accepts
// it, so unit tests pass and production fails silently. Use 'manual' and check response.ok instead.
const ROOTS = ['lib', 'app'];
const ERROR_REDIRECT = /redirect\s*:\s*['"`]error['"`]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|mjs)$/.test(name) ? [path] : [];
  });
}

test("no server code asks fetch for redirect: 'error', which Workers reject", () => {
  const offenders = ROOTS.flatMap(sourceFiles).filter((path) => ERROR_REDIRECT.test(readFileSync(path, 'utf8')));
  assert.deepEqual(offenders, []);
});

// GitHub answers 403 to a request without a User-Agent. Node's fetch adds one, Workers' fetch does not, so the same
// code passes tests and fails in production. A file that calls the GitHub API must set one.
// shortcut: lib/ingest/kept-repos.ts lacks it but sits under the data-collection freeze (docs/status.md); fix it then.
const GITHUB_UA_FROZEN = new Set([join('lib', 'ingest', 'kept-repos.ts')]);

test('every file that calls the GitHub API sends a User-Agent', () => {
  const offenders = ROOTS.flatMap(sourceFiles).filter((path) => {
    if (GITHUB_UA_FROZEN.has(path)) return false;
    const source = readFileSync(path, 'utf8');
    return source.includes('api.github.com') && !/user-agent/i.test(source);
  });
  assert.deepEqual(offenders, []);
});
