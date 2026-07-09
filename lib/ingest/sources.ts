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
  { name: 'NVIDIA Technical Blog', url: 'https://developer.nvidia.com/blog/feed/', language: 'en', quality: 82, tier: 'specialist' },
  { name: 'InfoQ AI/ML', url: 'https://www.infoq.com/ai-ml-data-eng/rss/', language: 'en', quality: 78, tier: 'specialist' },
  { name: 'InfoQ DevOps', url: 'https://www.infoq.com/devops/rss/', language: 'en', quality: 76, tier: 'specialist' },
  { name: 'NAVER D2', url: 'https://d2.naver.com/d2.atom', language: 'ko', quality: 84, tier: 'specialist' },
  { name: 'Toss Tech', url: 'https://toss.tech/rss.xml', language: 'ko', quality: 84, tier: 'specialist' },
  { name: 'Kakao Tech', url: 'https://tech.kakao.com/feed/', language: 'ko', quality: 82, tier: 'specialist' },
  { name: '우아한형제들 기술블로그', url: 'https://techblog.woowahan.com/feed/', language: 'ko', quality: 82, tier: 'specialist' },
  { name: '당근 기술블로그', url: 'https://medium.com/feed/daangn', language: 'ko', quality: 80, tier: 'specialist' },
  { name: 'Qwen Blog', url: 'https://qwenlm.github.io/blog/feed.xml', language: 'en', quality: 78, tier: 'specialist' },
] as const satisfies IngestSource[];

const DEFAULT_PRODUCT_SOURCES: IngestSource[] = [
  { name: 'Product Hunt', url: 'https://www.producthunt.com/feed', language: 'en', quality: 78, tier: 'community' },
] as const satisfies IngestSource[];

export const RSS_SOURCES = parseSourcesFromEnv(process.env.INGEST_RSS_SOURCES) ?? DEFAULT_RSS_SOURCES;
export const PRODUCT_SOURCES = parseSourcesFromEnv(process.env.INGEST_PRODUCT_SOURCES) ?? DEFAULT_PRODUCT_SOURCES;
export const MAX_ITEMS_PER_SOURCE = Number(process.env.MAX_ITEMS_PER_SOURCE ?? 10);

export const GITHUB_QUERIES = [
  // 최근 급부상 AI/LLM 관련 — 스타 기준을 낮춰 신규 프로젝트 포함
  'topic:llm stars:10..2000',
  'topic:ai-agent stars:10..2000',
  'topic:mcp stars:10..1000',
  // 최신 개발 트렌드 토픽
  'topic:vibe-coding stars:5..500',
  'topic:cursor stars:5..500',
  'topic:claude stars:5..1000',
  // 실용 개발 도구 — 소규모 프로젝트도 포함
  'topic:developer-tools stars:10..1000',
  'topic:nextjs stars:10..800',
  'topic:supabase stars:5..500',
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
