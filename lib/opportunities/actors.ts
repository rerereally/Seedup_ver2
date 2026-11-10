import type { ActorRun, Platform, RawSignal, SupplyItem, SupplyKind } from './types';

/**
 * Collection is split into small actors, in the style of Apify: each one owns a source,
 * pushes normalized items into a shared dataset, and reports its own run result. A failing
 * source lowers coverage but never stops the run.
 */

const USER_AGENT = 'SeedupOpportunityEngine/1.0';
const HOST_INTERVAL_MS: Record<string, number> = {
  'api.github.com': 2_300,
  'hn.algolia.com': 350,
  'api.stackexchange.com': 1_300,
  'registry.npmjs.org': 300,
  'dev.to': 400,
  'lobste.rs': 1_300,
  'marketplace.visualstudio.com': 400,
};
const WINDOW_DAYS = 365;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const hostSlots = new Map<string, number>();

async function waitForHost(host: string) {
  const interval = HOST_INTERVAL_MS[host] ?? 500;
  const now = Date.now();
  const startAt = Math.max(now, hostSlots.get(host) ?? 0);
  hostSlots.set(host, startAt + interval);
  if (startAt > now) await sleep(startAt - now);
}

export function cleanText(value: unknown) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&#x2F;/g, '/')
    .replace(/&quot;/g, '"')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

class ActorSession {
  errors = 0;

  async json<T>(url: string, init?: RequestInit): Promise<T | null> {
    const host = new URL(url).host;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await waitForHost(host);
      try {
        const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30_000), headers: { 'user-agent': USER_AGENT, ...githubAuth(host), ...init?.headers } });
        if (response.ok) return (await response.json()) as T;
        if (response.status === 403 || response.status === 429) {
          const retryAfter = Number(response.headers.get('retry-after') ?? 0);
          await sleep(Math.min(45_000, retryAfter ? retryAfter * 1_000 : 15_000 * (attempt + 1)));
          continue;
        }
        this.errors += 1;
        return null;
      } catch {
        await sleep(2_000);
      }
    }
    this.errors += 1;
    return null;
  }
}

function githubAuth(host: string): Record<string, string> {
  const token = process.env.GITHUB_TOKEN?.trim();
  if (host !== 'api.github.com' || !token) return {};
  return { accept: 'application/vnd.github+json', authorization: `Bearer ${token}` };
}

function windowStart() {
  const date = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  return { iso: date.toISOString().slice(0, 10), epoch: Math.floor(date.getTime() / 1_000) };
}

type Push = (item: Omit<RawSignal, 'id' | 'actor'>) => void;
type Actor = { id: string; run: (session: ActorSession, push: Push) => Promise<void> };

type GithubIssue = { html_url: string; title?: string; body?: string; repository_url: string; reactions?: { total_count?: number }; created_at?: string };
type HnHit = { objectID: string; title?: string; story_title?: string; story_text?: string; comment_text?: string; points?: number; num_comments?: number; created_at?: string };
type StackQuestion = { link: string; title?: string; body?: string; score?: number; creation_date?: number };
type DevArticle = { url: string; title?: string; description?: string; public_reactions_count?: number; comments_count?: number; published_at?: string };
type LobstersStory = { short_id_url?: string; comments_url?: string; title?: string; description_plain?: string; score?: number; comment_count?: number; created_at?: string };

// Vendor trackers are full of requests only that vendor can ship, so they are poor build signals.
const EXCLUDED_REPOS = ['anthropics/claude-code', 'openai/codex', 'microsoft/vscode', 'ValveSoftware/Proton', 'golang/go', 'whatwg/html', 'zed-industries/zed'];
const GITHUB_TOPICS = ['mcp', 'llm', 'agent', 'rag', 'prompt', 'observability', 'kubernetes', 'postgres', 'terraform', 'github actions', 'openapi', 'testing', 'logging', 'migration', 'documentation', 'ci', 'feature flags', 'monorepo'];
const HN_ASK_QUERIES = ['tool for', 'how do you', 'what do you use', 'alternative to', 'is there a', 'looking for'];
const HN_PAIN_PHRASES = ['"is there a tool"', '"I wish there was"', '"ended up building our own"', '"had to write our own"', '"no good way to"', '"why is there no"', '"we built an internal"', '"does anyone know a tool"', '"biggest pain point"', '"still no good"', '"I would pay for"', '"tired of manually"'];
const STACK_TAGS = ['model-context-protocol', 'langchain', 'large-language-model', 'github-copilot', 'vector-database', 'ollama', 'github-actions', 'opentelemetry', 'openai-api', 'langgraph', 'llama-index', 'pgvector', 'playwright'];
const DEV_TERMS = /\b(api|cli|sdk|deploy|ci|repo|codebase|database|kubernetes|docker|developer|devops|terraform|llm|agent|mcp|prompt|observability|logging|monitoring|testing|migration|schema|backend|frontend)\b/i;

