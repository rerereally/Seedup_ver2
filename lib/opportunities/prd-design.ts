import { translator, type Lang } from '../i18n';

export type CompetitorExcerpt = { name: string; quote: string };
export type Differentiation = { claim: string; evidence: number[]; competitor?: CompetitorExcerpt };
export type TechnicalDesign = {
  architecture: string;
  dataModel: string[];
  interfaces: string[];
  stack: string[];
  milestones: Array<{ title: string; featureIds: string[] }>;
};

const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
const list = (value: unknown, max: number) => Array.isArray(value) ? value.slice(0, max) : [];
const record = (value: unknown) => (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;

export function competitorListings(notes: readonly string[]) {
  return notes.flatMap((note) => {
    const split = note.indexOf(': ');
    const name = split > 0 ? note.slice(0, split).trim() : '';
    const description = split > 0 ? note.slice(split + 2).trim() : '';
    return name && description ? [{ name, description }] : [];
  });
}

export function listingQuote(value: unknown, description: string) {
  const quote = text(value, 400);
  return quote.length >= 8 && description.replace(/\s+/g, ' ').includes(quote) ? quote : '';
}

export function normalizeDifferentiation(value: unknown, evidenceCount: number, notes: readonly string[] = []): Differentiation | undefined {
  const raw = record(value);
  const claim = text(raw.claim, 280).split(/(?<=[.!?。！？])\s+/u, 1)[0];
  if (!claim) return undefined;
  const evidence = [...new Set(list(raw.evidence, 12).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= evidenceCount))];
  const excerpt = record(raw.competitor);
  const name = text(excerpt.name, 160);
  const quote = text(excerpt.quote, 400);
  const listing = competitorListings(notes).find((row) => row.name.toLowerCase() === name.toLowerCase() && listingQuote(quote, row.description));
  if (!evidence.length && !listing) return undefined;
  return { claim, evidence, ...(listing ? { competitor: { name: listing.name, quote } } : {}) };
}

export function normalizeTechnicalDesign(value: unknown, featureIds: ReadonlyMap<string, string>): TechnicalDesign | undefined {
  const raw = record(value);
  const rows = (value: unknown) => list(value, 8).map((line) => text(line, 360)).filter(Boolean);
  const design: TechnicalDesign = {
    architecture: text(raw.architecture, 1_200),
    dataModel: rows(raw.dataModel),
    interfaces: rows(raw.interfaces),
    stack: rows(raw.stack),
    milestones: list(raw.milestones, 5).flatMap((entry) => {
      const row = record(entry);
      const title = text(row.title, 240);
      const ids = [...new Set(list(row.featureIds, 10).flatMap((ref) => featureIds.get(String(ref)) ?? []))];
      return title && ids.length ? [{ title, featureIds: ids }] : [];
    }),
  };
  return design.architecture || design.dataModel.length || design.interfaces.length || design.stack.length || design.milestones.length ? design : undefined;
}

export function technicalSections(design: TechnicalDesign, lang: Lang) {
  const t = translator(lang);
  return [
    { title: t('구조', 'Architecture'), lines: design.architecture ? [design.architecture] : [], paragraph: true },
    { title: t('데이터 모델', 'Data model'), lines: design.dataModel },
    { title: t('인터페이스', 'Interfaces'), lines: design.interfaces },
    { title: t('스택과 이유', 'Stack and rationale'), lines: design.stack },
    { title: t('구현 순서', 'Implementation order'), lines: design.milestones.map((row) => `${row.title} (${row.featureIds.join(', ')})`), ordered: true },
  ].filter(({ lines }) => lines.length);
}

export function renderTechnicalDesign(design: TechnicalDesign, lang: Lang) {
  return technicalSections(design, lang).map(({ title, lines, paragraph, ordered }) =>
    `### ${title}\n${lines.map((line, index) => paragraph ? line : ordered ? `${index + 1}. ${line}` : `- ${line}`).join('\n')}`).join('\n\n');
}
