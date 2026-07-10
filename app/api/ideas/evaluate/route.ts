import { evaluateIdea } from '@/lib/ingest/ai';
import { retrieveIdeaContext } from '@/lib/ingest/rag';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const idea = typeof body?.idea === 'string' ? body.idea.trim() : '';

  if (!idea) {
    return NextResponse.json({ error: 'Idea is required' }, { status: 400 });
  }

  const supabase = await createClient();
  const references = await retrieveIdeaContext(idea);
  const ragContext = references.map((reference, index) => [
    `[근거 ${index + 1}] ${reference.metadata.title ?? reference.source_table}`,
    `출처: ${reference.metadata.source ?? reference.source_table}`,
    `유사도: ${reference.similarity.toFixed(2)}`,
    `URL: ${reference.metadata.url ?? '없음'}`,
    reference.content,
  ].join('\n')).join('\n\n');
  const { evaluation, model } = await evaluateIdea({ idea, context: ragContext });
  const userResult = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const user = userResult.data.user;
  let saved = false;
  let saveError: string | null = null;

  if (supabase && user) {
    const { error } = await supabase
      .from('idea_evaluations')
      .insert({
        user_id: user.id,
        idea_text: idea,
        status: 'completed',
        score: evaluation.score,
        result: {
          ...evaluation,
          model,
          references,
        },
      });

    if (error) {
      console.error('Failed to save idea evaluation', error);
      saveError = error.message;
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
  });
}
