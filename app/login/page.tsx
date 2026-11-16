import type { Metadata } from 'next';
import Link from 'next/link';
import LoginButton from '@/components/LoginButton';
import Logo from '@/components/Logo';

export const metadata: Metadata = {
  title: '로그인',
};

export default function LoginPage() {
  return (
    <main id="main-content" className="flex min-h-dvh flex-col justify-center bg-white px-5 py-12 text-ink sm:px-10">
      <div className="mx-auto w-full max-w-[460px]">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 text-[22px] font-bold tracking-tight">
          <Logo className="h-7 w-7" />
          Seedup
        </Link>
        <h1 className="mt-8 text-[clamp(30px,4vw,38px)] font-bold leading-[1.25] tracking-[-0.03em]">작은 신호부터<br />함께 키워 볼까요.</h1>
        <p className="mt-4 text-[17px] leading-8 text-muted">로그인하면 관심 분야에 맞춘 오늘의 신호와 주간 메일, PRD 만들기를 쓸 수 있습니다.</p>

        <div className="mt-8">
          <LoginButton />
        </div>

        <p className="mt-5 text-[13px] leading-6 text-muted">계속하면 Google 계정의 이름과 이메일을 Seedup 계정에 쓰는 데 동의하게 됩니다.</p>
        <p className="mt-1 text-[13px] leading-6 text-muted">로그인하지 않아도 기회와 원문은 모두 볼 수 있습니다. <Link href="/" className="font-medium text-seed underline-offset-4 hover:underline">둘러보기 ›</Link></p>
      </div>
    </main>
  );
}
