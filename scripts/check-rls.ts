// Row-level security against the live database: signed in as test user A, and signed out with the publishable key,
// nobody may read, change, delete or add test user B's private rows. Pages meant to be public (a PRD shared by link,
// an idea page) must still open on the site. Prints PASS/FAIL per table and exits 1 on any leak.
//   npm run rls        (RLS_BASE_URL defaults to https://seedup.rerereally.com)
// A is FLOW_TEST_EMAIL (default seedup-claude-test@example.com), B is RLS_TEST_EMAIL_B (default
// seedup-rls-test-b@example.com); both are created once with the service key and have no password. Every row the check
// writes is removed with the service key at the end, also when it fails or is interrupted.
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const BASE = (process.env.RLS_BASE_URL ?? 'https://seedup.rerereally.com').replace(/\/+$/, '');
const EMAIL_A = process.env.FLOW_TEST_EMAIL ?? 'seedup-claude-test@example.com';
const EMAIL_B = process.env.RLS_TEST_EMAIL_B ?? 'seedup-rls-test-b@example.com';
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
// Cleanup deletes every row B owns, so B must be an address nobody can own.
if (!/@example\.com$/.test(EMAIL_A) || !/@example\.com$/.test(EMAIL_B) || EMAIL_A === EMAIL_B) throw new Error('test users must be two different @example.com addresses');
if (!URL_ || !SECRET || !PUBLISHABLE) throw new Error('needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY');

const admin = createClient(URL_, SECRET, { auth: { persistSession: false } });
const OWNED = ['evidence_dossiers', 'mcp_tokens', 'idea_watches', 'build_progress', 'ai_usage', 'saved_quotes', 'idea_pages'] as const; // waitlist_signups go with idea_pages
const RUN = `rls-${Date.now().toString(36)}`;
const slug = () => Array.from({ length: 10 }, () => 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(Math.random() * 36)]).join('');

/** The user's id, creating the account once; with `signIn`, a client and site cookie signed in as them. */
async function testUser(email: string, signIn: boolean) {
  const created = await admin.auth.admin.createUser({ email, email_confirm: true, user_metadata: { full_name: 'RLS check' } });
  if (created.error && !/already/i.test(created.error.message)) throw created.error;
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (link.error) throw link.error;
  if (!signIn) return { id: link.data.user.id, client: null, cookie: '' };
  const jar = new Map<string, string>();
  const client = createServerClient(URL_!, PUBLISHABLE!, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (rows) => rows.forEach((row) => (row.value ? jar.set(row.name, row.value) : jar.delete(row.name))) } });
  const { error } = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' });
  if (error) throw error;
  return { id: link.data.user.id, client: client as unknown as SupabaseClient, cookie: [...jar].map(([name, value]) => `${name}=${value}`).join('; ') };
}

const cleanupIds: { a?: string; b?: string } = {};
async function cleanup() {
  const { a, b } = cleanupIds;
  if (b) for (const table of OWNED) await admin.from(table).delete().eq('user_id', b);
  if (a) await admin.from('evidence_dossiers').delete().eq('user_id', a).like('dossier_key', 'rls-%');
}

async function insertOne(table: string, row: Record<string, unknown>) {
  const { data, error } = await admin.from(table).insert(row).select().single();
  if (error) throw new Error(`setup ${table}: ${error.message}`);
  return data as Record<string, string>;
}

