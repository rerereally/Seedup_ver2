import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import SeedAdvisor from '@/components/SeedAdvisor';

export const metadata: Metadata = {
  title: 'Git 평가',
  description: 'GitHub 저장소를 읽고 고칠 점과 더할 기능을 짚어 드리고, PRD와 기능 명세로 이어 줍니다.',
};

export default function SeedsPage() {
  return (
    <>
      <Header />
      <main id="main-content" className="page-shell page-stack grow">
        <PageIntro title="Git 평가" description="GitHub 저장소를 읽고 고치면 좋을 점과 더하면 좋을 기능을 짚어 드립니다. 마음에 드는 방향은 개발자 원문이 붙은 PRD와 기능 명세로 바로 만들 수 있습니다." />
        <div className="max-w-[860px]"><SeedAdvisor /></div>
      </main>
      <Footer />
    </>
  );
}
