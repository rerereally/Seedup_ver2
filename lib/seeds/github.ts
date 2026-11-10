const GITHUB_API = 'https://api.github.com';
const REPOS_TO_READ = 5;
const README_CHARS = 1_200;
const TIMEOUT_MS = 8_000;

export type SeedRepo = {
  name: string;
  fullName: string;
  url: string;
  description: string;
  language: string;
  topics: string[];
  stars: number;
  pushedAt: string | null;
  readme: string;
};

export type GitHubLookupFailure = 'not_found' | 'rate_limited' | 'unavailable';

export class GitHubLookupError extends Error {
  constructor(public readonly reason: GitHubLookupFailure) {
    super(reason);
  }
}

/** GitHub's own rule for logins, checked before the name is put into a URL. */
export function isGitHubLogin(value: string) {
  return /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i.test(value);
}

async function github(path: string, accept: string) {
  const token = process.env.GITHUB_TOKEN?.trim();
  return fetch(`${GITHUB_API}${path}`, {
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: { accept, 'user-agent': 'seedup', 'x-github-api-version': '2022-11-28', ...(token ? { authorization: `Bearer ${token}` } : {}) },
  });
}

async function readReadme(fullName: string) {
  try {
    const response = await github(`/repos/${fullName}/readme`, 'application/vnd.github.raw+json');
    if (!response.ok) return '';
    return (await response.text()).replace(/<[^>]+>/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().slice(0, README_CHARS);
  } catch {
    return '';
  }
}

type GitHubRepoRow = {
  name: string;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  topics?: string[];
  stargazers_count: number;
  pushed_at: string | null;
  fork: boolean;
  archived: boolean;
};

/** The most recently pushed public repos a person owns. Nothing private is ever requested. */
export async function fetchPublicRepos(login: string): Promise<SeedRepo[]> {
  let response: Response;
  try {
    response = await github(`/users/${login}/repos?type=owner&sort=pushed&per_page=30`, 'application/vnd.github+json');
  } catch {
    throw new GitHubLookupError('unavailable');
  }
  if (response.status === 404) throw new GitHubLookupError('not_found');
  if (response.status === 403 || response.status === 429) throw new GitHubLookupError('rate_limited');
  if (!response.ok) throw new GitHubLookupError('unavailable');

  const rows = (await response.json()) as GitHubRepoRow[];
  const picked = rows.filter((row) => !row.fork && !row.archived).slice(0, REPOS_TO_READ);
  const readmes = await Promise.all(picked.map((row) => readReadme(row.full_name)));
  return picked.map((row, index) => ({
    name: row.name,
    fullName: row.full_name,
    url: row.html_url,
    description: row.description ?? '',
    language: row.language ?? '',
    topics: row.topics ?? [],
    stars: row.stargazers_count,
    pushedAt: row.pushed_at,
    readme: readmes[index],
  }));
}
