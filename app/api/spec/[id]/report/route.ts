import { revalidatePath } from 'next/cache';
import { submitPrdReport } from '@/lib/db/prd-reports';
import { isReportId, readPrdReport } from '@/lib/opportunities/prd-report-input';
import { getCurrentUser } from '@/lib/supabase/server';
import { clientOf, rateLimited } from '@/lib/throttle';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const visitor = clientOf(request);
  if (await rateLimited(`prd-report:${visitor}`, 6)) return Response.json({ error: 'rate-limit' }, { status: 429, headers: { 'Retry-After': '60' } });
  const { id } = await params;
  if (!isReportId(id)) return Response.json({ error: 'not-found' }, { status: 404 });
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') {
    return Response.json({ error: 'invalid' }, { status: 415 });
  }
  const report = readPrdReport(await request.json().catch(() => null));
  if (!report) return Response.json({ error: 'invalid' }, { status: 400 });
  const user = await getCurrentUser();
  const result = await submitPrdReport(id, report.reason, report.note, user?.id ?? null, visitor);
  if (result === 'not-found') return Response.json({ error: 'not-found' }, { status: 404 });
  if (result === 'unavailable') return Response.json({ error: 'unavailable' }, { status: 503 });
  revalidatePath('/spec');
  return Response.json({ ok: true });
}
