import { incrementContentView } from '@/lib/engagement';
import type { ContentTarget } from '@/lib/content-targets';
import { clientOf, rateLimited } from '@/lib/throttle';
import { NextResponse } from 'next/server';

const ALLOWED_TYPES = new Set<ContentTarget>(['news', 'paper', 'github', 'project', 'ai_product']);
// Every content table keys on a uuid; anything else is not a real item.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// One address counts once per item per minute and 60 views a minute overall, so a script cannot pump a ranking.
const VIEWS_PER_MINUTE = 60;

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const itemType = String(body?.itemType ?? '') as ContentTarget;
  const itemId = String(body?.itemId ?? '');
  if (!ALLOWED_TYPES.has(itemType) || !UUID.test(itemId)) return NextResponse.json({ error: 'Invalid view' }, { status: 400 });
  const client = clientOf(request);
  // A repeat is answered as fine but not counted: the page has nothing to do about it.
  if (await rateLimited(`view:${client}`, VIEWS_PER_MINUTE) || await rateLimited(`view:${client}:${itemType}:${itemId}`, 1)) return NextResponse.json({ ok: true, counted: false });
  await incrementContentView(itemType, itemId);
  return NextResponse.json({ ok: true });
}
