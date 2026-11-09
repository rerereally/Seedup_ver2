import { isAdminEmail } from '@/lib/auth/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  const supabase = await createClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  return NextResponse.json({ isAdmin: isAdminEmail(data.user?.email) });
}
