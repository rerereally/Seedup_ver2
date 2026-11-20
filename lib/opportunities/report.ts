import { translator, type Lang } from '../i18n';
import { searchDemand, searchSupply } from './actors';
import { estimateBuild } from './build';
import { isGeneratedProblemPost, searchIdeaEvidenceWithRetry } from './idea-evidence';
import { callJsonModel, type ModelUsage } from '../llm';
import { matchOpportunities } from './match';
import { discoveryReply } from './outreach';
import { isCutOffEvidenceQuote } from './quote-completeness';
import { CROWDED_AT, compareRivalListings, counterQuotesFrom, listingLimitation, validationChecks } from './report-checks';
import type { CounterQuote, ReportCheck } from './report-checks';
import { firstUserSources, meetsEvidenceBar, uniqueQuotes } from './rules';
import { MAX_RESEARCHED, researchRivals, rivalAgentEnabled } from './rival-research';
import { PLATFORM_LABELS } from './types';
import type { BuildEstimate, Evidence, Opportunity, SupplyItem } from './types';
import { searchWebSupply, webSearchEnabled } from './web';

export type ReportVerdict = { level: 'go' | 'more_evidence' | 'crowded' | 'no_signal'; reason: string };

/** "Should I build this?" for one idea: real quotes, the tools that already exist, size, first users, and a verdict. */
export type ValidationReport = {
  idea: string;
  phrases: string[];
  quotes: Evidence[];
  related: Array<{ slug: string; name: string; qualified: boolean; quotes: number }>;
  rivals: SupplyItem[];
  gap: string;
  build: BuildEstimate | null;
  firstUsers: Array<{ platform: string; url: string; quote: string }>;
  verdict: ReportVerdict;
  generatedAt: string;
  checks: ReportCheck[];
  counterQuotes: CounterQuote[];
  rivalStats: { candidates: number; direct: number; researchQueries: number };
};

const MAX_RIVALS = 8;

/**
 * The verdict follows the same bar as the rest of Seedup (3 quotes from 2 sites), so a report never calls an idea
 * worth building on less evidence than a published problem needs.
 */
export function reportVerdict(quotes: number, platforms: number, direct: number, lang: Lang = 'ko'): ReportVerdict {
  const t = translator(lang);
  if (!quotes) return { level: 'no_signal', reason: t('이 문제를 직접 말한 원문을 찾지 못했습니다. 문제를 다르게 적어 보거나, 아는 사람에게 먼저 물어보세요.', 'The search found no quotes directly describing this problem. Try another wording or ask someone you know.') };
  if (!meetsEvidenceBar(quotes, platforms)) return { level: 'more_evidence', reason: t(`원문 ${quotes}건, 플랫폼 ${platforms}곳을 찾았습니다. 3건과 2곳을 모두 채워야 합니다.`, `The search found ${quotes} quotes from ${platforms} platforms. The bar is 3 quotes across 2 platforms.`) };
  if (direct >= CROWDED_AT) return { level: 'crowded', reason: t(`같은 문제를 푸는 도구를 ${direct}개 찾았습니다. 기존 도구가 풀지 못한 한 가지부터 확인해 보세요.`, `The search found ${direct} direct competitors. Check for one concrete gap before you build.`) };
  return { level: 'go', reason: t(`원문 ${quotes}건, 플랫폼 ${platforms}곳에서 같은 문제를 확인했고, 검색에서 직접 경쟁 도구 ${direct}개를 찾았습니다.`, `The search found ${quotes} quotes from ${platforms} platforms and ${direct} direct competitors.`) };
}

export function firstUsersFrom(quotes: Evidence[], limit = 10) {
  return firstUserSources(quotes, limit).map((row) => ({ platform: PLATFORM_LABELS[row.platform] ?? row.platform, url: row.url, quote: row.quote }));
}

/** evidenceBudgetMs: time for the quote search; one search takes about 45 s on free models, a retry needs about 90 s. */
type ReportOptions = { lang?: Lang; stack?: string[]; searchCounterEvidence?: boolean; rivalAgent?: boolean; evidenceBudgetMs?: number; model?: string; onUsage?: (usage: ModelUsage) => void };
type ModelChoice = { model?: string; onUsage?: (usage: ModelUsage) => void };

// By default the evidence search gets a minute, leaving the rival search time inside the web route's 120 s; callers
// with more time (MCP, 160 s) pass a longer budget so the retry with other words can run.
const EVIDENCE_BUDGET_MS = 60_000;

