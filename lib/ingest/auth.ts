import { NextResponse } from 'next/server';

export function assertIngestAuth(request: Request) {
  const secrets = [process.env.INGEST_SECRET, process.env.CRON_SECRET].filter((value): value is string => Boolean(value));
  if (!secrets.length) return null;

  const url = new URL(request.url);
  const authorization = request.headers.get('authorization');
  const bearer = authorization?.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : null;
  const provided = request.headers.get('x-ingest-secret') ?? bearer ?? url.searchParams.get('secret');

  if (!provided || !secrets.includes(provided)) {
    return NextResponse.json({ error: 'Unauthorized ingestion request' }, { status: 401 });
  }

  return null;
}
