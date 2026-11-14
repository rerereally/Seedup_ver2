import { PLATFORM_LABELS } from './types';
import type { Evidence, Opportunity, OpportunityPoint, OpportunityStatus } from './types';

// Everything here is computed from the stored run, with no model call, so the same data always reads the same way.

const DAY_MS = 86_400_000;
const RECENT_DAYS = 180;
const STATUS_GAP_POINTS: Record<OpportunityStatus, number> = { open: 20, narrowing: 10, unknown: 6, closed: 0 };
const STATUS_GAP_WORDS: Record<OpportunityStatus, string> = {
  open: '직접 경쟁 도구가 거의 없습니다',
  narrowing: '직접 경쟁 도구가 늘고 있습니다',
  unknown: '기존 도구를 아직 다 조사하지 못했습니다',
  closed: '이미 자리 잡은 도구가 있습니다',
};

export type ScorePart = { key: 'demand' | 'spread' | 'reaction' | 'recency' | 'gap'; label: string; points: number; max: number; reason: string };
export type OpportunityScore = { total: number; parts: ScorePart[] };

const daysBetween = (from: string, to: number) => Math.floor((to - new Date(from).getTime()) / DAY_MS);

/** A 100 point reading of one opportunity. Each part states the number it was computed from. */
export function scoreOpportunity(opportunity: Opportunity, now = Date.now()): OpportunityScore {
  const { evidence, platforms, status, directCount } = opportunity;
  const reactions = evidence.reduce((sum, item) => sum + Math.max(0, item.score), 0);
  const dated = evidence.filter((item) => item.postedAt);
  const recent = dated.filter((item) => daysBetween(item.postedAt as string, now) <= RECENT_DAYS).length;

  const parts: ScorePart[] = [
    { key: 'demand', label: '증언 수', max: 30, points: Math.round(Math.min(1, evidence.length / 6) * 30), reason: `서로 다른 글 ${evidence.length}건 (6건이면 만점)` },
    { key: 'spread', label: '플랫폼 폭', max: 20, points: [0, 5, 14][platforms.length] ?? 20, reason: `${platforms.length}종에서 확인 (3종이면 만점)` },
    { key: 'reaction', label: '반응', max: 15, points: Math.round(Math.min(1, Math.log10(1 + reactions) / 3) * 15), reason: `추천과 댓글 합계 ${reactions.toLocaleString('ko-KR')}` },
    { key: 'recency', label: '최근성', max: 15, points: dated.length ? Math.round((recent / dated.length) * 15) : 0, reason: dated.length ? `날짜가 있는 ${dated.length}건 중 ${recent}건이 최근 6개월` : '글 날짜를 알 수 없습니다' },
    { key: 'gap', label: '남은 빈틈', max: 20, points: STATUS_GAP_POINTS[status], reason: `${STATUS_GAP_WORDS[status]} (직접 경쟁 ${directCount}개)` },
  ];
  return { total: parts.reduce((sum, part) => sum + part.points, 0), parts };
}

export type TimelineEvent = { at: string; kind: 'voice' | 'tool'; label: string; detail: string; url: string };
export type WhyNow = { events: TimelineEvent[]; recentVoices: number; toolsAfterFirstVoice: number; headline: string };

