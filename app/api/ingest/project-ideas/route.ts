import { assertIngestAuth } from '@/lib/ingest/auth';
import { ingestProjectIdeas } from '@/lib/ingest/project-ideas';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function ingest(request: Request) {
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;
  return ingestProjectIdeas(request);
}

export async function GET(request: Request) {
  return ingest(request);
}

export async function POST(request: Request) {
  return ingest(request);
}
