import { toLang } from '@/lib/i18n';
import { normalizeQuestions, planQuestionRound, questionTrack, readQuestionHistory } from '@/lib/opportunities/questions';
import { clientOf, rateLimited } from '@/lib/throttle';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 40;

// Open to visitors and limited per address.
const PER_MINUTE = 6;

/** A null first batch uses the fixed questions. An empty follow-up ends the interview. */
export async function POST(request: Request) {
  if (await rateLimited(`questions:${clientOf(request)}`, PER_MINUTE)) return NextResponse.json({ questions: null, track: 'A', trackReason: '', done: true, reason: 'throttled' }, { status: 429 });
  const body = await request.json().catch(() => null);
  const idea = typeof body?.idea === 'string' ? body.idea.trim().slice(0, 300) : '';
  if (idea.length < 4) return NextResponse.json({ error: '아이디어를 한 줄로 적어 주세요.' }, { status: 400 });
  // Quote text only gives the model the users' own situations to draw options from; it is clipped like any input.
  const quotes = (Array.isArray(body?.quotes) ? body.quotes : []).filter((quote: unknown): quote is string => typeof quote === 'string').slice(0, 6).map((quote: string) => quote.slice(0, 300));
  const input = {
    track: questionTrack(body?.track),
    history: Array.isArray(body?.history) ? readQuestionHistory(body.history) : undefined,
  };
  const plan = await planQuestionRound(idea, quotes, toLang(body?.lang), input).catch(() => normalizeQuestions(null, input));
  return NextResponse.json(plan);
}
