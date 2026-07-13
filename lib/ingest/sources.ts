type IngestSource = {
  name: string;
  url: string;
  language: string;
  quality?: number;
  tier?: 'primary' | 'specialist' | 'general' | 'community';
};

const DEFAULT_RSS_SOURCES: IngestSource[] = [
  { name: 'IT동아', url: 'https://it.donga.com/feeds/rss/', language: 'ko', quality: 64, tier: 'general' },
  { name: '전자신문', url: 'http://rss.etnews.com/03.xml', language: 'ko', quality: 68, tier: 'general' },
  { name: '요즘IT', url: 'https://yozm.wishket.com/magazine/feed/', language: 'ko', quality: 88, tier: 'specialist' },
  { name: 'ZDNet Korea', url: 'https://zdnet.co.kr/feed/', language: 'ko', quality: 74, tier: 'general' },
  { name: 'AI타임스', url: 'https://www.aitimes.com/rss/allArticle.xml', language: 'ko', quality: 70, tier: 'general' },
  { name: 'GeekNews', url: 'https://news.hada.io/rss/news', language: 'ko', quality: 82, tier: 'community' },
  { name: "Lenny's Newsletter", url: 'https://www.lennysnewsletter.com/feed', language: 'en', quality: 86, tier: 'specialist' },
  { name: 'Hacker News Frontpage', url: 'https://hnrss.org/frontpage', language: 'en', quality: 76, tier: 'community' },
  { name: 'Hacker News Best', url: 'https://hnrss.org/best', language: 'en', quality: 78, tier: 'community' },
  { name: 'GitHub Blog', url: 'https://github.blog/feed/', language: 'en', quality: 84, tier: 'primary' },
  { name: 'Vercel Blog', url: 'https://vercel.com/atom', language: 'en', quality: 84, tier: 'primary' },
  { name: 'Cloudflare Blog', url: 'https://blog.cloudflare.com/rss/', language: 'en', quality: 82, tier: 'primary' },
  { name: 'OpenAI News', url: 'https://openai.com/news/rss.xml', language: 'en', quality: 88, tier: 'primary' },
  { name: 'AWS Machine Learning Blog', url: 'https://aws.amazon.com/blogs/machine-learning/feed/', language: 'en', quality: 80, tier: 'specialist' },
  { name: 'AWS Architecture Blog', url: 'https://aws.amazon.com/blogs/architecture/feed/', language: 'en', quality: 86, tier: 'specialist' },
  { name: 'AWS Compute Blog', url: 'https://aws.amazon.com/blogs/compute/feed/', language: 'en', quality: 84, tier: 'specialist' },
  { name: 'NVIDIA Technical Blog', url: 'https://developer.nvidia.com/blog/feed/', language: 'en', quality: 82, tier: 'specialist' },
  { name: 'Kubernetes Blog', url: 'https://kubernetes.io/feed.xml', language: 'en', quality: 86, tier: 'primary' },
  { name: 'Microsoft DevBlogs', url: 'https://devblogs.microsoft.com/feed/', language: 'en', quality: 82, tier: 'primary' },
  { name: 'Toss Tech', url: 'https://toss.tech/rss.xml', language: 'ko', quality: 84, tier: 'specialist' },
  { name: 'Kakao Tech', url: 'https://tech.kakao.com/feed/', language: 'ko', quality: 82, tier: 'specialist' },
  { name: '우아한형제들 기술블로그', url: 'https://techblog.woowahan.com/feed/', language: 'ko', quality: 82, tier: 'specialist' },
  { name: '당근 기술블로그', url: 'https://medium.com/feed/daangn', language: 'ko', quality: 80, tier: 'specialist' },
] as const satisfies IngestSource[];

const DEFAULT_PRODUCT_SOURCES: IngestSource[] = [
  { name: 'Product Hunt', url: 'https://www.producthunt.com/feed', language: 'en', quality: 78, tier: 'community' },
] as const satisfies IngestSource[];

export const RSS_SOURCES = parseSourcesFromEnv(process.env.INGEST_RSS_SOURCES) ?? DEFAULT_RSS_SOURCES;
export const PRODUCT_SOURCES = parseSourcesFromEnv(process.env.INGEST_PRODUCT_SOURCES) ?? DEFAULT_PRODUCT_SOURCES;
export const MAX_ITEMS_PER_SOURCE = Number(process.env.MAX_ITEMS_PER_SOURCE ?? 10);

export const GITHUB_QUERIES = [
  'topic:ai-agent stars:50..12000',
  'topic:llm-agent stars:50..12000',
  'topic:mcp stars:50..12000',
  'topic:mcp-server stars:50..8000',
  'topic:rag stars:50..12000',
  'topic:vector-database stars:50..12000',
  'topic:local-llm stars:50..12000',
  'topic:ollama stars:50..12000',
  'topic:langgraph stars:50..12000',
  'topic:ai-coding stars:50..8000',
  'topic:coding-agent stars:50..8000',
  'topic:browser-agent stars:50..6000',
  'topic:computer-use stars:50..6000',
  'topic:vibe-coding stars:50..6000',
  'topic:cursor stars:50..8000',
  'topic:claude-code stars:50..8000',
  'topic:developer-tools topic:ai stars:200..12000',
  'topic:developer-tools topic:llm stars:200..12000',
  'topic:postgresql stars:50..12000',
  'topic:database stars:50..12000',
  'topic:kubernetes stars:50..12000',
  'topic:devops stars:50..12000',
  'topic:backend stars:50..12000',
  'topic:api stars:50..12000',
  'topic:supabase topic:rag stars:100..8000',
  'topic:supabase topic:ai-agent stars:100..8000',
] as const;

function parseSourcesFromEnv(value?: string): IngestSource[] | null {
  if (!value?.trim()) return null;

  const sources: IngestSource[] = [];
  const seenUrls = new Set<string>();
  for (const line of value.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const [name, url, language = 'ko'] = line.split('|').map((part) => part.trim());
    if (!name || !url) continue;
    const normalizedUrl = url.replace(/\/+$/, '');
    if (seenUrls.has(normalizedUrl)) continue;
    seenUrls.add(normalizedUrl);
    sources.push({ name, url, language, quality: 60, tier: 'general' });
  }

  return sources.length ? sources : null;
}
