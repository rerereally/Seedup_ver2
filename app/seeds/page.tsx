import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import SeedAdvisor from '@/components/SeedAdvisor';

export const metadata: Metadata = {
  title: '내 씨앗',
  description: '내 GitHub 레포를 읽고, 거기에 더하면 좋을 기능과 참고할 소식, 논문을 찾아드립니다.',
};

export default function SeedsPage() {
  return (
    <>
      <Header />
      <main id="main-content" className="page-shell page-stack grow">
        <PageIntro title="내 씨앗" description="이미 만들고 있는 것이 씨앗입니다. 레포를 읽고, 거기에 더하면 좋을 기능과 참고할 소식, 논문을 찾아드립니다." />
        <div className="max-w-[860px]">
          <SeedAdvisor />
        </div>
      </main>
      <Footer />
    </>
  );
}
