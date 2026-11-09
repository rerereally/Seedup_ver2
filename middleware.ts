import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from '@/lib/supabase/config';

// Server Components cannot write cookies, so expired Supabase sessions are refreshed here.
// This stays middleware.ts because OpenNext on Cloudflare treats Node-based proxy.ts as experimental.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabaseConfig = getSupabaseConfig();
  const hasSessionCookie = request.cookies.getAll().some(({ name }) => name.startsWith('sb-'));

  if (!supabaseConfig || !hasSessionCookie) return response;

  const supabase = createServerClient(supabaseConfig.url, supabaseConfig.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|api/ingest|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?)$).*)'],
};
