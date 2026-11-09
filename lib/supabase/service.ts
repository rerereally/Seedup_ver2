import { createClient } from '@supabase/supabase-js';
import { getSupabaseConfig } from './config';

export function createServiceClient() {
  const config = getSupabaseConfig();
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!config || !secretKey) return null;

  return createClient(config.url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
