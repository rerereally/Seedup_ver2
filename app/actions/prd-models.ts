'use server';

import { isAdminUser } from '@/lib/auth/admin';
import { savePrdPolicy } from '@/lib/opportunities/models';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

/** Saves which PRD models every account may pick. Admins only; ticked boxes arrive as repeated "enabled" fields. */
export async function savePrdModelPolicy(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect('/login');
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  if (!isAdminUser(data.user)) redirect('/');

  const service = createAdminClient();
  if (!service) redirect('/admin/ingest?prdModels=missing-service-key#prd-models');
  let failed = false;
  try {
    await savePrdPolicy(service, formData.getAll('enabled').map(String), data.user.email ?? data.user.id);
  } catch (error) {
    console.error('PRD model policy not saved:', error);
    failed = true;
  }
  revalidatePath('/admin/ingest');
  redirect(`/admin/ingest?prdModels=${failed ? 'failed' : 'saved'}#prd-models`);
}
