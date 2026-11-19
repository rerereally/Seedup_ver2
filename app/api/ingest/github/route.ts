import { assertIngestAuth } from '@/lib/ingest/auth';
import { ingestGithub } from '@/lib/ingest/github';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function ingest(request: Request) {
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;
  return ingestGithub(request);
}

export async function POST(request: Request) {
  return ingest(request);
}

export async function GET(request: Request) {
  return ingest(request);
}
