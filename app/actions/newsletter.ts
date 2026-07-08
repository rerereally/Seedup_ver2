'use server';

import { isAdminEmail } from '@/lib/auth/admin';
import { buildNewsletterHtml, buildNewsletterText } from '@/lib/newsletter/email';
import { createClient } from '@/lib/supabase/server';
import { createServiceClient } from '@/lib/supabase/service';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

type Recipient = {
  email: string | null;
  newsletter_subscribed: boolean | null;
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

  const [{ data: recipients }, { data: news }, { data: products }, { data: repos }, { data: projects }] = await Promise.all([
    service.from('user_onboarding').select('email, newsletter_subscribed').eq('newsletter_subscribed', true).not('email', 'is', null),
    service.from('news_items').select('*').order('published_at', { ascending: false }).limit(4),
    service.from('ai_products').select('*').order('score', { ascending: false }).limit(4),
    service.from('github_trends').select('*').order('stars', { ascending: false }).limit(4),
    service.from('project_ideas').select('*').order('created_at', { ascending: false }).limit(4),
  ]);

  const to = Array.from(new Set(((recipients ?? []) as Recipient[]).map((item) => item.email).filter(Boolean))) as string[];
  if (!to.length) redirect('/admin/ingest?newsletter=no-recipients');

  const html = buildNewsletterHtml({
    news: news ?? [],
    products: products ?? [],
    repos: repos ?? [],
    projects: projects ?? [],
    siteUrl,
  });
  const text = buildNewsletterText({
    news: news ?? [],
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
      to,
      subject: 'Seedup Weekly - 이번 주 개발 트렌드 브리핑',
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
    redirect(`/admin/ingest?newsletter=failed&sent=${to.length}&reason=${errorParam(message || `Resend ${response.status}`)}`);
  }

  revalidatePath('/admin/ingest');
  redirect(`/admin/ingest?newsletter=success&sent=${to.length}`);
}
