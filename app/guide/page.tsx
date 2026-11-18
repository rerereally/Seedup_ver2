import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { NumberedList, SiteHero, SiteRow } from '@/components/site/SiteSection';
import { translator } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';

export const metadata: Metadata = { title: '가이드', description: 'Seedup을 처음 쓰는 방법, 코딩 에이전트 연결, 자주 묻는 질문.' };

const ISSUES = 'https://github.com/rerereally/Seedup_ver2/issues';

// [Korean question, Korean answer, English question, English answer]
const FAQ: Array<[string, string, string, string]> = [
  ['무료인가요?', 'PRD 초안은 로그인 없이, PRD 생성은 로그인 후 하루 10개까지 무료입니다. 에이전트로 받는 검증 리포트는 하루 3개입니다.', 'Is it free?', 'Drafts need no account, and signed-in accounts make up to 10 PRDs a day for free. Reports through your agent are 3 a day.'],
  ['"가설"은 무슨 뜻인가요?', '어느 원문도 받쳐 주지 않는 요구사항입니다. 지우지 않고 남겨 두니, 만들기 전에 직접 확인해 보세요.', 'What is a "hypothesis"?', 'A requirement no quote backs. It stays in the PRD so you can check it before building.'],
  ['원문은 어디서 가져오나요?', 'GitHub 이슈, Hacker News, Stack Overflow, DEV, Lobsters, 사용자 포럼 같은 공개 글입니다. 모든 인용에 원문 링크가 붙습니다.', 'Where do the quotes come from?', 'Public posts on GitHub issues, Hacker News, Stack Overflow, DEV, Lobsters and user forums. Every quote links to its post.'],
  ['레포 분석은 코드를 저장하나요?', '아니요. 공개 저장소의 README, 파일 구조, 의존성만 읽고 결과는 브라우저에만 남습니다.', 'Do you store my code?', 'No. Only the README, file tree and dependencies of public repositories are read, and the results stay in your browser.'],
  ['PRD 만들기가 실패해요.', '무료 모델은 가끔 빈 답을 돌려줍니다. 실패하면 사용 횟수는 돌려 드리고, 같은 원문으로 만든 직전 결과가 있으면 그것을 보여 드립니다. 잠시 뒤 다시 시도해 주세요.', 'Making a PRD failed.', 'Free models sometimes return nothing. A failed try does not count against your limit, and the last good PRD for the same quotes is shown if there is one. Try again shortly.'],
];

export default async function GuidePage() {
  const lang = await getLang();
  const t = translator(lang);
  return (
    <>
      <Header variant="site" />
      <main id="main-content" className="grow">
        <SiteHero word="Start here" title={t('처음 쓰는 분을 위한 가이드', 'A guide for your first visit')} lead={t('아이디어 한 줄에서 에이전트가 만들기 시작하기까지, 5분이면 됩니다.', 'From one line of an idea to your agent building it, in about five minutes.')} />

        <SiteRow label="First PRD" title={t('첫 PRD 만들기', 'Your first PRD')}>
          <NumberedList items={[
            [t('아이디어를 한 줄로', 'Write one line'), t('PRD 화면에 만들고 싶은 것을 적습니다. 검증된 문제에서 골라 시작해도 됩니다.', 'Type what you want to build on the PRD page, or pick a verified problem.')],
            [t('질문 몇 개에 답하기', 'Answer a few questions'), t('대상 사용자, 지금의 해결 방법, 첫 버전 범위를 고르면 초안이 채워집니다.', 'Pick who it is for, how they cope today and what the first version covers.')],
            [t('원문 확인', 'Check the quotes'), t('요구사항을 누르면 그 줄을 받치는 원문이 보입니다. 원문이 없는 줄은 가설입니다.', 'Click a requirement to see the quotes behind it. Lines without one are hypotheses.')],
            [t('내보내기', 'Export'), t('AGENTS.md, CLAUDE.md, Cursor 규칙으로 받거나, 에이전트가 MCP로 직접 가져가게 합니다.', 'Download AGENTS.md, CLAUDE.md or a Cursor rule, or let your agent pull it over MCP.')],
          ]} />
          <Link href="/prd" className="btn mt-8">{t('PRD 만들기', 'Make a PRD')}</Link>
        </SiteRow>

        <SiteRow label="Connect" title={t('코딩 에이전트 연결', 'Connect your coding agent')}>
          <NumberedList items={[
            [t('로그인', 'Sign in'), t('Google 계정으로 로그인합니다.', 'Sign in with your Google account.')],
            [t('MCP 연동 화면', 'Open MCP'), t('왼쪽 메뉴의 MCP 연동에서 Cursor, VS Code, Claude Code 중 하나를 고릅니다.', 'In the sidebar, open Connect agent and pick Cursor, VS Code or Claude Code.')],
            [t('버튼 한 번', 'One button'), t('Cursor와 VS Code는 설치 창이 열리고, Claude Code는 복사한 명령을 터미널에 붙여 넣습니다.', 'Cursor and VS Code open an install prompt; for Claude Code, paste the copied command into your terminal.')],
            [t('에이전트에게 말하기', 'Ask your agent'), t('"Seedup에서 에이전트 메모리 문제를 찾아 PRD를 받고 F-01부터 만들어 줘"처럼 지시합니다.', 'Say something like "Find the agent memory problem on Seedup, get its PRD and build F-01 first."')],
          ]} />
          <Link href="/#features" className="link-seed mt-6">{t('에이전트 도구 보기', 'See the agent tools')}</Link>
        </SiteRow>

        <SiteRow label="FAQ" title={t('자주 묻는 질문', 'Questions people ask')}>
          <div className="border-t border-outline-soft">
            {FAQ.map(([q, a, qEn, aEn]) => (
              <details key={q} className="group border-b border-outline-soft">
                <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 text-[16px] font-semibold [&::-webkit-details-marker]:hidden">{t(q, qEn)}<span aria-hidden="true" className="text-muted transition-transform group-open:rotate-90">›</span></summary>
                <p className="max-w-[42em] pb-5 text-[15px] leading-7 text-tertiary">{t(a, aEn)}</p>
              </details>
            ))}
          </div>
        </SiteRow>

        <SiteRow label="Feedback" title={t('막혔거나 고칠 점이 보이면', 'Stuck, or spotted something to fix?')}>
          <p className="max-w-[40em] text-[16px] leading-8 text-tertiary">{t('GitHub 이슈로 남겨 주시면 확인하고 답합니다. 인용된 글의 작성자라면 삭제 요청도 같은 곳에서 받습니다.', 'Leave a GitHub issue and we will reply. If you wrote a quoted post, ask for its removal there too.')}</p>
          <a href={ISSUES} target="_blank" rel="noopener noreferrer" className="btn-quiet mt-5">{t('GitHub 이슈 남기기', 'Open a GitHub issue')}</a>
        </SiteRow>
      </main>
      <Footer />
    </>
  );
}
