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

  const [{ data: recipients }, { data: news }, { data: papers }, { data: products }, { data: repos }, { data: projects }] = await Promise.all([
    service.from('user_onboarding').select('email, newsletter_subscribed, answers').eq('newsletter_subscribed', true).not('email', 'is', null),
    service.from('news_items').select('*').order('relevance_score', { ascending: false }).order('published_at', { ascending: false }).limit(24),
    service.from('research_papers').select('*').order('relevance_score', { ascending: false }).order('published_at', { ascending: false }).limit(12),
    service.from('ai_products').select('*').order('score', { ascending: false }).limit(4),
    service.from('github_trends').select('*').order('stars', { ascending: false }).limit(4),
    service.from('project_ideas').select('*').order('created_at', { ascending: false }).limit(4),
  ]);

  const recipientList = Array.from(
    new Map(((recipients ?? []) as Recipient[]).filter((item) => item.email).map((item) => [item.email, item])).values(),
  );
  if (!recipientList.length) redirect('/admin/ingest?newsletter=no-recipients');

  let sent = 0;
  for (const recipient of recipientList) {
    const personalizedNews = pickPersonalized(news ?? [], recipient.answers, 5);
    const personalizedPapers = pickPersonalized(papers ?? [], recipient.answers, 3);
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
        subject: 'Seedup Weekly - 맞춤 개발 아티클 5 + 오늘 추천 3',
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

function flattenAnswers(answers: Record<string, unknown> | null | undefined) {
  return Object.values(answers ?? {})
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .map((value) => String(value ?? '').toLowerCase())
    .filter(Boolean);
}

function pickPersonalized<T extends {
  title?: string | null;
  summary?: string | null;
  beginner_summary?: string | null;
  category?: string | null;
  review_type?: string | null;
  related_skills?: string[] | null;
  target_levels?: string[] | null;
  target_goals?: string[] | null;
  target_interests?: string[] | null;
  relevance_score?: number | null;
}>(items: T[], answers: Record<string, unknown> | null | undefined, limit: number) {
  const answerTokens = flattenAnswers(answers);
  const ranked = items
    .map((item) => {
      const tags = [
        item.title,
        item.summary,
        item.beginner_summary,
        item.category,
        item.review_type,
        ...(item.related_skills ?? []),
        ...(item.target_levels ?? []),
        ...(item.target_goals ?? []),
        ...(item.target_interests ?? []),
      ].join(' ').toLowerCase();
      const matchScore = answerTokens.filter((token) => token && tags.includes(token)).length;
      return { item, score: matchScore * 10 + Number(item.relevance_score ?? 0) };
    })
    .sort((a, b) => b.score - a.score)
    .map(({ item }) => item);

  return ranked.slice(0, limit);
}
