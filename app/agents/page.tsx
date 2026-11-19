import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import McpConnect from '@/components/McpConnect';
import PageIntro from '@/components/PageIntro';
import WorkShell from '@/components/WorkShell';
import { mcpTokenStatus } from '@/lib/db/mcp-tokens';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'MCP 연동',
};

// Mirrors the tools registered in lib/mcp/server.ts.
const TOOLS = [
  ['search_opportunities', '만들고 싶은 것으로 검증된 기회 찾기'],
  ['get_opportunity', '원문과 이미 있는 도구까지 한 번에'],
  ['generate_verified_prd', '원문이 붙은 PRD 만들기 (AGENTS.md, CLAUDE.md, Cursor 규칙, 빌더 프롬프트)'],
  ['get_build_checklist', 'PRD 기능별 구현 체크리스트'],
  ['update_feature_status', '기능 상태와 이력 기록. 완료는 수락 기준별 확인 결과 필요'],
  ['mark_feature_done', '기존 호환용. 기능을 완료 또는 대기로 표시'],
  ['get_kept_items', '킵한 저장소, 글, 논문 가져오기'],
  ['find_related_content', '관련 글과 오픈소스 찾기'],
  ['watch_idea', '아이디어 지켜보기(매주 새 원문과 경쟁 도구를 메일로)'],
  ['validate_idea', '아이디어 하나로 만들 가치 검증 리포트(원문, 경쟁 도구, 규모, 첫 사용자)'],
];

/** "3분 전" style, computed on the server so the label does not change between server and browser render. */
function sinceLabel(iso: string) {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  const format = new Intl.RelativeTimeFormat('ko', { numeric: 'auto' });
  const steps: Array<[Intl.RelativeTimeFormatUnit, number]> = [['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [unit, size] of steps) if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  return '방금';
}

export default async function AgentsPage() {
  const supabase = await createClient();
  if (!supabase) redirect('/login?next=/agents');
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect('/login?next=/agents');

  const status = await mcpTokenStatus(user.id);

  return (
    <>
      <Header />
      <WorkShell>
        <PageIntro title="MCP 연동" description="MCP는 AI 도구가 바깥 서비스의 데이터를 직접 꺼내 쓰게 하는 연결 방식입니다. Claude, Codex, Cursor, Antigravity 같은 도구에 연결하면 대화창에서 바로 검증된 기회를 찾고, 원문이 붙은 PRD를 받아 기능별로 만들어 갑니다." />

        {/* Connecting is the work on the left; what the connection gives sits beside it, like the other app screens. */}
        <div className="page-split">
          <div className="min-w-0">
            <McpConnect siteUrl={process.env.NEXT_PUBLIC_SITE_URL || 'https://seedup.rerereally.com'} connected={Boolean(status)} lastUsed={status?.lastUsedAt ? sinceLabel(status.lastUsedAt) : null} />
          </div>

          <aside className="page-side">
            <section aria-labelledby="tools-heading">
              <h2 id="tools-heading" className="text-[15px] font-semibold text-ink">쓸 수 있는 도구 <span className="num ml-1 font-semibold text-muted">{TOOLS.length}</span></h2>
              <dl className="rows mt-3">
                {TOOLS.map(([name, detail]) => (
                  <div key={name} className="py-3">
                    <dt className="font-mono text-[13px] text-ink [overflow-wrap:anywhere]">{name}</dt>
                    <dd className="mt-0.5 text-sm leading-6 text-muted">{detail}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section aria-labelledby="extension-heading">
              <h2 id="extension-heading" className="text-[15px] font-semibold text-ink">브라우저 확장</h2>
              <p className="mt-2 text-sm leading-6 text-muted">읽던 글에서 문장을 골라 바로 원문으로 담는 크롬 확장도 &quot;직접 설정하기&quot;의 같은 토큰을 씁니다. <Link href="/guide#extension" className="text-seed underline-offset-4 hover:underline">설치 방법</Link></p>
            </section>
          </aside>
        </div>
      </WorkShell>
      <Footer />
    </>
  );
}
