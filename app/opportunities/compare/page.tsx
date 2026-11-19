import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { StatusLabel } from '@/components/opportunity-stage/OpportunityTable';
import { translator } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';
import { selectCompareOpportunities } from '@/lib/opportunities/compare';
import { getOpportunities } from '@/lib/opportunities/data';
import { firstUserSources } from '@/lib/opportunities/rules';
import { BUILD_LABELS, PLATFORM_LABELS, localizedOpportunity, publicEvidence } from '@/lib/opportunities/types';
import type { Opportunity } from '@/lib/opportunities/types';

const title = (lang: 'ko' | 'en') => translator(lang)('후보 비교', 'Compare candidates');
const labelCell = 'sticky left-0 z-10 border-r bg-white text-sm font-semibold text-muted';

export async function generateMetadata(): Promise<Metadata> {
  return { title: title(await getLang()) };
}

export default async function OpportunityComparePage({ searchParams }: { searchParams: Promise<{ slugs?: string | string[] }> }) {
  const [lang, { opportunities, generatedAt }, { slugs }] = await Promise.all([getLang(), getOpportunities(), searchParams]);
  const t = translator(lang);
  const { candidates, hasUnknownSlugs, hasExtraSlugs } = selectCompareOpportunities(slugs, opportunities);
  const noData = t('자료 없음', 'No data');
  const platformLabels = {
    ...PLATFORM_LABELS,
    forum: t('사용자 포럼', 'User forum'),
    web: t('웹 검색', 'Web search'),
    own: t('내 메모·인터뷰', 'My notes and interviews'),
  };
  const rows: Array<[string, (item: Opportunity) => ReactNode]> = [
    [t('문제', 'Problem'), (item) => localizedOpportunity(item, lang).problem],
    [t('검증', 'Verification'), (item) => item.qualified
      ? <span className="font-semibold text-seed">{t('검증됨', 'Verified')}</span>
      : t('근거 부족', 'Not enough evidence')],
    [t('원문', 'Quotes'), (item) => (
      <>
        <span className="num font-semibold">{t(`${item.evidence.length}건`, `${item.evidence.length} quotes`)}</span>
        <p className="mt-1 text-muted">{item.platforms.map((platform) => platformLabels[platform]).join(', ')}</p>
      </>
    )],
    [t('직접 경쟁', 'Direct rivals'), (item) => {
      const rivals = item.supply.filter((rival) => rival.relation === 'direct');
      return (
        <>
          <span className="num font-semibold">{t(`${item.directCount}개`, String(item.directCount))}</span>
          {rivals.length > 0 && <ul className="mt-1 text-tertiary">{rivals.map((rival) => <li key={rival.url}>{rival.name.replace(/^Show HN:\s*/i, '')}</li>)}</ul>}
        </>
      );
    }],
    [t('시장 빈틈', 'Market gap'), (item) => {
      const { gap } = localizedOpportunity(item, lang);
      return (
        <>
          <StatusLabel status={item.status} lang={lang} />
          {gap && <p className="mt-1 text-tertiary">{gap}</p>}
        </>
      );
    }],
    [t('구현 규모', 'Build size'), (item) => item.build ? (
      <>
        <span className="font-semibold">{BUILD_LABELS[item.build.size][lang === 'en' ? 1 : 0]}</span>
        <p className="num mt-1 text-muted">{t(`약 ${item.build.days}일 (AI 추정)`, `About ${item.build.days} days (AI estimate)`)}</p>
      </>
    ) : noData],
    [t('첫 사용자 후보', 'First user candidates'), (item) => {
      const sources = firstUserSources(publicEvidence(item.evidence));
      return sources.length > 0 ? (
        <ul>
          {sources.map((source, index) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="link-seed min-h-11 sm:min-h-9">
                {t(`${platformLabels[source.platform]} 글 ${index + 1}`, `${platformLabels[source.platform]} post ${index + 1}`)}
              </a>
            </li>
          ))}
        </ul>
      ) : noData;
    }],
    ['PRD', (item) => {
      const { name } = localizedOpportunity(item, lang);
      return (
        <Link href={`/prd?opportunity=${encodeURIComponent(item.slug)}`} className="btn-quiet min-h-11 sm:min-h-10"
          aria-label={t(`${name} PRD 만들기`, `Make a PRD for ${name}`)}>
          {t('PRD 만들기', 'Make a PRD')}
        </Link>
      );
    }],
  ];

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell min-w-0 grow">
        <Link href="/opportunities" className="inline-flex min-h-11 items-center gap-1 text-sm text-muted hover:text-ink"><span aria-hidden="true">‹</span> {t('인사이트', 'Insights')}</Link>
        <h1 id="compare-title" className="page-intro-title mt-4">{title(lang)}</h1>
        {hasUnknownSlugs && <p className="mt-3 text-sm text-muted">{t('찾을 수 없는 후보는 비교에서 뺐습니다.', 'Candidates we could not find were left out.')}</p>}
        {hasExtraSlugs && <p className="mt-3 text-sm text-muted">{t('앞에서부터 3개 후보만 비교합니다.', 'Showing the first three candidates.')}</p>}
        {candidates.length < 2 ? (
          <p className="empty-state mt-6 text-sm">{t('비교하려면 후보가 두 개 이상 필요합니다.', 'Choose at least two candidates to compare.')}</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-muted">
              {t('자료 기준일', 'Data as of')}{' '}
              <time dateTime={generatedAt} className="num">
                {new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en', { dateStyle: 'medium', timeZone: 'Asia/Seoul' }).format(new Date(generatedAt))}
              </time>
            </p>
            <div className="card mt-4 max-w-full overflow-x-auto" role="region" aria-labelledby="compare-title" tabIndex={0}>
              <table className="w-full table-fixed border-separate border-spacing-0 text-left text-sm leading-6 wrap-anywhere [&_:is(th,td)]:border-b [&_:is(th,td)]:border-outline-soft [&_:is(th,td)]:p-3 [&_:is(th,td)]:align-top [&_tr>:nth-child(n+3)]:border-l [&_tbody_tr:last-child>*]:border-b-0 sm:[&_:is(th,td)]:p-4"
                style={{ minWidth: `${6 + candidates.length * 13}rem` }}>
                <colgroup><col className="w-24" />{candidates.map((item) => <col key={item.slug} />)}</colgroup>
                <thead>
                  <tr>
                    <th scope="col" className={labelCell}>{t('항목', 'Criteria')}</th>
                    {candidates.map((item) => (
                      <th key={item.slug} scope="col" className="text-[16px] font-semibold">
                        <Link href={`/opportunities/${encodeURIComponent(item.slug)}`} className="inline-flex min-h-11 items-center underline-offset-4 hover:underline sm:min-h-9">
                          {localizedOpportunity(item, lang).name}
                        </Link>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, render]) => (
                    <tr key={label}>
                      <th scope="row" className={labelCell}>{label}</th>
                      {candidates.map((item) => <td key={item.slug}>{render(item)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
