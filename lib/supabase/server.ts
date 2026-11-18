import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { getSupabaseConfig } from './config';

export async function createClient() {
  const cookieStore = await cookies();
  const config = getSupabaseConfig();

  if (!config) {
    return null;
  }

  return createServerClient(config.url, config.publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Route handlers can.
        }
      },
    },
  });
}

/**
 * The signed-in user for this request, read once: `auth.getUser()` asks the Supabase auth server every time, and a
 * page plus its data helpers used to call it three or four times per request.
 */
export const getCurrentUser = cache(async () => {
  const supabase = await createClient();
  return supabase ? (await supabase.auth.getUser()).data.user : null;
});
