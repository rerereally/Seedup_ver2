import { uploadAgentUsage } from '@/lib/db/agent-usage';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const result = await uploadAgentUsage(request);
  return Response.json(result.body, { status: result.status, headers: { 'cache-control': 'no-store' } });
}