const reportSources = {
  readEvidence: (idea: string, budgetMs = EVIDENCE_BUDGET_MS, choice: ModelChoice = {}): Promise<{ phrases: string[]; quotes: Evidence[] }> => searchIdeaEvidenceWithRetry(idea, { deadline: Date.now() + budgetMs, ...choice }),
  estimate: estimateBuild,
  supply: searchSupply,
  demand: searchDemand,
  webSupply: (query: string) => webSearchEnabled() ? searchWebSupply(query) : Promise.resolve([]),
  rivalAgent: rivalAgentEnabled,
  askRivalQueries: (prompt: string, choice: ModelChoice = {}) => callJsonModel<{ queries?: unknown }>(prompt, { maxTokens: 300, timeoutMs: 20_000, title: 'Seedup rival research', ...choice }),
};

export async function buildValidationReport(idea: string, opportunities: Opportunity[], options: ReportOptions = {}, sources = reportSources): Promise<ValidationReport> {
  // The model the person picked (allowed by the admin policy) goes first in every call; free models stay behind it.
  const choice: ModelChoice = { model: options.model, onUsage: options.onUsage };
  const estimate = sources.estimate({ problem: idea, problemEn: undefined, gap: '', gapEn: undefined, supply: [] }, choice).catch(() => null);
  const search = async (query: string) => (await Promise.all([sources.supply(query).catch(() => []), sources.webSupply(query).catch(() => [])])).flat();
  const rawSupply = search(idea);
  const live = await sources.readEvidence(idea, options.evidenceBudgetMs, choice).catch(() => ({ phrases: [] as string[], quotes: [] as Evidence[] }));
  const queries = [idea, ...live.phrases].slice(0, 2);
  const phrases = live.phrases.length ? live.phrases : [idea];
  const [counterPhrase] = phrases;
  const counter = options.searchCounterEvidence
    ? Promise.all(['"already use"', '"no need"'].map((suffix) => sources.demand(`${counterPhrase} ${suffix}`).catch(() => [])))
        .then((results) => counterQuotesFrom(phrases, results.flat()))
    : Promise.resolve([]);

  const found = new Map<string, Omit<SupplyItem, 'relation'>>();
  const lists = await Promise.all([rawSupply, ...queries.slice(1).map(search)]);
  for (const item of lists.flat()) if (item.name && item.url && !found.has(item.url)) found.set(item.url, item);
  const agent = options.rivalAgent ?? sources.rivalAgent();
  const researchQueries = agent ? await researchRivals(idea, found, { ask: (prompt) => sources.askRivalQueries(prompt, choice), search }, queries) : [];
  const candidates = [...found.values()].slice(0, agent ? MAX_RESEARCHED : 16);
  const matchedRivals = compareRivalListings(phrases, candidates);
  const rivals = matchedRivals.slice(0, MAX_RIVALS);
  const gap = rivals.map(listingLimitation).find(Boolean) ?? '';
  const [build, counterQuotes] = await Promise.all([estimate, counter]);

  const quotes = uniqueQuotes(live.quotes);
  // Two shared words at least: one ("앱", "관리") tied a repair app to a paper backlog and made its posters first users.
  const match = matchOpportunities(idea, opportunities, 2);
  const relatedItems = opportunities.filter((item) => match.slugs.includes(item.slug)).slice(0, 3);
  const platforms = new Set(quotes.map((row) => row.platform)).size;
  const direct = matchedRivals.filter((item) => item.relation === 'direct').length;
  const firstUsers = firstUsersFrom([...quotes, ...relatedItems.flatMap((item) => item.evidence)].filter((row) => !isCutOffEvidenceQuote(row.quote) && !isGeneratedProblemPost(row)));
  const now = Date.now();
  return {
    idea,
    phrases: live.phrases,
    quotes,
    related: relatedItems.map((item) => ({ slug: item.slug, name: item.name, qualified: item.qualified, quotes: item.evidence.length })),
    rivals,
    gap,
    build,
    firstUsers,
    verdict: reportVerdict(quotes.length, platforms, direct, options.lang),
    generatedAt: new Date(now).toISOString(),
    checks: validationChecks({ quotes, rivals: matchedRivals, candidateCount: candidates.length, firstUsers, build, stack: options.stack ?? [], now, lang: options.lang }),
    counterQuotes,
    rivalStats: { candidates: found.size, direct, researchQueries: researchQueries.length },
  };
}

/** A listing too short to tell who a tool is for and what it does: under 8 words. */
const thinListing = (description: string) => description.trim().split(/\s+/).filter(Boolean).length < 8;

