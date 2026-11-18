import { getContentHref } from './content-targets';
import { cached } from './cache';
import { createEmbedding } from './opportunities/llm';
import { cosineSimilarity } from './opportunities/rules';
import type { Opportunity } from './opportunities/types';
import { createAdminClient } from './supabase/admin';

export type ForYouItem = { key: string; kind: string; title: string; href: string; source: string; reason: string; score: number };

const TABLE_KIND: Record<string, [string, string]> = {
  news_items: ['news', '글'],
  research_papers: ['paper', '논문'],
  github_trends: ['github', '저장소'],
  ai_products: ['ai_product', 'AI 제품'],
  project_ideas: ['project', '프로젝트 아이디어'],
};

// Text embeddings of a short interest list sit lower against long documents than an idea does, so the floor is lower.
const MIN_SIMILARITY = 0.3;
// Problem vectors come from a short name and keyword list, which lands lower still (about 0.2 to 0.3 when related).
const MIN_PROBLEM_SIMILARITY = 0.2;
const SKIP_ANSWERS = /잘 모르겠음|아직|없음/;

/** The words a person gave us about themselves: onboarding answers first, then what they kept and planned. */
export function interestTokens(answers: unknown) {
  const record = (answers ?? {}) as Record<string, unknown>;
  return ['interests', 'preferred_stack', 'preferred_roles', 'goals']
    .flatMap((key) => [record[key]].flat())
    .map((value) => String(value ?? '').split(':')[0].trim())
    .filter((value) => value && !SKIP_ANSWERS.test(value));
}

export function profileText(answers: unknown, keptTitles: string[], planTitles: string[]) {
  const interests = interestTokens(answers);
  const lines = [
    interests.length ? `관심: ${interests.join(', ')}` : '',
    planTitles.length ? `만들고 있는 것: ${planTitles.slice(0, 5).join(', ')}` : '',
    keptTitles.length ? `킵한 것: ${keptTitles.slice(0, 10).join(', ')}` : '',
  ].filter(Boolean);
  return lines.join('\n');
}

/** Why one item is here, in words the person recognises: an interest it mentions, else the kind of thing it resembles. */
export function reasonFor(text: string, interests: string[], hasKept: boolean) {
  const lower = text.toLowerCase();
  // "AI/LLM" matches on either part; short Latin words need a word boundary so "ai" does not match "maintain".
  const mentions = (part: string) => (/^[a-z0-9.+#-]{1,3}$/.test(part) ? new RegExp(`\\b${part.replace(/[.+#-]/g, '\\$&')}\\b`).test(lower) : part.length >= 2 && lower.includes(part));
  const hit = interests.find((word) => word.toLowerCase().split('/').some((part) => mentions(part.trim())));
  if (hit) return `관심 분야 ${hit}`;
  return hasKept ? '킵한 것과 비슷함' : '관심사와 가까움';
}

/**
 * Takes the best of each kind in turn, so one kind with many close items (often repos) cannot fill the whole list.
 * Within a round, the kind whose best item is closer goes first.
 */
export function mixByKind(items: ForYouItem[], limit: number) {
  const groups = new Map<string, ForYouItem[]>();
  for (const item of [...items].sort((a, b) => b.score - a.score)) groups.set(item.kind, [...(groups.get(item.kind) ?? []), item]);
  const out: ForYouItem[] = [];
  for (let round = 0; out.length < limit && [...groups.values()].some((group) => group.length > round); round += 1) {
    const heads = [...groups.values()].flatMap((group) => (group[round] ? [group[round]] : [])).sort((a, b) => b.score - a.score);
    out.push(...heads.slice(0, limit - out.length));
  }
  return out;
}

/**
 * A mixed "for you" list: problems to build, reads, repos and products, ranked by how close each is to the person's
 * own words. Nothing to go on (no onboarding, nothing kept, no plans) returns an empty list and the page asks instead.
 */
export async function forYou(userId: string, input: { answers: unknown; keptTitles: string[]; keptKeys: Set<string>; planTitles: string[]; opportunities: Opportunity[]; opportunityEmbeddings: Record<string, number[]> }, limit = 8): Promise<ForYouItem[]> {
  const text = profileText(input.answers, input.keptTitles, input.planTitles);
  if (!text) return [];
  // One embedding per person and profile, reused for an hour; the profile text is the cache key so a change re-embeds.
  // A failed call throws so the cache keeps nothing and the next visit tries again.
  const vector = await cached(`for-you:${userId}:${text}`, async () => {
    const embedding = await createEmbedding(text, { timeoutMs: 8_000 });
    if (!embedding) throw new Error('no embedding');
    return embedding;
  }, 60 * 60_000).catch(() => null);
  if (!vector) return [];
  const interests = interestTokens(input.answers);
  const hasKept = input.keptTitles.length > 0;

  const problems: ForYouItem[] = input.opportunities.flatMap((item) => {
    const embedding = input.opportunityEmbeddings[item.slug];
    if (!embedding) return [];
    const score = cosineSimilarity(vector, embedding);
    return score >= MIN_PROBLEM_SIMILARITY ? [{ key: `opportunity:${item.slug}`, kind: '만들 문제', title: item.name, href: `/opportunities/${item.slug}`, source: item.qualified ? '검증된 문제' : '원문 모으는 중', reason: reasonFor(`${item.name} ${item.problem} ${item.keywords.join(' ')}`, interests, hasKept), score: score + (item.qualified ? 0.03 : 0) }] : [];
  });

  const service = createAdminClient();
  const { data } = service ? await service.rpc('match_seedup_content', { query_embedding: vector, match_count: 50, min_similarity: MIN_SIMILARITY }) : { data: null };
  const seen = new Set<string>();
  const content: ForYouItem[] = ((data ?? []) as Array<{ source_table: string; source_id: string; content: string; metadata: Record<string, unknown> | null; similarity: number }>).flatMap((row) => {
    const [itemType, label] = TABLE_KIND[row.source_table] ?? [];
    const key = `${itemType}:${row.source_id}`;
    // A source can have several embeddings after its text changed; kept items are already on the desk.
    if (!itemType || seen.has(key) || input.keptKeys.has(key)) return [];
    seen.add(key);
    const title = String(row.metadata?.title ?? '').trim();
    if (!title) return [];
    return [{ key, kind: label, title, href: getContentHref(itemType, row.source_id), source: String(row.metadata?.source ?? ''), reason: reasonFor(row.content, interests, hasKept), score: Number(row.similarity) }];
  });

  return mixByKind([...problems, ...content], limit);
}
