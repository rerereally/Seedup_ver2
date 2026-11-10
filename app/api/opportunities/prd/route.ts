import { findEvidence, getOpportunities, leadOpportunity } from '@/lib/opportunities/data';
import { generatePrd } from '@/lib/opportunities/prd';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { createClient } from '@/lib/supabase/server';
import { consumeDailyUsage } from '@/lib/usage-limit';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 110;

const DAILY_PRD_LIMIT = 10;
const MAX_TITLE_LENGTH = 120;
const MAX_EVIDENCE = 12;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !data.user) {
    return NextResponse.json({ error: '로그인 후 PRD를 만들 수 있습니다.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const requestedTitle = typeof body?.title === 'string' ? body.title.trim().slice(0, MAX_TITLE_LENGTH) : '';
  const evidenceIds: string[] = Array.isArray(body?.evidenceIds) ? body.evidenceIds.filter((id: unknown): id is string => typeof id === 'string').slice(0, MAX_EVIDENCE) : [];

  const { opportunities } = await getOpportunities();
  const picked = findEvidence(opportunities, evidenceIds);
  const evidence = picked.map((item) => item.evidence);
  if (!meetsEvidenceBar(evidence.length, new Set(evidence.map((item) => item.platform)).size)) {
    return NextResponse.json({ error: '근거 3건 이상, 플랫폼 2종 이상을 담아야 PRD를 만들 수 있습니다.' }, { status: 422 });
  }

  const lead = leadOpportunity(opportunities, picked);
  if (!lead) return NextResponse.json({ error: '담은 근거를 찾지 못했습니다.' }, { status: 422 });

  if (!(await consumeDailyUsage(supabase, 'prd', DAILY_PRD_LIMIT))) {
    return NextResponse.json({ error: `PRD는 하루 ${DAILY_PRD_LIMIT}개까지 만들 수 있습니다.` }, { status: 429 });
  }

  const result = await generatePrd({
    title: requestedTitle || lead.name,
    problem: lead.problem,
    gap: lead.gap,
    evidence,
    competitors: lead.supply.filter((item) => item.relation === 'direct').slice(0, 5).map((item) => item.name),
  });
  if (!result) {
    return NextResponse.json({ error: 'PRD를 만들지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }

  return NextResponse.json({
    ok: true,
    title: requestedTitle || lead.name,
    markdown: result.markdown,
    agentBrief: result.agentBrief,
    requirementCount: result.draft.requirements.length,
    hypothesisCount: result.draft.hypotheses.length,
  });
}
