import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { StatusLabel } from '@/components/opportunity-stage/OpportunityTable';
import { translator } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';
import { getOpportunities } from '@/lib/opportunities/data';
import { parseSealedPredictions, predictionRecord, predictionSampleNote, predictionSummary } from '@/lib/opportunities/predictions';
import ledger from '@/predictions/sealed.jsonl';

export const metadata: Metadata = { title: '봉인 예측 적중 기록' };

const sealed = parseSealedPredictions(ledger);

export default async function PredictionsPage() {
  const [lang, { opportunities, generatedAt }] = await Promise.all([getLang(), getOpportunities()]);
  const t = translator(lang);
  const asOf = Date.parse(generatedAt);
  const rows = predictionRecord(sealed, opportunities, asOf);
  const { hits, sample, pending, rate } = predictionSummary(rows);
  const sampleNote = predictionSampleNote(sample, lang);
  const locale = lang === 'en' ? 'en-US' : 'ko-KR';
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'Asia/Seoul' });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const delta = new Intl.NumberFormat(locale, { signDisplay: 'exceptZero' });
  const outcome = { hit: t('맞음', 'Hit'), miss: t('틀림', 'Miss'), pending: t('아직 모름', 'Pending') };
  const missing = t('기록 없음', 'No record');

  return (
    <>
      <Header />
      <main id="main-content" className="page-shell grow">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h1 className="page-intro-title">{t('봉인 예측 적중 기록', 'Sealed prediction track record')}</h1>
          <Link href="/predictions/sealed.jsonl" className="link-seed">{t('봉인 원본과 해시', 'Sealed records and hashes')}</Link>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted">
          {Number.isFinite(asOf) && <>{t('최근 수집 기준', 'Data collected through')} <time dateTime={generatedAt}>{date.format(asOf)}</time>{' · '}</>}
          {t('이 기록은 참고용입니다. 인과관계를 뜻하지 않습니다.', 'This record is for reference. It does not imply causation.')}
        </p>

        <dl className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="card p-4">
            <dt className="text-sm text-muted">{t('적중률', 'Hit rate')}</dt>
            <dd className="mt-1">
              <span className="num text-2xl font-bold">{rate === null ? '—' : percent.format(rate)}</span>
              <span className="mt-1 block text-sm text-muted">{t(`판정 ${sample}건 중 ${hits}건 적중`, `${hits} hits among ${sample} scored predictions`)}</span>
            </dd>
          </div>
          <div className="card p-4"><dt className="text-sm text-muted">{t('판정 표본', 'Scored predictions')}</dt><dd className="num mt-1 text-2xl font-bold">{sample}</dd></div>
          <div className="card p-4"><dt className="text-sm text-muted">{t('아직 모름', 'Pending')}</dt><dd className="num mt-1 text-2xl font-bold">{pending}</dd></div>
        </dl>
        {sampleNote && <p className="mt-3 text-sm font-medium text-ink">{sampleNote}</p>}

        <details className="mt-5 rounded-xl border border-outline-soft p-4" open>
          <summary className="cursor-pointer font-semibold">{t('판정 기준', 'Scoring rules')}</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-tertiary">
            <li>{t('맞음: 봉인 이후부터 기한까지 출시된 직접 경쟁 도구가 최근 수집 기록에 있습니다.', 'Hit: the latest collection contains a direct rival released after sealing and by the deadline.')}</li>
            <li>{t('틀림: 수집 시점이 기한에 이르렀고, 기한 내 출시된 직접 경쟁 도구가 기록에 없습니다.', 'Miss: the latest collection reached the deadline without a recorded direct rival released within the window.')}</li>
            <li>{t('아직 모름: 기한 전까지 적중 신호가 없거나, 해당 문제의 최근 수집 기록이 없습니다.', 'Pending: no hit has been observed before the deadline, or current data for the problem is unavailable.')}</li>
          </ul>
        </details>

        <section className="mt-8" aria-labelledby="sealed-list">
          <h2 id="sealed-list" className="text-lg font-semibold">{t(`봉인된 예측 ${rows.length}건`, `${rows.length} sealed predictions`)}</h2>
          {rows.length === 0 && <p className="mt-3 text-sm text-muted">{t('아직 봉인된 예측이 없습니다.', 'There are no sealed predictions yet.')}</p>}
          <ul className="mt-3 space-y-3">
            {rows.map((row) => (
              <li key={row.hash} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold [overflow-wrap:anywhere]">{lang === 'en' ? row.nameEn ?? row.name : row.name}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {t(`${row.withinDays}일 안에 직접 경쟁 도구 등장`, row.claim)}
                      {' · '}{t('기한', 'Deadline')} <time dateTime={new Date(row.deadline).toISOString()}>{date.format(row.deadline)}</time>
                    </p>
                  </div>
                  <span className="chip text-sm">{outcome[row.status]}</span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg bg-surface-low p-3">
                    <h4 className="text-sm font-semibold">{t('봉인 시점', 'At sealing')} <time className="ml-1 font-normal text-muted" dateTime={row.sealedAt}>{date.format(Date.parse(row.sealedAt))}</time></h4>
                    <p className="mt-1 text-sm text-muted">{t(`원문 ${row.evidenceCount}건 · 직접 경쟁 ${row.directCount}개`, `${row.evidenceCount} quotes · ${row.directCount} direct rivals`)}</p>
                    <p className="mt-1 text-sm">{row.statusAtSeal ? <StatusLabel status={row.statusAtSeal} lang={lang} /> : missing}</p>
                  </div>
                  <div className="rounded-lg bg-surface-low p-3">
                    <h4 className="text-sm font-semibold">{t('최근 수집', 'Latest collection')}</h4>
                    {row.current ? (
                      <>
                        <p className="mt-1 text-sm text-muted">
                          {t(`원문 ${row.current.evidenceCount}건`, `${row.current.evidenceCount} quotes`)} ({delta.format(row.current.evidenceCount - row.evidenceCount)})
                          {' · '}{t(`직접 경쟁 ${row.current.directCount}개`, `${row.current.directCount} direct rivals`)} ({delta.format(row.current.directCount - row.directCount)})
                        </p>
                        <p className="mt-1 text-sm"><StatusLabel status={row.current.status} lang={lang} /></p>
                      </>
                    ) : <p className="mt-1 text-sm text-muted">{missing}</p>}
                  </div>
                </div>
                {row.current && (
                  <p className="mt-3 break-words text-sm text-muted">
                    <b className="font-semibold text-ink">{t('봉인 뒤 출시된 직접 경쟁 도구', 'Direct rivals released after sealing')}</b>{' · '}
                    {row.newDirect.map((tool) => Date.parse(tool.createdAt ?? '') > row.deadline
                      ? `${tool.name} (${t('기한 이후', 'after deadline')})` : tool.name).join(', ') || t('없음', 'None recorded')}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      </main>
      <Footer />
    </>
  );
}
