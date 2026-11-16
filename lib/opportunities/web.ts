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

/** The page as plain text, fetched by us, so a quote is checked against the page itself and never against a search snippet. */
export async function fetchPageText(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { 'user-agent': 'SeedupOpportunityEngine/1.0', accept: 'text/html,text/plain' } });
    const type = response.headers.get('content-type') ?? '';
    if (!response.ok || !/text\/(html|plain)/.test(type)) return null;
    const html = (await response.text()).slice(0, MAX_PAGE_BYTES);
    return cleanText(html.replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' '));
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

export async function searchWebDemand(phrase: string): Promise<Array<Omit<RawSignal, 'id' | 'actor'>>> {
  const results = await webSearch(phrase, 4);
  const pages = await Promise.all(results.map(async (row) => ({ row, page: await fetchPageText(row.url) })));
  return pages.flatMap(({ row, page }) => (page ? [{ platform: 'web' as const, url: row.url, title: row.title, text: pageWindow(page, row.content), score: 0, postedAt: null }] : []));
}
