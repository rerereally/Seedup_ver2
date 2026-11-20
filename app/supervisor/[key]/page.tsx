import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import Header from '@/components/Header';
import WorkShell from '@/components/WorkShell';
import PageIntro from '@/components/PageIntro';
import Dashboard, { pickTab } from '@/components/supervisor/Dashboard';
import SpecFlow from '@/components/supervisor/SpecFlow';
import { supervisorDetail } from '@/components/supervisor/data';
import { decodeProjectKey } from '@/components/supervisor/model';
import Usage from './Usage';
import { translator } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';
import { createClient, getCurrentUser } from '@/lib/supabase/server';

export default async function SupervisorProjectPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ tab?: string | string[] }> }) {
  const key = decodeProjectKey((await params).key);
  const tab = pickTab((await searchParams).tab);
  const [client, user] = await Promise.all([createClient(), getCurrentUser()]);
  if (!client || !user) redirect(`/login?next=${encodeURIComponent(`/supervisor/${encodeURIComponent(key)}`)}`);
  const project = await supervisorDetail(client, user.id, key);
  if (!project) notFound();
  const lang = await getLang();
  const t = translator(lang);
  return <><Header /><WorkShell>
    <Link href="/supervisor" className="link-seed inline-flex min-h-11 items-center self-start text-sm">{t('프로젝트 목록', 'Projects')}</Link>
    <PageIntro title={project.title} meta={<span className="break-all font-mono">{project.key}</span>} />
    <Dashboard project={project} lang={lang} tab={tab}
      usage={tab === 'usage' ? <Usage client={client} userId={user.id} project={project} lang={lang} /> : undefined}
      flow={tab === 'flow' && project.spec ? <SpecFlow spec={project.spec} quotes={project.specQuotes} progress={project.progress} lang={lang} /> : undefined} />
  </WorkShell></>;
}
