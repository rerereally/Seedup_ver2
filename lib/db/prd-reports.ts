import { createHmac } from 'node:crypto';
import { createAdminClient } from '../supabase/admin';
import type { ReportReason } from '../opportunities/prd-report-input';

export async function submitPrdReport(dossierId: string, reason: ReportReason, note: string, reporterId: string | null, visitor: string) {
  const db = createAdminClient();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!db || !secret) return 'unavailable';
  const reporterKey = createHmac('sha256', secret)
    .update(JSON.stringify(['prd-report', dossierId.toLowerCase(), reporterId ? 'user' : 'anonymous', reporterId ?? visitor]))
    .digest('hex');
  const { data, error } = await db.rpc('submit_prd_report', {
    p_dossier_id: dossierId,
    p_reason: reason,
    p_note: note,
    p_reporter_id: reporterId,
    p_reporter_key: reporterKey,
  });
  return error ? 'unavailable' : data ? 'accepted' : 'not-found';
}

export async function pendingPrdReports() {
  const db = createAdminClient();
  if (!db) return [];
  const { data, error } = await db.from('prd_reports')
    .select('id,dossier_id,reason,note,created_at,evidence_dossiers(title,shared)')
    .eq('status', 'pending').order('created_at').limit(50);
  return error ? [] : (data ?? []) as unknown as Array<{
    id: string; dossier_id: string; reason: ReportReason; note: string; created_at: string;
    evidence_dossiers: { title: string; shared: boolean } | null;
  }>;
}

export async function resolvePrdReport(id: string, status: 'ignored' | 'removed') {
  const db = createAdminClient();
  if (!db) return false;
  const { data, error } = await db.from('prd_reports').update({ status }).eq('id', id).eq('status', 'pending').select('id').maybeSingle();
  return !error && Boolean(data);
}
