'use server';

import { isAdminUser } from '@/lib/auth/admin';
import { specInputFor } from '@/lib/opportunities/context';
import { getOpportunities } from '@/lib/opportunities/data';
import { loadPrdPolicy, pickPrdModel, savePrdPolicy } from '@/lib/opportunities/models';
import { generatePrd } from '@/lib/opportunities/prd';
import { PRD_MAX_EVIDENCE, writePrdCache } from '@/lib/opportunities/prd-cache';
import { prdRunLog } from '@/lib/opportunities/prd-runs';
import { meetsEvidenceBar } from '@/lib/opportunities/rules';
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

/**
 * Makes and saves the evidence-only PRD of one opportunity ahead of a demo, with a model the admin picks. Saved PRDs open
 * instantly for every visitor, so a live demo never waits on a model. One opportunity per press keeps each request short.
 */
export async function prebuildDemoPrd(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect('/login');
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  if (!isAdminUser(data.user)) redirect('/');

  const service = createAdminClient();
  if (!service) redirect('/admin/ingest?demo=missing-service-key#demo-prds');
  const slug = String(formData.get('slug') ?? '');
  const { opportunities } = await getOpportunities();
  const opportunity = opportunities.find((item) => item.slug === slug);
  if (!opportunity) redirect('/admin/ingest?demo=unknown#demo-prds');

  const picked = opportunity.evidence.slice(0, PRD_MAX_EVIDENCE).map((evidence) => ({ evidence, slug }));
  const input = specInputFor(opportunities, picked);
  if (!input) redirect('/admin/ingest?demo=no-quotes#demo-prds');
  const model = pickPrdModel(formData.get('model'), await loadPrdPolicy(service));
  const run = prdRunLog(service, data.user, 'prd', model ?? 'default');
  const draft = !meetsEvidenceBar(picked.length, new Set(picked.map((item) => item.evidence.platform)).size);
  const result = await generatePrd(input, { draft, model, onUsage: run.onUsage }).catch(() => null);
  await run.finish(Boolean(result), `[시연] ${input.title}`);
  if (result) await writePrdCache(service, picked.map((item) => item.evidence.id), input, result.spec);
  revalidatePath('/admin/ingest');
  redirect(`/admin/ingest?demo=${result ? 'saved' : 'failed'}#demo-prds`);
}
