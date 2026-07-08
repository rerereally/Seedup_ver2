import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import { getScraps } from '@/lib/data';
import { Bookmark, Bot, Code2, FileText, Github, Lightbulb, Search } from 'lucide-react';
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

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <div className="page-shell">
          <PageIntro
            eyebrow="Saved"
            title="내 보관함"
            description="저장한 아티클, 논문, 오픈소스, AI 제품, 프로젝트 아이디어를 한 곳에서 이어보세요."
            icon={Bookmark}
          />

          <section className="mb-8 mt-9 rounded-xl border border-outline-soft bg-white p-4">
            <form action="/scrap" className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="relative md:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  type="search"
                  name="q"
                  defaultValue={params.q ?? ''}
                  placeholder="저장한 콘텐츠 검색"
                  className="h-11 w-full rounded-lg border border-outline-soft bg-surface-low pl-9 pr-3 text-sm outline-none focus:border-brand-primary"
                />
              </div>
              {activeType !== 'all' && <input type="hidden" name="type" value={activeType} />}
              <button type="submit" className="rounded-lg bg-brand-primary px-4 py-2 text-sm font-semibold text-white">검색</button>
            </form>
            <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="보관함 콘텐츠 타입">
              {FILTERS.map((filter) => {
                const href = filter.value === 'all'
                  ? query ? `/scrap?q=${encodeURIComponent(query)}` : '/scrap'
                  : `/scrap?type=${filter.value}${query ? `&q=${encodeURIComponent(query)}` : ''}`;

                return (
                  <Link
                    key={filter.value}
                    href={href}
                    role="tab"
                    aria-selected={activeType === filter.value}
                    className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${activeType === filter.value ? 'border-brand-primary bg-brand-primary text-white' : 'border-outline-soft bg-surface text-muted hover:border-brand-primary hover:text-brand-primary'}`}
                  >
                    {filter.label}
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${activeType === filter.value ? 'bg-white/20 text-white' : 'bg-white text-muted'}`}>{counts[filter.value] ?? 0}</span>
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

                return (
                  <Link key={item.id} href={`/scrap/${item.id}`} className="group rounded-xl border border-outline-soft bg-white p-5 transition-all hover:border-brand-primary hover:shadow-[0_4px_20px_-4px_rgba(255,70,40,0.16)]">
                    <div className="mb-5 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded bg-surface-high px-2 py-1 text-xs font-semibold text-muted">
                        <Icon className="h-3.5 w-3.5" />
                        {TYPE_LABELS[item.item_type] ?? item.item_type}
                      </span>
                      <span className="text-xs text-muted">{new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(new Date(item.created_at))}</span>
                    </div>
                    <h2 className="min-h-14 text-xl font-semibold leading-snug text-ink transition-colors group-hover:text-brand-primary">{item.title}</h2>
                    {item.description && <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">{item.description}</p>}
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
