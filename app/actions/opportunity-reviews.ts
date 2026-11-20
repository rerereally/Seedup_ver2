'use server';

import { isAdminUser } from '@/lib/auth/admin';
import { forget } from '@/lib/cache';
import { deleteOpportunityReview, saveOpportunityReview, type OpportunityReviewKind } from '@/lib/db/opportunity-reviews';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

async function requireAdmin() {
  const supabase = await createClient();
  if (!supabase) redirect('/login');
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  if (!isAdminUser(data.user)) redirect('/');
  return data.user;
}

function flushReviewCache(status: string) {
  forget('opportunities');
  revalidatePath('/admin/ingest');
  revalidatePath('/');
  revalidatePath('/newsletter-preview');
  redirect(`/admin/ingest?review=${encodeURIComponent(status)}#opportunity-reviews`);
}

export async function hideOpportunityAction(formData: FormData) {
  const user = await requireAdmin();
  const slug = String(formData.get('slug') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const result = await saveOpportunityReview({
    slug,
    kind: 'hide',
    quote: '',
    reason,
    created_by: user.email ?? user.id,
  });
  flushReviewCache(result.ok ? 'saved' : result.error);
}

export async function dropOpportunityQuoteAction(formData: FormData) {
  const user = await requireAdmin();
  const slug = String(formData.get('slug') ?? '').trim();
  const quote = String(formData.get('quote') ?? '').trim();
  const reason = String(formData.get('reason') ?? '').trim();
  const result = await saveOpportunityReview({
    slug,
    kind: 'drop_quote',
    quote,
    reason,
    created_by: user.email ?? user.id,
  });
  flushReviewCache(result.ok ? 'saved' : result.error);
}

export async function removeOpportunityReviewAction(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get('slug') ?? '').trim();
  const kind = formData.get('kind') === 'drop_quote' ? ('drop_quote' as OpportunityReviewKind) : ('hide' as OpportunityReviewKind);
  const quote = String(formData.get('quote') ?? '').trim();
  const result = await deleteOpportunityReview({ slug, kind, quote });
  flushReviewCache(result.ok ? 'deleted' : result.error);
}
