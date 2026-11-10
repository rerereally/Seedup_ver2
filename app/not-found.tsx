import Footer from '@/components/Footer';
import Header from '@/components/Header';
import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <>
      <Header />
      <main id="main-content" className="page-shell flex grow flex-col items-start justify-center py-20 md:py-28">
        <p className="num text-sm text-muted">404</p>
        <h1 className="page-intro-title mt-2">찾는 페이지가 없습니다</h1>
        <p className="page-intro-description">주소가 바뀌었거나, 수집 주기가 지나면서 내려간 글일 수 있습니다.</p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Link href="/opportunities" className="btn">기회 살펴보기</Link>
          <Link href="/" className="btn-quiet">홈으로</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
