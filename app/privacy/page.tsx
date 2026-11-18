import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { LegalSections, SiteHero } from '@/components/site/SiteSection';
import { PRIVACY } from '@/lib/legal';

export const metadata: Metadata = { title: '개인정보처리방침', description: 'Seedup이 어떤 정보를 왜 모으고 어디로 보내는지, 직접 지우거나 요청하는 방법입니다.' };

// Korean only for now: the Korean text is the one that applies.
export default function Page() {
  return (
    <>
      <Header variant="site" />
      <main id="main-content" className="grow">
        <SiteHero word="Privacy" title="개인정보처리방침" lead="Seedup이 어떤 정보를 왜 모으고 어디로 보내는지, 직접 지우거나 요청하는 방법입니다." />
        <LegalSections sections={PRIVACY} />
      </main>
      <Footer />
    </>
  );
}
