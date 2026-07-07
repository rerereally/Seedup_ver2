type IngestSource = {
  name: string;
  url: string;
  language: string;
};

const DEFAULT_RSS_SOURCES: IngestSource[] = [
  { name: 'IT동아', url: 'https://it.donga.com/feeds/rss/', language: 'ko' },
  { name: '전자신문', url: 'http://rss.etnews.com/03.xml', language: 'ko' },
  { name: '요즘IT', url: 'https://yozm.wishket.com/magazine/feed/', language: 'ko' },
  { name: "Lenny's Newsletter", url: 'https://www.lennysnewsletter.com/feed', language: 'en' },
  { name: 'ZDNet Korea', url: 'https://zdnet.co.kr/feed/', language: 'ko' },
] as const satisfies IngestSource[];

const DEFAULT_PRODUCT_SOURCES: IngestSource[] = [
  { name: 'Product Hunt', url: 'https://www.producthunt.com/feed', language: 'en' },
] as const satisfies IngestSource[];

export const RSS_SOURCES = parseSourcesFromEnv(process.env.INGEST_RSS_SOURCES) ?? DEFAULT_RSS_SOURCES;
export const PRODUCT_SOURCES = parseSourcesFromEnv(process.env.INGEST_PRODUCT_SOURCES) ?? DEFAULT_PRODUCT_SOURCES;

export const GITHUB_QUERIES = [
  'topic:ai stars:>100',
  'topic:llm stars:>100',
  'topic:agent stars:>50',
  'topic:developer-tools stars:>50',
  'topic:nextjs stars:>50',
  'topic:supabase stars:>20',
] as const;

function parseSourcesFromEnv(value?: string) {
  if (!value?.trim()) return null;

  const sources = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, url, language = 'ko'] = line.split('|').map((part) => part.trim());
      if (!name || !url) return null;
      return { name, url, language };
    })
    .filter((source): source is IngestSource => Boolean(source));

  return sources.length ? sources : null;
}
