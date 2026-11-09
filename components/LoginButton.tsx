'use client';

import { createClient } from '@/lib/supabase/client';
import { UserCircle } from 'lucide-react';

export default function LoginButton() {
  const handleLogin = async () => {
    const supabase = createClient();
    if (!supabase) {
      window.alert('Supabase URL과 publishable key를 .env에 먼저 설정해주세요.');
      return;
    }
    const origin = window.location.origin;
    const next = new URLSearchParams(window.location.search).get('next') ?? '/';

    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  };

  return (
    <button type="button" onClick={handleLogin} className="mb-8 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-brand-primary text-sm font-semibold text-white transition-opacity hover:opacity-90">
      <UserCircle className="h-5 w-5" />
      Google로 계속하기
    </button>
  );
}
