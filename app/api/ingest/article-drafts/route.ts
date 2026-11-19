import { assertIngestAuth } from '@/lib/ingest/auth';
import { ingestArticleDrafts } from '@/lib/ingest/article-drafts';

export const runtime = 'nodejs';
export const maxDuration = 300;

async function ingest(request: Request) {
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;
  return ingestArticleDrafts(request);
}

export async function GET(request: Request) {
  return ingest(request);
}

export async function POST(request: Request) {
  return ingest(request);
}
