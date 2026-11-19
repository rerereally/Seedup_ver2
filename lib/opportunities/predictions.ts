import { createHash } from 'node:crypto';
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
    const hit = bySlug.get(prediction.slug)?.supply.some((tool) => tool.relation === 'direct' && toolAppearedAfter(tool, sealedAt, through));
    const status: PredictionStatus = hit ? 'hit' : now >= deadline ? 'miss' : 'pending';
    return { ...prediction, status };
  });
}

export function parseSealedPredictions(jsonl: string): SealedPrediction[] {
  return jsonl.trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as SealedPrediction);
}
