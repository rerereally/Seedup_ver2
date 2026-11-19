import type { SeedIdea, SeedPaper } from './advise';
import { isGitHubLogin } from './github';

export type SavedSeedResult<Repo = { name: string }> = {
  login: string;
  at: string;
  repos: Repo[];
  ideas: Record<string, SeedIdea>;
  papers: Record<string, SeedPaper[]>;
};

function storageKey(userId?: string) {
  return userId ? `seedup:seeds-result:${userId}` : 'seedup:seeds-result';
}

export function parseSavedSeedResult<Repo>(raw: string | null): SavedSeedResult<Repo> | null {
  try {
    const saved = JSON.parse(raw ?? 'null') as SavedSeedResult | null;
    if (saved && typeof saved.login === 'string' && isGitHubLogin(saved.login) && typeof saved.at === 'string'
      && Array.isArray(saved.repos) && saved.repos.every((repo) => typeof repo?.name === 'string' && repo.name.length > 0)) {
      return saved as SavedSeedResult<Repo>;
    }
  } catch {
    // An unreadable result can be replaced by the next analysis.
  }
  return null;
}

export function readSavedSeedResult<Repo = { name: string }>(userId?: string) {
  try {
    return parseSavedSeedResult<Repo>(localStorage.getItem(storageKey(userId)));
  } catch {
    return null;
  }
}

export function saveSeedResult<Repo>(saved: SavedSeedResult<Repo>, userId?: string) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(saved));
  } catch {
    // Storage can be blocked or full; the result is then simply not remembered.
  }
}
