import { assertIngestAuth } from '@/lib/ingest/auth';
import { ingestEmbeddings } from '@/lib/ingest/embeddings';

export const runtime = 'nodejs';

async function handle(request: Request) {
  const unauthorized = assertIngestAuth(request);
  if (unauthorized) return unauthorized;
  return ingestEmbeddings(request);
}

export const GET = handle;
export const POST = handle;
