// Keep the route prefixes aligned with Header.tsx. The validation prefix takes precedence over /prd.
const SECTION_PATHS = {
  home: [],
  insights: ['/newsletter-preview', '/opportunities'],
  articles: ['/news'],
  papers: ['/papers'],
  trends: ['/trends'],
  'github-trends': ['/github-trends'],
  'ai-products': ['/ai-products'],
  projects: ['/projects'],
  predictions: ['/predictions'],
  validate: ['/prd/validate'],
  prd: ['/prd', '/spec', '/ideas', '/seeds'],
  mcp: ['/agents'],
  profile: ['/profile'],
  scrap: ['/scrap'],
  search: ['/search'],
} as const;

export type Section = keyof typeof SECTION_PATHS;
export const SECTIONS = Object.keys(SECTION_PATHS) as Section[];

export function sectionOf(pathname: string): Section | null {
  if (pathname === '/') return 'home';
  if (!pathname.startsWith('/') || pathname.includes('//') || /[?#\\\s]/.test(pathname)) return null;
  return SECTIONS.find((section) => SECTION_PATHS[section].some((path) => pathname === path || pathname.startsWith(`${path}/`))) ?? null;
}
