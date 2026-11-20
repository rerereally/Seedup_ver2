'use server';

import { revalidatePath } from 'next/cache';
import { notFound, redirect } from 'next/navigation';
import { isAdminUser } from '@/lib/auth/admin';
import { resolvePrdReport } from '@/lib/db/prd-reports';
import { isReportId } from '@/lib/opportunities/prd-report-input';
import { getCurrentUser } from '@/lib/supabase/server';

export async function moderatePrdReport(form: FormData) {
  if (!isAdminUser(await getCurrentUser())) notFound();
  const id = form.get('id');
  const status = form.get('status');
  const updated = isReportId(id) && (status === 'removed' || status === 'ignored') && await resolvePrdReport(id, status);
  if (updated) revalidatePath('/spec');
  redirect(`/admin/ingest?prdReport=${updated ? status : 'error'}#prd-reports`);
}
