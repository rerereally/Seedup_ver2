import { createHash } from 'node:crypto';
import { translator, type Lang } from '../i18n';
import { toolAppearedAfter, trackRecord, trackRecordSummary } from './insight';
import type { Opportunity } from './types';

type Prediction = Readonly<{
  slug: string;
  name: string;
  claim: string;
  withinDays: number;
  evidenceCount: number;
  platformCount: number;
  directCount: number;
  sealedAt: string;
}>;

export type SealedPrediction = Prediction & Readonly<{ hash: string }>;
export type PredictionStatus = 'pending' | 'hit' | 'miss';

export function hashPrediction({ slug, name, claim, withinDays, evidenceCount, platformCount, directCount, sealedAt }: Prediction) {
  const canonical = JSON.stringify({ slug, name, claim, withinDays, evidenceCount, platformCount, directCount, sealedAt });
  return createHash('sha256').update(canonical, 'utf8').digest('hex');
}

export function sealPredictions(opportunities: readonly Opportunity[], now: number): SealedPrediction[] {
  const { medianLeadDays: withinDays } = trackRecordSummary(trackRecord(opportunities, now), opportunities.length);
  const sealedAt = new Date(now).toISOString();

  return opportunities.filter((item) => item.qualified).map((item) => {
    const prediction = {
      slug: item.slug,
      name: item.name,
      claim: `A direct tool appears within ${withinDays} days`,
      withinDays,
      evidenceCount: item.evidence.length,
      platformCount: item.platforms.length,
      directCount: item.directCount,
      sealedAt,
    };
    return { ...prediction, hash: hashPrediction(prediction) };
  });
}

export function scorePredictions(sealed: readonly SealedPrediction[], opportunities: readonly Opportunity[], now: number) {
  const bySlug = new Map(opportunities.map((item) => [item.slug, item]));
  return sealed.map((prediction) => {
    const sealedAt = Date.parse(prediction.sealedAt);
    const deadline = sealedAt + prediction.withinDays * 86_400_000;
    const through = Math.min(now, deadline);
    const opportunity = bySlug.get(prediction.slug);
    const hit = opportunity?.supply.some((tool) => tool.relation === 'direct' && toolAppearedAfter(tool, sealedAt, through));
    const status: PredictionStatus = hit ? 'hit' : opportunity && now >= deadline ? 'miss' : 'pending';
    return { ...prediction, status };
  });
}

export function predictionRecord(sealed: readonly SealedPrediction[], opportunities: readonly Opportunity[], asOf: number) {
  const bySlug = new Map(opportunities.map((item) => [item.slug, item]));
  return scorePredictions(sealed, opportunities, asOf).map((row) => {
    const start = Date.parse(row.sealedAt);
    const opportunity = bySlug.get(row.slug);
    const observed = asOf >= start ? opportunity : undefined;
    const statusAtSeal = opportunity?.history?.findLast((point) => Date.parse(point.at) <= start)?.status ?? null;
    const newDirect = observed?.supply.filter((tool) => tool.relation === 'direct' && toolAppearedAfter(tool, start, asOf)) ?? [];
    return {
      ...row,
      deadline: start + row.withinDays * 86_400_000,
      statusAtSeal,
      current: observed ? { evidenceCount: observed.evidence.length, directCount: observed.directCount, status: observed.status } : null,
      newDirect,
      nameEn: opportunity?.nameEn,
    };
  });
}

export function predictionSummary(rows: readonly { status: PredictionStatus }[]) {
  const hits = rows.filter(({ status }) => status === 'hit').length;
  const sample = rows.filter(({ status }) => status !== 'pending').length;
  return { hits, sample, pending: rows.length - sample, rate: sample ? hits / sample : null };
}

export function predictionSampleNote(sample: number, lang: Lang) {
  return sample < 10 ? translator(lang)('아직 판단하기 이릅니다.', 'It is too early to draw a conclusion.') : null;
}

export function parseSealedPredictions(jsonl: string): SealedPrediction[] {
  return jsonl.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as SealedPrediction);
}
