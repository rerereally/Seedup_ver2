import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

export function createAdminClient() {
  const config = getSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!config || !secretKey) {
    return null;
  }

  return createSupabaseClient(config.url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
