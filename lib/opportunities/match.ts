export type Matchable = { slug: string; name: string; keywords: string[] };

// Words that describe almost every candidate, so they must not select one on their own.
const WEAK_TERMS = new Set(['ai', '에이전트', 'agent', 'agents', '코딩', 'coding', '개발', '도구', 'tool', 'tools', '서비스', '앱', '툴', '만들기', '위한', '관리']);

const isAscii = (value: string) => /^[\x00-\x7f]+$/.test(value);

export function queryTokens(query: string) {
  return query.toLowerCase().split(/\s+/).filter((token) => token && !/^[ㄱ-ㅎㅏ-ㅣ]+$/.test(token));
}

function tokenHits(item: Matchable, token: string) {
  if (item.name.toLowerCase().includes(token)) return true;
  if (WEAK_TERMS.has(token)) return false;
  return item.keywords.some((keyword) => {
    // Short Latin words such as "ci" need an exact match. Korean words carry particles, as in 규칙을.
    if (isAscii(keyword) && keyword.length < 3) return token === keyword;
    if (keyword.length >= 2 && token.includes(keyword)) return true;
    return (!isAscii(token) || token.length >= 2) && keyword.includes(token);
  });
}

/** Instant, local reaction while typing. Semantic matches replace this once they arrive. */
export function matchOpportunities(query: string, items: Matchable[]) {
  const tokens = queryTokens(query.trim());
  if (!tokens.length) return { active: false, tokens, slugs: [] as string[] };
  const scored = items.map((item) => ({ slug: item.slug, score: tokens.reduce((sum, token) => sum + (tokenHits(item, token) ? 1 : 0), 0) }));
  const best = Math.max(...scored.map((item) => item.score));
  return { active: true, tokens, slugs: best > 0 ? scored.filter((item) => item.score === best).map((item) => item.slug) : [] };
}

export function quoteMentions(tokens: string[], quote: string) {
  const text = quote.toLowerCase();
  return tokens.some((token) => token.length >= 2 && !WEAK_TERMS.has(token) && text.includes(token));
}

export function rankBySimilarity(scores: Array<{ slug: string; score: number }>, floor: number, band: number, limit: number) {
  const sorted = [...scores].sort((a, b) => b.score - a.score);
  const top = sorted[0]?.score ?? 0;
  if (top < floor) return [];
  return sorted.filter((item) => item.score >= top - band).slice(0, limit).map((item) => item.slug);
}
