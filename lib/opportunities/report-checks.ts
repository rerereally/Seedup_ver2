import { translator, type Lang } from '../i18n';
import { isCutOffEvidenceQuote } from './quote-completeness';
import { isPromotion, meetsEvidenceBar } from './rules';
import type { BuildEstimate, Evidence, RawSignal, SupplyItem } from './types';
import { safeSourceUrl } from './web';

export const CROWDED_AT = 3;
const WINDOW_MS = 90 * 86_400_000;
const MIN_CONTACTS = 5;
const COMMON = new Set(['the', 'for', 'and', 'with', 'from', 'need', 'missing', 'cannot', 'when', 'how', 'not', 'tool', 'tools', 'app', 'software', 'platform', 'solution', 'alternative', 'existing', '있는', '하는', '만드는', '도구', '서비스', '위한', '관련']);
const terms = (text: string) => new Set((text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []).filter((word) => !COMMON.has(word)));

function termGroups(phrases: string[]) {
  return phrases.map(terms).filter((group) => group.size >= 2);
}

const overlap = (group: Set<string>, words: Set<string>) => [...group].filter((term) => words.has(term)).length;
const OPPOSITION = /\b(?:no need|(?:do not|don't|don’t|does not|doesn't|doesn’t) need|not (?:needed|necessary|worth)|already (?:use|using|do|does|works?(?: for us)?)|works fine without)\b|필요\s*(?:없|하지 않)|이미\s+.+(?:쓰고|사용)/iu;
const LIMITATION = /\b(?:only|limited to|does not support|doesn't support|no support for|unsupported)\b|만 지원|지원하지 않|미지원/iu;
const sentences = (text: string) => text.split(/(?:\r?\n)+|(?<=[.!?。])\s+/u).map((line) => line.trim());

const sentenceSegmenter = new Intl.Segmenter('en', { granularity: 'sentence' });

function isCompleteEvidenceQuote(quote: string) {
  const text = quote.trim();
  return text.length >= 15 && !isCutOffEvidenceQuote(text) && /[.!?。！？]["'”’»）)\]}]*$/u.test(text);
}

export function isWholeSourceQuote(quote: string, source: string) {
  if (!isCompleteEvidenceQuote(quote)) return false;
  const segments = sentenceSegmenter.segment(source);
  for (const { index, segment } of segments) {
    const start = index + segment.length - segment.trimStart().length;
    if (!source.startsWith(quote, start)) continue;
    const end = start + quote.length;
    const last = segments.containing(end - 1);
    if (last && last.index + last.segment.trimEnd().length === end) return true;
  }
  return false;
}

export function compareRivalListings(phrases: string[], found: Array<Omit<SupplyItem, 'relation'>>): SupplyItem[] {
  const groups = termGroups(phrases);
  return found.flatMap((item): SupplyItem[] => {
    const words = terms(`${item.name} ${item.description}`);
    const direct = groups.some((group) => {
      if (overlap(group, words) !== group.size) return false;
      return !sentences(item.description).some((line) => LIMITATION.test(line) && overlap(group, terms(line)) === group.size);
    });
    return direct || groups.some((group) => overlap(group, words) >= 2)
      ? [{ ...item, relation: direct ? 'direct' : 'partial' }]
      : [];
  }).sort((a, b) => a.relation === b.relation ? b.popularity - a.popularity : a.relation === 'direct' ? -1 : 1);
}

export type CounterQuote = Pick<Evidence, 'platform' | 'quote' | 'url'>;

export function counterQuotesFrom(phrases: string[], posts: Array<Omit<RawSignal, 'id' | 'actor'>>): CounterQuote[] {
  const groups = termGroups(phrases);
  const found = new Map<string, CounterQuote>();
  for (const post of posts) {
    const url = safeSourceUrl(post.url);
    if (!url || found.has(url.href) || isPromotion(post)) continue;
    const quote = [post.title, post.text]
      .flatMap((source) => Array.from(sentenceSegmenter.segment(source), ({ segment }) => segment.trim()))
      .find((line) => {
        if (line.length < 16 || line.length > 280 || !isCompleteEvidenceQuote(line) || !OPPOSITION.test(line)) return false;
        const quoteWords = terms(line);
        const contextualWords = terms(`${post.title} ${line}`);
        return groups.some((group) => overlap(group, quoteWords) > 0 && overlap(group, contextualWords) >= 2);
      });
    if (quote) found.set(url.href, { platform: post.platform, url: url.href, quote });
    if (found.size >= 4) break;
  }
  return [...found.values()];
}

export type ReportCheck = {
  id: 'demand' | 'supply' | 'timing' | 'reach' | 'fit';
  label: string;
  level: 'supported' | 'caution' | 'unclear';
  observation: string;
  change: string;
};

export function listingLimitation(rival: Pick<SupplyItem, 'description'>) {
  return sentences(rival.description).find((line) => LIMITATION.test(line)) ?? '';
}

export function validationChecks(input: {
  quotes: Evidence[];
  rivals: SupplyItem[];
  candidateCount: number;
  firstUsers: Array<{ url: string }>;
  build: BuildEstimate | null;
  stack: string[];
  now: number;
  lang?: Lang;
}): ReportCheck[] {
  const t = translator(input.lang ?? 'ko');
  const distinct = [...new Map(input.quotes.map((row) => [row.url, row])).values()];
  const platforms = new Set(distinct.map((row) => row.platform)).size;
  const ages = distinct.map((row) => row.postedAt ? input.now - Date.parse(row.postedAt) : NaN).filter((age) => age >= 0);
  const recent = ages.filter((age) => age < WINDOW_MS).length;
  const previous = ages.filter((age) => age >= WINDOW_MS && age < 2 * WINDOW_MS).length;
  const direct = input.rivals.filter((row) => row.relation === 'direct').length;
  const limitations = input.rivals.filter((row) => listingLimitation(row)).length;
  const people = new Set(input.firstUsers.map((row) => row.url)).size;
  const stackKey = (text: string) => text.toLowerCase().replace(/[\s.-]/g, '');
  const suggested = new Set(input.build?.stack.map(stackKey));
  const commonStack = input.stack.filter((row) => suggested.has(stackKey(row)));
  const scope = input.build?.size;
  const stackNames = commonStack.join(', ');
  const scopeLabel = scope === 'weekend' ? t('주말 프로젝트', 'weekend project') : scope === 'weeks' ? t('몇 주', 'several weeks') : t('팀 필요', 'team-sized');
  return [
    {
      id: 'demand', label: t('수요', 'Demand'),
      level: recent && meetsEvidenceBar(distinct.length, platforms) ? 'supported' : distinct.length ? 'caution' : 'unclear',
      observation: t(`원문 ${distinct.length}건, 플랫폼 ${platforms}곳, 최근 90일 ${recent}건입니다.`, `${distinct.length} quotes, ${platforms} platforms, and ${recent} quotes in the last 90 days.`),
      change: t('원문 3건과 플랫폼 2곳을 채우고 최근 90일 원문이 1건 이상이면 수요를 확인한 것으로 봅니다.', 'Demand is supported with 3 quotes across 2 platforms, including at least 1 from the last 90 days.'),
    },
    {
      id: 'supply', label: t('공급', 'Supply'),
      level: !input.candidateCount ? 'unclear' : direct >= CROWDED_AT ? 'caution' : limitations > 0 || direct === 0 ? 'supported' : 'unclear',
      observation: t(`비교 후보 ${input.candidateCount}개 중 직접 경쟁 ${direct}개, 설명에 제약이 적힌 도구 ${limitations}개입니다.`, `${input.candidateCount} candidates, ${direct} direct rivals, and ${limitations} tools with a limitation in their listing.`),
      change: t('직접 경쟁이 3개면 주의로 바뀝니다. 3개 미만이면 직접 경쟁이 없거나 기존 도구의 제약을 확인할 때 여지가 있다고 봅니다.', 'Three direct rivals trigger caution. Below three, a documented constraint or no direct matches supports room to explore.'),
    },
    {
      id: 'timing', label: t('타이밍', 'Timing'),
      level: recent >= 2 && recent > previous ? 'supported' : recent + previous >= 2 ? 'caution' : 'unclear',
      observation: t(`날짜가 있는 원문은 최근 90일 ${recent}건, 앞선 90일 ${previous}건입니다.`, `Dated quotes in the last 90 days: ${recent}. In the preceding 90 days: ${previous}.`),
      change: t('최근 90일 원문이 2건 이상이고 앞선 90일보다 많으면 증가 신호로 봅니다.', 'A recent count of at least 2 that exceeds the previous 90 days indicates growth in this sample.'),
    },
    {
      id: 'reach', label: t('도달', 'Reach'),
      level: people >= MIN_CONTACTS ? 'supported' : people ? 'caution' : 'unclear',
      observation: t(`대화를 시작할 첫 사용자 후보 글이 ${people}건입니다.`, `${people} distinct posts could start a conversation with potential first users.`),
      change: t('서로 다른 후보 글이 5건이면 첫 인터뷰를 시작할 수 있다고 봅니다.', 'Five distinct candidate posts support starting the first interviews.'),
    },
    {
      id: 'fit', label: t('실행 적합', 'Build fit'),
      level: scope === 'team' ? 'caution' : !scope || !input.stack.length ? 'unclear' : commonStack.length ? 'supported' : 'caution',
      observation: scope ? t(`규모 추정은 ${scopeLabel}입니다. 선호 스택과 겹치는 기술은 ${stackNames || '확인되지 않았습니다'}${stackNames ? '입니다.' : '.'}`, `Estimated scope: ${scopeLabel}. Preferred stack overlap: ${stackNames || 'unknown or none'}.`)
        : t('구현 규모를 추정하지 못했습니다.', 'A build size estimate was unavailable.'),
      change: t('몇 주 이내로 줄이고 선호 기술이 하나 이상 겹치면 적합으로 바뀝니다.', 'Scope of several weeks or less and at least one preferred technology support a fit.'),
    },
  ];
}
