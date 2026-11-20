import { translator, type Lang } from '../i18n';
import { matchOpportunities, type Matchable } from './match';
import { competitorListings } from './prd-design';
import type { Evidence } from './types';

type Quote = Pick<Evidence, 'platform' | 'quote' | 'quoteKo' | 'url'>;
type Answer = { key?: string; question: string; answer: string };
export type Pushback = {
  kind: 'audience' | 'existing' | 'unsupported' | 'scope';
  claim: string;
  evidence: number[];
  competitor?: string;
};

export type DirectionSource = Matchable & { gap: string; problem: string; evidenceCount: number; directCount: number };

const STOP = new Set(['the', 'and', 'with', 'for', 'by', 'of', 'from', 'to', 'about', 'before', 'after', 'my', 'our', 'your', 'users', 'user', 'first', 'version', 'provide', 'support', 'allow', 'want', 'need', 'wanting', 'use', 'can', 'able', 'tool', 'app', '위해', '위한', '사용자', '첫', '버전', '기능', '지원', '제공', '합니다', '하는', '있도록', '도구']);
const token = (word: string) => /^[a-z]{4,}s$/.test(word) ? word.slice(0, -1) : word.replace(/(?:해요|합니다|하기|에게|에서|까지|으로|은|는|이|가|을|를|에|도|와|과)$/u, (suffix) => word.length - suffix.length >= 2 ? '' : suffix);
const terms = (text: string) => (text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((word) => !STOP.has(word)).map(token).filter((word) => word.length >= 2 && !STOP.has(word));
const words = (text: string) => new Set(terms(text));
const overlap = (left: Set<string>, right: Set<string>) => [...left].filter((word) => right.has(word)).length;

/** Used for a matching requirement and the same claim reworded slightly in the PRD. */
export function refersToClaim(claim: string, candidate: string) {
  const needed = words(claim);
  return needed.size > 0 && overlap(needed, words(candidate)) >= Math.ceil(needed.size * 0.8);
}

const AUDIENCES: RegExp[] = [
  /\b(?:sre|site reliability engineers?)\b|사이트 신뢰성 엔지니어/i,
  /\b(?:back[- ]?end developers?|back[- ]?end engineers?|server engineers?)\b|백엔드 개발자|서버 개발자/i,
  /\b(?:front[- ]?end developers?|front[- ]?end engineers?)\b|프론트엔드 개발자/i,
  /\b(?:graphic |product )?designers?\b|디자이너/i,
  /\bmarketers?\b|마케터/i,
  /\b(?:accountants?|bookkeepers?)\b|회계 담당자|회계사/i,
  /\b(?:university |college )?students?\b|대학생|\bundergraduates?\b|학생/i,
  /\b(?:solo|indie) developers?\b|1인 개발자/i,
  /\b(?:open[- ]source (?:maintainers?|contributors?)|repository maintainers?)\b|오픈소스 유지(?:관리|보수)자/i,
];
const AUDIENCE_ANSWER = /^(?:users?|audience|target(?:_users?)?|first_team|first_users?|who)$|대상 사용자|누가|먼저 쓸|먼저 쓰|who (?:uses|will use|are)|which team.*first/i;
const FEATURE_ANSWER = /^(?:must|features?|must_have|first_feature|mvp|scope)$|어떤 기능|꼭 .*(?:기능|해야)|첫 버전.*(?:기능|무엇)|\b(?:must-have|first feature|what must|which feature)\b/i;
const UNSURE = /^(?:잘 모르겠|모르겠|아직 모르|not sure\b|i (?:am unsure|don['’]t know)\b)/i;
const FIRST_PERSON = /(?:^\s*as|\b(?:i am|i['’]m|i work as|we are|we['’]re|our team is))\s+(?:(?:a|an|the)\s+)?|(?:저는|나는|우리는|저희는|우리 팀은|저희 팀은)\s*/i;
const DENIAL = /\b(?:not|no|cannot|can['’]t|without|won['’]t|planned|upcoming)\b|없습니다|않습니다|미지원|예정/u;
const CAPABILITY = /\b(?:support\w*|allow\w*|can|lets?|export\w*|send\w*|generat\w*|sync\w*|import\w*|creat\w*|schedul\w*|filter\w*|convert\w*|show\w*)\b|제공|지원|내보내|내보냅|동기화|전송|생성|예약|변환/i;
const stripCitations = (value: string) => value.replace(/[[(]\s*E\s*-?\s*\d[^\])]*[\])]/gi, '');
const cleanClaim = (claim: string) => stripCitations(claim).replace(/\s+/g, ' ').trim();
const featureList = (text: string) => stripCitations(text).split(/[\n,;；、]+/u).map((item) => item.replace(/^\s*(?:[-*•]|\d+[.)])\s*/u, '').replace(/\s+/g, ' ').trim()).filter((item) => terms(item).length >= 2 && !DENIAL.test(item.toLowerCase()));

/** Only explicit roles/listings or the kept quote set can substantiate a finding. Absence is scoped to that set. */
export function assessPushback(idea: string, answers: readonly Answer[], evidence: readonly Quote[], competitorNotes: readonly string[]): Pushback[] {
  const quotes = evidence.flatMap((row, index) => row.platform !== 'own' && row.url && row.quote.trim()
    ? [{ number: index + 1, text: `${row.quote} ${row.quoteKo}`, words: words(`${row.quote} ${row.quoteKo}`), url: row.url }] : []);
  const listings = competitorListings(competitorNotes);
  const explicit = answers.filter((row) => row.answer.trim() && !UNSURE.test(row.answer.trim()));
  const results: Pushback[] = [];
  const audience = cleanClaim(explicit.find((row) => AUDIENCE_ANSWER.test(row.key ?? '') || AUDIENCE_ANSWER.test(row.question))?.answer
    || idea.match(/\b(?:for|aimed at)\s+([^,.!?]+)/i)?.[1]
    || idea.match(/([가-힣0-9 ]{2,36})(?:를 위한|을 위한|용)/u)?.[1] || '');
  const pickedRoles = AUDIENCES.filter((role) => role.test(audience));
  if (pickedRoles.length === 1) {
    const authors = quotes.flatMap((quote) => {
      const role = quote.text.split(/(?<=[.!?])\s+/u).flatMap((sentence) => {
        const start = FIRST_PERSON.exec(sentence);
        const description = start ? sentence.slice(start.index + start[0].length) : '';
        return AUDIENCES.filter((pattern) => pattern.exec(description)?.index === 0);
      });
      return role.length ? [{ quote, role }] : [];
    });
    if (authors.length && authors.every(({ role }) => !role.includes(pickedRoles[0]))) {
      results.push({ kind: 'audience', claim: audience, evidence: authors.slice(0, 3).map(({ quote }) => quote.number) });
    }
  }

  const featureAnswers = explicit.filter((row) => FEATURE_ANSWER.test(row.key ?? '') || FEATURE_ANSWER.test(row.question));
  const firstCapability = idea.match(/\b(?:to|that)\s+((?:export|send|generate|sync|import|create|schedule|filter|convert|show)\w*\s+[^.!?]{3,90})/i)?.[1]
    ?? idea.match(/((?:[\p{L}\p{N}]+\s+){1,3}(?:내보내기|동기화|전송|변환|예약))/u)?.[1] ?? '';
  const features = [...new Set(featureAnswers.length ? featureAnswers.flatMap((row) => featureList(row.answer)) : featureList(firstCapability))].slice(0, 10);
  const ideaWords = words(idea);
  for (const word of words(audience)) ideaWords.delete(word);
  // Give each relevant post its own pain before flagging a large scope.
  const posts = new Map(quotes.filter((quote) => overlap(ideaWords, quote.words) >= 2 || features.some((feature) => overlap(words(feature), quote.words) >= 2)).map((quote) => [quote.url, quote]));
  if (posts.size && features.length >= posts.size * 2 + 1) {
    results.push({ kind: 'scope', claim: features.join(', ').slice(0, 400), evidence: [...posts.values()].slice(0, 3).map((quote) => quote.number) });
  }

  for (const feature of features) {
    const phrase = terms(feature).join(' ');
    const listing = listings.find((row) => row.description.split(/(?<=[.!?])\s+/u).some((sentence) =>
      CAPABILITY.test(sentence) && !DENIAL.test(sentence.toLowerCase()) && ` ${terms(sentence).join(' ')} `.includes(` ${phrase} `)));
    if (listing) {
      results.push({ kind: 'existing', claim: feature, evidence: [], competitor: listing.name });
      continue;
    }
    // A related post can anchor a missing capability; a wholly unrelated post cannot support a warning.
    const needed = words(feature);
    const ranked = quotes.map((quote) => ({ quote, same: overlap(needed, quote.words), topic: overlap(ideaWords, quote.words) }))
      .sort((a, b) => b.same - a.same || b.topic - a.topic);
    const closest = ranked[0];
    if (closest && closest.same < Math.ceil(needed.size * 0.8) && (closest.same || closest.topic >= 2)) {
      results.push({ kind: 'unsupported', claim: feature, evidence: [closest.quote.number] });
    }
  }
  return results.slice(0, 6);
}

export function suggestDirections<T extends DirectionSource>(idea: string, pool: readonly T[], matched: readonly string[]) {
  const available = pool.filter((item) => item.evidenceCount > 0 && (item.gap || item.problem));
  const close = available.filter((item) => matched.includes(item.slug) && item.gap);
  const suggestions = close.slice(0, 3);
  const topic = words(idea);
  const remaining = available.filter((item) => !matched.includes(item.slug) && overlap(topic, words(`${item.name} ${item.problem} ${item.keywords.join(' ')}`)) >= 2);
  while (suggestions.length < 3 && remaining.length) {
    const slugs = matchOpportunities(idea, remaining).slugs;
    const index = remaining.findIndex((item) => slugs.includes(item.slug));
    if (index < 0) break;
    suggestions.push(remaining.splice(index, 1)[0]);
  }
  return suggestions.map((item) => ({ ...item, direction: matched.includes(item.slug) ? item.gap : item.problem }));
}

export function pushbackText(row: Pushback, lang: Lang) {
  const t = translator(lang);
  const message = {
    audience: t(`“${row.claim}”와 담은 원문 작성자가 밝힌 역할이 다릅니다.`, `The authors identify a different role from “${row.claim}”.`),
    existing: t(`${row.competitor} 설명에 “${row.claim}” 기능이 이미 나옵니다.`, `${row.competitor} already lists “${row.claim}”.`),
    unsupported: t(`“${row.claim}” 기능을 담은 원문에서 확인하지 못했습니다.`, `The kept quotes do not establish “${row.claim}”.`),
    scope: t(`첫 버전의 기능 범위(“${row.claim}”)가 담은 원문에서 확인한 불편의 범위보다 넓습니다.`, `The first release (“${row.claim}”) covers more than the pains in the kept quotes.`),
  }[row.kind];
  return row.evidence.length ? `${message} [${row.evidence.map((n) => `E-${n}`).join(', ')}]` : message;
}
