import Link from 'next/link';
import { translator, type Lang } from '@/lib/i18n';
import type { ProjectSummary } from './data';

export function ActivityTime({ at, lang }: { at: string | null; lang: Lang }) {
  return at ? <time dateTime={at}>{new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Seoul' }).format(new Date(at))} KST</time>
    : <span>{translator(lang)('아직 기록 없음', 'No records yet')}</span>;
}

export default function ProjectList({ projects, lang }: { projects: ProjectSummary[]; lang: Lang }) {
  const t = translator(lang);
  if (!projects.length) return <p className="py-8 text-sm text-muted">{t('아직 프로젝트가 없습니다. PRD를 저장하거나 MCP에서 프로젝트를 연결해 주세요.', 'No projects yet. Save a PRD or connect a project through MCP.')}</p>;
  return <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3">
    {projects.map((project) => <Link key={project.key} href={`/supervisor/${encodeURIComponent(project.key)}`} className="card min-w-0 p-5 transition-colors hover:border-outline-strong [overflow-wrap:anywhere]">
      <p className="font-mono text-[13px] text-muted">{project.key}</p>
      <h2 className="mt-2 text-lg font-semibold text-ink">{project.title}</h2>
      <p className="mt-3 text-sm text-tertiary">{project.goal?.statement ?? t('아직 잠긴 목표가 없습니다.', 'No locked goal yet.')}</p>
      <p className="mt-4 text-sm text-ink">{t('성공 기준 충족', 'Criteria met')} {project.criteriaMet}/{project.criteriaTotal}</p>
      <p className="mt-2 text-[13px] text-muted">{t('마지막 활동', 'Last activity')}: <ActivityTime at={project.lastActivityAt} lang={lang} /></p>
    </Link>)}
  </div>;
}
