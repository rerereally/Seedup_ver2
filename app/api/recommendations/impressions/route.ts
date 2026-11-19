import { recordImpressions } from '@/lib/db/recommendations';
import { createClient } from '@/lib/supabase/server';
import { clientOf, rateLimited } from '@/lib/throttle';
import { NextResponse } from 'next/server';

const ALLOWED_TYPES = new Set(['news', 'paper', 'github', 'project', 'ai_product']);
// Anyone, signed in or not, can write here, so each visitor gets a per-minute budget (RL_30 binding).
const REQUESTS_PER_MINUTE = 30;

export async function POST(request: Request) {
  if (await rateLimited(`impressions:${clientOf(request)}`, REQUESTS_PER_MINUTE)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': '60' } });
  }
  const body = await request.json().catch(() => null) as {
    surface?: string;
    eventType?: 'impression' | 'click';
    items?: Array<{ itemType?: string; itemId?: string; position?: number; score?: number; reasons?: string[] }>;
  } | null;
  const surface = String(body?.surface ?? 'unknown').slice(0, 80);
  const eventType = body?.eventType === 'click' ? 'click' : 'impression';
  const items = Array.isArray(body?.items) ? body.items.slice(0, 20) : [];
  if (!items.length) return NextResponse.json({ ok: true, recorded: 0 });

  const supabase = await createClient();
  if (!supabase) return NextResponse.json({ error: 'Supabase is not configured' }, { status: 503 });
  const { data: userData } = await supabase.auth.getUser();

  const rows = items
    .filter((item) => ALLOWED_TYPES.has(String(item.itemType)) && item.itemId)
    .map((item) => ({
      user_id: userData.user?.id ?? null,
      item_type: String(item.itemType),
      item_id: String(item.itemId).slice(0, 120),
      surface,
      event_type: eventType,
      position: Number.isFinite(item.position) ? item.position : null,
      score: Number.isFinite(item.score) ? item.score : null,
      reasons: Array.isArray(item.reasons) ? item.reasons.slice(0, 3) : [],
    }));
  if (!rows.length) return NextResponse.json({ ok: true, recorded: 0 });

  const { error } = await recordImpressions(supabase, rows);
  if (error) return NextResponse.json({ error: 'Could not record recommendation impressions' }, { status: 500 });
  return NextResponse.json({ ok: true, recorded: rows.length });
}