/** Success criteria fitted to this report: what is missing decides what the next interviews must show. */
function nextStepCriteria(report: ValidationReport, platforms: number, direct: string[], t: (ko: string, en: string) => string) {
  return [
    !meetsEvidenceBar(report.quotes.length, platforms)
      ? t(`- 원문이 기준(3건 · 2곳)에 못 미칩니다(지금 ${report.quotes.length}건 · ${platforms}곳). 같은 문제를 겪는 사람 5명과 이야기해 3명 이상이 최근 한 달 안에 겪었다고 하면 원문 대신 인터뷰 기록으로 근거를 채웁니다.`,
        `- Evidence is below the bar (${report.quotes.length} quotes, ${platforms} platforms). Talk to 5 people with the problem; if 3 or more hit it in the last month, their notes stand in for the missing quotes.`)
      : t('- 원문 기준은 채웠습니다. 인터뷰 5명 중 3명 이상이 지금 방법에 시간이나 돈을 쓰고 있다고 하면 첫 버전을 만듭니다.', '- The quote bar is met. Build a first version when 3 of 5 interviewees say they spend time or money on the problem today.'),
    direct.length
      ? t(`- 직접 경쟁(${direct.slice(0, 3).join(', ')})이 있습니다. 그 도구를 쓰는 사람 3명 이상이 같은 빈틈을 말해야 차별점으로 씁니다.`, `- Direct competitors exist (${direct.slice(0, 3).join(', ')}). Use a gap as your edge only when 3 or more of their users name the same one.`)
      : t('- 직접 경쟁을 찾지 못했습니다. 이미 쓰는 방법(스프레드시트, 메신저 등)을 인터뷰에서 확인해 대체 대상을 정합니다.', '- No direct competitor found. Find what people use today (spreadsheets, chat) in the interviews; that is what you replace.'),
    report.counterQuotes.length
      ? t(`- 반대 의견 ${report.counterQuotes.length}건이 있습니다. 인터뷰에서 같은 이유("이미 쓰는 게 있다", "필요 없다")가 절반을 넘으면 멈춥니다.`, `- ${report.counterQuotes.length} counter-quotes found. Stop if over half of the interviews give the same reason ("already use something", "no need").`)
      : t('- 반대 근거는 이번 검색에서 찾지 못했습니다. 없다는 뜻이 아니니 인터뷰에서 "필요 없다"는 답의 비율을 직접 셉니다.', '- This search found no counter-evidence. That is not proof there is none; count the "no need" answers in the interviews.'),
  ];
}

