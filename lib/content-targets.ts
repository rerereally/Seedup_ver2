export type ContentTarget = 'news' | 'paper' | 'github' | 'project' | 'ai_product';

export function getContentHref(itemType: string, itemId: string | null | undefined) {
  if (!itemId) return '/scrap';
  if (itemType === 'news') return `/news/${itemId}`;
  if (itemType === 'paper') return `/papers/${itemId}`;
  if (itemType === 'github') return `/github-trends/${itemId}`;
  if (itemType === 'project') return `/projects/${itemId}`;
  if (itemType === 'ai_product') return `/ai-products/${itemId}`;
  if (itemType === 'trend') return '/trends';
  if (itemType === 'idea') return '/ideas';
  return '/scrap';
}

export function getContentTable(itemType: ContentTarget) {
  if (itemType === 'news') return 'news_items';
  if (itemType === 'paper') return 'research_papers';
  if (itemType === 'github') return 'github_trends';
  if (itemType === 'project') return 'project_ideas';
  return 'ai_products';
}
