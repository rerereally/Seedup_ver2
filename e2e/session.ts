// A signed-in session for the test account, made with the service key and a magic link (no password anywhere).
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

export const TEST_EMAIL = process.env.FLOW_TEST_EMAIL ?? 'seedup-claude-test@example.com';

function config() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !secret || !publishable) throw new Error('e2e needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY');
  return { url, secret, publishable };
}

/** The Supabase auth cookies for the test account, plus a client signed in as it. */
export async function testSession() {
  const { url, secret, publishable } = config();
  const admin = createClient(url, secret, { auth: { persistSession: false } });
  const created = await admin.auth.admin.createUser({ email: TEST_EMAIL, email_confirm: true, user_metadata: { full_name: 'E2E test' } });
  if (created.error && !/already/i.test(created.error.message)) throw created.error;
  const link = await admin.auth.admin.generateLink({ type: 'magiclink', email: TEST_EMAIL });
  if (link.error) throw link.error;
  const jar = new Map<string, string>();
  const client = createServerClient(url, publishable, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (rows) => rows.forEach((row) => (row.value ? jar.set(row.name, row.value) : jar.delete(row.name))) } });
  const { error } = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: 'magiclink' });
  if (error) throw error;
  return { cookies: [...jar].map(([name, value]) => ({ name, value })), client };
}
