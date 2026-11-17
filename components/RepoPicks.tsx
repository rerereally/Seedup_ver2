import Link from 'next/link';
import ScrapButton from '@/components/ScrapButton';
import type { GitHubTrend } from '@/lib/data';

/** Picked repositories: this week's star gain first, then Seedup's own relevance score, then size. */
export function rankRepos(repos: GitHubTrend[]) {
  return [...repos].sort((a, b) => Number(b.stars_delta_7d ?? 0) - Number(a.stars_delta_7d ?? 0) || Number(b.relevance_score ?? 0) - Number(a.relevance_score ?? 0) || Number(b.stars ?? 0) - Number(a.stars ?? 0));
}

/** A short list of repositories, each with a keep button; kept ones reach a coding agent through MCP get_kept_items. */
export default function RepoPicks({ repos, kept, limit = 4 }: { repos: GitHubTrend[]; kept: Set<string>; limit?: number }) {
  return (
    <ul className="rows">
      {repos.slice(0, limit).map((repo) => (
        <li key={repo.id} className="flex items-start gap-3 py-4">
          <Link href={`/github-trends/${repo.id}`} className="min-w-0 flex-1 underline-offset-4 hover:underline">
            <span className="block truncate font-semibold text-ink">{repo.repo_full_name}</span>
            <span className="mt-1 line-clamp-2 block text-sm leading-6 text-muted">{repo.short_summary ?? repo.description}</span>
          </Link>
          <ScrapButton itemType="github" itemId={repo.id} title={repo.repo_full_name} description={repo.short_summary ?? repo.description} tag={repo.language ?? 'github'} initialSaved={kept.has(`github:${repo.id}`)} className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-tertiary hover:bg-surface-low hover:text-ink" iconOnly savedLabel="킵함" unsavedLabel="킵하기" />
        </li>
      ))}
    </ul>
  );
}
