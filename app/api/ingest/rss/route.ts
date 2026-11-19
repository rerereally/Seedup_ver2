import { assertIngestAuth } from '@/lib/ingest/auth';
import { ingestRss } from '@/lib/ingest/rss';

export const runtime = 'nodejs';
export const maxDuration = 120;

async function ingest(request: Request) {
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;
  return ingestRss(request);
}

export async function POST(request: Request) {
  return ingest(request);
}

export async function GET(request: Request) {
  return ingest(request);
}
