import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { LegalSections, SiteHero } from '@/components/site/SiteSection';
import { TERMS } from '@/lib/legal';

export const metadata: Metadata = { title: '이용약관', description: 'Seedup을 쓸 때 서로 지킬 것과, 원문 인용과 AI 결과물에 대한 약속입니다.' };

// Korean only for now: the Korean text is the one that applies.
export default function Page() {
  return (
    <>
      <Header variant="site" />
      <main id="main-content" className="grow">
        <SiteHero word="Terms" title="이용약관" lead="Seedup을 쓸 때 서로 지킬 것과, 원문 인용과 AI 결과물에 대한 약속입니다." />
        <LegalSections sections={TERMS} />
      </main>
      <Footer />
    </>
  );
}
