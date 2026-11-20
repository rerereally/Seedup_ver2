import { toLang } from '@/lib/i18n';
import { checkIdeaClarity } from '@/lib/opportunities/questions';
import { clientOf, rateLimited } from '@/lib/throttle';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 40;

// Same limit as the planning questions: open to visitors, counted per address, never against the report quota.
const PER_MINUTE = 6;

/** Which of who, problem and how a one-line idea leaves out. `clarity: null` means the page shows no hint. */
export async function POST(request: Request) {
  if (await rateLimited(`clarity:${clientOf(request)}`, PER_MINUTE)) return NextResponse.json({ clarity: null, reason: 'throttled' }, { status: 429 });
  const body = await request.json().catch(() => null);
  const idea = typeof body?.idea === 'string' ? body.idea.trim().slice(0, 300) : '';
  if (idea.length < 4) return NextResponse.json({ error: '아이디어를 한 줄로 적어 주세요.' }, { status: 400 });
  const clarity = await checkIdeaClarity(idea, toLang(body?.lang)).catch(() => null);
  return NextResponse.json({ clarity });
}
