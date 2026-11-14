import { getOpportunities } from '@/lib/opportunities/data';
import { dossierChanges } from '@/lib/opportunities/insight';
import { describeChange } from '@/lib/opportunities/merge';
import type { Metadata } from 'next';
import DossierPrd from '@/components/DossierPrd';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import { getContentHref } from '@/lib/content-targets';
import { getScraps } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import { ArrowRight, Bookmark, Bot, Code2, FileText, Github, Lightbulb, Search } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '내 보관함',
};

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
  { label: '글', value: 'news' },
  { label: '논문', value: 'paper' },
  { label: '오픈소스', value: 'github' },
  { label: 'AI 제품', value: 'ai_product' },
  { label: '프로젝트', value: 'project' },
  { label: '아이디어', value: 'idea' },
];

const TYPE_LABELS: Record<string, string> = {
  news: '글',
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

async function getDossiers() {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('evidence_dossiers')
    // '*' so the page keeps working before the optional `shared` column (dossier_share_2026_11.sql) exists.
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(20);
  return error ? [] : ((data ?? []) as DossierRow[]);
}

type DossierRow = { id: string; title: string; opportunity_slug: string | null; evidence_ids: string[]; prd_markdown: string | null; updated_at: string; shared?: boolean };

export default async function Scrap({ searchParams }: { searchParams: Promise<{ type?: string; q?: string }> }) {
  const params = await searchParams;
  const [savedItems, savedDossiers, { opportunities }] = await Promise.all([getScraps(), getDossiers(), getOpportunities()]);
  const dossiers = savedDossiers.map((dossier) => {
    const opportunity = opportunities.find((item) => item.slug === dossier.opportunity_slug);
    return { ...dossier, notes: opportunity ? dossierChanges(dossier.evidence_ids, dossier.updated_at, opportunity, describeChange).notes : [] };
  });
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
      <main id="main-content" className="grow bg-surface">
        <div className="page-shell page-stack">
          <PageIntro
            title="내 보관함"
            description="담아 둔 근거와 저장한 글, 저장소, 제품을 한곳에서 다시 봅니다."
            meta={savedItems.length ? <>저장 <span className="num text-ink">{savedItems.length}</span>개{latestItem ? <> · 마지막 저장 {formatDate(latestItem.created_at)}</> : null}</> : undefined}
            aside={savedItems.length > 0 ? (
              <form action="/scrap" role="search" className="flex h-11 w-full items-center gap-2.5 rounded-full border border-outline-soft bg-white px-4 transition-colors focus-within:border-ink sm:w-72">
                <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
                <input type="search" name="q" defaultValue={params.q ?? ''} aria-label="보관함 검색" placeholder="저장한 것 찾기" className="min-w-0 flex-1 rounded-none border-0 bg-transparent text-sm text-ink placeholder:text-muted" style={{ outline: 'none' }} />
                {activeType !== 'all' && <input type="hidden" name="type" value={activeType} />}
              </form>
            ) : undefined}
          />

          {dossiers.length > 0 && (
            <section aria-labelledby="dossiers-heading">
              <h2 id="dossiers-heading" className="text-xl font-extrabold tracking-tight text-ink">담은 근거</h2>
              <ul className="mt-4 grid gap-4 md:grid-cols-2">
                {dossiers.map((dossier) => (
                  <li key={dossier.id} className="card p-5 md:p-6">
                    <p className="text-lg font-bold leading-snug text-ink">{dossier.title}</p>
                    <p className="mt-1.5 text-[13px] text-muted">근거 <span className="num text-ink">{dossier.evidence_ids.length}</span>건{dossier.prd_markdown ? ' · PRD 있음' : ''} · {formatDate(dossier.updated_at)}</p>
                    {dossier.notes.length > 0 && (
                      <div className="mt-4 border-l-[3px] border-hot pl-4">
                        <p className="label">PRD에서 고칠 것</p>
                        <ul className="mt-1 grid gap-1 text-sm leading-6 text-muted">
                          {dossier.notes.map((note) => <li key={note}>{note}</li>)}
                        </ul>
                      </div>
                    )}
                    <DossierPrd id={dossier.id} title={dossier.title} markdown={dossier.prd_markdown} shared={dossier.shared === true} />
                    {dossier.opportunity_slug && <Link href={`/opportunities/${dossier.opportunity_slug}`} className="btn-quiet mt-2">기회 다시 보기<ArrowRight aria-hidden="true" className="h-4 w-4" /></Link>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="flex flex-col gap-5">
            {dossiers.length > 0 && <h2 className="text-xl font-extrabold tracking-tight text-ink">저장한 것</h2>}
            {savedItems.length > 0 && (
              <nav aria-label="저장한 것의 종류" className="tabs self-start">
                {FILTERS.filter((filter) => filter.value === 'all' || counts[filter.value] > 0 || activeType === filter.value).map((filter) => (
                  <Link key={filter.value} href={buildFilterHref(filter.value, query)} aria-current={activeType === filter.value ? 'page' : undefined} className="tab">
                    {filter.label}
                    <span className="num">{counts[filter.value] ?? 0}</span>
                  </Link>
                ))}
              </nav>
            )}

            {!filteredItems.length ? (
              <EmptyState
                title={savedItems.length ? '조건에 맞는 것이 없습니다' : '아직 저장한 것이 없습니다'}
                description={savedItems.length ? '찾는 말이나 종류를 바꿔 보세요.' : '기회에서 근거를 담거나 글, 저장소, 제품의 책갈피를 누르면 여기에 모입니다.'}
                actionHref={savedItems.length ? '/scrap' : '/opportunities'}
                actionLabel={savedItems.length ? '전체 보기' : '기회 살펴보기'}
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredItems.map((item) => {
                  const Icon = iconMap[item.item_type as keyof typeof iconMap] ?? Bookmark;
                  const contentHref = getContentHref(item.item_type, item.item_id);

                  return (
                    <article key={item.id} className="card flex min-h-56 flex-col p-5 transition-colors hover:border-outline-strong md:p-6">
                      <p className="flex items-center gap-1.5 text-[13px] text-muted">
                        <Icon aria-hidden="true" className="h-3.5 w-3.5" />
                        <span className="font-bold text-ink">{TYPE_LABELS[item.item_type] ?? item.item_type}</span>
                        <span>· {formatDate(item.created_at)}</span>
                      </p>
                      <Link href={`/scrap/${item.id}`} className="mt-2.5 block">
                        <h3 className="line-clamp-3 text-lg font-bold leading-snug text-ink">{item.title}</h3>
                      </Link>
                      {item.description && <p className="mt-2.5 line-clamp-3 text-[15px] leading-7 text-muted">{item.description}</p>}
                      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                        <Link href={contentHref} className="btn-quiet">
                          원본 열기
                          <ArrowRight aria-hidden="true" className="h-4 w-4" />
                        </Link>
                        {item.tag && <span className="chip max-w-[45%] truncate">{item.tag}</span>}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
