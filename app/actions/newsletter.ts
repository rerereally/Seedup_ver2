'use server';

import { isAdminEmail } from '@/lib/auth/admin';
import type { AIProduct, GitHubTrend, NewsItem, ProjectIdea, ResearchPaper } from '@/lib/data';
import { claimSend, releaseSend } from '@/lib/newsletter/sends';
import { buildNewsletterHtml, buildNewsletterText } from '@/lib/newsletter/email';
import { buildRecommendationProfile, isRecommendableNewsItem, scoreNewsletterItems, toNewsletterContentItems } from '@/lib/recommendations';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

type Subscriber = {
  user_id: string;
  newsletter_subscribed: boolean | null;
  answers?: Record<string, unknown> | null;
};

const AUTH_USERS_PAGE_SIZE = 1000;
const SEND_INTERVAL_MS = 600;

function errorParam(message: string) {
  return encodeURIComponent(message.replace(/\s+/g, ' ').slice(0, 180));
}

// Addresses come from Supabase Auth because users can edit their own user_onboarding row.
async function getAuthEmails(service: NonNullable<ReturnType<typeof createAdminClient>>) {
  const emails = new Map<string, string>();
  for (let page = 1; ; page += 1) {
    const { data, error } = await service.auth.admin.listUsers({ page, perPage: AUTH_USERS_PAGE_SIZE });
    if (error) throw error;
    for (const user of data.users) {
      if (user.email) emails.set(user.id, user.email);
    }
    if (data.users.length < AUTH_USERS_PAGE_SIZE) return emails;
  }
}

