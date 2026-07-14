import { applyIdeaEvidencePolicy, evaluateIdea } from '@/lib/ingest/ai';
import { validateIdeaInput } from '@/lib/ideas/input';
import { retrieveIdeaContext } from '@/lib/ingest/rag';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 110;

const EVALUATION_CACHE_HOURS = 24;
const EVALUATION_CRITERIA_VERSION = 'v5';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const rawIdea = typeof body?.idea === 'string' ? body.idea : '';
  const input = validateIdeaInput(rawIdea);

  if (!input.ok) {
    return NextResponse.json({ error: input.message }, { status: 422 });
  }
  const { idea, key: inputKey } = input;
  const key = `${inputKey}:${EVALUATION_CRITERIA_VERSION}`;

  const supabase = await createClient();
  const userResult = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const user = userResult.data.user;

  if (supabase && user) {
    const cacheAfter = new Date(Date.now() - EVALUATION_CACHE_HOURS * 60 * 60 * 1000).toISOString();
    const cacheByKey = await supabase
      .from('idea_evaluations')
      .select('result')
      .eq('user_id', user.id)
      .eq('evaluation_key', key)
      .eq('status', 'completed')
      .gte('created_at', cacheAfter)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const cacheByText = cacheByKey.error
      ? await supabase
          .from('idea_evaluations')
          .select('result')
          .eq('user_id', user.id)
          .eq('idea_text', idea)
          .eq('status', 'completed')
          .gte('created_at', cacheAfter)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
      : null;
    const cached = cacheByKey.data ?? cacheByText?.data;

    if (cached?.result && typeof cached.result === 'object') {
      const cachedResult = cached.result as { model?: string | null; evaluation?: unknown; references?: unknown };
      const cachedEvaluation = cachedResult.evaluation ?? cachedResult;
      const cachedReferences = Array.isArray(cachedResult.references) ? cachedResult.references : [];
      const referencesForPolicy = cachedReferences.filter((reference): reference is { source_table?: unknown } => Boolean(reference && typeof reference === 'object'));
      const evaluation = applyIdeaEvidencePolicy(cachedEvaluation as Parameters<typeof applyIdeaEvidencePolicy>[0], {
        referenceCount: referencesForPolicy.length,
        sourceTypeCount: new Set(referencesForPolicy.map((reference) => String(reference.source_table ?? 'unknown'))).size,
        marketEvidenceCount: referencesForPolicy.filter((reference) => ['ai_products', 'news_items'].includes(String(reference.source_table ?? ''))).length,
      });
      return NextResponse.json({ ok: true, evaluation, model: cachedResult.model ?? null, references: cachedReferences, saved: true, cached: true });
    }
  }

  const references = await retrieveIdeaContext(idea, { maxReferences: 6, syncMissing: true, maxSyncDocuments: 8 });
  const ragContext = references.map((reference, index) => [
    `[근거 ${index + 1}] ${reference.metadata.title ?? reference.source_table}`,
    `출처: ${reference.metadata.source ?? reference.source_table}`,
    `유사도: ${reference.similarity.toFixed(2)}`,
    `URL: ${reference.metadata.url ?? '없음'}`,
    reference.content.slice(0, 1_200),
  ].join('\n')).join('\n\n');
  const { evaluation: rawEvaluation, model, error: evaluationError } = await evaluateIdea({ idea, context: ragContext });
  if (!rawEvaluation) {
    return NextResponse.json({ error: evaluationError ?? '평가 모델에 연결하지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }
  const evaluation = applyIdeaEvidencePolicy(rawEvaluation, {
    referenceCount: references.length,
    sourceTypeCount: new Set(references.map((reference) => reference.source_table)).size,
    marketEvidenceCount: references.filter((reference) => ['ai_products', 'news_items'].includes(reference.source_table)).length,
  });
  let saved = false;
  let saveError: string | null = null;

  if (supabase && user) {
    const evaluationRecord = {
      user_id: user.id,
      idea_text: idea,
      evaluation_key: key,
      status: 'completed',
      score: evaluation.score,
      result: {
        ...evaluation,
        model,
        references,
      },
    };
    const { error } = await supabase
      .from('idea_evaluations')
      .insert(evaluationRecord);

    if (error) {
      const { evaluation_key: _evaluationKey, ...legacyRecord } = evaluationRecord;
      const { error: legacyError } = await supabase.from('idea_evaluations').insert(legacyRecord);
      if (legacyError) {
        console.error('Failed to save idea evaluation', legacyError);
        saveError = legacyError.message;
      } else {
        saved = true;
      }
    } else {
      saved = true;
    }
  }

  return NextResponse.json({
    ok: true,
    evaluation,
    model,
    references,
    saved,
    saveError,
    cached: false,
  });
}
