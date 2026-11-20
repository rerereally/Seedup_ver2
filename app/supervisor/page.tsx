import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import WorkShell from '@/components/WorkShell';
import PageIntro from '@/components/PageIntro';
import McpToolMap from '@/components/supervisor/McpToolMap';
import ProjectList, { ActivityTime } from '@/components/supervisor/ProjectList';
import { supervisorList, supervisorPrds } from '@/components/supervisor/data';
import { translator } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

const TABS = [['projects', '프로젝트', 'Projects'], ['prds', '내 PRD', 'My PRDs'], ['mcp', 'MCP 기능', 'MCP tools']] as const;
type Tab = (typeof TABS)[number][0];

export default async function SupervisorPage({ searchParams }: { searchParams: Promise<{ tab?: string | string[] }> }) {
  const requested = (await searchParams).tab;
  const tab: Tab = TABS.find(([key]) => key === requested)?.[0] ?? 'projects';
  const [client, user] = await Promise.all([createClient(), getCurrentUser()]);
  if (!client || !user) redirect(`/login?next=${encodeURIComponent(tab === 'projects' ? '/supervisor' : `/supervisor?tab=${tab}`)}`);
  const lang = await getLang();
  const t = translator(lang);
  const [projects, prds] = await Promise.all([tab === 'projects' ? supervisorList(client, user.id) : [], tab === 'prds' ? supervisorPrds(client, user.id) : []]);
  return <><Header /><WorkShell>
    <PageIntro title={t('감독관', 'Supervisor')} description={t('프로젝트의 잠긴 목표와 진행 기록을 확인합니다.', 'Review locked goals and project progress.')} aside={<Link href="/agents" className="btn-quiet min-h-11">{t('MCP 연동과 스타터 팩', 'MCP and starter pack')}</Link>} />
    <nav aria-label={t('감독관 보기', 'Supervisor views')} className="-mx-1 mb-6 flex gap-1 overflow-x-auto border-b border-outline-soft">
      {TABS.map(([key, ko, en]) => <Link key={key} href={key === 'projects' ? '/supervisor' : `/supervisor?tab=${key}`} aria-current={tab === key ? 'page' : undefined}
        className={`tab shrink-0 ${tab === key ? 'border-b-2 border-ink font-semibold text-ink' : 'text-muted'}`}>{t(ko, en)}</Link>)}
    </nav>
    {tab === 'projects' && <ProjectList projects={projects} lang={lang} />}
    {tab === 'prds' && (!prds.length ? <p className="py-8 text-sm text-muted">{t('저장한 PRD가 없습니다. 웹이나 MCP(generate_verified_prd, validate_idea)로 만들 수 있습니다.', 'No saved PRDs. Make one on the web or with MCP (generate_verified_prd, validate_idea).')}</p>
      : <ul className="divide-y divide-outline-soft [overflow-wrap:anywhere]">{prds.map((row) => <li key={row.key}>
        <Link href={`/supervisor/${encodeURIComponent(row.key)}`} className="group flex min-h-16 flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-3">
          <span className="min-w-0"><span className="block font-semibold text-ink underline-offset-4 group-hover:underline">{row.title}</span><span className="font-mono text-[13px] text-muted">{row.key}</span></span>
          <span className="text-[13px] text-muted">{row.hasPrd ? t('PRD 있음', 'Has PRD') : t('원문만 있는 초안', 'Quotes-only draft')} · {t(`원문 ${row.quotes}건`, `${row.quotes} quotes`)} · <ActivityTime at={row.updatedAt} lang={lang} /></span>
        </Link>
      </li>)}</ul>)}
    {tab === 'mcp' && <McpToolMap lang={lang} />}
  </WorkShell></>;
}