export async function sendManualNewsletter() {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  if (!isAdminEmail(data.user.email)) redirect('/');

  const service = createAdminClient();
  if (!service) redirect('/admin/ingest?newsletter=missing-service-key');

  const resendApiKey = process.env.RESEND_API_KEY;
  const from = process.env.NEWSLETTER_FROM_EMAIL;
  if (!resendApiKey || !from) redirect('/admin/ingest?newsletter=missing-email-env');

  const headerStore = await headers();
  const host = headerStore.get('host');
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${protocol}://${host}` : 'http://localhost:3000');

  const [{ data: subscribers }, newsResult, { data: papers }, { data: products }, { data: repos }, { data: projects }, authEmails] = await Promise.all([
    service.from('user_onboarding').select('user_id, newsletter_subscribed, answers').eq('newsletter_subscribed', true),
    service.from('news_items').select('*').not('content', 'is', null).order('daily_rank_score', { ascending: false, nullsFirst: false }).order('published_at', { ascending: false }).limit(24),
    service.from('research_papers').select('*').order('relevance_score', { ascending: false }).order('published_at', { ascending: false }).limit(12),
    service.from('ai_products').select('*').order('newsletter_priority', { ascending: false, nullsFirst: false }).order('launch_date', { ascending: false, nullsFirst: false }).limit(20),
    service.from('github_trends').select('*').order('stars', { ascending: false }).limit(20),
    service.from('project_ideas').select('*').order('created_at', { ascending: false }).limit(20),
    getAuthEmails(service),
  ]);
  const news = newsResult.error
    ? (await service.from('news_items').select('*').not('content', 'is', null).order('relevance_score', { ascending: false }).order('published_at', { ascending: false }).limit(24)).data
    : newsResult.data;
  const publishedNews = (news ?? []).filter((item) => isRecommendableNewsItem(item as NewsItem));

  const recipientList = Array.from(
    new Map(((subscribers ?? []) as Subscriber[]).flatMap((subscriber) => {
      const email = authEmails.get(subscriber.user_id);
      return email ? [[email, { ...subscriber, email }] as const] : [];
    })).values(),
  );
  if (!recipientList.length) redirect('/admin/ingest?newsletter=no-recipients');

  // Resend keeps idempotency keys for 24 hours, so a same-day rerun skips delivered recipients.
  const issueDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  let sent = 0;
  let skippedNoContent = 0;
  let skippedDuplicates = 0;
  for (const recipient of recipientList) {
    const profile = buildRecommendationProfile(recipient.answers);
    const scored = scoreNewsletterItems(toNewsletterContentItems({
      news: publishedNews as NewsItem[],
      papers: (papers ?? []) as ResearchPaper[],
      products: (products ?? []) as AIProduct[],
      repos: (repos ?? []) as GitHubTrend[],
      projects: (projects ?? []) as ProjectIdea[],
    }), profile);
    const pick = <T,>(prefix: string, limit: number) => scored
      .filter(({ content }) => content.id.startsWith(prefix))
      .slice(0, limit)
      .map(({ content, score, reasons }) => ({ item: content.raw as T, score, reasons }));
    const personalizedNews = pick<NewsItem>('news:', 5);
    const personalizedPapers = pick<ResearchPaper>('paper:', 3);
    const personalizedProducts = pick<AIProduct>('product:', 1);
    const personalizedRepos = pick<GitHubTrend>('repo:', 1);
    const personalizedProjects = pick<ProjectIdea>('project:', 1);
    const fallback = <T,>(items: T[], limit: number, score: (item: T) => number) => items
      .slice()
      .sort((left, right) => score(right) - score(left))
      .slice(0, limit)
      .map((item) => ({ item, score: score(item), reasons: ['프로필 후보가 부족해 최신 우수 콘텐츠로 보완'] }));
    const newsForEmail = personalizedNews.length ? personalizedNews : fallback(publishedNews as NewsItem[], 5, (item) => Number(item.daily_rank_score ?? item.newsletter_priority ?? item.relevance_score ?? 0));
    const papersForEmail = personalizedPapers.length ? personalizedPapers : fallback((papers ?? []) as ResearchPaper[], 3, (item) => Number(item.trend_score ?? item.relevance_score ?? 0));
    const productsForEmail = personalizedProducts.length ? personalizedProducts : fallback((products ?? []) as AIProduct[], 1, (item) => Number(item.newsletter_priority ?? item.score ?? 0));
    const reposForEmail = personalizedRepos.length ? personalizedRepos : fallback((repos ?? []) as GitHubTrend[], 1, (item) => Number(item.newsletter_priority ?? item.stars_delta_7d ?? item.stars ?? 0));
    const projectsForEmail = personalizedProjects.length ? personalizedProjects : fallback((projects ?? []) as ProjectIdea[], 1, (item) => Number(item.duration_days ?? 0) <= 10 ? 80 : 60);
    if (!newsForEmail.length && !papersForEmail.length && !productsForEmail.length && !reposForEmail.length && !projectsForEmail.length) {
      skippedNoContent += 1;
      continue;
    }
    const html = buildNewsletterHtml({
      news: newsForEmail,
      papers: papersForEmail,
      products: productsForEmail,
      repos: reposForEmail,
      projects: projectsForEmail,
      siteUrl,
    });
    const text = buildNewsletterText({
      news: newsForEmail,
      papers: papersForEmail,
      products: productsForEmail,
      repos: reposForEmail,
      projects: projectsForEmail,
      siteUrl,
    });

    // Kept in our own table as well, because the provider forgets an idempotency key after 24 hours.
    const claim = await claimSend(service, 'weekly-reading', issueDate, recipient.user_id);
    if (claim === 'duplicate') {
      skippedDuplicates += 1;
      continue;
    }

    let response: Response;
    try {
      response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `newsletter-${issueDate}-${recipient.user_id}`,
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
    } catch (error) {
      if (claim === 'claimed') await releaseSend(service, 'weekly-reading', issueDate, recipient.user_id);
      const message = error instanceof Error ? error.message : 'Resend API에 연결하지 못했습니다.';
      revalidatePath('/admin/ingest');
      redirect(`/admin/ingest?newsletter=failed&sent=${sent}&reason=${errorParam(`메일 서비스 연결 실패: ${message}`)}`);
    }

    // 409 means this recipient already has an email for today's idempotency key.
    if (response.status === 409) {
      skippedDuplicates += 1;
      continue;
    }

    if (!response.ok) {
      if (claim === 'claimed') await releaseSend(service, 'weekly-reading', issueDate, recipient.user_id);
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
    await new Promise((resolve) => setTimeout(resolve, SEND_INTERVAL_MS));
  }

  if (!sent) redirect(`/admin/ingest?newsletter=no-content&skipped=${skippedNoContent + skippedDuplicates}`);
  revalidatePath('/admin/ingest');
  redirect(`/admin/ingest?newsletter=success&sent=${sent}&duplicates=${skippedDuplicates}&failed=0`);
}
