import { assertIngestAuth } from '@/lib/ingest/auth';
import { ingestTrends } from '@/lib/ingest/trends';

export const runtime = 'nodejs';

async function ingest(request: Request) {
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;
  return ingestTrends(request);
}

export async function GET(request: Request) {
  return ingest(request);
}

export async function POST(request: Request) {
  return ingest(request);
}
