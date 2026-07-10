import { incrementContentView } from '@/lib/engagement';
import type { ContentTarget } from '@/lib/content-targets';
import { NextResponse } from 'next/server';

const ALLOWED_TYPES = new Set<ContentTarget>(['news', 'paper', 'github', 'project', 'ai_product']);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const itemType = String(body?.itemType ?? '') as ContentTarget;
  const itemId = String(body?.itemId ?? '');
  if (!ALLOWED_TYPES.has(itemType) || !itemId) return NextResponse.json({ error: 'Invalid view' }, { status: 400 });
  await incrementContentView(itemType, itemId);
  return NextResponse.json({ ok: true });
}
