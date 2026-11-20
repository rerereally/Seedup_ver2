import Link from 'next/link';
import { translator, type Lang } from '@/lib/i18n';

// Where each MCP tool's result can be seen on the web. Keep in step with the tool list in lib/mcp/server.ts.
type Row = { tool: string; what: [string, string]; where: [string, string]; href?: string };

const PLANNING: Row[] = [
  { tool: 'search_opportunities', what: ['검증된 원문이 있는 기회 찾기', 'Find opportunities with verified quotes'], where: ['기회 목록', 'Opportunities'], href: '/opportunities' },
  { tool: 'get_opportunity', what: ['기회 하나의 문제 · 원문 · 경쟁', 'One opportunity in full'], where: ['기회 상세', 'Opportunity page'], href: '/opportunities' },
  { tool: 'validate_idea', what: ['아이디어 검증 리포트', 'Validation report for an idea'], where: ['아이디어 검증 · 원문은 내 PRD 초안으로', 'Idea check · quotes saved as a PRD draft'], href: '/prd/validate' },
  { tool: 'generate_verified_prd', what: ['근거가 이어진 PRD', 'Evidence-traced PRD'], where: ['내 PRD 탭 → 프로젝트의 PRD 탭', 'My PRDs → project PRD tab'], href: '/supervisor?tab=prds' },
  { tool: 'get_my_prd', what: ['저장한 PRD 목록 · 본문', 'Saved PRDs'], where: ['내 PRD 탭', 'My PRDs tab'], href: '/supervisor?tab=prds' },
  { tool: 'watch_idea', what: ['아이디어 매주 다시 찾기', 'Weekly watch on an idea'], where: ['프로필', 'Profile'], href: '/profile' },
  { tool: 'get_kept_items', what: ['북마크한 저장소 · 글', 'Kept repos and articles'], where: ['북마크', 'Bookmarks'], href: '/scrap' },
  { tool: 'find_related_content', what: ['아이디어와 가까운 뉴스 · 논문 · 저장소', 'Related news, papers, repos'], where: ['뉴스', 'News'], href: '/news' },
];

const BUILDING: Row[] = [
  { tool: 'resume_project', what: ['목표 · 체크리스트 · 최근 기록으로 이어서 시작', 'Resume with goal, checklist, memory'], where: ['프로젝트 → 개요', 'Project → Overview'] },
  { tool: 'get_next_task', what: ['목표에 가장 기여하는 다음 기능', 'Next feature for the goal'], where: ['프로젝트 → 개요(기능 신호등)', 'Project → Overview (feature signals)'] },
  { tool: 'update_feature_status', what: ['기능 상태 보고', 'Report a feature status'], where: ['프로젝트 → 개요(기능 신호등)', 'Project → Overview (feature signals)'] },
  { tool: 'verify_feature', what: ['커밋 · CI로 완료 검증', 'Verify done from commit and CI'], where: ['프로젝트 → 검증 · 커밋', 'Project → Checks · commits'] },
  { tool: 'link_commit', what: ['커밋을 기능에 연결', 'Link a commit to a feature'], where: ['프로젝트 → 검증 · 커밋, 개요(이탈 경고)', 'Project → Checks · commits, Overview (drift)'] },
  { tool: 'explain_file', what: ['파일을 기능 · 요구사항 · 원문으로 거슬러 보기', 'Trace a file back to the PRD'], where: ['에이전트 대화에서만 (화면 없음)', 'Agent chat only (no page)'] },
  { tool: 'connect_repo', what: ['공개 GitHub 저장소 연결', 'Connect a public repository'], where: ['프로젝트 → 에이전트 설정', 'Project → Agent setup'] },
  { tool: 'setup_project', what: ['AGENTS.md · 훅 파일', 'AGENTS.md and hook files'], where: ['프로젝트 → 에이전트 설정', 'Project → Agent setup'] },
  { tool: 'check_env', what: ['필요한 환경 변수 이름 확인', 'Check env key names'], where: ['프로젝트 → 기록(프로젝트 사실)', 'Project → Memory (facts)'] },
  { tool: 'record_decision', what: ['결정과 이유, 범위 변경 승인', 'Decisions and scope approvals'], where: ['프로젝트 → 기록', 'Project → Memory'] },
  { tool: 'save_handoff', what: ['세션 인수인계', 'Session handoff'], where: ['프로젝트 → 기록', 'Project → Memory'] },
  { tool: 'get_project_memory', what: ['결정 · 인수인계 · 사실 전체', 'All decisions, handoffs, facts'], where: ['프로젝트 → 기록', 'Project → Memory'] },
];

export default function McpToolMap({ lang }: { lang: Lang }) {
  const t = translator(lang);
  const table = (title: [string, string], rows: Row[]) => <section className="min-w-0">
    <h2 className="text-xl font-semibold text-ink">{t(...title)}</h2>
    <ul className="mt-3 divide-y divide-outline-soft">{rows.map((row) => <li key={row.tool} className="grid gap-1 py-3 text-sm sm:grid-cols-[14rem_1fr_16rem] sm:gap-4">
      <span className="font-mono text-ink">{row.tool}</span>
      <span className="text-tertiary">{t(...row.what)}</span>
      <span>{row.href ? <Link href={row.href} className="link-seed">{t(...row.where)}</Link> : <span className="text-muted">{t(...row.where)}</span>}</span>
    </li>)}</ul>
  </section>;
  return <div className="min-w-0 space-y-8 [overflow-wrap:anywhere]">
    <p className="text-sm text-tertiary">{t('Seedup MCP 도구 20개와, 그 결과를 웹 어디서 보는지입니다. 프로젝트 화면은 프로젝트 탭에서 엽니다.', 'All 20 Seedup MCP tools and where their results show on the web. Open a project from the Projects tab.')}</p>
    {table(['기획', 'Planning'], PLANNING)}
    {table(['개발 · 감독', 'Building · supervision'], BUILDING)}
  </div>;
}
