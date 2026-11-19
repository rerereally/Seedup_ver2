import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Opportunity, OpportunitySnapshot } from '@/lib/opportunities/types';
import { scoreOpportunity, stackFit } from '@/lib/opportunities/insight';
import { dailyResearch } from '@/lib/opportunities/research';
import { tidyOpportunities } from '@/lib/opportunities/review';
import { onboardingQuestions } from '@/lib/onboarding';
import { renderDailyResearchMail } from './daily-research';
import { buildOpportunityDigest } from './opportunity-digest';
import type { DigestIssue, DigestKind, DigestLine, DigestRead } from './opportunity-digest';
import { behaviorSignals, buildRecommendationProfile, scoreNewsletterItems } from '@/lib/recommendations';
import type { NewsletterContentItem } from '@/lib/recommendations';
import { selectInChunks } from '@/lib/supabase/chunks';
import { saveIssue } from './issues';
import { loadReadCandidates, pickReads } from './reads';
import { sendDigestMail } from './sends';
import { sendWebhookDigest } from './webhooks';

const WINDOW_HOURS: Record<DigestKind, number> = { changes: 26, weekly: 7 * 24 };

export type OpportunityDigestOutcome =
  | { status: 'empty'; since: string }
  | { status: 'preview'; subject: string; text: string; lines: DigestLine[] }
  | { status: 'not-configured'; subject: string; text: string; lines: DigestLine[] }
  | { status: 'sent'; subject: string; text: string; lines: DigestLine[]; sent: number; duplicates: number; failed: number };

export type OpportunityDigestInput = {
  service: SupabaseClient | null;
  kind: DigestKind;
  dryRun: boolean;
  siteUrl: string;
  resendKey?: string;
  from?: string;
};

export const digestSiteUrl = () => process.env.SEEDUP_SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '';

async function loadPublishedOpportunities(service: SupabaseClient) {
  const { data, error } = await service.from('opportunities').select('data').eq('published', true);
  if (error) throw new Error(`could not read opportunities: ${error.message}`);
  return tidyOpportunities((data ?? []).map((row) => row.data as Opportunity));
}

/** Builds the opportunity digest and, unless dryRun, mails it to every subscriber once per issue. */
export async function sendOpportunityDigest({ service, kind, dryRun, siteUrl, resendKey, from }: OpportunityDigestInput): Promise<OpportunityDigestOutcome> {
  let opportunities = service ? await loadPublishedOpportunities(service) : [];
  const snapshotFile = resolve(process.cwd(), 'lib/opportunities/data/snapshot.json');
  if (!opportunities.length && existsSync(snapshotFile)) opportunities = tidyOpportunities((JSON.parse(readFileSync(snapshotFile, 'utf8')) as OpportunitySnapshot).opportunities);

  const since = new Date(Date.now() - WINDOW_HOURS[kind] * 3_600_000).toISOString();
  const period = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  // The weekly issue carries curated reads; everyone gets the general pick, subscribers their own below.
  const candidates: NewsletterContentItem[] = kind === 'weekly' && service ? await loadReadCandidates(service).catch(() => []) : [];
  const generalReads: DigestRead[] = candidates.length ? pickReads(scoreNewsletterItems(candidates, buildRecommendationProfile(null))) : [];
  const digest = buildOpportunityDigest(opportunities, since, siteUrl || 'http://localhost:3000', kind, Date.now(), undefined, generalReads);
  if (!digest) return { status: 'empty', since };
  if (dryRun) return { status: 'preview', subject: digest.subject, text: digest.text, lines: digest.lines };

  // Archived before the mail settings are checked, so the web archive fills up even while mail is not set up.
  if (kind === 'weekly' && service) {
    const issue: DigestIssue = { kind: digest.kind, subject: digest.subject, headline: digest.headline, lines: digest.lines, top: digest.top, reads: digest.reads };
    await saveIssue(service, period, issue);
  }

  // Chat webhooks do not need the mail settings, only a deployed address for the links.
  if (service && /^https:\/\//.test(siteUrl)) {
    const posted = await sendWebhookDigest(service, kind, period, digest.subject, digest.text).catch(() => ({ sent: 0, failed: 0 }));
    if (posted.sent || posted.failed) console.log(`webhooks: sent ${posted.sent}, failed ${posted.failed}`);
  }

  // A mail whose links point at localhost helps nobody, so a deployed address is required too.
  if (!service || !resendKey || !from || !/^https:\/\//.test(siteUrl)) {
    return { status: 'not-configured', subject: digest.subject, text: digest.text, lines: digest.lines };
  }

  const { data: subscribers, error } = await service.from('user_onboarding').select('user_id,answers').eq('newsletter_subscribed', true);
  if (error) throw new Error(`could not read subscribers: ${error.message}`);
  // Saved dossiers tell which opportunities each reader cares about; read once for everyone.
  const subscriberIds = (subscribers ?? []).map((row) => String(row.user_id));
  const dossiers = await selectInChunks<{ user_id: string; opportunity_slug: string | null }>(subscriberIds, (chunk) =>
    service.from('evidence_dossiers').select('user_id,opportunity_slug').in('user_id', chunk),
  );
  const savedSlugs = new Map<string, string[]>();
  for (const row of dossiers) {
    if (row.opportunity_slug) savedSlugs.set(row.user_id, [...(savedSlugs.get(row.user_id) ?? []), row.opportunity_slug]);
  }
  // What each reader saved and reacted to on the site steers their reads, as on the site itself.
  const [scraps, reactions] = candidates.length ? await Promise.all([
    selectInChunks<{ user_id: string; item_type: string; item_id: string | null; title: string; tag: string | null }>(subscriberIds, (chunk) => service.from('scraps').select('user_id,item_type,item_id,title,tag').in('user_id', chunk)),
    selectInChunks<{ user_id: string; item_type: string; item_id: string; reaction: string }>(subscriberIds, (chunk) => service.from('content_reactions').select('user_id,item_type,item_id,reaction').in('user_id', chunk)),
  ]) : [[], []];
  const readsFor = (userId: string, answers: Record<string, unknown>) => {
    if (!candidates.length) return [];
    const behavior = behaviorSignals(scraps.filter((row) => row.user_id === userId), reactions.filter((row) => row.user_id === userId), candidates);
    return pickReads(scoreNewsletterItems(candidates, { ...buildRecommendationProfile(answers, behavior.liked), ...behavior }));
  };
  const counts = { sent: 0, duplicates: 0, failed: 0 };
  for (const subscriber of subscribers ?? []) {
    const userId = String(subscriber.user_id);
    // Addresses come from Supabase Auth because users can edit their own user_onboarding row.
    const { data: account } = await service.auth.admin.getUserById(userId);
    const email = account.user?.email;
    if (!email) continue;
    const answers = (subscriber as { answers?: Record<string, unknown> | null }).answers ?? {};
    const keywords = ['interests', 'preferred_stack', 'goals'].flatMap((key) => {
      const value = answers[key];
      return (Array.isArray(value) ? value : value ? [value] : []).map(String);
    });
    const mail = buildOpportunityDigest(opportunities, since, siteUrl, kind, Date.now(), { slugs: savedSlugs.get(userId) ?? [], keywords }, readsFor(userId, answers)) ?? digest;
    const result = await sendDigestMail(service, { kind: `opportunity-${kind}`, period, userId, email, resendKey, from, mail, allowUnclaimed: true });
    counts[result] += 1;
  }
  return { status: 'sent', subject: digest.subject, text: digest.text, lines: digest.lines, ...counts };
}