/** Complaints and competing tools on one time axis, which is what shows whether the timing is early or late. */
export function whyNow(opportunity: Opportunity, now = Date.now()): WhyNow {
  const voices: TimelineEvent[] = opportunity.evidence.flatMap((item: Evidence) => (item.postedAt
    ? [{ at: item.postedAt, kind: 'voice' as const, label: `${PLATFORM_LABELS[item.platform]} 증언`, detail: item.quoteKo || item.quote, url: item.url }]
    : []));
  const tools: TimelineEvent[] = opportunity.supply.flatMap((item) => (item.createdAt
    ? [{ at: item.createdAt, kind: 'tool' as const, label: item.relation === 'direct' ? '직접 경쟁 도구 등장' : '일부 겹치는 도구 등장', detail: item.name.replace(/^Show HN:\s*/i, ''), url: item.url }]
    : []));
  const events = [...voices, ...tools].sort((a, b) => a.at.localeCompare(b.at));
  const first = voices.map((item) => item.at).sort()[0];
  const recentVoices = voices.filter((item) => daysBetween(item.at, now) <= 90).length;
  const toolsAfterFirstVoice = first ? tools.filter((item) => item.at > first).length : 0;

  let headline = '글 날짜가 없어 시점을 판단할 수 없습니다.';
  if (first) {
    if (recentVoices > 0 && toolsAfterFirstVoice === 0) headline = `최근 3개월에도 증언이 ${recentVoices}건 나왔고, 첫 증언 뒤에 나온 도구는 아직 없습니다.`;
    else if (recentVoices > 0) headline = `최근 3개월에도 증언이 ${recentVoices}건 나왔습니다. 첫 증언 뒤에 도구 ${toolsAfterFirstVoice}개가 나왔지만 불만은 이어지고 있습니다.`;
    else if (toolsAfterFirstVoice > 0) headline = `최근 3개월에는 새 증언이 없고, 첫 증언 뒤에 도구 ${toolsAfterFirstVoice}개가 나왔습니다. 이미 풀리고 있을 수 있습니다.`;
    else headline = '최근 3개월에는 새 증언이 없습니다. 지금도 겪는 문제인지 먼저 확인이 필요합니다.';
  }
  return { events, recentVoices, toolsAfterFirstVoice, headline };
}

export type TrackRecordRow = { slug: string; name: string; firstSeenAt: string; followers: Array<{ name: string; url: string; createdAt: string; leadDays: number }> };

