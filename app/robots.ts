import type { MetadataRoute } from 'next';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://seedup.rerereally.com').replace(/\/+$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/agents', '/profile', '/scrap', '/onboarding', '/login', '/prd/new', '/auth/', '/try/'] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