type DailyResearchInput = Omit<OpportunityDigestInput, 'kind' | 'service'> & { service: SupabaseClient };
type DailySubscriber = { user_id: string; answers: Record<string, unknown> | null };
const DAILY_STACK_OPTIONS = onboardingQuestions.find(({ id }) => id === 'preferred_stack')?.options ?? [];

async function loadDailySubscribers(service: SupabaseClient) {
  const subscribers: DailySubscriber[] = [];
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await service.from('user_onboarding').select('user_id,answers')
      .eq('daily_research_subscribed', true).order('user_id').range(offset, offset + pageSize - 1);
    if (error) throw new Error(`could not read daily research subscribers: ${error.message}`);
    subscribers.push(...(data ?? []));
    if (!data || data.length < pageSize) return subscribers;
  }
}

export async function sendDailyResearchMail({ service, dryRun, siteUrl, resendKey, from }: DailyResearchInput, now = Date.now()) {
  const delivery = resendKey && from && /^https:\/\//.test(siteUrl) ? { resendKey, from } : null;
  if (!dryRun && !delivery) {
    throw new Error('Daily research mail requires RESEND_API_KEY, NEWSLETTER_FROM_EMAIL and an https SEEDUP_SITE_URL.');
  }

  const [opportunities, subscribers] = await Promise.all([loadPublishedOpportunities(service), loadDailySubscribers(service)]);
  const research = dailyResearch(opportunities, now);
  const counts = { recipients: subscribers.length, sent: 0, duplicates: 0, failed: 0 };
  if (!research.changeCount) return { ...counts, mail: null };

  const ranked = opportunities.map((item) => ({ item, score: scoreOpportunity(item, now).total }))
    .sort((a, b) => Number(b.item.qualified) - Number(a.item.qualified) || b.score - a.score || a.item.slug.localeCompare(b.item.slug))
    .map(({ item }) => item);
  const base = siteUrl || 'http://localhost:3000';
  const mail = renderDailyResearchMail(research, ranked[0], base);
  if (!mail || dryRun || !delivery) return { ...counts, mail };

  const period = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
  const candidates = ranked[0].qualified ? ranked.filter((item) => item.qualified) : ranked;
  for (const { user_id: userId, answers } of subscribers) {
    const { data: account, error } = await service.auth.admin.getUserById(userId);
    if (error) {
      counts.failed += 1;
      continue;
    }
    const email = account.user?.email;
    if (!email) continue;
    const preferences = [answers?.preferred_stack].flat();
    const stack = DAILY_STACK_OPTIONS.filter((name) => preferences.includes(name));
    const recommendation = stack.length ? candidates.map((item) => ({ item, matches: stackFit(item, stack).matched.length }))
      .sort((a, b) => b.matches - a.matches)[0].item : ranked[0];
    const personalized = recommendation === ranked[0] ? mail : renderDailyResearchMail(research, recommendation, base) ?? mail;
    const result = await sendDigestMail(service, { kind: 'opportunity-daily', period, userId, email, mail: personalized, ...delivery });
    counts[result] += 1;
  }
  return { ...counts, mail };
}
