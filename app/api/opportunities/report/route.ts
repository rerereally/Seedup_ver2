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
  if (!supabase || !user) return NextResponse.json({ error: '로그인 후 검증 리포트를 만들 수 있습니다.' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const idea = typeof body?.idea === 'string' ? body.idea.trim().slice(0, 300) : '';
  if (idea.length < 4) return NextResponse.json({ error: '아이디어를 한 줄로 적어 주세요.' }, { status: 400 });
  if (!(await consumeDailyUsage(supabase, 'validation_report', DAILY_REPORT_LIMIT))) {
    return NextResponse.json({ error: `검증 리포트는 하루 ${DAILY_REPORT_LIMIT}건까지 만들 수 있습니다.` }, { status: 429 });
  }

  const { opportunities } = await getOpportunities();
  const report = await buildValidationReport(idea, opportunities).catch((error) => {
    console.error('validation report failed', error);
    return null;
  });
  if (!report) {
    await releaseDailyUsage(supabase, 'validation_report');
    return NextResponse.json({ error: '리포트를 만들지 못했습니다. 잠시 뒤 다시 시도해 주세요.' }, { status: 502 });
  }
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/+$/, '');
  return NextResponse.json({ ...report, quotes: report.quotes.flatMap((row) => signEvidence(row) ?? []), markdown: renderReport(report, siteUrl) });
}