// Phrases people use when they lack a tool, as opposed to reporting a bug or sharing an opinion.
const PAIN_SIGNALS = [
  /\bis there (a|any) (tool|way|library|service|app|plugin|extension|cli|package)\b/i,
  /\b(i|we) wish (there (was|were)|i could|we could|it (was|were))\b/i,
  /\bno (good|easy|simple|clean|reliable|built-?in) way\b/i,
  /\b(ended up|had to|have to) (build|building|write|writing|roll|rolling|maintain|maintaining) (our|my|your|a|an|it)\b/i,
  /\bwhy is(n't)? there (no|not)\b/i,
  /\b(looking|searching) for (a|an|some) (tool|way|library|alternative|solution|service)\b/i,
  /\balternatives? to\b/i,
  /\b(biggest|major|real|huge) pain\b|\bpain point\b|\bpainful\b/i,
  /\bfrustrat(ed|ing)\b|\btired of\b|\bsick of\b/i,
  /\bwould (be (great|nice|awesome)|love) (if|to have|a way)\b/i,
  /\bhow do (you|people|teams|others) (all )?(handle|manage|deal with|solve|track|test|debug)\b/i,
  /\b(can't|cannot|couldn't) find (a|an|any)\b/i,
  /\b(would|i'd|we'd) pay for\b/i,
  /\bmanually\b.*\b(every|each) (time|day|week|release|deploy)\b/i,
];
const MIN_POST_CHARS = 60;

/** How many distinct ways a post says "I lack a tool for this". Used to read the most promising posts first. */
export function painSignalCount(text: string) {
  return PAIN_SIGNALS.reduce((count, pattern) => count + (pattern.test(text) ? 1 : 0), 0);
}

/** Orders posts for sampling: explicit pain language first, then engagement on a compressed scale, then recency. */
export function signalRank(item: { title: string; text: string; score: number; postedAt: string | null }, now = Date.now()) {
  const ageDays = item.postedAt ? Math.max(0, (now - new Date(item.postedAt).getTime()) / 86_400_000) : 365;
  return Math.min(3, painSignalCount(`${item.title} ${item.text}`)) * 2 + Math.log10(1 + Math.max(0, item.score)) + Math.max(0, 1 - ageDays / 365);
}

const hnUrl = (id: string) => `https://news.ycombinator.com/item?id=${id}`;
const stackDate = (epoch?: number) => (epoch ? new Date(epoch * 1_000).toISOString() : null);

export const DISCOVERY_ACTORS: Actor[] = [
  {
    id: 'github-feature-requests',
    async run(session, push) {
      const excluded = EXCLUDED_REPOS.map((repo) => `-repo:${repo}`).join(' ');
      const { iso } = windowStart();
      for (const topic of GITHUB_TOPICS) {
        const q = `${topic} "feature request" is:issue is:open reactions:>=4 created:>=${iso} ${excluded}`;
        const json = await session.json<{ items?: GithubIssue[] }>(`https://api.github.com/search/issues?q=${encodeURIComponent(q)}&sort=reactions&order=desc&per_page=12`);
        for (const issue of json?.items ?? []) {
          push({ platform: 'github', title: cleanText(issue.title), text: cleanText(issue.body).slice(0, 900), url: issue.html_url, score: issue.reactions?.total_count ?? 0, postedAt: issue.created_at ?? null, repo: issue.repository_url.split('/').slice(-2).join('/') });
        }
      }
    },
  },
  {
    id: 'hn-ask',
    async run(session, push) {
      const { epoch } = windowStart();
      for (const query of HN_ASK_QUERIES) {
        const json = await session.json<{ hits?: HnHit[] }>(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=ask_hn&numericFilters=created_at_i>${epoch},num_comments>3&hitsPerPage=40`);
        for (const hit of json?.hits ?? []) {
          const title = cleanText(hit.title);
          const text = cleanText(hit.story_text).slice(0, 900);
          if (DEV_TERMS.test(`${title} ${text}`)) push({ platform: 'hn', title, text, url: hnUrl(hit.objectID), score: (hit.points ?? 0) + (hit.num_comments ?? 0), postedAt: hit.created_at ?? null });
        }
      }
    },
  },
  {
    id: 'hn-pain-comments',
    async run(session, push) {
      const { epoch } = windowStart();
      for (const phrase of HN_PAIN_PHRASES) {
        const json = await session.json<{ hits?: HnHit[] }>(`https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(phrase)}&tags=comment&numericFilters=created_at_i>${epoch}&hitsPerPage=50`);
        for (const hit of json?.hits ?? []) {
          const text = cleanText(hit.comment_text).slice(0, 900);
          if (DEV_TERMS.test(text)) push({ platform: 'hn', title: cleanText(hit.story_title), text, url: hnUrl(hit.objectID), score: 0, postedAt: hit.created_at ?? null });
        }
      }
    },
  },
  {
    id: 'stackoverflow-unanswered',
    async run(session, push) {
      const { epoch } = windowStart();
      for (const tag of STACK_TAGS) {
        const json = await session.json<{ items?: StackQuestion[] }>(`https://api.stackexchange.com/2.3/questions/no-answers?order=desc&sort=votes&tagged=${encodeURIComponent(tag)}&site=stackoverflow&pagesize=15&fromdate=${epoch}&filter=withbody`);
        for (const question of json?.items ?? []) {
          push({ platform: 'stackoverflow', title: cleanText(question.title), text: cleanText(question.body).slice(0, 900), url: question.link, score: question.score ?? 0, postedAt: stackDate(question.creation_date) });
        }
      }
    },
  },
  {
    id: 'devto-discussions',
    async run(session, push) {
      for (const tag of ['discuss', 'devops', 'ai']) {
        const json = await session.json<DevArticle[]>(`https://dev.to/api/articles?tag=${tag}&top=180&per_page=30`);
        for (const article of json ?? []) {
          const title = cleanText(article.title);
          const text = cleanText(article.description);
          if (DEV_TERMS.test(`${title} ${text}`)) push({ platform: 'devto', title, text, url: article.url, score: (article.public_reactions_count ?? 0) + (article.comments_count ?? 0), postedAt: article.published_at ?? null });
        }
      }
    },
  },
  {
    id: 'lobsters-ask',
    async run(session, push) {
      for (const tag of ['ask', 'devops', 'practices']) {
        const json = await session.json<LobstersStory[]>(`https://lobste.rs/t/${tag}.json`);
        for (const story of json ?? []) {
          const title = cleanText(story.title);
          const text = cleanText(story.description_plain).slice(0, 900);
          const url = story.comments_url ?? story.short_id_url;
          if (url && text && DEV_TERMS.test(`${title} ${text}`)) push({ platform: 'lobsters', title, text, url, score: (story.score ?? 0) + (story.comment_count ?? 0), postedAt: story.created_at ?? null });
        }
      }
    },
  },
];

export async function runDiscoveryActors() {
  const dataset = new Map<string, RawSignal>();
  const runs: ActorRun[] = [];
  await Promise.all(DISCOVERY_ACTORS.map(async (actor) => {
    const session = new ActorSession();
    const startedAt = Date.now();
    let items = 0;
    let crashed = false;
    try {
      await actor.run(session, (item) => {
        // A title with almost no body gives the model nothing to quote, and only costs a slot in the sample.
        if (!item.url || dataset.has(item.url) || `${item.title} ${item.text}`.length < MIN_POST_CHARS) return;
        dataset.set(item.url, { ...item, id: String(dataset.size), actor: actor.id });
        items += 1;
      });
    } catch {
      crashed = true;
    }
    runs.push({ id: actor.id, status: crashed || !items ? 'failed' : session.errors ? 'partial' : 'ok', items, errors: session.errors + (crashed ? 1 : 0), durationMs: Date.now() - startedAt });
  }));
  return { items: [...dataset.values()], runs };
}

/** Finds posts about one problem, across platforms, to widen a candidate's evidence. */
export async function searchDemand(phrase: string): Promise<Array<Omit<RawSignal, 'id' | 'actor'>>> {
  const session = new ActorSession();
  const { iso, epoch } = windowStart();
  const found: Array<Omit<RawSignal, 'id' | 'actor'>> = [];
  const q = encodeURIComponent(phrase);

  const [issues, hn, stack] = await Promise.all([
    session.json<{ items?: GithubIssue[] }>(`https://api.github.com/search/issues?q=${encodeURIComponent(`${phrase} is:issue created:>=${iso}`)}&sort=reactions&order=desc&per_page=8`),
    session.json<{ hits?: HnHit[] }>(`https://hn.algolia.com/api/v1/search?query=${q}&tags=(comment,ask_hn)&numericFilters=created_at_i>${epoch}&hitsPerPage=10`),
    session.json<{ items?: StackQuestion[] }>(`https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=votes&q=${q}&site=stackoverflow&pagesize=5&fromdate=${epoch}&filter=withbody`),
  ]);
  for (const issue of issues?.items ?? []) found.push({ platform: 'github', url: issue.html_url, title: cleanText(issue.title), text: cleanText(issue.body).slice(0, 700), score: issue.reactions?.total_count ?? 0, postedAt: issue.created_at ?? null });
  for (const hit of hn?.hits ?? []) found.push({ platform: 'hn', url: hnUrl(hit.objectID), title: cleanText(hit.title ?? hit.story_title), text: cleanText(hit.comment_text ?? hit.story_text).slice(0, 700), score: (hit.points ?? 0) + (hit.num_comments ?? 0), postedAt: hit.created_at ?? null });
  for (const question of stack?.items ?? []) found.push({ platform: 'stackoverflow', url: question.link, title: cleanText(question.title), text: cleanText(question.body).slice(0, 700), score: question.score ?? 0, postedAt: stackDate(question.creation_date) });
  return found;
}

export const SUPPLY_COVERAGE: SupplyKind[] = ['github', 'npm', 'show_hn', 'vscode'];

type Repo = { full_name: string; description?: string; stargazers_count?: number; html_url: string; created_at?: string };
type NpmObject = { package?: { name?: string; description?: string; date?: string; links?: { npm?: string } } };
type VsExtension = { extensionName: string; displayName?: string; shortDescription?: string; publishedDate?: string; publisher?: { publisherName?: string }; statistics?: Array<{ statisticName: string; value: number }> };

export async function searchSupply(query: string): Promise<Array<Omit<SupplyItem, 'relation'>>> {
  const session = new ActorSession();
  const items: Array<Omit<SupplyItem, 'relation'>> = [];
  const q = encodeURIComponent(query);

  const [repos, npm, show, vscode] = await Promise.all([
    session.json<{ items?: Repo[] }>(`https://api.github.com/search/repositories?q=${encodeURIComponent(`${query} stars:>=10 archived:false`)}&sort=stars&order=desc&per_page=5`),
    session.json<{ objects?: NpmObject[] }>(`https://registry.npmjs.org/-/v1/search?text=${q}&size=4`),
    session.json<{ hits?: HnHit[] }>(`https://hn.algolia.com/api/v1/search?query=${q}&tags=show_hn&hitsPerPage=5`),
    session.json<{ results?: Array<{ extensions?: VsExtension[] }> }>('https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery', {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json;api-version=7.1-preview.1' },
      body: JSON.stringify({ filters: [{ criteria: [{ filterType: 8, value: 'Microsoft.VisualStudio.Code' }, { filterType: 10, value: query }], pageNumber: 1, pageSize: 4, sortBy: 4, sortOrder: 0 }], flags: 914 }),
    }),
  ]);

  for (const repo of repos?.items ?? []) items.push({ kind: 'github', name: repo.full_name, description: cleanText(repo.description).slice(0, 160), popularity: repo.stargazers_count ?? 0, url: repo.html_url, createdAt: repo.created_at ?? null });
  for (const object of npm?.objects ?? []) {
    const url = object.package?.links?.npm;
    if (object.package?.name && url) items.push({ kind: 'npm', name: object.package.name, description: cleanText(object.package.description).slice(0, 160), popularity: 0, url, createdAt: null });
  }
  for (const hit of show?.hits ?? []) items.push({ kind: 'show_hn', name: cleanText(hit.title).slice(0, 90), description: '', popularity: hit.points ?? 0, url: hnUrl(hit.objectID), createdAt: hit.created_at ?? null });
  for (const extension of vscode?.results?.[0]?.extensions ?? []) {
    const publisher = extension.publisher?.publisherName ?? '';
    items.push({ kind: 'vscode', name: extension.displayName ?? extension.extensionName, description: cleanText(extension.shortDescription).slice(0, 160), popularity: Math.round(extension.statistics?.find((stat) => stat.statisticName === 'install')?.value ?? 0), url: `https://marketplace.visualstudio.com/items?itemName=${publisher}.${extension.extensionName}`, createdAt: extension.publishedDate ?? null });
  }
  return items;
}

export type { Platform };
