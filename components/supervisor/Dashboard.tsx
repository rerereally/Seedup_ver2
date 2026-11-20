import { translator, type Lang } from '@/lib/i18n';
import type { FeatureStatus } from '@/lib/opportunities/build-progress';
import type { SupervisorDetail } from './data';
import { ActivityTime } from './ProjectList';
import VerificationHistory from './VerificationHistory';

const STATUSES: Record<FeatureStatus, [string, string]> = {
  todo: ['대기', 'To do'], in_progress: ['진행 중', 'In progress'], improving: ['개선 중', 'Improving'],
  done: ['완료', 'Done'], blocked: ['막힘', 'Blocked'], needs_recheck: ['재확인 필요', 'Needs recheck'],
};
const DRIFT_MESSAGES = {
  unlinked_commit: 'This commit is not linked to a feature. Link it with link_commit or ask the user whether it is out of scope.',
  out_of_spec: 'A screen, API route or table outside the spec was added. Update the spec or remove it.',
  non_goal: 'This work may match an out-of-scope item. Ask the user before proceeding.',
  touched_done: 'Files of a completed feature changed. Recheck that feature.',
};

export default function Dashboard({ project, lang }: { project: SupervisorDetail; lang: Lang }) {
  const t = translator(lang);
  const goal = project.goal;
  return <div className="min-w-0 space-y-7 [overflow-wrap:anywhere]">
    <section className="card min-w-0 p-5 sm:p-6" aria-labelledby="goal-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="goal-heading" className="text-xl font-semibold text-ink">{t('잠긴 목표', 'Locked goal')}</h2>
        {goal && <span className="text-[13px] text-muted">{t('목표 버전', 'Goal version')} {goal.version}</span>}
      </div>
      {goal ? <>
        <p className="mt-4 text-lg text-ink">{goal.statement}</p>
        <p className="mt-2 text-[13px] text-muted">{t('잠근 시각', 'Locked at')}: <ActivityTime at={goal.lockedAt} lang={lang} /></p>
        <h3 className="mt-6 font-semibold text-ink">{t('성공 기준', 'Success criteria')} {project.criteriaMet}/{project.criteriaTotal}</h3>
        <ul className="mt-2 divide-y divide-outline-soft">{goal.criteria.map((criterion) => <li key={criterion.id} className="py-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><span className="font-mono text-muted">{criterion.id}</span><span className="text-ink">{criterion.status}</span></div>
          <p className="mt-1 text-ink">{criterion.text}</p><p className="mt-1 text-muted">{t('재는 방법', 'Measure')}: {criterion.measure}</p>
        </li>)}</ul>
        <h3 className="mt-4 font-semibold text-ink">{t('하지 않는 것', 'Out of scope')}</h3>
        {goal.outOfScope.length ? <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-tertiary">{goal.outOfScope.map((item, index) => <li key={index}>{item}</li>)}</ul>
          : <p className="mt-2 text-sm text-muted">{t('기록 없음', 'None recorded')}</p>}
      </> : <p className="mt-4 text-sm text-muted">{t('아직 잠긴 목표가 없습니다. 기획 탭에서 목표를 잠가 주세요.', 'No locked goal yet. Lock a goal in the planning tab.')}</p>}
    </section>
    <div className="grid min-w-0 items-start gap-7 xl:grid-cols-2">
      <section className="min-w-0" aria-labelledby="features-heading">
        <h2 id="features-heading" className="text-xl font-semibold text-ink">{t('기능 신호등', 'Feature signals')}</h2>
        <p className="mt-2 text-[13px] text-muted">{t('🟢 감독관 검증 / 🔵 로컬 확인 / ⚪ 자가 보고', '🟢 Supervisor verified / 🔵 Local check / ⚪ Self-reported')}</p>
        {!project.specAvailable && <p className="mt-2 text-[13px] text-muted">{t('명세가 없어 진행 기록에 있는 기능만 표시합니다.', 'Without a spec, only features with progress records are shown.')}</p>}
        <ul className="mt-3 divide-y divide-outline-soft">{project.features.map((feature) => <li key={feature.id} className="py-4 text-sm">
          <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-mono text-muted">{feature.id}</span><span className="text-tertiary">{t(...STATUSES[feature.status])}</span></div>
          <h3 className="mt-1 font-semibold text-ink">{feature.title}</h3>
          <p className={`mt-2 ${feature.verification === 'supervisor_verified' ? 'font-medium text-seed' : 'text-muted'}`}>
            {feature.verification === 'supervisor_verified'
              ? t('🟢 감독관 검증', '🟢 Supervisor verified')
              : feature.verification === 'local_checked'
                ? t('🔵 로컬 확인', '🔵 Local check')
                : t('⚪ 자가 보고', '⚪ Self-reported')}
          </p>
          {feature.note && <p className="mt-2 whitespace-pre-wrap text-tertiary">{feature.note}</p>}
        </li>)}</ul>
        {!project.features.length && <p className="mt-4 text-sm text-muted">{t('아직 기록 없음', 'No records yet')}</p>}
      </section>
      <section className="min-w-0" aria-labelledby="drift-heading">
        <h2 id="drift-heading" className="text-xl font-semibold text-ink">{t('이탈 경고', 'Drift warnings')}</h2>
        {project.drift === null ? <p className="mt-4 text-sm text-muted">{t('아직 기록 없음', 'No records yet')}</p>
          : !project.drift.length ? <p className="mt-4 text-sm text-muted">{t('기록된 커밋에서 발견된 이탈이 없습니다.', 'No drift found in the recorded commits.')}</p>
          : <ul className="mt-3 divide-y divide-outline-soft">{project.drift.map((finding, index) => <li key={`${finding.sha}-${index}`} className="py-4 text-sm">
            <p className="font-mono text-[13px] text-muted">{finding.sha.slice(0, 12)} / {finding.kind}</p>
            <p className="mt-2 text-ink">{t(finding.message, DRIFT_MESSAGES[finding.kind])}</p>
            {finding.files.length > 0 && <p className="mt-2 font-mono text-[13px] text-muted">{finding.files.join(', ')}</p>}
          </li>)}</ul>}
      </section>
    </div>
    <VerificationHistory rows={project.verifications} lang={lang} />
    <section className="min-w-0 border-t border-outline-soft pt-6" aria-labelledby="handoff-heading">
      <h2 id="handoff-heading" className="text-xl font-semibold text-ink">{t('최근 인수인계', 'Recent handoffs')}</h2>
      {project.handoffs.length === 0 && <p className="mt-3 text-sm text-muted">{t('기록된 인수인계가 없습니다.', 'No handoffs recorded.')}</p>}
      {project.handoffs.map((handoff, index) => <details key={handoff.at + index} open={index === 0} className="border-b border-outline-soft py-3 text-sm">
        <summary className="cursor-pointer font-semibold text-ink">{handoff.agent} · <ActivityTime at={handoff.at} lang={lang} /></summary>
        <dl className="mt-3 space-y-3">
          <div><dt className="font-semibold">{t('하던 일', 'Work in progress')}</dt><dd className="whitespace-pre-wrap text-tertiary">{handoff.doing}</dd></div>
          <div><dt className="font-semibold">{t('다음 할 일', 'Next step')}</dt><dd className="whitespace-pre-wrap text-tertiary">{handoff.next}</dd></div>
          {handoff.cautions.length > 0 && <div><dt className="font-semibold">{t('주의 사항', 'Cautions')}</dt><dd><ul className="list-disc pl-5">{handoff.cautions.map((item, i) => <li key={i}>{item}</li>)}</ul></dd></div>}
          {handoff.unverifiedShas.length > 0 && <div><dt className="font-semibold">{t('미검증 커밋', 'Unverified commits')}</dt><dd className="font-mono">{handoff.unverifiedShas.join(', ')}</dd></div>}
        </dl>
      </details>)}
    </section>
    <section className="min-w-0 border-t border-outline-soft pt-6" aria-labelledby="decisions-heading">
      <h2 id="decisions-heading" className="text-xl font-semibold text-ink">{t('최근 결정', 'Recent decisions')}</h2>
      {!project.decisions.length ? <p className="mt-4 text-sm text-muted">{t('아직 기록 없음', 'No records yet')}</p>
        : <ol className="mt-3 divide-y divide-outline-soft">{project.decisions.map((decision) => <li key={decision.id} className="py-4 text-sm">
          <h3 className="font-semibold text-ink">{decision.title}</h3><p className="mt-2 whitespace-pre-wrap text-tertiary">{decision.why}</p>
          <p className="mt-2 text-[13px] text-muted">{t('출처', 'Author')}: {decision.author.kind === 'person' ? t('사람', 'Person') : t('에이전트', 'Agent')} / {decision.author.name}</p>
          <p className="mt-1 text-[13px] text-muted">{t('사용자 승인', 'User approval')}: {decision.approved === null ? t('확인 대기', 'Pending') : decision.approved ? t('승인', 'Approved') : t('승인 안 됨', 'Not approved')} / {t('목표 버전', 'Goal version')} {decision.goalVersion}</p>
          {decision.rejected.length > 0 && <p className="mt-2 text-muted">{t('버린 대안', 'Rejected alternatives')}: {decision.rejected.join(', ')}</p>}
          {(decision.featureIds.length > 0 || decision.criterionIds.length > 0) && <p className="mt-2 font-mono text-[13px] text-muted">{[...decision.featureIds, ...decision.criterionIds].join(', ')}</p>}
          <p className="mt-2 text-[13px] text-muted"><ActivityTime at={decision.at} lang={lang} /></p>
        </li>)}</ol>}
    </section>
  </div>;
}
