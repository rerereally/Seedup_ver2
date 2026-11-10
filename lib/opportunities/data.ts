import { cache } from 'react';
import { cached } from '@/lib/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import bundledSnapshot from './data/snapshot.json';
import { PLATFORM_LABELS } from './types';
import type { Evidence, Opportunity, OpportunitySnapshot, Platform } from './types';

const snapshotFile = bundledSnapshot as unknown as OpportunitySnapshot;

type OpportunitySource = {
  generatedAt: string;
  opportunities: Opportunity[];
  live: boolean;
};

/** Reads the published run, and falls back to the bundled run so the page never renders empty. */
export const getOpportunities = cache(() => cached('opportunities', loadOpportunities));

async function loadOpportunities(): Promise<OpportunitySource> {
  const fallback = { generatedAt: snapshotFile.generatedAt, opportunities: snapshotFile.opportunities, live: false };
  const supabase = createAdminClient();
  if (!supabase) return fallback;

  const { data, error } = await supabase
    .from('opportunities')
    .select('data,generated_at')
    .eq('published', true)
    .order('qualified', { ascending: false })
    .limit(60);

  if (error || !data?.length) return fallback;
  return {
    generatedAt: String(data[0].generated_at),
    opportunities: data.map((row) => row.data as Opportunity),
    live: true,
  };
}

export async function getOpportunity(slug: string) {
  const { opportunities } = await getOpportunities();
  return opportunities.find((item) => item.slug === slug) ?? null;
}

export const getOpportunityEmbeddings = () => cached('opportunity-embeddings', loadOpportunityEmbeddings, 10 * 60_000);

async function loadOpportunityEmbeddings(): Promise<Record<string, number[]>> {
  const supabase = createAdminClient();
  if (supabase) {
    const { data, error } = await supabase.from('opportunities').select('slug,embedding').eq('published', true);
    if (!error && data?.length) {
      return Object.fromEntries(data.flatMap((row) => (Array.isArray(row.embedding) ? [[row.slug as string, row.embedding as number[]]] : [])));
    }
  }
  // Loaded on demand because the vectors are far larger than anything the page itself needs.
  const local = await import('./data/embeddings.json');
  return local.default as Record<string, number[]>;
}

export type StageQuote = {
  id: string;
  platform: Platform;
  platformLabel: string;
  quote: string;
  quoteKo: string;
  url: string;
};

export type StageOpportunity = {
  slug: string;
  name: string;
  gap: string;
  problem: string;
  keywords: string[];
  directCount: number;
  bg: string;
  fg: string;
  quotes: StageQuote[];
};

export type StageNews = { id: string; title: string; source: string | null; terms: string[] };

const CHIP_COLORS: Array<[string, string]> = [
  ['#F75001', '#160700'], ['#2F6BFF', '#ffffff'], ['#8B3FE8', '#ffffff'], ['#D92D20', '#ffffff'],
  ['#34C759', '#04140a'], ['#12B5A6', '#031513'], ['#FFC400', '#171200'], ['#FF6FAE', '#1a0610'],
  ['#E8E8EC', '#111113'], ['#6E7BFF', '#05071a'], ['#B7E34C', '#121804'], ['#FF9F43', '#1a0e00'],
];

/** An opportunity keeps one colour everywhere: its chips on the stage, its row in the table, its own page. */
export function opportunityColors(opportunities: Opportunity[]): Record<string, { bg: string; fg: string }> {
  return Object.fromEntries(opportunities.map((item, index) => {
    const [bg, fg] = CHIP_COLORS[index % CHIP_COLORS.length];
    return [item.slug, { bg, fg }];
  }));
}

export type OpportunityFunnel = { quotes: number; problems: number; qualified: number; open: number };

/** How much survives each filter, counted from the run itself so it can never drift from the list. */
export function summarizeFunnel(opportunities: Opportunity[]): OpportunityFunnel {
  const qualified = opportunities.filter((item) => item.qualified);
  return {
    quotes: opportunities.reduce((sum, item) => sum + item.evidence.length, 0),
    problems: opportunities.length,
    qualified: qualified.length,
    open: qualified.filter((item) => item.status === 'open').length,
  };
}

export function toStageOpportunities(opportunities: Opportunity[]): StageOpportunity[] {
  const colors = opportunityColors(opportunities);
  return opportunities.map((item) => {
    const { bg, fg } = colors[item.slug];
    return {
      slug: item.slug,
      name: item.name,
      gap: item.gap,
      problem: item.problem,
      keywords: item.keywords,
      directCount: item.directCount,
      bg,
      fg,
      quotes: item.evidence.map((evidence: Evidence) => ({
        id: evidence.id,
        platform: evidence.platform,
        platformLabel: PLATFORM_LABELS[evidence.platform],
        quote: evidence.quote,
        quoteKo: evidence.quoteKo,
        url: evidence.url,
      })),
    };
  });
}

export function findEvidence(opportunities: Opportunity[], ids: string[]) {
  const wanted = new Set(ids);
  const found = new Map<string, { evidence: Evidence; slug: string }>();
  for (const opportunity of opportunities) {
    for (const evidence of opportunity.evidence) {
      if (wanted.has(evidence.id) && !found.has(evidence.id)) found.set(evidence.id, { evidence, slug: opportunity.slug });
    }
  }
  return ids.flatMap((id) => found.get(id) ?? []);
}

export function leadOpportunity(opportunities: Opportunity[], picked: Array<{ slug: string }>) {
  const counts = new Map<string, number>();
  for (const item of picked) counts.set(item.slug, (counts.get(item.slug) ?? 0) + 1);
  const slug = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return opportunities.find((item) => item.slug === slug) ?? null;
}
