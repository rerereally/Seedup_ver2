import { answerArticleQuestion } from '@/lib/ingest/ai';
import { createClient } from '@/lib/supabase/server';
import { consumeDailyUsage, releaseDailyUsage } from '@/lib/usage-limit';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const MAX_TITLE_LENGTH = 200;
const DAILY_ASK_LIMIT = 40;

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  if (!data.user) {
    return NextResponse.json({ error: '로그인 후 사용할 수 있습니다.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title.slice(0, MAX_TITLE_LENGTH) : '';
  // The model only reads the first 2,200 characters; these caps just stop oversized request bodies.
  const summary = typeof body?.summary === 'string' ? body.summary.slice(0, 2_000) : '';
  const content = typeof body?.content === 'string' ? body.content.slice(0, 12_000) : '';
  const question = typeof body?.question === 'string' ? body.question.trim() : '';
  const historyItems: unknown[] = Array.isArray(body?.history) ? body.history : [];
  const history = historyItems
    .flatMap((message) => {
        if (!message || typeof message !== 'object') return [];
        const record = message as { role?: unknown; content?: unknown };
        if ((record.role !== 'user' && record.role !== 'assistant') || typeof record.content !== 'string') return [];
        const role: 'user' | 'assistant' = record.role;
        const content = record.content.trim().slice(0, 1_200);
        return content ? [{ role, content }] : [];
      }).slice(-4);

  if (!title || !question) {
    return NextResponse.json({ error: 'Article title and question are required' }, { status: 400 });
  }

  if (supabase && !(await consumeDailyUsage(supabase, 'article_ask', DAILY_ASK_LIMIT))) {
    return NextResponse.json({ error: `글 도우미는 하루 ${DAILY_ASK_LIMIT}번까지 사용할 수 있습니다.` }, { status: 429 });
  }

  const { result, model, error } = await answerArticleQuestion({ title, summary, content, question, history });
  if (!result) {
    if (supabase) await releaseDailyUsage(supabase, 'article_ask');
    return NextResponse.json({ error: error ?? '글 도우미 응답을 만들지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, ...result, model });
}
