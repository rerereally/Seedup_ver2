import { handleMcpRequest } from '@/lib/mcp/endpoint';

export const runtime = 'nodejs';
export const maxDuration = 160;

// Wrapped: Next passes the route context as a second argument, which must not reach pathKey.
export const POST = (request: Request) => handleMcpRequest(request);

export async function GET() {
  return new Response('Use POST. This server answers with JSON and does not open an event stream.', { status: 405, headers: { Allow: 'POST' } });
}
