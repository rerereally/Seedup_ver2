import Header from '@/components/Header';

// Shown the moment a link is clicked, while the next page is read on the server.
// Keeping the header in place makes the wait read as a page change, not a frozen screen.
export default function Loading() {
  return (
    <>
      <Header />
      <main id="main-content" className="page-shell page-stack grow" aria-busy="true">
        <p role="status" className="sr-only">불러오는 중입니다</p>
        <div aria-hidden="true" className="flex animate-pulse flex-col gap-4">
          <div className="h-10 w-56 rounded-xl bg-surface-high" />
          <div className="h-5 w-full max-w-[32em] rounded-lg bg-surface-high" />
          <div className="mt-6 h-40 rounded-[20px] bg-white" />
          <div className="h-40 rounded-[20px] bg-white" />
        </div>
      </main>
    </>
  );
}
