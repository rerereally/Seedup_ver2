import { NextResponse } from 'next/server';

export function assertIngestAuth(request: Request) {
  const secret = process.env.INGEST_SECRET;
  if (!secret) return null;

  const url = new URL(request.url);
  const provided = request.headers.get('x-ingest-secret') ?? url.searchParams.get('secret');

  if (provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized ingestion request' }, { status: 401 });
  }

  return null;
}
