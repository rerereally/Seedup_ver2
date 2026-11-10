import type { Metadata } from 'next';
import Link from 'next/link';
import { Sprout } from 'lucide-react';
import LoginButton from '@/components/LoginButton';
import { getOpportunities, toStageOpportunities } from '@/lib/opportunities/data';

export const metadata: Metadata = {
  title: '로그인',
};

// Tilt and offset for each testimony on the brand side, so the stack reads as the same pile as the home stage.
const CHIP_LAYOUT = [
  'rotate-[-5deg]',
  'ml-10 rotate-[3deg]',
  'ml-3 rotate-[-2deg]',
  'ml-16 rotate-[6deg]',
  'ml-6 rotate-[-4deg]',
];

const BENEFITS = [
  ['담은 근거가 보관함에 남습니다', '어느 기기에서든 이어서 볼 수 있습니다.'],
  ['근거로 PRD를 만듭니다', '원문 증언만 근거로 쓰고, AI 코딩 도구용 파일로 받습니다.'],
  ['관심사에 맞춰 추천합니다', '처음 한 번, 다섯 가지만 여쭙니다.'],
];

export default async function LoginPage() {
  const { opportunities } = await getOpportunities();
  const chips = toStageOpportunities(opportunities)
    .flatMap((item) => item.quotes.slice(0, 1).map((quote) => ({ id: quote.id, text: quote.quote, bg: item.bg, fg: item.fg })))
    .slice(0, CHIP_LAYOUT.length);

  return (
    <main id="main-content" className="grid min-h-dvh bg-surface text-ink lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <section className="relative hidden flex-col justify-between overflow-hidden rounded-[28px] bg-[radial-gradient(120%_90%_at_50%_0%,#1b1b20_0%,#101013_60%)] p-12 shadow-[inset_0_0_0_1px_rgba(255,255,255,.07)] lg:m-2.5 lg:flex">
        <Link href="/" className="inline-flex min-h-11 items-center gap-2 self-start text-[19px] font-extrabold tracking-tight">
          <Sprout className="h-[22px] w-[22px] text-hot" aria-hidden="true" />
          Seedup
        </Link>
        <div>
          <h1 className="text-[clamp(40px,4.4vw,64px)] font-extrabold leading-[1.08] tracking-tight">만들기 전에<br />사람들의 말부터.</h1>
          <p className="mt-5 max-w-[26em] text-lg leading-8 text-muted">개발자들이 실제로 남긴 불만을 원문과 대조해 모으고, 근거가 붙은 PRD까지 이어갑니다.</p>
        </div>
        <ul className="flex flex-col items-start gap-2.5" aria-label="실제 증언 일부">
          {chips.map((chip, index) => (
            <li key={chip.id} lang="en" className={`max-w-[min(420px,80%)] truncate rounded-full px-5 py-3 text-[15px] font-bold shadow-[0_10px_30px_rgba(0,0,0,.35)] ${CHIP_LAYOUT[index]}`} style={{ background: chip.bg, color: chip.fg }}>
              {chip.text}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col justify-center px-5 py-12 sm:px-10">
        <div className="mx-auto w-full max-w-[380px]">
          <Link href="/" className="mb-12 inline-flex min-h-11 items-center gap-2 text-[19px] font-extrabold tracking-tight lg:hidden">
            <Sprout className="h-[22px] w-[22px] text-hot" aria-hidden="true" />
            Seedup
          </Link>
          <h2 className="text-[32px] font-extrabold leading-tight tracking-tight">로그인</h2>
          <p className="mt-2 text-muted [text-wrap:balance] [word-break:keep-all]">Google 계정 하나면 됩니다. 비밀번호를 새로 만들지 않습니다.</p>

          <div className="mt-8">
            <LoginButton />
          </div>

          <ul className="mt-8 border-t border-outline-soft">
            {BENEFITS.map(([title, detail]) => (
              <li key={title} className="border-b border-outline-soft py-4">
                <p className="font-bold">{title}</p>
                <p className="mt-0.5 text-sm leading-6 text-muted">{detail}</p>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[13px] leading-6 text-muted">로그인하지 않아도 기회와 증언은 모두 볼 수 있습니다. <Link href="/" className="font-bold text-ink underline-offset-4 hover:underline">둘러보기</Link></p>
        </div>
      </section>
    </main>
  );
}
