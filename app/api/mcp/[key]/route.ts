import { handleMcpRequest } from '@/lib/mcp/endpoint';

export const runtime = 'nodejs';
export const maxDuration = 160;

// The same endpoint with the token as the path, for connector forms that only take a URL (Claude, ChatGPT).
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  return handleMcpRequest(request, (await params).key);
}

export async function GET() {
  return new Response('Use POST. This server answers with JSON and does not open an event stream.', { status: 405, headers: { Allow: 'POST' } });
}
