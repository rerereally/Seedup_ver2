import { assertIngestAuth } from '@/lib/ingest/auth';
import { INGEST_STEPS } from '@/lib/ingest/steps';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function GET(request: Request) {
  return ingestAll(request);
}

export async function POST(request: Request) {
  return ingestAll(request);
}

async function ingestAll(request: Request) {
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;

  const secret = process.env.INGEST_SECRET ?? process.env.CRON_SECRET;
  const origin = new URL(request.url).origin;
  const results: Array<{ step: string; ok: boolean; status: number; detail: unknown }> = [];

  for (const [step, path] of INGEST_STEPS) {
    const url = `${origin}${path}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        cache: 'no-store',
        headers: secret ? { 'x-ingest-secret': secret } : undefined,
        // One stuck step is reported as failed, and the remaining steps still run.
        signal: AbortSignal.timeout(280_000),
      });
      const contentType = response.headers.get('content-type') ?? '';
      const detail = contentType.includes('application/json') ? await response.json() : await response.text();
      results.push({ step, ok: response.ok, status: response.status, detail });
    } catch (error) {
      results.push({ step, ok: false, status: 0, detail: error instanceof Error ? error.message : String(error) });
    }
  }

  const ok = results.every((result) => result.ok);
  return NextResponse.json({ ok, results }, { status: ok ? 200 : 207 });
}
