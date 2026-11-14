import { createHash } from 'node:crypto';
import { specInputFor } from '@/lib/opportunities/context';
import { findEvidence, getOpportunities } from '@/lib/opportunities/data';
import { generatePrd } from '@/lib/opportunities/prd';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { consumeDailyUsage, releaseDailyUsage } from '@/lib/usage-limit';
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
  if (!picked.length) return NextResponse.json({ error: '담은 근거를 찾지 못했습니다.' }, { status: 422 });
  // Below the bar the PRD is still made, but as a labeled hypothesis draft (never a "verified" PRD).
  const draft = !meetsEvidenceBar(picked.length, new Set(picked.map((item) => item.evidence.platform)).size);
  const input = specInputFor(opportunities, picked, requestedTitle);
  if (!input) return NextResponse.json({ error: '담은 근거를 찾지 못했습니다.' }, { status: 422 });

  if (!(await consumeDailyUsage(supabase, 'prd', DAILY_PRD_LIMIT))) {
    return NextResponse.json({ error: `PRD는 하루 ${DAILY_PRD_LIMIT}개까지 만들 수 있습니다.` }, { status: 429 });
  }

  const result = await generatePrd(input, { draft }).catch((error) => {
    console.error('PRD generation failed', error);
    return null;
  });
  const cacheKey = createHash('sha256').update(picked.map((item) => item.evidence.id).sort().join(',')).digest('hex').slice(0, 40);
  const cache = createAdminClient();
  if (!result) {
    await releaseDailyUsage(supabase, 'prd');
    // The free model fails often; the last good PRD for the same quotes is better than an empty screen.
    const { data: cached } = cache ? await cache.from('prd_cache').select('input,spec,created_at').eq('evidence_key', cacheKey).maybeSingle() : { data: null };
    if (cached) return NextResponse.json({ ok: true, cached: true, cachedAt: cached.created_at, input: cached.input, spec: cached.spec });
    return NextResponse.json({ error: 'PRD를 만들지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }

  if (cache) {
    const { error } = await cache.from('prd_cache').upsert({ evidence_key: cacheKey, input, spec: result.spec, created_at: new Date().toISOString() });
    if (error) console.error('PRD cache write failed', error.message);
  }
  return NextResponse.json({
    ok: true,
    input,
    spec: result.spec,
    markdown: result.markdown,
    agentBrief: result.agentBrief,
  });
}
