import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { parseArgs } from 'node:util';
import { saveFoundEvidenceRows } from '../lib/db/found-evidence';
import { translator } from '../lib/i18n';
import { platformOfUrl, quotesFromLink, safeSourceUrl } from '../lib/opportunities/live-evidence';
import { isCompleteQuote } from '../lib/opportunities/rules';
import type { Evidence } from '../lib/opportunities/types';

type ImportOptions = { dir: string; dryRun?: boolean; limit?: number; concurrency?: number };
type ImportRow = Evidence & { postedAt: string; terms: string[] };
type Candidate = Omit<ImportRow, 'id' | 'platform'>;
type DiscardReason = 'json' | 'fields' | 'date' | 'quote_length' | 'incomplete_quote' | 'bad_url' | 'duplicate_url' | 'not_found' | 'unreadable';
const FIRST_DATE = Date.parse('2026-01-01T00:00:00Z');
const LAST_DATE = Date.parse('2026-11-21T23:59:59Z');
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;
const normalizeTerm = (term: string) => term.trim().toLowerCase().replace(/\s+/g, ' ');

function publicSourceUrl(value: string) {
  const url = safeSourceUrl(value);
  if (!url?.hostname.endsWith('.')) return url;
  url.hostname = url.hostname.slice(0, -1);
  return safeSourceUrl(url.href);
}

function parseLine(line: string): Candidate | DiscardReason {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return 'json';
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'fields';
  const { url, platform, quote, posted_at, quote_ko = '', score = 0, terms, domain, kind } = value as Record<string, unknown>;
  if (typeof url !== 'string' || !url.trim() || typeof platform !== 'string' || !platform.trim()
    || typeof quote !== 'string' || typeof posted_at !== 'string'
    || !Array.isArray(terms) || terms.some((term) => typeof term !== 'string')
    || typeof quote_ko !== 'string' || typeof score !== 'number' || !Number.isInteger(score) || score < -2_147_483_648 || score > 2_147_483_647
    || (domain !== undefined && typeof domain !== 'string') || (kind !== undefined && typeof kind !== 'string')) return 'fields';
  const storedText = [quote, quote_ko, ...terms, domain, kind].join('\n');
  if (storedText.includes('\0') || !storedText.isWellFormed()) return 'fields';

  const time = Date.parse(posted_at);
  if (!ISO_TIME.test(posted_at) || !Number.isFinite(time) || time < FIRST_DATE || time > LAST_DATE) return 'date';
  const date = posted_at.slice(0, 10);
  if (new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) return 'date';
  const trimmedQuote = quote.trim();
  if (trimmedQuote.length < 12 || quote.length > 400) return 'quote_length';
  if (!isCompleteQuote(trimmedQuote)) return 'incomplete_quote';
  const source = publicSourceUrl(url);
  if (!source) return 'bad_url';

  const tags = [...new Set(terms.map(normalizeTerm).filter(Boolean))].slice(0, 12);
  if (domain?.trim()) tags.push(`domain:${normalizeTerm(domain)}`);
  if (kind?.trim()) tags.push(`kind:${normalizeTerm(kind)}`);
  return { url: source.href, quote: trimmedQuote, quoteKo: quote_ko, postedAt: posted_at, score, terms: [...new Set(tags)] };
}

// The frozen verifier starts parallel fetches and can switch between an API and the source page.
function pacedSourceFetch(fetchSource: typeof fetch): typeof fetch {
  const lastStart = new Map<string, number>();
  return async (input, init) => {
    const request = new Request(input, init);
    const follow = request.redirect === 'follow';
    let url = publicSourceUrl(request.url);
    for (let hops = 0; url && hops <= 3; hops++) {
      const host = url.hostname.replace(/^www\./, '');
      const platform = platformOfUrl(url);
      const site = host === 'api.github.com' || platform === 'github' ? 'github.com'
        : host === 'hn.algolia.com' || platform === 'hn' ? 'news.ycombinator.com'
        : platform === 'stackexchange' || platform === 'stackoverflow' ? 'api.stackexchange.com' : host;
      const outgoing = new Request(url, request);
      for (;;) {
        request.signal.throwIfAborted();
        const wait = (lastStart.get(site) ?? -Infinity) + 1_000 - performance.now();
        if (wait <= 0) break;
        await delay(Math.ceil(wait), undefined, { signal: request.signal });
      }
      const started = fetchSource(outgoing, follow ? { redirect: 'manual' } : undefined);
      lastStart.set(site, performance.now());
      const response = await started;
      if (!follow || ![301, 302, 303, 307, 308].includes(response.status)) return response;
      const location = response.headers.get('location');
      if (!location) return response;
      await response.body?.cancel().catch(() => undefined);
      url = publicSourceUrl(new URL(location, url).href);
    }
    throw new Error('Unsafe source URL or too many redirects.');
  };
}

