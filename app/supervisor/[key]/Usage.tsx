import type { SupabaseClient } from '@supabase/supabase-js';
import type { SupervisorDetail } from '@/components/supervisor/data';
import { projectUsage } from '@/lib/db/agent-usage';
import { translator, type Lang } from '@/lib/i18n';
import { TOP_MODEL } from '@/lib/pricing';

export default async function Usage({ client, userId, project, lang }: {
  client: SupabaseClient; userId: string; project: SupervisorDetail; lang: Lang;
}) {
  const t = translator(lang);
  const usage = await projectUsage(client, userId, project.key, project.progress, project.goal?.criteria ?? []).catch(() => null);
  const number = new Intl.NumberFormat(lang === 'ko' ? 'ko-KR' : 'en-US');
  const usd = new Intl.NumberFormat(lang === 'ko' ? 'ko-KR' : 'en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 });

  if (!usage) return <p role="status" className="text-sm text-muted">{t('사용량을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.', 'Could not load usage. Please try again shortly.')}</p>;

  const titles = new Map(project.features.map((row) => [row.id, row.title]));
  for (const row of usage.features) if (!titles.has(row.id)) titles.set(row.id, '');
  const measured = new Map(usage.features.map((row) => [row.id, row]));
  type Total = typeof usage.total;
  const money = (amount: number, unpriced: number) => <>{!unpriced || amount !== 0 ? usd.format(amount) : null}{unpriced > 0 && <span className="block text-xs text-muted">{t('단가 없음', 'Pricing unavailable')}</span>}</>;
  const cells = (total: Total | undefined, savings = true) => <>
    <td className="p-2 text-right tabular-nums">{total ? number.format(total.tokens) : '—'}</td>
    <td className="p-2 text-right tabular-nums">{total ? money(total.cost, total.unpriced) : '—'}</td>
    <td className="p-2 text-right tabular-nums">{total && savings ? money(total.savings, total.unpriced) : '—'}</td>
  </>;
  const headings = <tr className="border-b border-outline-soft">
    <th scope="col" className="p-2 text-left">{t('항목', 'Item')}</th>
    <th scope="col" className="p-2 text-right">{t('토큰', 'Tokens')}</th>
    <th scope="col" className="p-2 text-right">{t('비용 (USD)', 'Cost (USD)')}</th>
    <th scope="col" className="p-2 text-right">{t('절감액 (USD)', 'Savings (USD)')}</th>
  </tr>;

  return <section className="card min-w-0 space-y-4 p-5 sm:p-6" aria-labelledby="usage-heading">
    <h2 id="usage-heading" className="text-xl font-semibold text-ink">{t('토큰과 비용', 'Tokens and cost')}</h2>
    <p className="text-sm text-muted">{t(
      `비용은 API 단가로 환산한 추정치입니다. 절감액은 같은 에이전트 토큰을 ${TOP_MODEL}로 썼을 때와 비교합니다.`,
      `Costs are API-rate estimates. Savings compare the same agent tokens at ${TOP_MODEL} rates.`,
    )}</p>
    <p className="text-sm text-muted">{t(
      '작업 시간이 겹치거나 기능을 알 수 없는 토큰은 프로젝트 합계에만 넣습니다. 저장하지 않았거나 프로젝트 연결이 없는 기존 PRD 실행은 합계에서 빠집니다.',
      'Tokens from overlapping or unmatched work periods count toward the project total only. Unsaved PRD runs and older runs without a project link are excluded.',
    )}</p>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="sr-only">{t('프로젝트와 기능별 사용량', 'Project and feature usage')}</caption>
        <thead>{headings}</thead>
        <tbody className="divide-y divide-outline-soft">
          <tr className="font-semibold"><th scope="row" className="p-2 text-left">{t('프로젝트 합계', 'Project total')}</th>{cells(usage.total)}</tr>
          <tr><th scope="row" className="p-2 text-left font-normal">{t('Seedup PRD · 서버 검증', 'Seedup PRDs and server verification')}</th>{cells(usage.seedup, false)}</tr>
          <tr><th scope="row" className="p-2 text-left font-normal">{t('기능에 연결되지 않은 에이전트 사용량', 'Agent usage without a feature')}</th>{cells(usage.unmapped)}</tr>
          {[...titles].map(([id, title]) => {
            const row = measured.get(id);
            return <tr key={id}><th scope="row" className="p-2 text-left font-normal">{id} {title}
              {row?.tier && <span className="mt-1 block text-xs text-muted">{t(
                `같거나 더 큰 기능 3개 이상이 ${row.tier}급 모델로 감독관 검증을 통과했습니다.`,
                `At least three features of this size or larger passed supervisor verification with ${row.tier}-tier models.`,
              )}</span>}
            </th>{cells(row?.total)}</tr>;
          })}
        </tbody>
      </table>
    </div>
    {usage.criteria.length > 0 && <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <caption className="mb-2 text-left font-semibold">{t('성공 기준별 사용량', 'Usage by success criterion')}</caption>
        <thead>{headings}</thead>
        <tbody className="divide-y divide-outline-soft">
          {usage.criteria.map((row) => <tr key={row.id}>
            <th scope="row" className="p-2 text-left font-normal">{row.id} {row.title}</th>{cells(row.total)}
          </tr>)}
        </tbody>
      </table>
    </div>}
    {usage.criteria.length > 0 && <p className="text-sm text-muted">{t(
      '한 기능이 여러 성공 기준에 연결되면 각 기준에 같은 사용량을 표시합니다.',
      'When a feature serves several criteria, its usage appears under each one.',
    )}</p>}
  </section>;
}
