import { toLang } from '@/lib/i18n';
import { planQuestions } from '@/lib/opportunities/questions';
import { clientOf, rateLimited } from '@/lib/throttle';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 40;

// Asked once per idea, before sign-in is needed, so it is open to visitors and limited per address instead.
const PER_MINUTE = 6;

/** Planning questions for one idea. `questions: null` means the page should use its fixed list. */
export async function POST(request: Request) {
  if (rateLimited(`questions:${clientOf(request)}`, PER_MINUTE)) return NextResponse.json({ questions: null, reason: 'throttled' }, { status: 429 });
  const body = await request.json().catch(() => null);
  const idea = typeof body?.idea === 'string' ? body.idea.trim().slice(0, 300) : '';
  if (idea.length < 4) return NextResponse.json({ error: '아이디어를 한 줄로 적어 주세요.' }, { status: 400 });
  // Quote text only gives the model the users' own situations to draw options from; it is clipped like any input.
  const quotes = (Array.isArray(body?.quotes) ? body.quotes : []).filter((quote: unknown): quote is string => typeof quote === 'string').slice(0, 6).map((quote: string) => quote.slice(0, 300));
  const questions = await planQuestions(idea, quotes, toLang(body?.lang)).catch(() => null);
  return NextResponse.json({ questions });
}
