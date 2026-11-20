import Link from 'next/link';
import GoalLock from '@/components/goal/GoalLock';
import MarkdownContent from '@/components/MarkdownContent';
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

export const DASHBOARD_TABS = ['overview', 'prd', 'activity', 'memory', 'setup'] as const;
export type DashboardTab = (typeof DASHBOARD_TABS)[number];
const TAB_LABELS: Record<DashboardTab, [string, string]> = {
  overview: ['개요', 'Overview'], prd: ['PRD · 원문', 'PRD · quotes'], activity: ['검증 · 커밋', 'Checks · commits'],
  memory: ['기록', 'Memory'], setup: ['에이전트 설정', 'Agent setup'],
};
export const pickTab = (value: unknown): DashboardTab => DASHBOARD_TABS.find((tab) => tab === value) ?? 'overview';
const FACT_LABELS: Record<string, [string, string]> = {
  stack: ['스택', 'Stack'], command: ['명령', 'Command'], env_name: ['환경 변수 이름', 'Env key name'], do_not_touch: ['건드리지 말 것', 'Do not touch'], other: ['기타', 'Other'],
};

/** One project's supervisor page, split into tabs (?tab=) so everything the MCP tools recorded has a place on the web. */
export default function Dashboard({ project, lang, tab = 'overview' }: { project: SupervisorDetail; lang: Lang; tab?: DashboardTab }) {
  const t = translator(lang);
  const goal = project.goal;
  const href = (next: DashboardTab) => `/supervisor/${encodeURIComponent(project.key)}${next === 'overview' ? '' : `?tab=${next}`}`;
  return <div className="min-w-0 space-y-7 [overflow-wrap:anywhere]">
    <nav aria-label={t('프로젝트 보기', 'Project views')} className="tabs">
      {DASHBOARD_TABS.map((key) => <Link key={key} href={href(key)} aria-current={tab === key ? 'page' : undefined} className="tab">{t(...TAB_LABELS[key])}</Link>)}
    </nav>
    {tab === 'overview' && <>
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
      </> : project.lockSpec ? <div className="mt-4"><GoalLock spec={project.lockSpec} idea={project.title} projectKey={project.key} /></div>
        : <p className="mt-4 text-sm text-muted">{t('아직 잠긴 목표가 없습니다. 기획 탭에서 목표를 잠가 주세요.', 'No locked goal yet. Lock a goal in the planning tab.')}</p>}
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
    </>}
    {tab === 'prd' && <>
    <section className="min-w-0" aria-labelledby="prd-heading">
      <h2 id="prd-heading" className="text-xl font-semibold text-ink">PRD</h2>
      <p className="mt-2 text-[13px] text-muted">{t('generate_verified_prd · get_my_prd가 쓰는 같은 PRD입니다.', 'The same PRD generate_verified_prd and get_my_prd use.')}</p>
      {project.prd.markdown ? <div className="mt-4"><MarkdownContent content={project.prd.markdown.replace(/^# .*\n+/, '')} /></div>
        : <p className="mt-4 text-sm text-muted">{t('아직 PRD가 없습니다. 원문만 있는 초안이면 generate_verified_prd로 만드세요.', 'No PRD yet. For a quotes-only draft, make one with generate_verified_prd.')}</p>}
    </section>
    <section className="min-w-0 border-t border-outline-soft pt-6" aria-labelledby="quotes-heading">
      <h2 id="quotes-heading" className="text-xl font-semibold text-ink">{t('근거 원문', 'Source quotes')} <span className="num text-muted">{project.prd.quotes.length}</span></h2>
      {!project.prd.quotes.length ? <p className="mt-4 text-sm text-muted">{t('저장된 원문이 없습니다.', 'No quotes saved.')}</p>
        : <ol className="mt-3 divide-y divide-outline-soft">{project.prd.quotes.map((row, index) => <li key={index} className="py-3 text-sm">
          <p className="whitespace-pre-wrap text-ink">“{row.quote}”</p>
          <a href={row.url} target="_blank" rel="noreferrer" className="link-seed mt-1 inline-block break-all text-[13px]">{row.platform || new URL(row.url).host}</a>
        </li>)}</ol>}
    </section>
    </>}
    {tab === 'activity' && <>
    <VerificationHistory rows={project.verifications} lang={lang} />
    <section className="min-w-0 border-t border-outline-soft pt-6" aria-labelledby="commits-heading">
      <h2 id="commits-heading" className="text-xl font-semibold text-ink">{t('연결된 커밋', 'Linked commits')}</h2>
      <p className="mt-2 text-[13px] text-muted">{t('link_commit · verify_feature가 기록한 최근 30개', 'Latest 30 recorded by link_commit and verify_feature')}</p>
      {!project.commits.length ? <p className="mt-4 text-sm text-muted">{t('아직 기록 없음', 'No records yet')}</p>
        : <ul className="mt-3 divide-y divide-outline-soft">{project.commits.map((row) => <li key={`${row.sha}-${row.featureId}`} className={`py-3 text-sm ${row.dismissed ? 'opacity-60' : ''}`}>
          <p className="font-mono text-[13px] text-muted">{project.repo ? <a href={`https://github.com/${project.repo}/commit/${row.sha}`} target="_blank" rel="noreferrer" className="link-seed">{row.sha.slice(0, 12)}</a> : row.sha.slice(0, 12)} · {row.featureId || t('기능 미연결', 'no feature')} · {t(`파일 ${row.files}개`, `${row.files} files`)}{row.dismissed ? ` · ${t('범위 밖으로 처리', 'dismissed')}` : ''}</p>
          <p className="mt-1 text-ink">{row.message.split('\n')[0]}</p>
          <p className="mt-1 text-[13px] text-muted"><ActivityTime at={row.at} lang={lang} /></p>
        </li>)}</ul>}
    </section>
    </>}
    {tab === 'memory' && <>
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
    <section className="min-w-0 border-t border-outline-soft pt-6" aria-labelledby="facts-heading">
      <h2 id="facts-heading" className="text-xl font-semibold text-ink">{t('프로젝트 사실', 'Project facts')}</h2>
      <p className="mt-2 text-[13px] text-muted">{t('check_env가 남긴 키 이름(값은 저장하지 않음)과 에이전트가 기록한 스택 · 명령', 'Key names from check_env (never values) and stack or commands the agents recorded')}</p>
      {!project.facts.length ? <p className="mt-4 text-sm text-muted">{t('아직 기록 없음', 'No records yet')}</p>
        : <ul className="mt-3 divide-y divide-outline-soft">{project.facts.map((fact, index) => <li key={fact.at + index} className="py-3 text-sm">
          <p className="text-[13px] text-muted">{t(...(FACT_LABELS[fact.kind] ?? FACT_LABELS.other))} · {fact.author} · <ActivityTime at={fact.at} lang={lang} /></p>
          <p className={`mt-1 whitespace-pre-wrap text-ink ${fact.kind === 'env_name' || fact.kind === 'command' ? 'font-mono' : ''}`}>{fact.text}</p>
        </li>)}</ul>}
    </section>
    </>}
    {tab === 'setup' && <>
    <section className="min-w-0" aria-labelledby="setup-heading">
      <h2 id="setup-heading" className="text-xl font-semibold text-ink">{t('연결 상태', 'Connection')}</h2>
      <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-3">
        <div><dt className="text-muted">{t('저장소 (connect_repo)', 'Repository (connect_repo)')}</dt><dd className="mt-1 break-all text-ink">{project.repo ? <a href={`https://github.com/${project.repo}`} target="_blank" rel="noreferrer" className="link-seed">{project.repo}</a> : t('연결 안 됨', 'Not connected')}</dd></div>
        <div><dt className="text-muted">{t('트랙', 'Track')}</dt><dd className="mt-1 text-ink">{project.track === 'launch' ? t('출시용', 'Launch') : project.track === 'personal' ? t('개인용', 'Personal') : t('목표를 잠그면 정해짐', 'Set when a goal is locked')}</dd></div>
        <div><dt className="text-muted">{t('엄격 모드', 'Strict mode')}</dt><dd className="mt-1 text-ink">{project.strict ? t('켜짐: 자가 보고로 완료 불가', 'On: no self-reported done') : t('꺼짐', 'Off')}</dd></div>
      </dl>
    </section>
    <section className="min-w-0 border-t border-outline-soft pt-6" aria-labelledby="files-heading">
      <h2 id="files-heading" className="text-xl font-semibold text-ink">{t('저장소에 넣을 파일 (setup_project)', 'Files for the repository (setup_project)')}</h2>
      {!project.files.length ? <p className="mt-4 text-sm text-muted">{t('목표를 잠그면 훅과 검사 파일이 만들어집니다.', 'Hook and check files appear once a goal is locked.')}</p>
        : project.files.map((file) => <details key={file.path} className="border-b border-outline-soft py-3 text-sm">
          <summary className="cursor-pointer font-mono text-ink">{file.path}</summary>
          <pre className="terminal mt-3 max-h-80 overflow-auto whitespace-pre text-[12px] leading-5">{file.content}</pre>
        </details>)}
      <p className="mt-4 text-sm"><Link href="/agents" className="link-seed">{t('MCP 연결과 스타터 팩 받기', 'MCP connection and starter pack')}</Link></p>
    </section>
    </>}
  </div>;
}
