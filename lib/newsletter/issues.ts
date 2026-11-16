import type { SupabaseClient } from '@supabase/supabase-js';
import type { DigestIssue } from './opportunity-digest';

/** A sent (or ready) weekly issue as the web archive shows it: the version for everyone, not one reader's. */
export type StoredIssue = { period: string; subject: string; issue: DigestIssue; createdAt: string };

const PERIOD = /^\d{4}-\d{2}-\d{2}$/;

/** Keeps the issue for the archive. Best effort: a missing table must never stop the mail itself. */
export async function saveIssue(service: SupabaseClient, period: string, issue: DigestIssue) {
  const { error } = await service.from('newsletter_issues').upsert({ period_key: period, subject: issue.subject, data: issue });
  if (error) console.error('newsletter issue not archived:', error.message);
}

export async function listIssues(service: SupabaseClient | null, limit = 12): Promise<StoredIssue[]> {
  if (!service) return [];
  const { data, error } = await service.from('newsletter_issues').select('period_key,subject,data,created_at').order('period_key', { ascending: false }).limit(limit);
  if (error) return [];
  return (data ?? []).map((row) => ({ period: String(row.period_key), subject: String(row.subject), issue: row.data as DigestIssue, createdAt: String(row.created_at) }));
}

export async function getIssue(service: SupabaseClient | null, period: string): Promise<StoredIssue | null> {
  if (!service || !PERIOD.test(period)) return null;
  const { data, error } = await service.from('newsletter_issues').select('period_key,subject,data,created_at').eq('period_key', period).maybeSingle();
  if (error || !data) return null;
  return { period: String(data.period_key), subject: String(data.subject), issue: data.data as DigestIssue, createdAt: String(data.created_at) };
}