async function main() {
  const [a, b] = await Promise.all([testUser(EMAIL_A, true), testUser(EMAIL_B, false)]);
  Object.assign(cleanupIds, { a: a.id, b: b.id });
  await cleanup(); // rows a crashed earlier run may have left
  const B = b.id;

  // B's private rows, written with the service key.
  const dossier = await insertOne('evidence_dossiers', { user_id: B, dossier_key: `${RUN}-private`, title: `${RUN} private`, prd_markdown: '# RLS check' });
  const shared = await insertOne('evidence_dossiers', { user_id: B, dossier_key: `${RUN}-shared`, title: `${RUN} shared`, prd_markdown: '# RLS check shared', shared: true });
  await insertOne('mcp_tokens', { user_id: B, token_hash: `${RUN}-hash` });
  const watch = await insertOne('idea_watches', { user_id: B, idea: `${RUN} watch` });
  await insertOne('build_progress', { user_id: B, slug: RUN, feature_id: 'f1' });
  await insertOne('ai_usage', { user_id: B, feature: RUN, count: 1 });
  const quote = await insertOne('saved_quotes', { user_id: B, url: 'https://example.com/rls', quote: `${RUN} quote to keep private` });
  const page = await insertOne('idea_pages', { user_id: B, slug: slug(), idea: `${RUN} idea`, headline: `${RUN} headline` });
  const signup = await insertOne('waitlist_signups', { page_id: page.id, email: `${RUN}@example.com` });
  const own = await insertOne('evidence_dossiers', { user_id: a.id, dossier_key: `${RUN}-own`, title: `${RUN} own` });

  const cases: Array<{ table: string; match: Record<string, string>; patch: Record<string, unknown>; insert: Record<string, unknown> }> = [
    { table: 'evidence_dossiers', match: { id: dossier.id }, patch: { title: `${RUN} leaked` }, insert: { user_id: B, dossier_key: `${RUN}-insert`, title: `${RUN} insert` } },
    { table: 'mcp_tokens', match: { user_id: B }, patch: { token_hash: `${RUN}-leaked` }, insert: { user_id: B, token_hash: `${RUN}-insert` } },
    { table: 'idea_watches', match: { id: watch.id }, patch: { idea: `${RUN} leaked` }, insert: { user_id: B, idea: `${RUN} insert` } },
    { table: 'build_progress', match: { user_id: B, slug: RUN }, patch: { note: `${RUN} leaked` }, insert: { user_id: B, slug: `${RUN}-insert`, feature_id: 'f1' } },
    { table: 'ai_usage', match: { user_id: B, feature: RUN }, patch: { count: 999 }, insert: { user_id: B, feature: `${RUN}-insert`, count: 1 } },
    { table: 'saved_quotes', match: { id: quote.id }, patch: { page_title: `${RUN} leaked` }, insert: { user_id: B, url: 'https://example.com/rls', quote: `${RUN} inserted by someone else` } },
    { table: 'idea_pages', match: { id: page.id }, patch: { headline: `${RUN} leaked` }, insert: { user_id: B, slug: slug(), idea: `${RUN} insert`, headline: `${RUN} insert` } },
    { table: 'waitlist_signups', match: { id: signup.id }, patch: { email: `${RUN}-leaked@example.com` }, insert: { page_id: page.id, email: `${RUN}-insert@example.com` } },
  ];

  const results = new Map<string, string[]>(); // table -> problems
  const fail = (table: string, problem: string) => results.set(table, [...(results.get(table) ?? []), problem]);
  const anon = createClient(URL_!, PUBLISHABLE!, { auth: { persistSession: false } });
  const actors: Array<[string, SupabaseClient]> = [['A', a.client!], ['anon', anon]];

  // Without these, every "denied" below could just mean a broken session or key.
  const control = await a.client!.from('evidence_dossiers').select('id').eq('id', own.id);
  if (control.data?.length !== 1) fail('(control)', `A cannot read A's own dossier: ${control.error?.message ?? 'no row'}`);
  const anonControl = await anon.from('opportunities').select('slug').limit(1);
  if (anonControl.error || !anonControl.data?.length) fail('(control)', `the publishable key cannot read public opportunities: ${anonControl.error?.message ?? 'no row'}`);

  for (const { table, match, patch, insert } of cases) {
    results.set(table, results.get(table) ?? []);
    for (const [who, client] of actors) {
      const read = await client.from(table).select('*').match(match);
      if (read.data?.length) fail(table, `${who} read B's row`);

      await client.from(table).update(patch).match(match);
      const after = await admin.from(table).select('*').match(match);
      const row = after.data?.[0] as Record<string, unknown> | undefined;
      if (row && Object.entries(patch).some(([key, value]) => row[key] === value)) fail(table, `${who} changed B's row`);

      await client.from(table).delete().match(match);
      const kept = await admin.from(table).select('*', { count: 'exact', head: true }).match(match);
      if (!kept.count) fail(table, `${who} deleted B's row`);

      const added = await client.from(table).insert(insert);
      const found = await admin.from(table).select('*', { count: 'exact', head: true }).match(insert);
      if (!added.error || found.count) fail(table, `${who} added a row as B`);
      else if (added.error.code !== '42501') fail(table, `${who} insert failed for another reason (${added.error.code}: ${added.error.message}); check by hand`);
    }
  }

  // The service-only quota function must not be callable for someone else.
  for (const [who, client] of actors) {
    const { error } = await client.rpc('consume_ai_usage_for', { p_user: B, p_feature: RUN, p_daily_limit: 100 });
    const usage = await admin.from('ai_usage').select('count').match({ user_id: B, feature: RUN }).maybeSingle();
    if (!error || usage.data?.count !== 1) fail('ai_usage', `${who} counted B's usage through consume_ai_usage_for`);
  }

  // Public on purpose, through the site: a shared PRD and an idea page open signed out; a private PRD and someone
  // else's waitlist do not.
  const site = 'site (shared pages)';
  results.set(site, []);
  const get = (path: string, cookie = '') => fetch(`${BASE}${path}`, { headers: cookie ? { cookie } : {}, redirect: 'manual', signal: AbortSignal.timeout(30_000) });
  const sharedPage = await get(`/spec/${shared.id}`);
  if (sharedPage.status !== 200 || !(await sharedPage.text()).includes('RLS check shared')) fail(site, `shared PRD /spec/<id> did not show its PRD (${sharedPage.status})`);
  // Not the status: with streaming, a not-found page still answers 200, so the PRD itself must be absent.
  const privatePage = await (await get(`/spec/${dossier.id}`)).text();
  if (privatePage.includes(`${RUN} private`) || privatePage.includes('RLS check')) fail(site, 'private PRD /spec/<id> showed the PRD signed out');
  const ideaPage = await get(`/try/${page.slug}`);
  if (ideaPage.status !== 200 || !(await ideaPage.text()).includes(`${RUN} headline`)) fail(site, `idea page /try/<slug> did not open (${ideaPage.status})`);
  const csv = await get(`/api/ideas/pages/${page.slug}/csv`, a.cookie);
  if (csv.status === 200 || (await csv.text()).includes(`${RUN}@example.com`)) fail(site, `A downloaded B's waitlist CSV (${csv.status})`);

  let leaks = 0;
  for (const [table, problems] of results) {
    console.log(`${problems.length ? 'FAIL' : 'PASS'}  ${table}${problems.length ? `\n        ${problems.join('\n        ')}` : ''}`);
    leaks += problems.length;
  }
  if (leaks) process.exitCode = 1;
}

process.on('SIGINT', () => void cleanup().finally(() => process.exit(130)));
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await cleanup();
    for (const table of OWNED) {
      const { count } = cleanupIds.b ? await admin.from(table).select('*', { count: 'exact', head: true }).eq('user_id', cleanupIds.b) : { count: 0 };
      if (count) {
        console.error(`::error::${count} test row(s) left in ${table}; delete the rows of ${EMAIL_B} by hand.`);
        process.exitCode = 1;
      }
    }
  });
