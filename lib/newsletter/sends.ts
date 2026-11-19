import type { SupabaseClient } from '@supabase/supabase-js';

export type SendClaim = 'claimed' | 'duplicate' | 'unavailable';

/**
 * Records that one mail of one issue is going to one person, before it is sent. The unique key makes a second
 * attempt for the same issue a no-op, for as long as the row exists, not just for the mail provider's 24 hours.
 * 'unavailable' means the table is missing or unreachable; callers then rely on the provider's own idempotency key.
 */
export async function claimSend(service: SupabaseClient, kind: string, periodKey: string, userId: string): Promise<SendClaim> {
  const { error } = await service.from('newsletter_sends').insert({ kind, period_key: periodKey, user_id: userId });
  if (!error) return 'claimed';
  return error.code === '23505' ? 'duplicate' : 'unavailable';
}

/** Gives the claim back after a failed send, so the next run can try this person again. */
export async function releaseSend(service: SupabaseClient, kind: string, periodKey: string, userId: string) {
  await service.from('newsletter_sends').delete().match({ kind, period_key: periodKey, user_id: userId });
}

type DigestMail = {
  kind: string;
  period: string;
  userId: string;
  email: string;
  resendKey: string;
  from: string;
  mail: { subject: string; html: string; text: string };
  allowUnclaimed?: boolean;
};

export async function sendDigestMail(service: SupabaseClient, { kind, period, userId, email, resendKey, from, mail, allowUnclaimed }: DigestMail) {
  const claim = await claimSend(service, kind, period, userId);
  if (claim === 'duplicate') return 'duplicates';
  if (claim === 'unavailable' && !allowUnclaimed) return 'failed';

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `${kind}-${period}-${userId}` },
    body: JSON.stringify({ from, to: email, subject: mail.subject, html: mail.html, text: mail.text }),
    signal: AbortSignal.timeout(30_000),
  }).catch(() => null);
  const result = response?.ok ? 'sent' : response?.status === 409 ? 'duplicates' : 'failed';
  if (result === 'failed' && claim === 'claimed') await releaseSend(service, kind, period, userId);
  await new Promise((done) => setTimeout(done, 600));
  return result;
}
