'use server';

import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/auth/admin';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

const INGEST_PATHS = {
  rss: '/api/ingest/rss?limit=8&minScore=50',
  products: '/api/ingest/products?limit=12',
  github: '/api/ingest/github?limit=15&minStars=50&pruneDays=30',
  research: '/api/ingest/research?limit=12&minScore=55&minFitScore=18',
  'external-trends': '/api/ingest/external-trends',
  trends: '/api/ingest/trends',
  'project-ideas': '/api/ingest/project-ideas?limit=10',
  'article-drafts': '/api/ingest/article-drafts?mode=daily&limit=8',
  'deep-dive': '/api/ingest/article-drafts?mode=deep-dive&limit=1&minSources=5&minSourceTypes=3',
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
  const { ok, reason } = await requestIngest(`${baseUrl}${INGEST_PATHS[target]}${separator}secret=${encodeURIComponent(secret)}`);

  revalidatePath('/admin/ingest');
  redirect(`/admin/ingest?status=${ok ? 'success' : 'failed'}&target=${target}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`);
}

export async function runFullIngest() {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  if (!isAdminEmail(data.user.email)) redirect('/');

  const order: IngestKey[] = ['rss', 'products', 'github', 'research', 'external-trends', 'trends', 'project-ideas', 'article-drafts'];

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

  await requestIngest(`${baseUrl}${INGEST_PATHS[target]}${separator}secret=${encodeURIComponent(secret)}`);
}

async function getFailureReason(response: Response) {
  try {
    const text = await response.text();
    if (!text) return `HTTP ${response.status}`;

    try {
      const json = JSON.parse(text) as Record<string, unknown>;
      const message = json.error ?? json.message ?? json.detail ?? json.status;
      return truncateReason(typeof message === 'string' ? message : text);
    } catch {
      return truncateReason(text);
    }
  } catch {
    return `HTTP ${response.status}`;
  }
}

function truncateReason(value: string) {
  return value.replace(/\s+/g, ' ').trim().slice(0, 180);
}

async function requestIngest(url: string) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
    });
    return {
      ok: response.ok,
      reason: response.ok ? '' : await getFailureReason(response),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      reason: truncateReason(message),
    };
  }
}
