import { assertIngestAuth } from '@/lib/ingest/auth';
import { ingestResearch } from '@/lib/ingest/research';

export const runtime = 'nodejs';
export const maxDuration = 90;

async function ingest(request: Request) {
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;
  return ingestResearch(request);
}

export async function POST(request: Request) {
  return ingest(request);
}

export async function GET(request: Request) {
  return ingest(request);
}
