import assert from 'node:assert/strict';
import test from 'node:test';
import { fixtureProse } from '../lib/llm-fixtures';
import { handleMcpRequest } from '../lib/mcp/endpoint';
import { DEFAULT_PAID_PRD_MODEL, HAIKU_MODEL } from '../lib/opportunities/models';

test('MCP logs one paid generation per draft and public PRD, including writer fallback and auxiliary token usage', async (t) => {
  const env = { NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.invalid', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    SUPABASE_SECRET_KEY: 'test-service', OPENROUTER_API_KEY: 'test-model', LLM_FIXTURES: '0' };
  for (const [key, value] of Object.entries(env)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const user = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const id = '11111111-1111-1111-1111-111111111111';
  const title = 'My on-call bot';
  const calls: Array<Record<string, unknown>> = [];
  const rows: Array<Record<string, unknown>> = [];
  let saved: string | null = null;
  t.mock.method(globalThis, 'fetch', async (source: string, init?: RequestInit) => {
    const url = new URL(source);
    const method = init?.method ?? 'GET';
    const body = init?.body && JSON.parse(String(init.body));
    if (url.pathname === '/api/v1/chat/completions') {
      if (body.stream) {
        calls.push(body);
        if (body.model === DEFAULT_PAID_PRD_MODEL) return new Response(null, { status: 503 });
        const prose = fixtureProse().replace('- 수락 기준:', '- 근거: E-1\n- 수락 기준:');
        const chunk = { choices: [{ delta: { content: prose } }], usage: { prompt_tokens: 1000, completion_tokens: 500 } };
        return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`);
      }
      if (body.model === HAIKU_MODEL) return new Response(null, { status: 503 });
      return Response.json({ choices: [{ message: { content: '{}' } }], usage: { prompt_tokens: 100, completion_tokens: 50 } });
    }
    assert.equal(url.hostname, 'supabase.invalid');
    switch (url.pathname) {
      case '/rest/v1/mcp_tokens': return method === 'PATCH' ? new Response(null, { status: 204 }) : Response.json([{ user_id: user }]);
      case '/rest/v1/rpc/consume_ai_usage_for': return Response.json(true);
      case '/rest/v1/project_memory':
      case '/rest/v1/opportunity_reviews':
      case '/rest/v1/opportunities': return Response.json([]);
      case '/rest/v1/prd_cache': return new Response(null, { status: 204 });
      case '/rest/v1/prd_runs':
        rows.push(body);
        return new Response(null, { status: 201 });
      case '/rest/v1/evidence_dossiers': {
        if (method === 'POST') return Response.json({ id });
        if (method === 'PATCH') {
          saved = body.prd_markdown;
          return new Response(null, { status: 204 });
        }
        const select = url.searchParams.get('select');
        if (select === 'validation_report') return Response.json([{ validation_report: {
          markdown: '# saved validation', competitors: [{ name: 'Team Handover', description: 'Lists notes for Slack only.' }],
        } }]);
        if (select === 'id,title,evidence' || saved) return Response.json([{
          id, title, opportunity_slug: null, evidence_ids: [], evidence: [], prd_markdown: saved, updated_at: '2026-11-20T09:00:00Z',
        }]);
        return Response.json([]);
      }
      default: throw new Error(`Unexpected request: ${url.pathname}`);
    }
  });
  const generate = async (project: string, fresh = false) => {
    const response = await handleMcpRequest(new Request('https://seedup.test/api/mcp', {
      method: 'POST', headers: { authorization: `Bearer sdp_${'a'.repeat(48)}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: {
        name: 'generate_verified_prd', arguments: { project, fresh, format: 'prd' },
      } }),
    }));
    assert.equal(response.status, 200);
    const reply = await response.json();
    assert.ok(!reply.error && !reply.result.isError, JSON.stringify(reply));
  };

  await generate(`prd:${id}`);
  assert.ok(calls.some((call) => JSON.stringify(call.messages).includes('Team Handover: Lists notes for Slack only.')));
  await generate(`prd:${id}`); // reading the saved draft does not log again
  await generate('gif-api-replacement', true);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].title, title);
  for (const row of rows) {
    assert.equal(row.user_id, user);
    assert.equal(row.kind, 'prd');
    assert.equal(row.ok, true);
    assert.equal(row.model, HAIKU_MODEL);
    assert.equal(row.requested_model, DEFAULT_PAID_PRD_MODEL);
    assert.ok(Number(row.calls) >= 2);
    assert.ok(Number(row.prompt_tokens) > 1000);
    assert.ok(Number(row.completion_tokens) > 500);
    assert.ok(Number(row.cost_usd) > 0.00035);
    assert.ok(Number(row.duration_ms) >= 0);
  }
});