export async function importEvidence(
  { dir, dryRun = false, limit = Infinity, concurrency = 3 }: ImportOptions,
  { verify = quotesFromLink, save = saveFoundEvidenceRows } = {},
) {
  const discarded = new Map<DiscardReason, number>();
  const discard = (reason: DiscardReason) => discarded.set(reason, (discarded.get(reason) ?? 0) + 1);
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const files = (await readdir(dir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && /^evidence-\d{4}-(0[1-9]|1[0-2])\.jsonl$/.test(entry.name))
    .map((entry) => entry.name).sort();

  let read = 0;
  for (const file of files) {
    if (read >= limit) break;
    for (const line of (await readFile(join(dir, file), 'utf8')).split(/\r?\n/)) {
      if (!line.trim()) continue;
      if (read >= limit) break;
      read++;
      const row = parseLine(line);
      if (typeof row === 'string') discard(row);
      else if (seen.has(row.url)) discard('duplicate_url');
      else {
        seen.add(row.url);
        candidates.push(row);
      }
    }
  }

  const results = Array<ImportRow | undefined>(candidates.length);
  const pending = candidates.entries();
  const fetchSource = globalThis.fetch;
  globalThis.fetch = pacedSourceFetch(fetchSource);
  try {
    await Promise.all(Array.from({ length: Math.min(concurrency, candidates.length) }, async () => {
      for (const [index, { url, quote, ...fields }] of pending) {
        for (let attempt = 0; ; attempt++) {
          const result = await verify(url, '', quote).catch(() => ({ status: 'unreadable' as const, quotes: [] }));
          if ((result.status === 'unreadable' || result.status === 'not_found') && attempt < 2) continue;
          const [verified] = result.quotes;
          if (result.status === 'ok' && verified) results[index] = { ...verified, ...fields };
          else discard(result.status === 'ok' ? 'not_found' : result.status);
          break;
        }
      }
    }));
  } finally {
    globalThis.fetch = fetchSource;
  }

  const rows = results.filter((row) => row !== undefined);
  if (!dryRun) {
    for (let offset = 0; offset < rows.length; offset += 100) await save(rows.slice(offset, offset + 100));
  }

  const counts = new Map<string, number>();
  for (const { platform, postedAt } of rows) {
    const key = `${platform} ${new Date(postedAt).toISOString().slice(0, 7)}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const passed = [...counts].sort().map(([key, count]) => {
    const [platform, month] = key.split(' ');
    return { platform, month, count };
  });
  return { read, passed, discarded: Object.fromEntries([...discarded].sort()) };
}

const locale = process.env.LC_ALL || process.env.LC_MESSAGES || process.env.LANG || '';
const t = translator(/^en(?:[_.-]|$)/i.test(locale) ? 'en' : 'ko');

async function main() {
  const { values } = parseArgs({ options: {
    dir: { type: 'string' }, 'dry-run': { type: 'boolean' }, limit: { type: 'string' }, concurrency: { type: 'string', default: '3' },
  } });
  const limit = values.limit === undefined ? undefined : Number(values.limit);
  const concurrency = Number(values.concurrency);
  if (!values.dir?.trim()) throw new Error(t('--dir로 자료 폴더를 지정하세요.', 'Set --dir to the input folder.'));
  if ((limit !== undefined && (!Number.isSafeInteger(limit) || limit < 1)) || !Number.isSafeInteger(concurrency) || concurrency < 1) {
    throw new Error(t('--limit와 --concurrency에는 양의 정수를 넣으세요.', 'Set --limit and --concurrency to positive integers.'));
  }
  const dryRun = values['dry-run'];
  const { read, passed, discarded } = await importEvidence({ dir: values.dir, dryRun, limit, concurrency });
  console.log(dryRun ? t(`시험 실행에서 ${read}줄을 읽었습니다.`, `Read ${read} lines in dry run.`) : t(`${read}줄을 읽었습니다.`, `Read ${read} lines.`));
  console.log(t('출처와 월별 통과 수', 'Passed by source and month'));
  console.table(passed.map(({ platform, month, count }) => ({ [t('출처', 'Source')]: platform, [t('월', 'Month')]: month, [t('통과', 'Passed')]: count })));
  const reasons: Record<DiscardReason, string> = {
    json: t('잘못된 JSON', 'Invalid JSON'), fields: t('필드 오류', 'Invalid fields'), date: t('날짜 오류 또는 기간 밖', 'Invalid or out-of-range date'),
    quote_length: t('인용문 길이 오류', 'Invalid quote length'), incomplete_quote: t('덜 끝난 인용문', 'Incomplete quote'),
    bad_url: t('잘못된 주소', 'Invalid URL'), duplicate_url: t('중복 주소', 'Duplicate URL'),
    not_found: t('원문에서 찾지 못함', 'Quote not found'), unreadable: t('원문을 읽지 못함', 'Source unreadable'),
  };
  console.log(t('버린 이유별 수', 'Discarded by reason'));
  console.table(Object.entries(discarded).map(([reason, count]) => ({ [t('이유', 'Reason')]: reasons[reason as DiscardReason], [t('건수', 'Count')]: count })));
}

if (require.main === module) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
