import type { SupabaseClient } from '@supabase/supabase-js';

export type RepoRelease = { tag: string; name: string; url: string; publishedAt: string; note: string };

const MAX_KEPT_REPOS = 60;

/** The first lines of release notes that say something, without headings, links or badges, cut to one short line. */
export function releaseNote(body: string | null | undefined, max = 200) {
  const lines = String(body ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .split('\n')
    .map((line) => line.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/^[#>*\-\s]+/, '').replace(/[*_`]/g, '').trim())
    .filter((line) => line.length >= 8 && !/^(what'?s changed|full changelog|changelog|new contributors|release notes)\b/i.test(line) && !/^https?:\/\//.test(line));
  const text = lines.slice(0, 2).join(' ');
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

/**
 * For every repository someone kept: its latest release and current numbers, so the desk and the coding agent can say
 * what is new in the tools a person chose. Refreshing pushed_at also keeps an active kept repo from being pruned.
 */
export async function refreshKeptRepos(supabase: SupabaseClient, headers: HeadersInit) {
  const { data: kept } = await supabase.from('scraps').select('item_id').eq('item_type', 'github').limit(5000);
  const ids = [...new Set((kept ?? []).map((row) => String(row.item_id ?? '')).filter(Boolean))].slice(0, MAX_KEPT_REPOS);
  if (!ids.length) return { checked: 0, releases: 0 };
  const { data: repos } = await supabase.from('github_trends').select('id,repo_full_name').in('id', ids);
  let checked = 0;
  let releases = 0;
  for (const repo of repos ?? []) {
    const name = String(repo.repo_full_name);
    const get = async <T>(path: string) => {
      const response = await fetch(`https://api.github.com/repos/${name}${path}`, { headers, signal: AbortSignal.timeout(15_000), cache: 'no-store' }).catch(() => null);
      return response?.ok ? ((await response.json().catch(() => null)) as T | null) : null;
    };
    const [info, latest] = await Promise.all([
      get<{ stargazers_count?: number; forks_count?: number; pushed_at?: string }>(''),
      get<{ tag_name?: string; name?: string; html_url?: string; published_at?: string; body?: string; draft?: boolean; prerelease?: boolean }>('/releases/latest'),
    ]);
    if (!info) continue;
    checked += 1;
    const release: RepoRelease | null = latest?.tag_name && latest.html_url && latest.published_at && !latest.draft
      ? { tag: latest.tag_name, name: String(latest.name || latest.tag_name).slice(0, 120), url: latest.html_url, publishedAt: latest.published_at, note: releaseNote(latest.body) }
      : null;
    if (release) releases += 1;
    const { error } = await supabase.from('github_trends').update({ stars: info.stargazers_count, forks: info.forks_count, pushed_at: info.pushed_at, latest_release: release }).eq('id', repo.id);
    if (error) console.error('kept repo refresh failed', name, error.message);
  }
  return { checked, releases };
}

/** Kept repositories with a release in the last `days`, newest first. */
export function recentReleases<T extends { latest_release?: RepoRelease | null }>(rows: T[], days = 30, now = Date.now()) {
  const since = now - days * 86_400_000;
  return rows
    .filter((row) => row.latest_release && new Date(row.latest_release.publishedAt).getTime() >= since)
    .sort((a, b) => String(b.latest_release?.publishedAt).localeCompare(String(a.latest_release?.publishedAt)));
}