/** The report as Markdown, for the result view and MCP. */
export function renderReport(report: ValidationReport, siteUrl: string, lang: Lang = 'ko') {
  const t = translator(lang);
  const verdict = { go: t('실험해 볼 만함', 'Worth testing'), more_evidence: t('근거가 더 필요함', 'Need more evidence'), crowded: t('경쟁이 많음', 'Crowded'), no_signal: t('신호 없음', 'No signal') };
  const levels = { supported: t('근거 있음', 'Supported'), caution: t('주의', 'Caution'), unclear: t('판단 보류', 'Unclear') };
  const direct = report.rivals.filter((row) => row.relation === 'direct');
  const platforms = new Set(report.quotes.map((row) => row.platform)).size;
  const first = report.firstUsers[0];
  const waitlist = `${siteUrl}/profile?${new URLSearchParams({ tryIdea: report.idea })}#idea-pages`;
  const size = { weekend: t('주말 프로젝트', 'Weekend project'), weeks: t('몇 주', 'Several weeks'), team: t('팀이 필요함', 'Needs a team') };
  const relation = { direct: t('직접 경쟁', 'Direct competitor'), partial: t('일부 겹침', 'Partial overlap'), unrelated: t('관련 낮음', 'Low overlap') };

  return [
    `# ${t('아이디어 검증', 'Idea validation')} · ${report.idea.replace(/\s+/g, ' ')}`,
    '',
    `## ${t('실패할 이유', 'Why it could fail')}`,
    ...(!meetsEvidenceBar(report.quotes.length, platforms) ? [t(
      `- 원문이 기준보다 적습니다. 현재 ${report.quotes.length}건과 플랫폼 ${platforms}곳입니다. 기준은 3건과 2곳입니다.`,
      `- Evidence is below the bar. Found ${report.quotes.length} quotes across ${platforms} platforms. The bar is 3 quotes across 2 platforms.`,
    )] : []),
    ...direct.map((row) => `- ${t('직접 경쟁', 'Direct competitor')}: ${row.name} ${row.url}`),
    ...(report.counterQuotes.length ? report.counterQuotes.map((row) =>
      `- ${t('반대 의견', 'Counter-evidence')}: “${row.quote}” (${PLATFORM_LABELS[row.platform] ?? row.platform}) ${row.url}`,
    ) : [t('- 이번 검색에서 반대 의견 원문을 찾지 못했습니다.', '- This search found no verified counter-quotes.')]),
    '',
    `**${t('판정', 'Verdict')}** — ${verdict[report.verdict.level]}. ${report.verdict.reason}`,
    '',
    `## ${t('항목별 판정', 'Checks by area')}`,
    ...report.checks.flatMap((row) => [
      `### ${row.label} · ${levels[row.level]}`,
      row.observation,
      `**${t('판정이 바뀌는 조건', 'What would change the result')}** ${row.change}`, '',
    ]),
    `## ${t('실제 원문', 'Source quotes')}`,
    ...(report.quotes.length ? report.quotes.map((row) => `- “${row.quote}” (${PLATFORM_LABELS[row.platform] ?? row.platform}) ${row.url}`) : [t('- 찾지 못했습니다.', '- The search found none.')]),
    '',
    `## ${t('이미 있는 도구', 'Existing tools')}`,
    ...(report.rivals.length ? report.rivals.map((row) => `- ${row.name} (${relation[row.relation]}) ${row.description} ${row.url}${thinListing(row.description)
      ? t(' — 공식 설명이 짧아 대상 사용자와 핵심 기능을 확인할 근거가 부족합니다. 제품 페이지를 직접 확인하세요.', ' — The listing is too short to confirm its users and core features. Check the product page.') : ''}`) : [t('- 비교할 만한 도구를 찾지 못했습니다.', '- The search found no comparable tools.')]),
    ...(report.gap ? [t(`- 제품 설명에 적힌 제약 예시: ${report.gap}`, `- Example of a limitation from a listing: ${report.gap}`)] : []),
    '',
    `## ${t('구현 규모 추정', 'Build size estimate')}`,
    report.build ? t(
      `- ${size[report.build.size]}, 약 ${report.build.days}일. 스택: ${report.build.stack.join(', ') || '미정'}. 막히기 쉬운 곳: ${report.build.hard.join(', ') || '미정'}`,
      `- ${size[report.build.size]}, about ${report.build.days} days. Stack: ${report.build.stack.join(', ') || 'undecided'}. Likely challenges: ${report.build.hard.join(', ') || 'unknown'}`,
    ) : t('- 규모를 추정하지 못했습니다.', '- A size estimate was unavailable.'),
    '',
    `## ${t('첫 사용자 후보', 'Potential first users')}`,
    ...(report.firstUsers.length ? report.firstUsers.map((row) => `- ${row.platform}: ${row.url}`) : [t('- 후보 글을 찾지 못했습니다.', '- The search found no candidate posts.')]),
    ...(report.related.length ? ['', `## ${t('비슷한 문제', 'Related problems')}`, ...report.related.map((row) => `- ${row.name} (${t(`원문 ${row.quotes}건`, `${row.quotes} quotes`)}) ${siteUrl}/opportunities/${row.slug}`)] : []),
    '',
    `## ${t('다음 실험', 'Next experiments')}`,
    ...(first ? [t('원문 작성자에게 보낼 답글 초안입니다. 원문을 읽고 직접 답해 보세요.', 'Read the original post and use this draft to reply yourself.'), '', `> ${discoveryReply(first.quote)}`, first.url, ''] : [t('후보 글을 찾으면 작성자에게 실제 사례를 물어보세요.', 'When you find a candidate post, ask its author for a concrete example.'), '']),
    `[${t('대기 신청 페이지 만들기', 'Create a waitlist page')}](${waitlist})`,
    '',
    `### ${t('인터뷰 질문', 'Interview questions')}`,
    t('1. 마지막으로 이 문제를 겪은 때를 순서대로 설명해 주실 수 있나요?', '1. Can you walk me through the last time you ran into this problem?'),
    t('2. 지금은 어떻게 해결하시고, 그 방법에서 불편한 점은 무엇인가요?', '2. What do you do today, and where does that approach let you down?'),
    t('3. 새 방법을 한 번 써 보려면 무엇을 먼저 확인하셔야 하나요?', '3. What would you need to see before trying a different approach?'),
    ...(direct.length ? [t(`4. ${direct[0].name}를 써 보셨나요? 그 도구로 안 되는 한 가지는 무엇인가요?`, `4. Have you tried ${direct[0].name}? What is the one thing it does not do for you?`)] : []),
    '',
    `### ${t('다음 단계로 갈 기준', 'When to move on')}`,
    ...nextStepCriteria(report, platforms, direct.map((row) => row.name), t),
  ].join('\n');
}
