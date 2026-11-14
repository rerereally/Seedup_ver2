'use server';

import { createClient } from '@/lib/supabase/server';
import { isAdminEmail } from '@/lib/auth/admin';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { DEEP_DIVE_STEP, INGEST_STEPS, type IngestStepKey } from '@/lib/ingest/steps';

const INGEST_PATHS: Record<IngestStepKey, string> = Object.fromEntries([...INGEST_STEPS, DEEP_DIVE_STEP]) as Record<IngestStepKey, string>;

type IngestKey = IngestStepKey;

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
  const { ok, reason } = await requestIngest(buildIngestUrl(INGEST_PATHS[target], headerStore), secret);

  revalidatePath('/admin/ingest');
  redirect(`/admin/ingest?status=${ok ? 'success' : 'failed'}&target=${target}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`);
}

export async function runFullIngest() {
  const supabase = await createClient();
  if (!supabase) redirect('/login');

  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');
  if (!isAdminEmail(data.user.email)) redirect('/');

  const secret = process.env.INGEST_SECRET;
  if (!secret) redirect('/admin/ingest?status=missing-secret');

  const headerStore = await headers();
  const failedSteps: string[] = [];
  for (const [target, path] of INGEST_STEPS) {
    const { ok } = await requestIngest(buildIngestUrl(path, headerStore), secret);
    if (!ok) failedSteps.push(target);
  }

  revalidatePath('/admin/ingest');
  if (failedSteps.length) redirect(`/admin/ingest?status=failed&target=all&reason=${encodeURIComponent(failedSteps.join(', '))}`);
  redirect('/admin/ingest?status=success&target=all');
}

function buildIngestUrl(path: string, headerStore: Headers) {
  const configuredBaseUrl = process.env.INGEST_INTERNAL_URL || process.env.NEXT_PUBLIC_SITE_URL;
  const host = headerStore.get('x-forwarded-host') || headerStore.get('host');
  const protocol = headerStore.get('x-forwarded-proto') ?? 'http';
  const baseUrl = configuredBaseUrl || (host ? `${protocol}://${host}` : 'http://localhost:3000');
  return `${baseUrl}${path}`;
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

async function requestIngest(url: string, secret: string) {
  try {
    const response = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'x-ingest-secret': secret },
    });
    return {
      ok: response.ok,
      reason: response.ok ? '' : await getFailureReason(response),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cause = error instanceof Error && error.cause && typeof error.cause === 'object'
      ? (error.cause as { code?: string; message?: string })
      : null;
    const detail = cause?.code || cause?.message;
    return {
      ok: false,
      reason: truncateReason(detail ? `${message}: ${detail}` : message),
    };
  }
}
