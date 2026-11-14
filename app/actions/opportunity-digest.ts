'use server';

import { isAdminEmail } from '@/lib/auth/admin';
import type { DigestKind } from '@/lib/newsletter/opportunity-digest';
import { digestSiteUrl, sendOpportunityDigest } from '@/lib/newsletter/opportunity-digest-send';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

function kindFrom(formData: FormData): DigestKind {
  return formData.get('kind') === 'weekly' ? 'weekly' : 'changes';
}

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  if (!isAdminEmail(data.user.email)) redirect('/');
}

// Preview only builds the mail and never sends. The page renders the text itself, so it stays out of the URL.
export async function previewOpportunityDigestMail(formData: FormData) {
  await requireAdmin();
  redirect(`/admin/ingest?digest=preview&kind=${kindFrom(formData)}`);
}

export async function sendOpportunityDigestMail(formData: FormData) {
  await requireAdmin();
  const kind = kindFrom(formData);

  let outcome;
  try {
    outcome = await sendOpportunityDigest({
      service: createAdminClient(),
      kind,
      dryRun: false,
      siteUrl: digestSiteUrl(),
      resendKey: process.env.RESEND_API_KEY,
      from: process.env.NEWSLETTER_FROM_EMAIL,
    });
  } catch {
    redirect(`/admin/ingest?digest=skipped&reason=error&kind=${kind}`);
  }

  if (outcome.status === 'sent') redirect(`/admin/ingest?digest=sent&kind=${kind}&sent=${outcome.sent}&duplicates=${outcome.duplicates}&failed=${outcome.failed}`);
  const reason = outcome.status === 'empty' ? 'empty' : 'not-configured';
  redirect(`/admin/ingest?digest=skipped&kind=${kind}&reason=${reason}`);
}
