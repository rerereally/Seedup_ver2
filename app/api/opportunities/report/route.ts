import { onboardingAnswers } from '@/lib/db/onboarding';
import { toLang, translator } from '@/lib/i18n';
import { preferredStack } from '@/lib/onboarding';
import { getOpportunities } from '@/lib/opportunities/data';
import { signEvidence } from '@/lib/opportunities/live-evidence';
import { buildValidationReport, renderReport } from '@/lib/opportunities/report';
import { createClient, getCurrentUser } from '@/lib/supabase/server';
import { consumeDailyUsage, releaseDailyUsage } from '@/lib/usage-limit';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

const DAILY_REPORT_LIMIT = 3;

/**
 * A validation report for one idea. Signed in only, three a day: it spends a web search and several model calls.
 * Quotes come back signed, so the PRD routes accept them as evidence when the person goes on to make a PRD.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  const body = await request.json().catch(() => null);
  const lang = toLang(body?.lang);
  const t = translator(lang);
  if (!supabase || !user) return NextResponse.json({ error: t('로그인 후 검증 리포트를 만들 수 있습니다.', 'Sign in to create a validation report.') }, { status: 401 });
  const idea = typeof body?.idea === 'string' ? body.idea.trim().slice(0, 300) : '';
  if (idea.length < 4) return NextResponse.json({ error: t('아이디어를 한 줄로 적어 주세요.', 'Enter your idea in one line.') }, { status: 400 });
  if (!(await consumeDailyUsage(supabase, 'validation_report', DAILY_REPORT_LIMIT))) {
    return NextResponse.json({ error: t(`검증 리포트는 하루 ${DAILY_REPORT_LIMIT}건까지 만들 수 있습니다.`, `You can create up to ${DAILY_REPORT_LIMIT} validation reports per day.`) }, { status: 429 });
  }

  const [{ opportunities }, answers] = await Promise.all([getOpportunities(), onboardingAnswers(supabase, user.id)]);
  const report = await buildValidationReport(idea, opportunities, { lang, stack: preferredStack(answers), searchCounterEvidence: true }).catch((error) => {
    console.error('validation report failed', error);
    return null;
  });
  if (!report) {
    await releaseDailyUsage(supabase, 'validation_report');
    return NextResponse.json({ error: t('리포트를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.', 'Could not create the report. Try again shortly.') }, { status: 502 });
  }
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, '');
  return NextResponse.json({ ...report, quotes: report.quotes.flatMap((row) => signEvidence(row) ?? []), markdown: renderReport(report, siteUrl, lang) });
}