/** Problems where a tool appeared only after the first complaint we hold. The record of the signal coming first. */
export function trackRecord(opportunities: Opportunity[]): TrackRecordRow[] {
  return opportunities.flatMap((item) => {
    const first = item.firstSeenAt;
    if (!first) return [];
    const followers = item.supply
      .filter((tool) => tool.relation !== 'unrelated' && tool.createdAt && tool.createdAt > first)
      .map((tool) => ({ name: tool.name.replace(/^Show HN:\s*/i, ''), url: tool.url, createdAt: tool.createdAt as string, leadDays: Math.max(1, daysBetween(first, new Date(tool.createdAt as string).getTime())) }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return followers.length ? [{ slug: item.slug, name: item.name, firstSeenAt: first, followers }] : [];
  }).sort((a, b) => b.followers.length - a.followers.length);
}

// Profile choices are product names, while opportunities are written in whatever words developers used.
const STACK_TERMS: Record<string, string[]> = {
  'React': ['react', 'jsx', 'frontend', '프론트엔드'],
  'Next.js': ['next.js', 'nextjs', 'vercel', 'frontend'],
  'TypeScript': ['typescript', 'javascript', 'npm', 'node'],
  'Node.js': ['node', 'nodejs', 'npm', 'javascript', 'backend', '백엔드'],
  'Python': ['python', 'pip', 'pypi', 'fastapi', 'django'],
  'FastAPI': ['fastapi', 'python', 'api', 'backend'],
  'Spring': ['spring', 'java', 'jvm', 'backend'],
  'Supabase': ['supabase', 'postgres', 'database', 'auth'],
  'PostgreSQL': ['postgres', 'postgresql', 'pgvector', 'sql', 'database', '데이터베이스', 'migration'],
  'Docker': ['docker', 'container', 'kubernetes', 'k8s', 'devops', '컨테이너'],
  'AWS': ['aws', 'cloud', 's3', 'lambda', 'terraform', '클라우드'],
  'Cloudflare': ['cloudflare', 'workers', 'edge', 'cdn'],
  'LLM API': ['llm', 'openai', 'anthropic', 'prompt', 'agent', 'mcp', 'rag', 'embedding', '프롬프트', '에이전트'],
};

export type StackFit = { matched: string[]; chosen: number; level: 'high' | 'some' | 'none' };

/** Which of the stacks the user picked in their profile show up in this opportunity's own words. */
export function stackFit(opportunity: Opportunity, stack: string[]): StackFit {
  const known = stack.filter((name) => STACK_TERMS[name]);
  const text = [opportunity.name, opportunity.problem, opportunity.gap, ...opportunity.keywords, ...opportunity.evidence.map((item) => item.quote), ...opportunity.supply.map((item) => `${item.name} ${item.description}`)].join(' ').toLowerCase();
  const words = new Set(text.split(/[^a-z0-9.가-힣+#]+/).filter(Boolean));
  const matched = known.filter((name) => STACK_TERMS[name].some((term) => (/[가-힣]/.test(term) ? text.includes(term) : words.has(term))));
  return { matched, chosen: known.length, level: matched.length >= 2 ? 'high' : matched.length === 1 ? 'some' : 'none' };
}

const KOREAN_PLACES: Array<{ name: string; note: string; url: (query: string) => string }> = [
  { name: 'GeekNews', note: '국내 개발자 뉴스와 댓글', url: (query) => `https://news.hada.io/search?q=${query}` },
  { name: 'OKKY', note: '질문과 실무 고민', url: (query) => `https://okky.kr/search?keyword=${query}` },
  { name: 'velog', note: '삽질 기록과 회고', url: (query) => `https://velog.io/search?q=${query}` },
  { name: '디스콰이엇', note: '국내 메이커가 만든 제품', url: (query) => `https://disquiet.io/search?keyword=${query}` },
];

export type KoreaLens = { query: string; places: Array<{ name: string; note: string; href: string }> };

/**
 * Evidence comes from English-language communities only, so the Korean market is not measured.
 * This gives the search words and the places to check it by hand, and says so on the page.
 */
export function koreaLens(opportunity: Opportunity): KoreaLens {
  // Korean posts name the technology in English and describe the trouble in Korean, so the search uses one of each.
  const korean = opportunity.keywords.find((word) => /[가-힣]/.test(word));
  const english = opportunity.keywords.find((word) => !/[가-힣]/.test(word));
  const query = [english, korean].filter(Boolean).join(' ') || opportunity.name;
  const encoded = encodeURIComponent(query);
  return { query, places: KOREAN_PLACES.map((place) => ({ name: place.name, note: place.note, href: place.url(encoded) })) };
}

export type DossierChange = { added: Evidence[]; removed: number; notes: string[] };

/** What happened to an opportunity after a dossier was saved from it, phrased as things to revise in the PRD. */
export function dossierChanges(savedEvidenceIds: string[], savedAt: string, opportunity: Opportunity, describe: (before: OpportunityPoint, after: OpportunityPoint) => string[]): DossierChange {
  const saved = new Set(savedEvidenceIds);
  const current = new Set(opportunity.evidence.map((item) => item.id));
  const added = opportunity.evidence.filter((item) => !saved.has(item.id));
  const removed = savedEvidenceIds.filter((id) => !current.has(id)).length;
  const history = opportunity.history ?? [];
  const before = [...history].reverse().find((entry) => entry.at <= savedAt) ?? history[0];
  const after = history[history.length - 1];
  const notes: string[] = [];
  if (added.length) notes.push(`저장한 뒤 증언 ${added.length}건이 새로 붙었습니다. 요구사항의 근거로 추가할 수 있는지 확인하세요.`);
  if (removed) notes.push(`저장한 증언 중 ${removed}건이 재검증에서 빠졌습니다. 그 증언에만 기대던 요구사항은 가설로 내리세요.`);
  if (before && after && before !== after) {
    const changes = describe(before, after).filter((line) => !line.startsWith('증언'));
    if (changes.length) notes.push(`저장한 뒤 달라진 점: ${changes.join(', ')}. 경쟁 도구와 하지 않을 것을 다시 보세요.`);
  }
  return { added, removed, notes };
}

export type TrackRecordSummary = { hits: number; total: number; rate: number; tools: number; medianLeadDays: number; maxLeadDays: number };

/**
 * The headline of the track record: how many opportunities saw a related tool appear only after the complaint,
 * and by how much the complaint came first (median of each opportunity's earliest follower).
 */
export function trackRecordSummary(rows: TrackRecordRow[], total: number): TrackRecordSummary {
  const leads = rows.map((row) => Math.min(...row.followers.map((tool) => tool.leadDays))).sort((a, b) => a - b);
  const middle = Math.floor(leads.length / 2);
  const median = !leads.length ? 0 : leads.length % 2 ? leads[middle] : Math.round((leads[middle - 1] + leads[middle]) / 2);
  return {
    hits: rows.length,
    total,
    rate: total ? Math.round((rows.length / total) * 100) : 0,
    tools: rows.reduce((sum, row) => sum + row.followers.length, 0),
    medianLeadDays: median,
    maxLeadDays: Math.max(0, ...rows.flatMap((row) => row.followers.map((tool) => tool.leadDays))),
  };
}
