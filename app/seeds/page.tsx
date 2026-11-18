import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import SeedAdvisor from '@/components/SeedAdvisor';

export const metadata: Metadata = {
  title: '레포 분석',
  description: 'GitHub 저장소를 읽고 고칠 점과 더할 기능을 짚어 드리고, PRD와 기능 명세로 이어 줍니다.',
};

// What one review returns, so the page says what it does before a repository is entered.
const RETURNS: Array<[string, string]> = [
  ['고칠 점과 더할 기능', '저장소의 README, 구조, 의존성을 읽고 다음에 할 일을 3가지로 짚습니다.'],
  ['관련된 개발자 문제', '저장소와 가까운 문제와 실제 원문을 붙여, 왜 그 기능인지 보여 줍니다.'],
  ['최신 논문', '저장소 주제와 맞는 논문을 골라 줍니다.'],
  ['PRD와 GitHub 이슈', '마음에 드는 방향은 원문이 붙은 PRD로 만들거나 이슈로 바로 엽니다.'],
];

export default function SeedsPage() {
  return (
    <>
      <Header />
      <main id="main-content" className="page-shell page-stack grow">
        <PageIntro title="레포 분석" description="GitHub 저장소를 읽고 고치면 좋을 점과 더하면 좋을 기능을 짚어 드립니다. 마음에 드는 방향은 개발자 원문이 붙은 PRD와 기능 명세로 바로 만들 수 있습니다." />
        <div className="page-split">
          <div className="min-w-0"><SeedAdvisor /></div>
          <aside className="page-side" aria-labelledby="seeds-returns">
            <h2 id="seeds-returns" className="text-[16px] font-bold">저장소 하나에 알려 드리는 것</h2>
            <ul className="rows mt-3 text-[14px] leading-6">
              {RETURNS.map(([name, what]) => (
                <li key={name} className="py-3"><b className="block font-semibold">{name}</b><span className="text-muted">{what}</span></li>
              ))}
            </ul>
            <p className="mt-3 text-[13px] leading-6 text-muted">공개 저장소만 읽고, 코드는 저장하지 않습니다.</p>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  );
}
