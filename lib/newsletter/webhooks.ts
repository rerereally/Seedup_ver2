import type { SupabaseClient } from '@supabase/supabase-js';
import { claimSend, releaseSend } from './sends';

const DISCORD = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[\w-]+$/;
const SLACK = /^https:\/\/hooks\.slack\.com\/services\/[\w/]+$/;

/**
 * Only Discord and Slack incoming-webhook addresses are accepted: the server posts to this address, so anything else
 * could point it at an internal or unrelated service.
 */
export function webhookKind(value: unknown): 'discord' | 'slack' | null {
  const url = String(value ?? '').trim();
  if (DISCORD.test(url)) return 'discord';
  if (SLACK.test(url)) return 'slack';
  return null;
}

/** One message for the chat: Discord caps a message at 2,000 characters, Slack takes plain text with links. */
export function webhookPayload(kind: 'discord' | 'slack', subject: string, text: string) {
  const body = `**${subject}**\n\n${text}`;
  return kind === 'discord' ? { content: body.length > 1990 ? `${body.slice(0, 1989)}…` : body } : { text: `*${subject}*\n\n${text}` };
}

/** Posts one digest to every person who added a webhook, once per issue (claimed in newsletter_sends). */
export async function sendWebhookDigest(service: SupabaseClient, kind: string, period: string, subject: string, text: string) {
  const { data, error } = await service.from('user_onboarding').select('user_id,notify_webhook').not('notify_webhook', 'is', null).limit(5000);
  if (error) return { sent: 0, failed: 0 };
  let sent = 0;
  let failed = 0;
  for (const row of data ?? []) {
    const type = webhookKind(row.notify_webhook);
    if (!type) continue;
    const userId = String(row.user_id);
    const claim = await claimSend(service, `webhook-${kind}`, period, userId);
    if (claim === 'duplicate') continue;
    const response = await fetch(String(row.notify_webhook), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(webhookPayload(type, subject, text)), signal: AbortSignal.timeout(15_000) }).catch(() => null);
    if (response?.ok) sent += 1;
    else {
      failed += 1;
      if (claim === 'claimed') await releaseSend(service, `webhook-${kind}`, period, userId);
    }
  }
  return { sent, failed };
}
