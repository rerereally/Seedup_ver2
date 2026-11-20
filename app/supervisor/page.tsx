import { redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import WorkShell from '@/components/WorkShell';
import PageIntro from '@/components/PageIntro';
import ProjectList from '@/components/supervisor/ProjectList';
import { supervisorList } from '@/components/supervisor/data';
import { translator } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export default async function SupervisorPage() {
  const [client, user] = await Promise.all([createClient(), getCurrentUser()]);
  if (!client || !user) redirect('/login?next=/supervisor');
  const lang = await getLang();
  const t = translator(lang);
  const projects = await supervisorList(client, user.id);
  return <><Header /><WorkShell>
    <PageIntro title={t('감독관', 'Supervisor')} description={t('프로젝트의 잠긴 목표와 진행 기록을 확인합니다.', 'Review locked goals and project progress.')} aside={<Link href="/agents" className="btn-quiet min-h-11">{t('MCP 연동과 스타터 팩', 'MCP and starter pack')}</Link>} />
    <ProjectList projects={projects} lang={lang} />
  </WorkShell></>;
}
