export const RESEARCH_QUERIES = [
  'cat:cs.AI OR cat:cs.CL OR cat:cs.LG',
  'all:"AI agent" OR all:"tool use" OR all:"workflow automation"',
  'all:"retrieval augmented generation" OR all:RAG',
  'all:"code generation" OR all:"software engineering"',
  'all:"human computer interaction" OR all:"developer tools"',
];

export const RESEARCH_SOURCE_INFO = {
  arxiv: {
    name: 'arXiv',
    url: 'https://export.arxiv.org/api/query',
  },
  papersWithCode: {
    name: 'Papers with Code',
    url: 'https://paperswithcode.com/api/v1/papers/',
  },
  huggingFacePapers: {
    name: 'Hugging Face Papers',
    url: 'https://huggingface.co/papers',
  },
} as const;

export type ResearchFeedSource = {
  name: string;
  url: string;
  language: string;
};

const DEFAULT_ARXIV_SOURCES: ResearchFeedSource[] = [
  { name: 'arXiv cs.AI', url: 'https://rss.arxiv.org/rss/cs.AI', language: 'en' },
  { name: 'arXiv cs.LG', url: 'https://rss.arxiv.org/rss/cs.LG', language: 'en' },
  { name: 'arXiv cs.CL', url: 'https://rss.arxiv.org/rss/cs.CL', language: 'en' },
  { name: 'arXiv cs.CV', url: 'https://rss.arxiv.org/rss/cs.CV', language: 'en' },
  { name: 'arXiv cs.SE', url: 'https://rss.arxiv.org/rss/cs.SE', language: 'en' },
  { name: 'arXiv cs.DB', url: 'https://rss.arxiv.org/rss/cs.DB', language: 'en' },
];

export const ARXIV_FEED_SOURCES = parseArxivSourcesFromEnv(process.env.INGEST_ARXIV_SOURCES) ?? DEFAULT_ARXIV_SOURCES;

function parseArxivSourcesFromEnv(value?: string): ResearchFeedSource[] | null {
  if (!value?.trim()) return null;

  const sources: ResearchFeedSource[] = [];
  const seenUrls = new Set<string>();
  for (const line of value.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const [name, url, language = 'en'] = line.split('|').map((part) => part.trim());
    if (!name || !url) continue;
    const normalizedUrl = url.replace(/\/+$/, '');
    if (seenUrls.has(normalizedUrl)) continue;
    seenUrls.add(normalizedUrl);
    sources.push({ name, url, language });
  }

  return sources.length ? sources : null;
}
