import type { Lang } from '../i18n';
import { competitorListings } from './prd-design';
import { listingLimitation } from './report-checks';
import type { SpecInput, SpecRival } from './spec';

const oneLine = (value: string) => value.trim().replace(/\s+/g, ' ');

/** Any factual limitation in a PRD must come from the named competitor's own listing. */
export function groundRivalComparisons(
  rivals: readonly SpecRival[],
  input: Pick<SpecInput, 'competitors' | 'competitorNotes'>,
  lang: Lang = 'ko',
): SpecRival[] {
  const listings = competitorListings(input.competitorNotes ?? []);
  const unknown = lang === 'en'
    ? 'Not compared yet: decide what this product does that this tool does not.'
    : '아직 비교하지 않았습니다. 이 도구와 무엇이 다른지 정해야 합니다.';
  const names = new Map(input.competitors.map((name) => [name.toLowerCase(), name]));

  return [...names].map(([key, name]) => {
    const listing = listings.find((row) => row.name.toLowerCase() === key);
    const excerpt = listing ? listingLimitation(listing) : '';
    const limitation = /\b(?:not|the)\s+only\b/i.test(excerpt) ? '' : excerpt;
    const proposed = rivals.find((row) => row.name.toLowerCase() === key);
    return {
      name,
      misses: limitation || unknown,
      answer: limitation && proposed && oneLine(proposed.misses) === oneLine(limitation) ? proposed.answer : '',
    };
  });
}
