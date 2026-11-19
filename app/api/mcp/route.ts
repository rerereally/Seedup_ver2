import { handleMcpRequest } from '@/lib/mcp/endpoint';

export const runtime = 'nodejs';
export const maxDuration = 160;

export const POST = handleMcpRequest;

export async function GET() {
  return new Response('Use POST. This server answers with JSON and does not open an event stream.', { status: 405, headers: { Allow: 'POST' } });
}
