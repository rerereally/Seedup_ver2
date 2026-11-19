import ledger from '@/predictions/sealed.jsonl';

export const dynamic = 'force-static';

export function GET() {
  return new Response(ledger, { headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8' } });
}
