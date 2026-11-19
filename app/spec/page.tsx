import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { listedPrds } from '@/lib/db/dossiers';
import { translator } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';
import { getOpportunities } from '@/lib/opportunities/data';
import { forkHref, problemGroups } from '@/lib/opportunities/public-prds';

// Kept out of search until there is a way to report a listed PRD; each one is user content.
export const metadata: Metadata = { title: '공개 PRD', robots: { index: false, follow: true } };
export const revalidate = 300;

/** PRDs their owners chose to list: grouped by problem, each opens read-only or seeds a new PRD from the same quotes. */
export default async function PublicPrdsPage() {
  const [lang, rows, { opportunities }] = await Promise.all([getLang(), listedPrds(60), getOpportunities()]);
  const t = translator(lang);
  const byslug = new Map(opportunities.map((item) => [item.slug, item]));
  const groups = problemGroups(rows, new Map(opportunities.map((item) => [item.slug, lang === 'en' ? item.nameEn ?? item.name : item.name])));
  const date = new Intl.DateTimeFormat(lang === 'en' ? 'en-US' : 'ko-KR', { dateStyle: 'medium', timeZone: 'Asia/Seoul' });

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell grow">
        <h1 className="text-[clamp(26px,3vw,34px)] font-bold leading-tight tracking-tight">{t('공개 PRD', 'Public PRDs')}</h1>
        <p className="mt-2 max-w-[42em] text-[15px] leading-7 text-tertiary">{t('만든 사람이 공개 목록에 올린 PRD입니다. 읽기만 할 수 있고, 같은 원문으로 내 PRD를 새로 만들 수 있습니다.', 'PRDs their makers chose to list. Read them, or start your own from the same quotes.')}</p>

        {groups.length > 0 && (
          <section className="mt-8" aria-labelledby="by-problem">
            <h2 id="by-problem" className="text-[15px] font-semibold">{t('문제별', 'By problem')}</h2>
            <ul className="mt-3 flex flex-wrap gap-2">
              {groups.map((group) => (
                <li key={group.slug}>
                  <Link href={`/opportunities/${group.slug}`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-outline-soft px-3 text-[14px] hover:border-outline-strong">
                    <span className="text-ink">{group.name}</span>
                    <span className="text-muted">{t(`PRD ${group.prds}개${group.built ? `, ${group.built}개 만들어짐` : ''}`, `${group.prds} PRD${group.prds > 1 ? 's' : ''}${group.built ? `, ${group.built} built` : ''}`)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {rows.length ? (
          <ul className="mt-8 grid gap-3 md:grid-cols-2">
            {rows.map((row) => {
              const problem = row.opportunity_slug ? byslug.get(row.opportunity_slug) : undefined;
              const quotes = (row.evidence_ids ?? []).length;
              return (
                <li key={row.id} className="flex flex-col rounded-xl border border-outline-soft p-4">
                  <Link href={`/spec/${row.id}`} className="text-[16px] font-semibold leading-snug text-ink underline-offset-4 hover:underline">{row.title}</Link>
                  <p className="mt-1 text-[13px] text-muted">
                    {problem ? (lang === 'en' ? problem.nameEn ?? problem.name : problem.name) : t('내 아이디어', 'Own idea')}
                    {' · '}{quotes ? t(`개발자 원문 ${quotes}건`, `${quotes} developer quote${quotes > 1 ? 's' : ''}`) : t('원문 없음(가설 초안)', 'No quotes (hypothesis draft)')}
                    {' · '}{date.format(new Date(row.updated_at))}
                  </p>
                  {row.built_url && <p className="mt-2 text-[13px] font-medium text-seed">{t('이걸로 만들었어요', 'Built from this')}</p>}
                  <div className="mt-auto flex flex-wrap gap-2 pt-3">
                    <Link href={`/spec/${row.id}`} className="btn-quiet h-9">{t('읽기', 'Read')}</Link>
                    <Link href={forkHref(row)} className="btn-quiet h-9">{t('이 근거로 내 PRD 만들기', 'Start mine from this')}</Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <div className="mt-10 rounded-xl border border-outline-soft p-6">
            <p className="text-[15px] text-ink">{t('아직 공개 목록에 올라온 PRD가 없습니다.', 'No PRD has been listed yet.')}</p>
            <p className="mt-2 text-[14px] leading-6 text-tertiary">{t('PRD를 만들어 북마크에 저장한 뒤, 북마크에서 "공개 목록에 올리기"를 누르면 여기에 보입니다.', 'Make a PRD, save it, then press "List publicly" in Bookmarks to show it here.')}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/prd/new" className="btn h-10">{t('PRD 만들기', 'Make a PRD')}</Link>
              <Link href="/newsletter-preview" className="btn-quiet h-10">{t('검증된 문제 보기', 'See verified problems')}</Link>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </>
  );
}
