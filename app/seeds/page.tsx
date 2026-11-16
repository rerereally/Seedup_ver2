import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import SeedAdvisor from '@/components/SeedAdvisor';
import WorkShell from '@/components/WorkShell';

export const metadata: Metadata = {
  title: '내 저장소',
  description: '내 GitHub 레포를 읽고, 거기에 더하면 좋을 기능과 참고할 소식, 논문을 찾아드립니다.',
};

export default function SeedsPage() {
  return (
    <>
      <Header />
      <WorkShell>
        <PageIntro title="내 저장소" description="GitHub 레포를 연결하면 코드를 읽고 PRD를 거꾸로 만듭니다. 이미 만든 것에 무엇이 빠졌는지 개발자 원문과 비교해 보여줍니다." />
        <SeedAdvisor />
      </WorkShell>
      <Footer />
    </>
  );
}
