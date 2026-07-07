'use server';

import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/auth/admin';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const INGEST_PATHS = {
  rss: '/api/ingest/rss?limit=5',
  products: '/api/ingest/products?limit=10',
  github: '/api/ingest/github?limit=5',
  trends: '/api/ingest/trends',
  'project-ideas': '/api/ingest/project-ideas?limit=10',
} as const;

type IngestKey = keyof typeof INGEST_PATHS;

export async function runManualIngest(formData: FormData) {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  if (!isAdminEmail(data.user.email)) redirect('/');

  const target = String(formData.get('target') ?? '') as IngestKey;
  if (!INGEST_PATHS[target]) redirect('/admin/ingest?status=invalid');

  const secret = process.env.INGEST_SECRET;
  if (!secret) redirect('/admin/ingest?status=missing-secret');

  const headerStore = await headers();
  const host = headerStore.get('host');
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${protocol}://${host}` : 'http://localhost:3000');
  const separator = INGEST_PATHS[target].includes('?') ? '&' : '?';
  const response = await fetch(`${baseUrl}${INGEST_PATHS[target]}${separator}secret=${encodeURIComponent(secret)}`, {
    method: 'POST',
    cache: 'no-store',
  });

  revalidatePath('/admin/ingest');
  redirect(`/admin/ingest?status=${response.ok ? 'success' : 'failed'}&target=${target}`);
}

export async function runFullIngest() {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  if (!isAdminEmail(data.user.email)) redirect('/');

  const order: IngestKey[] = ['rss', 'products', 'github', 'trends', 'project-ideas'];

  for (const target of order) {
    const formData = new FormData();
    formData.set('target', target);
    await runManualIngestNoRedirect(formData);
  }

  revalidatePath('/admin/ingest');
  redirect('/admin/ingest?status=success&target=all');
}

async function runManualIngestNoRedirect(formData: FormData) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return;

  const target = String(formData.get('target') ?? '') as IngestKey;
  if (!INGEST_PATHS[target]) return;

  const headerStore = await headers();
  const host = headerStore.get('host');
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http';
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || (host ? `${protocol}://${host}` : 'http://localhost:3000');
  const separator = INGEST_PATHS[target].includes('?') ? '&' : '?';

  await fetch(`${baseUrl}${INGEST_PATHS[target]}${separator}secret=${encodeURIComponent(secret)}`, {
    method: 'POST',
    cache: 'no-store',
  });
}
