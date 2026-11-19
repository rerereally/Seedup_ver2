import type { SeedRepo } from './github';

export const SEEDS_RESULT_KEY = 'seedup:seeds-result';

export function savedRepoLanguages(raw: string | null) {
  const result = JSON.parse(raw ?? 'null') as { repos?: Array<Pick<SeedRepo, 'language'> | null> } | null;
  return Array.isArray(result?.repos) ? result.repos.map((repo) => repo?.language) : [];
}
