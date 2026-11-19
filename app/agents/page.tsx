import type { Metadata } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import McpConnect from '@/components/McpConnect';
import PageIntro from '@/components/PageIntro';
import WorkShell from '@/components/WorkShell';
import { hasMcpToken } from '@/lib/db/mcp-tokens';
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
  ['mark_feature_done', '수락 기준마다 확인 결과를 받아, 모두 통과한 기능만 완료로 표시'],
  ['get_kept_items', '킵한 저장소, 글, 논문 가져오기'],
  ['find_related_content', '관련 글과 오픈소스 찾기'],
  ['watch_idea', '아이디어 지켜보기(매주 새 원문과 경쟁 도구를 메일로)'],
  ['validate_idea', '아이디어 하나로 만들 가치 검증 리포트(원문, 경쟁 도구, 규모, 첫 사용자)'],
];

export default async function AgentsPage() {
  const supabase = await createClient();
  if (!supabase) redirect('/login?next=/agents');
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) redirect('/login?next=/agents');

  const connected = await hasMcpToken(user.id);

  return (
    <>
      <Header />
      <WorkShell>
        <PageIntro title="MCP 연동" description="MCP는 AI 코딩 도구가 바깥 서비스의 데이터를 직접 꺼내 쓰게 하는 연결 방식입니다. 연결하면 Claude Code, Cursor 같은 도구가 Seedup의 기회와 검증된 PRD를 직접 가져갑니다." />

        <div className="flex max-w-[860px] flex-col gap-10">
          <McpConnect siteUrl={process.env.NEXT_PUBLIC_SITE_URL || 'https://seedup.rerereally.com'} connected={connected} />

          <section>
            <h2 className="text-[17px] font-semibold text-ink">쓸 수 있는 도구 <span className="num font-normal text-muted">{TOOLS.length}개</span></h2>
            <dl className="rows mt-3">
              {TOOLS.map(([name, detail]) => (
                <div key={name} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4">
                  <dt className="font-mono text-sm text-ink">{name}</dt>
                  <dd className="text-[15px] text-muted">{detail}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="border-t border-outline-soft pt-8">
            <h2 className="text-[17px] font-semibold text-ink">브라우저 확장</h2>
            <p className="mt-2 text-[15px] leading-7 text-muted">읽던 글에서 문장을 골라 바로 원문으로 담는 크롬 확장도 위 &quot;직접 설정하기&quot;의 같은 토큰을 씁니다. <Link href="/guide#extension" className="text-seed underline-offset-4 hover:underline">설치 방법</Link></p>
          </section>
        </div>
      </WorkShell>
      <Footer />
    </>
  );
}
