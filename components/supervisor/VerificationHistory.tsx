import type { VerificationSummary } from '@/lib/db/verifications';
import { translator, type Lang } from '@/lib/i18n';
import { ActivityTime } from './ProjectList';

const statuses: Record<VerificationSummary['status'], [string, string]> = {
  queued: ['대기 중', 'Queued'], running: ['검증 중', 'Running'], passed: ['통과', 'Passed'],
  failed: ['통과 기준 미충족', 'Did not pass'], blocked: ['검사에서 차단', 'Blocked'], error: ['실행 오류', 'Error'],
};
const verdicts: Record<VerificationSummary['verdicts'][number]['verdict'], [string, string]> = {
  met: ['충족', 'Met'], unclear: ['근거 불충분', 'Unclear'], not_met: ['미충족', 'Not met'],
};

export default function VerificationHistory({ rows, lang }: { rows: VerificationSummary[] | null; lang: Lang }) {
  const t = translator(lang);
  return <section aria-labelledby="verification-history" className="min-w-0 border-t border-outline-soft pt-6">
    <h2 id="verification-history" className="text-xl font-semibold text-ink">{t('최근 검증 기록', 'Recent verifications')}</h2>
    {rows === null && <p className="mt-3 text-sm text-muted">{t('검증 기록을 불러오지 못했습니다.', 'Verification history could not be loaded.')}</p>}
    {rows?.length === 0 && <p className="mt-3 text-sm text-muted">{t('아직 실행한 검증이 없습니다.', 'No verifications yet.')}</p>}
    {rows?.map((run, index) => <details key={run.id} open={index === 0} className="mt-3 rounded-xl border border-outline-soft bg-white p-4 sm:p-5">
      <summary className="cursor-pointer text-sm font-semibold text-ink">
        {run.feature_id} · {t(...statuses[run.status])} <span className="ml-2 font-mono font-normal text-muted">{run.sha.slice(0, 8)}</span>
      </summary>
      <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[13px] text-muted">
        <span>{run.repo}</span><ActivityTime at={run.created_at} lang={lang} />
        {run.model && <span>{run.model}</span>}
        {run.duration_ms != null && <span>{(run.duration_ms / 1000).toFixed(1)}{t('초', ' s')}</span>}
      </div>
      {run.error_message && <p className="mt-3 text-sm text-ink">{run.error_message}</p>}
      {run.checks.length > 0 && <p className="mt-2 text-sm text-tertiary">CI · {run.checks.map((check) => `${check.name} (${check.conclusion ?? t('진행 중', 'pending')})`).join(', ')}</p>}
      {run.verdicts.length > 0 && <ol className="mt-3 divide-y divide-outline-soft">{run.verdicts.map((item) => <li key={item.criterion} className="py-3 text-sm">
        <h3 className="font-semibold text-ink">{t('기준', 'Criterion')} {item.criterion} · {t(...verdicts[item.verdict])}</h3>
        {item.testEvidence?.criterionText && <p className="mt-1 text-ink">{item.testEvidence.criterionText}</p>}
        <p className="mt-1 whitespace-pre-wrap text-tertiary">{item.reason}</p>
        {item.citations.length > 0 && <details className="mt-2">
          <summary className="cursor-pointer text-tertiary">{t('코드 인용', 'Code citations')} ({item.citations.length})</summary>
          <ul>{item.citations.map((citation, n) => <li key={n} className="my-2 border-l-2 border-outline-soft pl-3">
            <span className="font-mono">{citation.path}:{citation.line}</span>
            <span className="ml-2 text-muted">{citation.verified ? t('원문 일치', 'Matched') : t('미확인', 'Unverified')}</span>
            <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-tertiary">{citation.quote}</pre>
          </li>)}</ul>
        </details>}
      </li>)}</ol>}
    </details>)}
  </section>;
}
