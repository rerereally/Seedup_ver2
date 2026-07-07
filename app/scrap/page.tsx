import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { getScraps } from '@/lib/data';
import { Bookmark, Code2, FileText, Github, Lightbulb, Search } from 'lucide-react';
import Link from 'next/link';

const iconMap = {
  news: FileText,
  project: Code2,
  idea: Lightbulb,
  github: Github,
};

const FILTERS = [
  { label: '전체', value: 'all' },
  { label: '뉴스', value: 'news' },
  { label: '프로젝트', value: 'project' },
  { label: 'AI 제품', value: 'ai_product' },
  { label: 'GitHub', value: 'github' },
  { label: '아이디어', value: 'idea' },
];

export default async function Scrap({ searchParams }: { searchParams: Promise<{ type?: string; q?: string }> }) {
  const params = await searchParams;
  const savedItems = await getScraps();
  const activeType = params.type ?? 'all';
  const query = params.q?.trim().toLowerCase() ?? '';
  const filteredItems = savedItems.filter((item) => {
    const matchesType = activeType === 'all' || item.item_type === activeType;
    const matchesQuery = !query || [item.title, item.description, item.tag, item.item_type].some((value) => value?.toLowerCase().includes(query));
    return matchesType && matchesQuery;
  });

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="mx-auto max-w-[1280px] px-4 py-12 md:px-10 md:py-16">
          <section className="mb-10 flex flex-col gap-4 border-b border-outline-soft pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-bold text-brand-primary">
                <Bookmark className="h-3.5 w-3.5 fill-brand-primary" />
                Saved
              </div>
              <h1 className="text-3xl font-semibold text-ink md:text-[32px]">스크랩북</h1>
              <p className="mt-2 text-muted">뉴스, 트렌드, 프로젝트 아이디어를 한 곳에 모아 다음 빌드를 준비하세요.</p>
            </div>
          </section>

          <section className="mb-8 rounded-xl border border-outline-soft bg-white p-4">
            <form action="/scrap" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative md:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  name="q"
                  defaultValue={params.q ?? ''}
                  placeholder="스크랩 검색"
                  className="h-11 w-full rounded-lg border border-outline-soft bg-surface-low pl-9 pr-3 text-sm outline-none focus:border-brand-primary"
                />
              </div>
              {activeType !== 'all' && <input type="hidden" name="type" value={activeType} />}
              <button type="submit" className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white">검색</button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2">
              {FILTERS.map((filter) => {
                const href = filter.value === 'all'
                  ? query ? `/scrap?q=${encodeURIComponent(query)}` : '/scrap'
                  : `/scrap?type=${filter.value}${query ? `&q=${encodeURIComponent(query)}` : ''}`;

                return (
                  <Link
                    key={filter.value}
                    href={href}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${activeType === filter.value ? 'border-brand-primary bg-brand-primary text-white' : 'border-outline-soft bg-surface text-muted hover:border-brand-primary hover:text-brand-primary'}`}
                  >
                    {filter.label}
                  </Link>
                );
              })}
              {(query || activeType !== 'all') && (
                <Link href="/scrap" className="rounded-full border border-outline-soft px-3 py-1 text-xs font-semibold text-brand-primary hover:border-brand-primary">
                  초기화
                </Link>
              )}
            </div>
          </section>

          {!filteredItems.length ? (
            <EmptyState title={savedItems.length ? '조건에 맞는 스크랩이 없습니다' : '아직 스크랩한 항목이 없습니다'} description={savedItems.length ? '검색어 또는 타입 필터를 바꿔보세요.' : '로그인 후 뉴스나 프로젝트를 저장하면 이곳에 표시됩니다.'} />
          ) : (
            <section className="grid gap-4 lg:grid-cols-3">
              {filteredItems.map((item) => {
                const Icon = iconMap[item.item_type as keyof typeof iconMap] ?? Bookmark;

                return (
                  <Link key={item.id} href={`/scrap/${item.id}`} className="group rounded-xl border border-outline-soft bg-white p-5 transition-all hover:border-brand-primary hover:shadow-[0_4px_20px_-4px_rgba(255,70,40,0.16)]">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded bg-surface-high px-2 py-1 text-xs font-semibold text-muted">
                        <Icon className="h-3.5 w-3.5" />
                        {item.item_type}
                      </span>
                      <span className="text-xs text-muted">{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(item.created_at))}</span>
                    </div>
                    <h2 className="min-h-14 text-xl font-semibold leading-snug text-ink transition-colors group-hover:text-brand-primary">{item.title}</h2>
                    <div className="mt-6 flex items-center justify-between border-t border-outline-soft/60 pt-4">
                      {item.tag && <span className="rounded-full bg-brand-primary/10 px-3 py-1 text-xs font-semibold text-brand-primary">{item.tag}</span>}
                      <Bookmark className="h-5 w-5 fill-brand-primary text-brand-primary" />
                    </div>
                  </Link>
                );
              })}
            </section>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
