import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import { getContentHref } from '@/lib/content-targets';
import { getScraps } from '@/lib/data';
import { ArrowRight, Bookmark, Bot, Code2, FileText, Github, Lightbulb, Search } from 'lucide-react';
import Link from 'next/link';

const iconMap = {
  news: FileText,
  paper: FileText,
  project: Code2,
  ai_product: Bot,
  idea: Lightbulb,
  github: Github,
};

const FILTERS = [
  { label: '전체', value: 'all' },
  { label: '아티클', value: 'news' },
  { label: '논문', value: 'paper' },
  { label: '오픈소스', value: 'github' },
  { label: 'AI 제품', value: 'ai_product' },
  { label: '프로젝트', value: 'project' },
  { label: '아이디어', value: 'idea' },
];

const TYPE_LABELS: Record<string, string> = {
  news: '아티클',
  paper: '논문',
  project: '프로젝트',
  ai_product: 'AI 제품',
  github: '오픈소스',
  idea: '아이디어',
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(value));
}

function buildFilterHref(filterValue: string, query: string) {
  if (filterValue === 'all') return query ? `/scrap?q=${encodeURIComponent(query)}` : '/scrap';
  return `/scrap?type=${filterValue}${query ? `&q=${encodeURIComponent(query)}` : ''}`;
}

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
  const counts = FILTERS.reduce<Record<string, number>>((acc, filter) => {
    acc[filter.value] = filter.value === 'all' ? savedItems.length : savedItems.filter((item) => item.item_type === filter.value).length;
    return acc;
  }, {});
  const latestItem = savedItems[0];

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="page-shell page-stack">
          <PageIntro
            eyebrow="Saved Queue"
            title="내 보관함"
            description="나중에 읽고, 비교하고, 프로젝트 후보로 이어갈 콘텐츠를 한 곳에서 관리합니다."
            icon={Bookmark}
            meta={(
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  [`${savedItems.length}개`, '전체 저장'],
                  [`${filteredItems.length}개`, '현재 보기'],
                  [latestItem ? formatDate(latestItem.created_at) : '-', '최근 저장'],
                ].map(([value, label]) => (
                  <div key={label} className="border border-outline-soft bg-white px-4 py-3">
                    <p className="text-2xl font-black text-ink">{value}</p>
                    <p className="mt-1 text-xs font-bold uppercase text-muted">{label}</p>
                  </div>
                ))}
              </div>
            )}
          />

          <section className="border border-outline-soft bg-white p-4">
            <form action="/scrap" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative md:w-96">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  name="q"
                  defaultValue={params.q ?? ''}
                  placeholder="저장한 콘텐츠 검색"
                  className="h-11 w-full border border-outline-soft bg-surface pl-9 pr-3 text-sm outline-none focus:border-ink"
                />
              </div>
              {activeType !== 'all' && <input type="hidden" name="type" value={activeType} />}
              <button type="submit" className="h-11 bg-ink px-4 text-sm font-bold text-white">검색</button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="보관함 콘텐츠 타입">
              {FILTERS.map((filter) => (
                <Link
                  key={filter.value}
                  href={buildFilterHref(filter.value, query)}
                  role="tab"
                  aria-selected={activeType === filter.value}
                  className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-bold ${activeType === filter.value ? 'border-ink bg-ink text-white' : 'border-outline-soft bg-surface text-muted hover:border-ink hover:text-ink'}`}
                >
                  {filter.label}
                  <span className={activeType === filter.value ? 'text-white' : 'text-muted'}>{counts[filter.value] ?? 0}</span>
                </Link>
              ))}
              {(query || activeType !== 'all') && (
                <Link href="/scrap" className="border border-outline-soft px-3 py-1.5 text-xs font-bold text-ink hover:border-ink">
                  초기화
                </Link>
              )}
            </div>
          </section>

          {!filteredItems.length ? (
            <EmptyState
              title={savedItems.length ? '조건에 맞는 저장 항목이 없습니다' : '아직 저장한 항목이 없습니다'}
              description={savedItems.length ? '검색어 또는 타입 필터를 바꿔보세요.' : '아티클, 논문, 오픈소스, AI 제품, 프로젝트를 저장하면 나중에 만들 후보로 이어볼 수 있습니다.'}
              actionHref={savedItems.length ? '/scrap' : '/news'}
              actionLabel={savedItems.length ? '필터 초기화' : '아티클 둘러보기'}
            />
          ) : (
            <section className="grid gap-4 lg:grid-cols-3">
              {filteredItems.map((item) => {
                const Icon = iconMap[item.item_type as keyof typeof iconMap] ?? Bookmark;
                const contentHref = getContentHref(item.item_type, item.item_id);

                return (
                  <article key={item.id} className="group flex min-h-64 flex-col border border-outline-soft bg-white p-5 transition-colors hover:border-ink">
                    <div className="mb-5 flex items-center justify-between gap-3">
                      <span className="inline-flex items-center gap-1 border border-outline-soft bg-surface px-2 py-1 text-xs font-bold text-muted">
                        <Icon className="h-3.5 w-3.5" />
                        {TYPE_LABELS[item.item_type] ?? item.item_type}
                      </span>
                      <span className="text-xs font-semibold text-muted">{formatDate(item.created_at)}</span>
                    </div>
                    <Link href={`/scrap/${item.id}`} className="block">
                      <h2 className="line-clamp-3 text-xl font-black leading-snug text-ink group-hover:underline">{item.title}</h2>
                    </Link>
                    {item.description && <p className="mt-3 line-clamp-3 text-sm leading-6 text-muted">{item.description}</p>}
                    <div className="mt-auto pt-5">
                      {item.tag && <span className="mb-3 inline-flex border border-outline-soft bg-surface px-2 py-1 text-xs font-bold text-muted">{item.tag}</span>}
                      <div className="flex items-center justify-between border-t border-outline-soft pt-4">
                        <Link href={contentHref} className="inline-flex h-9 items-center gap-1 bg-ink px-3 text-xs font-bold text-white">
                          원본 열기
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Bookmark className="h-5 w-5 fill-ink text-ink" />
                      </div>
                    </div>
                  </article>
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
