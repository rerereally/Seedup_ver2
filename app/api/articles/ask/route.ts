import { answerArticleQuestion } from '@/lib/ingest/ai';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === 'string' ? body.title : '';
  const summary = typeof body?.summary === 'string' ? body.summary : '';
  const content = typeof body?.content === 'string' ? body.content : '';
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

  const { result, model, error } = await answerArticleQuestion({ title, summary, content, question, history });
  if (!result) {
    return NextResponse.json({ error: error ?? '글 도우미 응답을 만들지 못했습니다. 잠시 후 다시 시도해주세요.' }, { status: 503 });
  }
  return NextResponse.json({ ok: true, ...result, model });
}
