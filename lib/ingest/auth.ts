import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';

// Query-string secrets are not accepted: URLs reach logs, browser history and Referer headers.
export function assertIngestAuth(request: Request) {
  const secrets = [process.env.INGEST_SECRET, process.env.CRON_SECRET].filter((value): value is string => Boolean(value));
  if (!secrets.length) {
    return NextResponse.json({ error: 'Ingestion secret is not configured' }, { status: 503 });
  }

  const authorization = request.headers.get('authorization');
  const bearer = authorization?.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : null;
  const provided = request.headers.get('x-ingest-secret') ?? bearer;

  if (!provided || !secrets.some((secret) => safeEqual(provided, secret))) {
    return NextResponse.json({ error: 'Unauthorized ingestion request' }, { status: 401 });
  }

  return null;
}

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
