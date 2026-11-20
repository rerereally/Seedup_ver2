import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { handleReadError } from './data-catalog';
import type { ScrapItem } from './data-types';

export type * from './data-types';
export {
  getAIProduct,
  getAIProductReviews,
  getAIProducts,
  getArticleFeedItems,
  getGitHubTrend,
  getGitHubTrends,
  getModelIntelligence,
  getNewsItem,
  getPeriodBaseline,
  getTrendAverages,
  getNewsItems,
  getProjectIdea,
  getProjectIdeas,
  getRelatedPapersForNews,
  getResearchPaper,
  getResearchPapers,
  getTrends,
} from './data-catalog';
export { searchContent, searchFilter, tagFilter } from './data-search';
export { getIngestQualitySummary, getIngestRejections, getIngestRuns, getRecommendationQuality } from './data-admin';

export async function getScraps() {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase.from('scraps').select('*').order('created_at', { ascending: false });

  if (error) {
    handleReadError(error);
    return [];
  }
  return (data ?? []) as ScrapItem[];
}

export async function getScrap(id: string) {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase.from('scraps').select('*').eq('id', id).maybeSingle();

  if (error) {
    handleReadError(error);
    return null;
  }
  return data as ScrapItem | null;
}

export async function getExistingScrap(itemType: string, itemId: string) {
  const supabase = await createClient();
  if (!supabase) return null;

  const userData = { user: await getCurrentUser() };
  if (!userData.user) return null;

  const { data, error } = await supabase
    .from('scraps')
    .select('*')
    .eq('user_id', userData.user.id)
    .eq('item_type', itemType)
    .eq('item_id', itemId)
    .maybeSingle();

  if (error) {
    handleReadError(error);
    return null;
  }

  return data as ScrapItem | null;
}

export async function getScrapKeySet() {
  const supabase = await createClient();
  if (!supabase) return new Set<string>();

  const userData = { user: await getCurrentUser() };
  if (!userData.user) return new Set<string>();

  const { data, error } = await supabase
    .from('scraps')
    .select('item_type,item_id')
    .eq('user_id', userData.user.id);

  if (error) {
    handleReadError(error);
    return new Set<string>();
  }

  return new Set((data ?? []).map((item) => `${item.item_type}:${item.item_id}`));
}
