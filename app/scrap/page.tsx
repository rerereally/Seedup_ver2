import { getOpportunities } from '@/lib/opportunities/data';
import { dossierChanges } from '@/lib/opportunities/insight';
import { describeChange } from '@/lib/opportunities/merge';
import type { Metadata } from 'next';
import DossierPrd from '@/components/DossierPrd';
import EmptyState from '@/components/EmptyState';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import PageIntro from '@/components/PageIntro';
import WorkShell from '@/components/WorkShell';
import { getContentHref } from '@/lib/content-targets';
import { getScraps } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import { Search } from 'lucide-react';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '북마크',
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

  return (
    <>
      <Header />
      <WorkShell>
        <PageIntro
          title="북마크"
          description="저장한 PRD와 킵한 저장소, 글, 논문. 킵한 것은 코딩 에이전트가 MCP get_kept_items로 가져갑니다."
          aside={savedItems.length > 0 ? (
            <form action="/scrap" role="search" className="flex h-11 w-full items-center gap-2.5 rounded-[10px] border border-field bg-white px-4 transition-colors focus-within:border-ink sm:w-72">
              <Search aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
              <input type="search" name="q" defaultValue={params.q ?? ''} aria-label="북마크 검색" placeholder="저장한 것 찾기" className="min-w-0 flex-1 rounded-none border-0 bg-transparent text-sm text-ink placeholder:text-muted" />
              {activeType !== 'all' && <input type="hidden" name="type" value={activeType} />}
            </form>
          ) : undefined}
        />

        {dossiers.length > 0 && (
          <section aria-labelledby="dossiers-heading">
            <h2 id="dossiers-heading" className="text-lg font-semibold text-ink">PRD <span className="num text-sm font-normal text-muted">{dossiers.length}</span></h2>
            <ul className="rows mt-3">
              {dossiers.map((dossier) => (
                <li key={dossier.id} className="py-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                    <p className="text-[17px] font-semibold leading-snug text-ink">{dossier.title}</p>
                    <time dateTime={dossier.updated_at} className="shrink-0 text-[13px] text-muted">{formatDate(dossier.updated_at)}</time>
                  </div>
                  <p className="mt-1 flex flex-wrap gap-x-3 text-sm text-muted"><span>원문 <span className="num">{dossier.evidence_ids.length}</span>건</span><span>{dossier.prd_markdown ? 'PRD 있음' : 'PRD 없음'}</span><span>{dossier.shared === true ? '공유 링크 켜짐' : '공유 안 함'}</span></p>
                  {dossier.notes.length > 0 && (
                    <div className="mt-4 border-l-2 border-seed pl-4">
                      <p className="label">PRD에서 고칠 것</p>
                      <ul className="mt-1 grid gap-1 text-sm leading-6 text-ink">
                        {dossier.notes.map((note) => <li key={note}>{note}</li>)}
                      </ul>
                    </div>
                  )}
                  <DossierPrd id={dossier.id} title={dossier.title} markdown={dossier.prd_markdown} shared={dossier.shared === true} />
                  {dossier.opportunity_slug && <Link href={`/opportunities/${dossier.opportunity_slug}`} className="link-seed mt-2">기회 다시 보기</Link>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="flex flex-col gap-2">
          {savedItems.length > 0 && (
            <nav aria-label="저장한 것의 종류" className="tabs">
              {FILTERS.filter((filter) => filter.value === 'all' || counts[filter.value] > 0 || activeType === filter.value).map((filter) => (
                <Link key={filter.value} href={buildFilterHref(filter.value, query)} aria-current={activeType === filter.value ? 'page' : undefined} className="tab">
                  {filter.label}
                  <span className="num">{counts[filter.value] ?? 0}</span>
                </Link>
              ))}
            </nav>
          )}

          {!filteredItems.length ? (
            <div className="mt-4">
              <EmptyState
                title={savedItems.length ? '조건에 맞는 것이 없습니다' : '아직 저장한 것이 없습니다'}
                description={savedItems.length ? '찾는 말이나 종류를 바꿔 보세요.' : '글이나 저장소에서 킵하기를 누르거나 PRD를 저장하면 여기에 모입니다.'}
                actionHref={savedItems.length ? '/scrap' : '/news?tab=github'}
                actionLabel={savedItems.length ? '전체 보기' : '이번 주 오픈소스 보기'}
              />
            </div>
          ) : (
            <ul className="rows [&>:first-child]:border-t-0">
              {filteredItems.map((item) => (
                <li key={item.id} className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4">
                  <div className="min-w-0 flex-1 basis-72">
                    <Link href={`/scrap/${item.id}`} className="text-[17px] font-semibold leading-snug text-ink underline-offset-4 hover:underline">{item.title}</Link>
                    {item.description && <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted">{item.description}</p>}
                    <p className="mt-1 flex flex-wrap gap-x-3 text-[13px] text-muted">
                      <span>{TYPE_LABELS[item.item_type] ?? item.item_type}</span>
                      {item.tag && <span>{item.tag}</span>}
                      <Link href={getContentHref(item.item_type, item.item_id)} className="font-semibold text-seed underline-offset-4 hover:underline">원본 보기</Link>
                    </p>
                  </div>
                  <time dateTime={item.created_at} className="shrink-0 text-[13px] text-muted">{formatDate(item.created_at)}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </WorkShell>
      <Footer />
    </>
  );
}
