import { cleanText } from './actors';
import { normalizeForMatch } from './rules';
import type { RawSignal, SupplyItem } from './types';

/**
 * General web search, used after the platform searches to find competing products and more people with the problem.
 * Uses Tavily (free tier: 1,000 searches a month). Without TAVILY_API_KEY every function returns nothing and the run
 * continues on the platform searches alone.
 */

type WebResult = { title: string; url: string; content: string };

const PAGE_WINDOW = 1_500;
const MAX_PAGE_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;

/**
 * Only public http(s) addresses with a host name (no IP literals, no local names), so a user-supplied link or an
 * HTTP redirect cannot point the server at internal addresses.
 */
export function safeSourceUrl(value: unknown): URL | null {
  try {
    const url = new URL(String(value ?? '').trim());
    if (!/^https?:$/.test(url.protocol) || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (!host.includes('.') || /^[\d.]+$/.test(host) || host.includes(':') || /(^|\.)(localhost|local|internal|lan|home|corp)$/.test(host)) return null;
    return url;
  } catch {
    return null;
  }
}

export const webSearchEnabled = () => Boolean(process.env.TAVILY_API_KEY?.trim());

async function webSearch(query: string, maxResults: number): Promise<WebResult[]> {
  const key = process.env.TAVILY_API_KEY?.trim();
  if (!key) return [];
  try {
    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ query, max_results: maxResults, search_depth: 'basic' }),
    });
    if (!response.ok) return [];
    const json = (await response.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
    return (json.results ?? []).flatMap((row) => (row.url?.startsWith('http') ? [{ title: cleanText(row.title), url: row.url, content: cleanText(row.content) }] : []));
  } catch {
    return [];
  }
}

async function readBodyUpTo(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return (await response.text()).slice(0, maxBytes);
  const decoder = new TextDecoder();
  let received = 0;
  let text = '';
  try {
    while (received < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;
      const remaining = maxBytes - received;
      if (value.byteLength >= remaining) {
        text += decoder.decode(value.subarray(0, remaining), { stream: false });
        received = maxBytes;
        await reader.cancel().catch(() => undefined);
        return text;
      }
      text += decoder.decode(value, { stream: true });
      received += value.byteLength;
    }
    text += decoder.decode();
    return text;
  } finally {
    reader.releaseLock();
  }
}

/**
 * The page as plain text, fetched by us, so a quote is checked against the page itself and never against a search
 * snippet. Redirects are checked against `safeSourceUrl` so a public link cannot redirect to an internal address,
 * and bodies are read incrementally up to `maxBytes` so an oversized response cannot exhaust Worker memory.
 */
export async function fetchPageText(
  url: string,
  fetcher: typeof fetch = fetch,
  maxBytes = MAX_PAGE_BYTES,
): Promise<string | null> {
  try {
    let current = safeSourceUrl(url);
    for (let hops = 0; current && hops <= MAX_REDIRECTS; hops += 1) {
      const response = await fetcher(current.toString(), {
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
        headers: { 'user-agent': 'SeedupOpportunityEngine/1.0', accept: 'text/html,text/plain' },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        await response.body?.cancel().catch(() => undefined);
        current = location ? safeSourceUrl(new URL(location, current).toString()) : null;
        continue;
      }
      const type = response.headers.get('content-type') ?? '';
      if (!response.ok || !/text\/(html|plain)/.test(type)) {
        await response.body?.cancel().catch(() => undefined);
        return null;
      }
      const html = await readBodyUpTo(response, maxBytes);
      return cleanText(html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' '));
    }
    return null;
  } catch {
    return null;
  }
}

/** The part of the page around the search snippet, since a whole page is too long for one model call. */
export function pageWindow(page: string, snippet: string) {
  const head = normalizeForMatch(snippet).slice(0, 40);
  const at = head ? normalizeForMatch(page).indexOf(head) : -1;
  // Normalizing only removes characters, so the index in the page is at least the normalized index.
  const start = at > 300 ? at - 300 : 0;
  return page.slice(start, start + PAGE_WINDOW);
}

export async function searchWebSupply(query: string): Promise<Array<Omit<SupplyItem, 'relation'>>> {
  const results = await webSearch(`${query} software tool`, 5);
  return results.map((row) => ({ kind: 'web', name: row.title.slice(0, 90) || new URL(row.url).host, description: row.content.slice(0, 160), popularity: 0, url: row.url, createdAt: null }));
}

/**
 * A well-known product the model named for this problem (GIPHY for a GIF API), found on the web so it enters the
 * competitor list with a real page and that page's own description. A name the web cannot find is dropped.
 */
export async function searchKnownProduct(name: string): Promise<Array<Omit<SupplyItem, 'relation'>>> {
  const [top] = await webSearch(`${name} official site`, 1);
  return top ? [{ kind: 'web', name: name.slice(0, 90), description: top.content.slice(0, 160), popularity: 0, url: top.url, createdAt: null }] : [];
}

export async function searchWebDemand(phrase: string): Promise<Array<Omit<RawSignal, 'id' | 'actor'>>> {
  const results = await webSearch(phrase, 4);
  const pages = await Promise.all(results.map(async (row) => ({ row, page: await fetchPageText(row.url) })));
  return pages.flatMap(({ row, page }) => (page ? [{ platform: 'web' as const, url: row.url, title: row.title, text: pageWindow(page, row.content), score: 0, postedAt: null }] : []));
}
