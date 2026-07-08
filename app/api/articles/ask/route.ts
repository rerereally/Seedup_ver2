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

  if (!title || !question) {
    return NextResponse.json({ error: 'Article title and question are required' }, { status: 400 });
  }

  const { result, model } = await answerArticleQuestion({ title, summary, content, question });
  return NextResponse.json({ ok: true, ...result, model });
}
