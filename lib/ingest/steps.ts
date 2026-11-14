// Ordered ingest steps for a full run. New steps are added here only.
export const INGEST_STEPS = [
  ['rss', '/api/ingest/rss?limit=8&minScore=50'],
  ['products', '/api/ingest/products?limit=12'],
  ['github', '/api/ingest/github?limit=15&minStars=50&pruneDays=30'],
  ['research', '/api/ingest/research?limit=12&minScore=55&minFitScore=18'],
  ['external-trends', '/api/ingest/external-trends'],
  ['model-intelligence', '/api/ingest/model-intelligence'],
  ['trends', '/api/ingest/trends'],
  ['project-ideas', '/api/ingest/project-ideas?limit=10'],
  ['article-drafts', '/api/ingest/article-drafts?mode=daily&limit=12'],
] as const;

// Single-run only (admin action); not part of the full run.
export const DEEP_DIVE_STEP = ['deep-dive', '/api/ingest/article-drafts?mode=deep-dive&limit=1&minSources=5&minSourceTypes=3'] as const;

export type IngestStepKey = (typeof INGEST_STEPS)[number][0] | typeof DEEP_DIVE_STEP[0];
