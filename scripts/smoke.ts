// Smoke test for main pages and API routes. Run it against a dev server or a deployed URL:
// SMOKE_BASE_URL=https://example.com npm run smoke
// Exits with code 1 if any check fails.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const BASE_URL = (process.env.SMOKE_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const TIMEOUT_MS = 20_000;
const ERROR_MARKERS = ['Application error', 'Internal Server Error', '찾는 페이지가 없습니다', 'This page could not be found'];

type Check = { method: 'GET' | 'POST'; path: string; run: (res: Response, body: string) => string | null };

const pageCheck = (res: Response, body: string) => {
  if (res.status !== 200) return `status ${res.status}`;
  // Next embeds the RSC payload, including the not-found component text, in <script> tags. Only rendered markup counts.
  const markup = body.replace(/<script[\s\S]*?<\/script>/g, '');
  const marker = ERROR_MARKERS.find((text) => markup.includes(text));
  return marker ? `error marker "${marker}"` : null;
};

const jsonCheck = (res: Response, body: string) => {
  if (res.status !== 200) return `status ${res.status}`;
  try {
    JSON.parse(body);
    return null;
  } catch {
    return 'response is not JSON';
  }
};

// Without a configured secret the route answers 503, with a wrong or missing secret 401.
const ingestCheck = (res: Response) => (res.status === 401 || res.status === 503 ? null : `expected 401 or 503, got ${res.status}`);

const snapshot = JSON.parse(readFileSync(resolve(process.cwd(), 'lib/opportunities/data/snapshot.json'), 'utf8')) as {
  opportunities: { slug: string }[];
};
const firstSlug = snapshot.opportunities[0]?.slug;
if (!firstSlug) throw new Error('lib/opportunities/data/snapshot.json has no opportunities');

const pages = ['/', '/opportunities', `/opportunities/${firstSlug}`, '/news', '/trends', '/github-trends', '/projects', '/ai-products', '/ideas', '/seeds', '/search?q=ai', '/login'];

const checks: Check[] = [
  ...pages.map((path) => ({ method: 'GET' as const, path, run: pageCheck })),
  { method: 'GET', path: '/api/opportunities/match?q=memory', run: jsonCheck },
  { method: 'POST', path: '/api/ingest/rss', run: ingestCheck },
];

async function runCheck(check: Check) {
  const started = Date.now();
  try {
    const res = await fetch(`${BASE_URL}${check.path}`, {
      method: check.method,
      redirect: 'follow',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = await res.text();
    return { status: res.status, ms: Date.now() - started, failure: check.run(res, body) };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return { status: 0, ms: Date.now() - started, failure: `request failed: ${reason}` };
  }
}

async function main() {
  console.log(`Smoke test against ${BASE_URL}`);
  let failed = 0;
  for (const check of checks) {
    const result = await runCheck(check);
    const ok = result.failure === null;
    if (!ok) failed += 1;
    const line = `${ok ? 'PASS' : 'FAIL'}  ${String(result.status || '-').padEnd(4)} ${String(result.ms).padStart(6)}ms  ${check.method} ${check.path}`;
    console.log(ok ? line : `${line}  -> ${result.failure}`);
  }
  const total = checks.length;
  console.log(`\n${total - failed}/${total} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
