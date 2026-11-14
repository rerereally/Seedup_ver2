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

export type RepoStructure = { readme: string; tree: string[]; manifest: string };

const SOURCE_DIRS = new Set(['src', 'app', 'lib', 'pages', 'components', 'server', 'api', 'packages', 'cmd', 'internal']);
const MANIFESTS = ['package.json', 'pyproject.toml', 'requirements.txt', 'Cargo.toml', 'go.mod'];

async function listDir(fullName: string, path = '') {
  try {
    const response = await github(`/repos/${fullName}/contents/${path}`, 'application/vnd.github+json');
    if (!response.ok) return [];
    const rows = (await response.json()) as Array<{ name: string; type: string; path: string }>;
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

async function readRaw(fullName: string, path: string, limit: number) {
  try {
    const response = await github(`/repos/${fullName}/contents/${path}`, 'application/vnd.github.raw+json');
    return response.ok ? (await response.text()).slice(0, limit) : '';
  } catch {
    return '';
  }
}

/** What a reverse spec reads from a public repo: a longer README, the top two levels of source folders, and the manifest. */
export async function readRepoStructure(fullName: string): Promise<RepoStructure> {
  const top = await listDir(fullName);
  const sourceDirs = top.filter((row) => row.type === 'dir' && SOURCE_DIRS.has(row.name)).slice(0, 3);
  const nested = await Promise.all(sourceDirs.map(async (dir) => (await listDir(fullName, dir.path)).slice(0, 25).map((row) => `${dir.name}/${row.name}${row.type === 'dir' ? '/' : ''}`)));
  const manifest = top.find((row) => row.type === 'file' && MANIFESTS.includes(row.name));
  const [readmeResponse, manifestText] = await Promise.all([
    github(`/repos/${fullName}/readme`, 'application/vnd.github.raw+json').catch(() => null),
    manifest ? readRaw(fullName, manifest.path, 1_500) : Promise.resolve(''),
  ]);
  const readme = readmeResponse?.ok ? (await readmeResponse.text()).replace(/<[^>]+>/g, ' ').replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 4_000) : '';
  return {
    readme,
    tree: [...top.slice(0, 40).map((row) => `${row.name}${row.type === 'dir' ? '/' : ''}`), ...nested.flat()].slice(0, 90),
    manifest: manifest ? `${manifest.name}:\n${manifestText}` : '',
  };
}
