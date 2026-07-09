'use server';

import { isAdminEmail } from '@/lib/auth/admin';
import type { NewsItem, ResearchPaper } from '@/lib/data';
import { buildNewsletterHtml, buildNewsletterText } from '@/lib/newsletter/email';
import { buildRecommendationProfile, recommendNewsItems, recommendResearchPapers } from '@/lib/recommendations';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

type Recipient = {
  email: string | null;
  newsletter_subscribed: boolean | null;
  answers?: Record<string, unknown> | null;
};

function errorParam(message: string) {
  return encodeURIComponent(message.replace(/\s+/g, ' ').slice(0, 180));
}

export async function sendManualNewsletter() {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  if (!isAdminEmail(data.user.email)) redirect('/');

  const service = createServiceClient();
  if (!service) redirect('/admin/ingest?newsletter=missing-service-key');

  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.NEWSLETTER_FROM_EMAIL;
  if (!resendApiKey || !from) redirect('/admin/ingest?newsletter=missing-email-env');

  const headerStore = await headers();
  const host = headerStore.get('host');
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${protocol}://${host}` : 'http://localhost:3000');

  const [{ data: recipients }, newsResult, { data: papers }, { data: products }, { data: repos }, { data: projects }] = await Promise.all([
    service.from('user_onboarding').select('email, newsletter_subscribed, answers').eq('newsletter_subscribed', true).not('email', 'is', null),
    service.from('news_items').select('*').order('daily_rank_score', { ascending: false, nullsFirst: false }).order('published_at', { ascending: false }).limit(24),
    service.from('research_papers').select('*').order('relevance_score', { ascending: false }).order('published_at', { ascending: false }).limit(12),
    service.from('ai_products').select('*').order('score', { ascending: false }).limit(4),
    service.from('github_trends').select('*').order('stars', { ascending: false }).limit(4),
    service.from('project_ideas').select('*').order('created_at', { ascending: false }).limit(4),
  ]);
  const news = newsResult.error
    ? (await service.from('news_items').select('*').order('relevance_score', { ascending: false }).order('published_at', { ascending: false }).limit(24)).data
    : newsResult.data;

  const recipientList = Array.from(
    new Map(((recipients ?? []) as Recipient[]).filter((item) => item.email).map((item) => [item.email, item])).values(),
  );
  if (!recipientList.length) redirect('/admin/ingest?newsletter=no-recipients');

  let sent = 0;
  for (const recipient of recipientList) {
    const profile = buildRecommendationProfile(recipient.answers);
    const personalizedNews = recommendNewsItems((news ?? []) as NewsItem[], profile, 5);
    const personalizedPapers = recommendResearchPapers((papers ?? []) as ResearchPaper[], profile, 3);
    const html = buildNewsletterHtml({
      news: personalizedNews,
      papers: personalizedPapers,
      products: products ?? [],
      repos: repos ?? [],
      projects: projects ?? [],
      siteUrl,
    });
    const text = buildNewsletterText({
      news: personalizedNews,
      papers: personalizedPapers,
      products: products ?? [],
      repos: repos ?? [],
      projects: projects ?? [],
      siteUrl,
    });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: recipient.email,
        subject: 'Seedup Weekly - 오늘 추천 아티클과 논문',
        html,
        text,
      }),
      cache: 'no-store',
    });

    if (!response.ok) {
      const raw = await response.text();
      let message = raw;

      try {
        const json = JSON.parse(raw) as { message?: string; error?: string; name?: string };
        message = json.message ?? json.error ?? json.name ?? raw;
      } catch {
        // Resend normally returns JSON, but keep the raw text if it does not.
      }

      revalidatePath('/admin/ingest');
      redirect(`/admin/ingest?newsletter=failed&sent=${sent}&reason=${errorParam(message || `Resend ${response.status}`)}`);
    }
    sent += 1;
  }

  revalidatePath('/admin/ingest');
  redirect(`/admin/ingest?newsletter=success&sent=${sent}`);
}
