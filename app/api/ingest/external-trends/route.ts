import { assertIngestAuth } from '@/lib/ingest/auth';
import { ingestExternalTrends } from '@/lib/ingest/external-trends';

export const runtime = 'nodejs';
export const maxDuration = 120;

async function ingest(request: Request) {
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;
  return ingestExternalTrends(request);
}

export async function GET(request: Request) {
  return ingest(request);
}

export async function POST(request: Request) {
  return ingest(request);
}
