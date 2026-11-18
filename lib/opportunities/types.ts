// own: what the maker heard themselves (interviews, notes). Never checked against a source, never counted for the bar.
export type Platform = 'github' | 'hn' | 'stackoverflow' | 'devto' | 'lobsters' | 'stackexchange' | 'forum' | 'web' | 'own';

export const PLATFORM_LABELS: Record<Platform, string> = {
  // Issues and discussions both: what matters is that the author is a user of that project.
  github: 'GitHub',
  hn: 'Hacker News',
  stackoverflow: 'Stack Overflow',
  devto: 'DEV Community',
  lobsters: 'Lobsters',
  stackexchange: 'Stack Exchange',
  forum: '사용자 포럼',
  web: '웹 검색',
  own: '내 메모·인터뷰',
};

/** Quotes that count toward the evidence bar: public posts checked against their source, not the maker's own notes. */
export const publicEvidence = <T extends { platform: Platform }>(rows: T[]) => rows.filter((row) => row.platform !== 'own');

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

/** A verified pain kept between runs, so one found today can still pair with a post found next week. */
export type MemoryPain = { who?: string; pain?: string; quote: string; item: RawSignal; readAt: string };
/** What earlier runs read (post URL → when) and the pains they found that are not yet evidence. */
export type ReadMemory = { read: Record<string, string>; pains: MemoryPain[] };

export type Evidence = {
  id: string;
  platform: Platform;
  quote: string;
  quoteKo: string;
  url: string;
  score: number;
  postedAt: string | null;
};

export type SupplyKind = 'github' | 'npm' | 'show_hn' | 'vscode' | 'appstore' | 'web';
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
  /** The occupation that has the problem, e.g. "회계 담당자". Missing on runs from when every problem was a developer's. */
  audience?: string;
  audienceEn?: string;
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
  /** A model's estimate of a solo first version. Missing until the engine script fills it. */
  build?: BuildEstimate;
};

export type BuildSize = 'weekend' | 'weeks' | 'team';
/** stack: tools for the first version. hard: parts likely to block a beginner (Korean phrases). */
export type BuildEstimate = { size: BuildSize; days: number; stack: string[]; hard: string[] };

export const BUILD_LABELS: Record<BuildSize, [string, string]> = {
  weekend: ['주말 프로젝트', 'Weekend build'],
  weeks: ['몇 주 프로젝트', 'A few weeks'],
  team: ['팀 프로젝트', 'Team project'],
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
