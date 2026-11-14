export type Platform = 'github' | 'hn' | 'stackoverflow' | 'devto' | 'lobsters';

export const PLATFORM_LABELS: Record<Platform, string> = {
  github: 'GitHub 이슈',
  hn: 'Hacker News',
  stackoverflow: 'Stack Overflow',
  devto: 'DEV Community',
  lobsters: 'Lobsters',
};

export type RawSignal = {
  id: string;
  actor: string;
  platform: Platform;
  title: string;
  text: string;
  url: string;
  score: number;
  postedAt: string | null;
  repo?: string;
};

export type Evidence = {
  id: string;
  platform: Platform;
  quote: string;
  quoteKo: string;
  url: string;
  score: number;
  postedAt: string | null;
};

export type SupplyKind = 'github' | 'npm' | 'show_hn' | 'vscode';
export type SupplyRelation = 'direct' | 'partial' | 'unrelated';

export type SupplyItem = {
  kind: SupplyKind;
  name: string;
  description: string;
  popularity: number;
  url: string;
  createdAt: string | null;
  relation: SupplyRelation;
};

export type OpportunityStatus = 'open' | 'narrowing' | 'closed' | 'unknown';

export type Opportunity = {
  slug: string;
  name: string;
  problem: string;
  gap: string;
  keywords: string[];
  status: OpportunityStatus;
  qualified: boolean;
  platforms: Platform[];
  evidence: Evidence[];
  supply: SupplyItem[];
  directCount: number;
  firstSeenAt: string | null;
  followersAfterSignal: number;
  /** English copies written by the engine for the English UI. Missing on older snapshots. */
  nameEn?: string;
  problemEn?: string;
  gapEn?: string;
  /** When an engine run last found this problem again. Missing on results from before runs were merged. */
  lastSeenAt?: string;
  /** One point per run in which something changed, oldest first. */
  history?: OpportunityPoint[];
};

export type OpportunityPoint = { at: string; evidence: number; platforms: number; direct: number; status: OpportunityStatus; qualified: boolean };

export type ActorRun = {
  id: string;
  status: 'ok' | 'partial' | 'failed';
  items: number;
  errors: number;
  durationMs: number;
};

export type EngineStats = {
  collected: number;
  sampled: number;
  batchesOk: number;
  batchesTotal: number;
  painsVerified: number;
  quotesRejected: number;
  candidates: number;
  qualified: number;
  llmCalls: number;
  llmFailures: number;
  supplyCoverage: SupplyKind[];
  actors: ActorRun[];
};

export type OpportunitySnapshot = {
  generatedAt: string;
  stats: EngineStats;
  opportunities: Opportunity[];
};

export const MIN_EVIDENCE = 3;
export const MIN_PLATFORMS = 2;

/** Name, problem and gap in the reader's language, falling back to Korean when no English copy exists yet. */
export function localizedOpportunity(item: Pick<Opportunity, 'name' | 'problem' | 'gap' | 'nameEn' | 'problemEn' | 'gapEn'>, lang: 'ko' | 'en') {
  return lang === 'en'
    ? { name: item.nameEn || item.name, problem: item.problemEn || item.problem, gap: item.gapEn || item.gap }
    : { name: item.name, problem: item.problem, gap: item.gap };
}
