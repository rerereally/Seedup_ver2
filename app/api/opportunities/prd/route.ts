import { cachePrd, cachedPrd, prdPolicy, prdRun } from '@/lib/db/server';
import { onboardingAnswers } from '@/lib/db/onboarding';
import { toLang } from '@/lib/i18n';
import { isBeginner, preferredStack } from '@/lib/onboarding';
import { getOpportunities } from '@/lib/opportunities/data';
import { inputFromBody } from '@/lib/opportunities/idea';
import { DEFAULT_PAID_PRD_MODEL, pickPrdModel } from '@/lib/opportunities/models';
import { generatePrd } from '@/lib/opportunities/prd';
import type { PrdEvent } from '@/lib/opportunities/prd';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
import { withEvidenceStrength, withPrdReadiness } from '@/lib/opportunities/spec';
import { publicEvidence } from '@/lib/opportunities/types';
import { createClient } from '@/lib/supabase/server';
import { consumeDailyUsage, releaseDailyUsage } from '@/lib/usage-limit';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 160;

const DAILY_PRD_LIMIT = 10;

/**
 * Makes a PRD. With `stream: true` the answer is NDJSON: the model's text as it is written ({"type":"delta"}), the
 * steps after it, then one {"type":"done"} line with the checked spec (or {"type":"error"}). Without it, one JSON
 * answer as before.
 */
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
  const checked = publicEvidence(picked.map((item) => item.evidence));
  const draft = !meetsEvidenceBar(checked.length, new Set(checked.map((item) => item.platform)).size);

  if (!(await consumeDailyUsage(supabase, 'prd', DAILY_PRD_LIMIT))) {
    return NextResponse.json({ error: `PRD는 하루 ${DAILY_PRD_LIMIT}개까지 만들 수 있습니다.` }, { status: 429 });
  }

  const answers = await onboardingAnswers(supabase, data.user.id);
  const beginner = isBeginner(answers);
  const stack = preferredStack(answers).slice(0, 8).map((item) => item.trim().slice(0, 60));
  // Every account may pick a model; the admin's policy decides which ones run. Anything else defaults to GPT 6.2 Sol.
  const model = pickPrdModel(body?.model, await prdPolicy()) ?? DEFAULT_PAID_PRD_MODEL;
  const run = prdRun(data.user, 'prd', model);
  const lang = toLang(body?.lang);
  const ids = picked.map((item) => item.evidence.id);

  // Shared by both answer styles: the finished result, or the fallback when the model gave nothing.
  const make = async (onEvent?: (event: PrdEvent) => void) => {
    const result = await generatePrd(input, { draft, lang, idea: personal, model, onUsage: run.onUsage, beginner, stack, onEvent }).catch((error) => {
      console.error('PRD generation failed', error);
      return null;
    });
    const runKey = await run.finish(Boolean(result), input.title);
    if (result) {
      // The cache stands in for anyone's failed request, so it keeps only full-scope PRDs.
      if (!personal && !beginner && !stack.length) await cachePrd(ids, input, result.spec);
      return { ok: true as const, runKey, input, spec: result.spec, markdown: result.markdown, agentBrief: result.agentBrief };
    }
    await releaseDailyUsage(supabase, 'prd');
    // The free model fails often; the last good PRD for the same quotes is better than an empty screen.
    // The cache is keyed by quotes only, so it never stands in for an idea PRD written from the user's answers.
    const cached = personal ? null : await cachedPrd(ids);
    if (cached) return { ok: true as const, cached: true, cachedAt: cached.createdAt, input: cached.input, spec: withEvidenceStrength(withPrdReadiness(cached.spec), cached.input.evidence) };
    return null;
  };

  if (body?.stream !== true) {
    const answer = await make();
    return answer ? NextResponse.json(answer) : NextResponse.json({ error: 'PRD를 만들지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (line: unknown) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
        } catch {
          // The reader left; the PRD still finishes so the run log and cache stay right.
        }
      };
      // Periodic keep-alive prevents CDN/proxy idle timeouts while reasoning models think silently.
      const heartbeat = setInterval(() => send({ type: 'ping' }), 15_000);
      try {
        const answer = await make(send);
        send(answer ? { type: 'done', ...answer } : { type: 'error', error: 'PRD를 만들지 못했습니다. 잠시 후 다시 시도해주세요.' });
      } finally {
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // Already closed by a reader that left.
        }
      }
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store, no-transform', 'x-accel-buffering': 'no' } });
}
