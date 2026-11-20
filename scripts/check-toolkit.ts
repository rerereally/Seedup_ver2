// Checks every repo in lib/opportunities/toolkit.ts on GitHub before it ships: it exists, is not archived, has a
// licence, and was pushed to within a year. Exits 1 on any problem. Uses GITHUB_TOKEN when set (higher rate limit).
//   npx tsx scripts/check-toolkit.ts
import { TOOLKIT } from '../lib/opportunities/toolkit';

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

async function main() {
  const headers: Record<string, string> = { accept: 'application/vnd.github+json', 'user-agent': 'seedup-toolkit-check' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  let failed = 0;
  for (const tool of TOOLKIT) {
    const response = await fetch(`https://api.github.com/repos/${tool.repo}`, { headers });
    const repo = (await response.json().catch(() => ({}))) as { archived?: boolean; license?: { spdx_id?: string } | null; pushed_at?: string; stargazers_count?: number; full_name?: string };
    const problems = [
      !response.ok && `HTTP ${response.status}`,
      repo.archived && 'archived',
      !repo.license?.spdx_id && !tool.licencePerItem && 'no licence',
      repo.pushed_at && Date.now() - Date.parse(repo.pushed_at) > YEAR_MS && `last push ${repo.pushed_at}`,
    ].filter(Boolean);
    if (problems.length) failed++;
    console.log(`${problems.length ? '✖' : '✔'} ${tool.id.padEnd(14)} ${repo.full_name ?? tool.repo} ${repo.license?.spdx_id ?? '-'} ★${repo.stargazers_count ?? '-'} ${repo.pushed_at?.slice(0, 10) ?? ''}${problems.length ? `  ${problems.join(', ')}` : ''}`);
  }
  if (failed) process.exitCode = 1;
}

main();
