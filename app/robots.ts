import type { MetadataRoute } from 'next';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://seedup.rerereally.com').replace(/\/+$/, '');

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/admin', '/profile', '/scrap', '/onboarding', '/login', '/prd/new', '/auth/'] },
    sitemap: `${SITE}/sitemap.xml`,
  };
}
