import { toLang } from '@/lib/i18n';
import { isBeginner } from '@/lib/onboarding';
import { getOpportunities } from '@/lib/opportunities/data';
import { inputFromBody } from '@/lib/opportunities/idea';
import { loadPrdPolicy, pickPrdModel } from '@/lib/opportunities/models';
import { prdRunLog } from '@/lib/opportunities/prd-runs';
import { readPrdCache, writePrdCache } from '@/lib/opportunities/prd-cache';
import { generatePrd } from '@/lib/opportunities/prd';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { consumeDailyUsage, releaseDailyUsage } from '@/lib/usage-limit';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 110;

const DAILY_PRD_LIMIT = 10;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!supabase || !data.user) {
    return NextResponse.json({ error: '로그인 후 PRD를 만들 수 있습니다.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { opportunities } = await getOpportunities();
  // An idea brief may come with no quotes at all; a classic request needs at least one.
  const resolved = inputFromBody(opportunities, body, toLang(body?.lang));
  if (!resolved || (!resolved.brief && !resolved.picked.length)) return NextResponse.json({ error: '담은 근거를 찾지 못했습니다.' }, { status: 422 });
  const { input, picked, brief, notes } = resolved;
  // The maker's own input (an idea brief or notes) makes the PRD theirs: it may build on hypotheses, and it never goes
  // into or comes out of the shared cache, which holds the evidence-only PRD for each set of quotes.
  const personal = Boolean(brief || notes);
  // Below the bar the PRD is still made, but as a labeled hypothesis draft (never a "verified" PRD).
  const draft = !meetsEvidenceBar(picked.length, new Set(picked.map((item) => item.evidence.platform)).size);

  if (!(await consumeDailyUsage(supabase, 'prd', DAILY_PRD_LIMIT))) {
    return NextResponse.json({ error: `PRD는 하루 ${DAILY_PRD_LIMIT}개까지 만들 수 있습니다.` }, { status: 429 });
  }

  const cache = createAdminClient();
  const { data: onboarding } = await supabase.from('user_onboarding').select('answers').eq('user_id', data.user.id).maybeSingle();
  const beginner = isBeginner(onboarding?.answers);
  // Every account may pick a model; the admin's policy decides which ones run. Anything else falls back to free.
  const model = pickPrdModel(body?.model, await loadPrdPolicy(cache));
  const run = prdRunLog(cache, data.user, 'prd', model ?? 'default');
  const result = await generatePrd(input, { draft, lang: toLang(body?.lang), idea: personal, model, onUsage: run.onUsage, beginner, screens: false }).catch((error) => {
    console.error('PRD generation failed', error);
    return null;
  });
  await run.finish(Boolean(result), input.title);
  const ids = picked.map((item) => item.evidence.id);
  if (!result) {
    await releaseDailyUsage(supabase, 'prd');
    // The free model fails often; the last good PRD for the same quotes is better than an empty screen.
    // The cache is keyed by quotes only, so it never stands in for an idea PRD written from the user's answers.
    const cached = personal ? null : await readPrdCache(cache, ids);
    if (cached) return NextResponse.json({ ok: true, cached: true, cachedAt: cached.createdAt, input: cached.input, spec: cached.spec });
    return NextResponse.json({ error: 'PRD를 만들지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }

  // The cache stands in for anyone's failed request, so it keeps only full-scope PRDs.
  if (!personal && !beginner) await writePrdCache(cache, ids, input, result.spec);
  return NextResponse.json({
    ok: true,
    input,
    spec: result.spec,
    markdown: result.markdown,
    agentBrief: result.agentBrief,
  });
}
