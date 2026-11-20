export type UnseenFile = { path: string; reason: string };
export type GitHubEvidence = {
  sha: string; diff: string; files: Record<string, string>;
  checks: Array<{ name: string; conclusion: string | null }>;
  unseen: UnseenFile[];
};
type CommitFile = { filename: string; status: string };
type TreeFile = { path: string; type: string; size?: number; mode?: string };

const MAX_DIFF = 2_000_000;
const MAX_FILE = 160_000;
const MAX_CONTENT = 600_000;
const MAX_FILES = 80;

export function validateGitHubCommit(repo: string, sha: string) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) || repo.split('/').some((part) => part === '.' || part === '..')) throw new Error('Expected owner/repo');
  if (!/^[a-f0-9]{40}$/i.test(sha)) throw new Error('Expected a full commit SHA');
}

async function boundedText(response: Response, max: number) {
  if (Number(response.headers.get('content-length')) > max) { await response.body?.cancel(); throw new Error('GitHub response too large'); }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Empty GitHub response');
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > max) throw new Error('GitHub response too large');
      parts.push(value);
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(parts));
  } finally {
    await reader.cancel();
  }
}

/** Only immutable public GitHub data. Auth never follows a redirect or leaves api.github.com. */
export async function collectGitHubEvidence(
  repo: string, sha: string, criterionPaths: string[] = [],
  options: { fetch?: typeof fetch; token?: string } = {},
): Promise<GitHubEvidence> {
  validateGitHubCommit(repo, sha);
  sha = sha.toLowerCase();
  const request = options.fetch ?? fetch;
  const token = options.token ?? process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required');
  const base = `https://api.github.com/repos/${repo}`;
  async function get(path: string, max = 8_000_000, accept = 'application/vnd.github+json') {
    const response = await request(`${base}${path}`, {
      headers: { authorization: `Bearer ${token}`, accept, 'X-GitHub-Api-Version': '2022-11-28' },
      redirect: 'error', signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) { await response.body?.cancel(); throw new Error(`GitHub HTTP ${response.status}`); }
    return boundedText(response, max);
  }
  const metadata = JSON.parse(await get('')) as { private?: boolean; visibility?: string };
  if (metadata.private !== false || metadata.visibility && metadata.visibility !== 'public') throw new Error('Only public repositories are supported');

  const changed: CommitFile[] = [];
  let treeSha = '';
  for (let page = 1; page <= 30; page++) {
    const commit = JSON.parse(await get(`/commits/${sha}?per_page=100&page=${page}`)) as { sha: string; commit: { tree: { sha: string } }; files: CommitFile[] };
    if (commit.sha.toLowerCase() !== sha) throw new Error('GitHub SHA mismatch');
    treeSha = commit.commit.tree.sha;
    changed.push(...commit.files);
    if (commit.files.length < 100) break;
    if (page === 30) throw new Error('Commit file list may be truncated');
  }
  // Refuse truncated/oversized diffs rather than silently skipping the static gate.
  const diff = await get(`/commits/${sha}`, MAX_DIFF, 'application/vnd.github.diff');
  const tree = JSON.parse(await get(`/git/trees/${treeSha}?recursive=1`)) as { truncated: boolean; tree: TreeFile[] };
  const entries = new Map(tree.tree.filter((file) => file.type === 'blob').map((file) => [file.path, file]));
  const relevant = new Set(criterionPaths);
  const wanted = new Set([...changed.filter((file) => file.status !== 'removed').map((file) => file.filename), ...criterionPaths]);
  const unseen: UnseenFile[] = [];
  if (tree.truncated) unseen.push({ path: '*', reason: 'GitHub tree truncated; repository inventory incomplete' });
  for (const file of changed.filter((file) => file.status === 'removed')) unseen.push({ path: file.filename, reason: 'Deleted at this SHA' });
  const files: Record<string, string> = Object.create(null);
  let total = 0;
  // Explicit criterion paths first when the budget cannot hold every changed file.
  const paths = [...wanted].sort((a, b) => Number(relevant.has(b)) - Number(relevant.has(a)));
  for (const path of paths) {
    const entry = entries.get(path);
    if (!entry || entry.mode === '120000' || entry.size === undefined || entry.size > MAX_FILE || total + entry.size > MAX_CONTENT || Object.keys(files).length >= MAX_FILES) {
      unseen.push({ path, reason: !entry ? 'Not in SHA tree' : 'File or total context limit' });
      continue;
    }
    try {
      const content = await get(`/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${sha}`, MAX_FILE, 'application/vnd.github.raw+json');
      if (content.includes('\0')) throw new Error('Binary file');
      if (total + Buffer.byteLength(content) > MAX_CONTENT) throw new Error('Total context limit');
      total += Buffer.byteLength(content);
      files[path] = content;
    } catch {
      unseen.push({ path, reason: 'Could not read full UTF-8 file' });
    }
  }
  for (const path of entries.keys()) if (!wanted.has(path)) unseen.push({ path, reason: 'Outside changed files and criterion paths' });

  const checks: GitHubEvidence['checks'] = [];
  for (let page = 1; page <= 30; page++) {
    const result = JSON.parse(await get(`/commits/${sha}/check-runs?filter=latest&per_page=100&page=${page}`)) as {
      total_count: number; check_runs: Array<{ name: string; status: string; conclusion: string | null; head_sha: string }>;
    };
    for (const check of result.check_runs) {
      if (check.head_sha.toLowerCase() !== sha) throw new Error('CI SHA mismatch');
      checks.push({ name: check.name, conclusion: check.status === 'completed' ? check.conclusion : null });
    }
    if (checks.length >= result.total_count) break;
    if (!result.check_runs.length || page === 30) throw new Error('CI list incomplete');
  }
  return { sha, diff, files, checks, unseen };
}
