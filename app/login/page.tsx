import Link from 'next/link';
import LoginButton from '@/components/LoginButton';
import { Lightbulb, ShieldCheck, Sparkles, TrendingUp } from 'lucide-react';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen bg-[#fff8f7] text-[#201a19]">
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-[#f4eaea] p-16 md:flex">
        <div className="absolute inset-0 opacity-30 dot-grid" />
        <Link href="/" className="relative z-10 text-2xl font-bold tracking-tight text-brand-primary">
          Seedup
        </Link>
        <div className="relative z-10 max-w-md">
          <h1 className="mb-6 text-5xl font-bold leading-tight">
            뉴스를
            <br />
            <span className="text-brand-primary">프로젝트로</span>
            <br />
            만들다
          </h1>
          <p className="mb-10 text-lg leading-8 text-[#534341]">
            트렌드를 분석하고, 아이디어를 검증하여, 실제 포트폴리오 프로젝트로 발전시키는 가장 빠른 방법.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-[#f5dfdb] bg-white p-5">
              <TrendingUp className="mb-3 h-6 w-6 text-brand-primary" />
              <div className="text-sm font-semibold">데이터 기반 트렌드 분석</div>
            </div>
            <div className="rounded-lg border border-[#f5dfdb] bg-white p-5">
              <Lightbulb className="mb-3 h-6 w-6 text-brand-primary" />
              <div className="text-sm font-semibold">AI 아이디어 제안</div>
            </div>
          </div>
        </div>
        <div className="relative z-10 text-xs text-[#534341]">© 2026 Seedup. All rights reserved.</div>
      </section>

      <section className="flex w-full flex-col justify-center px-5 py-10 md:w-1/2 md:px-16">
        <Link href="/" className="absolute left-5 top-8 text-2xl font-bold tracking-tight text-brand-primary md:hidden">
          Seedup
        </Link>
        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-12 text-center">
            <h2 className="mb-2 text-3xl font-semibold">환영합니다</h2>
            <p className="text-[#534341]">Seedup 계정으로 로그인하세요</p>
          </div>

          <LoginButton />

          <div className="mt-8 rounded-lg border border-[#f5dfdb] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-primary">
              <ShieldCheck className="h-4 w-4" />
              Google OAuth 로그인
            </div>
            <p className="mt-2 text-sm leading-6 text-[#534341]">Seedup은 Supabase Auth의 Google OAuth로 로그인합니다. 처음 로그인하면 관심 분야와 뉴스레터 구독 여부를 묻는 설문이 표시됩니다.</p>
          </div>

          <div className="mt-4 rounded-lg border border-[#f5dfdb] bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-brand-primary">
              <Sparkles className="h-4 w-4" />
              로그인 후 가능한 기능
            </div>
            <p className="mt-2 text-sm leading-6 text-[#534341]">뉴스와 프로젝트를 스크랩하고, 아이디어 평가 기록을 저장하고, 개인화 추천 흐름을 사용할 수 있습니다.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
