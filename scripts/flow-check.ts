// The core flow against a running site, signed in as a test user: tailored questions, a streamed PRD from an idea,
// one item revised, and a PRD through MCP. Each step must answer in shape; it costs the test user's daily limits and
// free model calls, so it runs on demand (after a deploy, or before a demo), not on a schedule.
//   FLOW_BASE_URL=https://seedup.rerereally.com npx tsx --env-file=.env scripts/flow-check.ts
// The test user (FLOW_TEST_EMAIL, default seedup-claude-test@example.com) is created once with the service key and
// signs in with a magic link made on the spot, so no password exists anywhere.
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

const BASE = (process.env.FLOW_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const EMAIL = process.env.FLOW_TEST_EMAIL ?? 'seedup-claude-test@example.com';
const IDEA = 'PR 리뷰 코멘트를 모아 팀의 코딩 규칙 문서로 정리해 주는 봇';

async function sessionCookie() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secret || !publishable) throw new Error('needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY');
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const created = await admin.auth.admin.createUser({ email: EMAIL, email_confirm: true, user_metadata: { full_name: 'Flow check' } });
  if (created.error && !/already/i.test(created.error.message)) throw created.error;
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: EMAIL });
  if (link.error) throw link.error;
  const jar = new Map<string, string>();
  const client = createServerClient(url, publishable, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (rows) => rows.forEach((row) => (row.value ? jar.set(row.name, row.value) : jar.delete(row.name))) } });
  const { error } = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' });
  if (error) throw error;
  return [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
}

const results: Array<[string, boolean, string]> = [];
async function step(name: string, run: () => Promise<string>) {
  const started = Date.now();
  try {
    const note = await run();
    results.push([name, true, `${note} (${Math.round((Date.now() - started) / 1000)}s)`]);
  } catch (error) {
    results.push([name, false, error instanceof Error ? error.message : String(error)]);
  }
}

async function main() {
  const cookie = await sessionCookie();
  const post = (path: string, body: unknown, headers: Record<string, string> = { cookie }) => fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
  const brief = { idea: IDEA, answers: [{ question: '누가 쓰나요?', answer: '코드 리뷰가 많은 5~20명 개발팀' }] };
  let spec: { requirements: Array<{ id: string }>; hypotheses: Array<{ id: string }>; features: unknown[] } | null = null;

  await step('맞춤 질문', async () => {
    const json = await (await post('/api/ideas/questions', { idea: IDEA, quotes: [], lang: 'ko' })).json();
    if (!Array.isArray(json.questions) || json.questions.length < 2) throw new Error(`questions missing: ${JSON.stringify(json).slice(0, 160)}`);
    return `${json.questions.length}개`;
  });

  await step('실시간 PRD', async () => {
    const response = await post('/api/opportunities/prd', { stream: true, lang: 'ko', brief });
    if (!response.ok || !response.body) throw new Error(`status ${response.status}`);
    const counts: Record<string, number> = {};
    let last: Record<string, unknown> | null = null;
    let buffer = '';
    const decoder = new TextDecoder();
    for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
      buffer += decoder.decode(chunk, { stream: true });
      let index;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).trim();
        buffer = buffer.slice(index + 1);
        if (!line) continue;
        last = JSON.parse(line) as Record<string, unknown>;
        counts[String(last.type)] = (counts[String(last.type)] ?? 0) + 1;
      }
    }
    if (last?.type !== 'done') throw new Error(`ended with ${String(last?.type)}: ${JSON.stringify(last).slice(0, 160)}`);
    spec = (last.spec ?? (last.result as { spec?: unknown } | undefined)?.spec) as typeof spec;
    if (!spec?.features?.length) throw new Error('no features in the PRD');
    return `글 조각 ${counts.delta ?? 0}개, 요구사항 ${spec.requirements.length} 가설 ${spec.hypotheses.length} 기능 ${spec.features.length}`;
  });

  await step('항목 하나만 고치기', async () => {
    if (!spec) throw new Error('no PRD to revise');
    const target = spec.hypotheses[0]?.id ?? spec.requirements[0]?.id;
    const json = await (await post('/api/opportunities/prd/revise', { brief, spec, instruction: `${target} 항목만 고칩니다. 다른 항목은 그대로 둡니다. 요청: 수락 기준을 숫자로 바꿔줘` })).json();
    if (!json.ok || !json.spec) throw new Error(json.error ?? 'no spec');
    return `${target} 수정`;
  });

  await step('MCP PRD', async () => {
    const token = (await (await post('/api/mcp/token', {})).json()).token as string | undefined;
    if (!token) throw new Error('no MCP token');
    const rpc = async (name: string, args: Record<string, unknown>) => (await (await post('/api/mcp', { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }, { authorization: `Bearer ${token}` })).json()) as { result?: { isError?: boolean; content?: Array<{ text?: string }> } };
    const found = await rpc('search_opportunities', { query: 'agent', limit: 1 });
    const slug = /\(([a-z0-9-]+)\)/.exec(found.result?.content?.[0]?.text ?? '')?.[1];
    if (!slug) throw new Error('search_opportunities found nothing');
    const prd = await rpc('generate_verified_prd', { slug, format: 'claude' });
    const text = prd.result?.content?.[0]?.text ?? '';
    if (prd.result?.isError || !text.includes('F-01')) throw new Error(text.slice(0, 160) || 'empty');
    return slug;
  });

  for (const [name, ok, note] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}: ${note}`);
  if (results.some(([, ok]) => !ok)) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
