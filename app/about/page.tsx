import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import { SiteHero, SiteRow } from '@/components/site/SiteSection';
import { translator } from '@/lib/i18n';
import { getLang } from '@/lib/i18n-server';

export const metadata: Metadata = { title: '소개', description: '코딩은 빨라졌는데, 무엇을 만들지는 그대로입니다. Seedup이 왜 있고 어떻게 판정하는지.' };

const ISSUES = 'https://github.com/rerereally/Seedup_ver2/issues';

// Dates from the repository history.
const HISTORY: Array<[string, string, string]> = [
  ['2026-07-08', '첫 버전 공개. 개발 뉴스와 트렌드를 모아 읽는 곳으로 시작', 'First version: a place to read developer news and trends'],
  ['2026-11-09', '무료 모델 전용 모드와 보안 강화', 'Free-model-only mode and security hardening'],
  ['2026-11-14', '근거 추적 PRD(원문, 요구사항, 기능, 화면)와 MCP 서버, 레포 분석', 'Evidence-traced PRDs, the MCP server and reverse specs for your repo'],
  ['2026-11-16', '다크 모드, 시스템 설정을 따름', 'Dark mode that follows the system'],
  ['2026-11-18', '만들 가치 검증 리포트 첫 버전, 매일 수집 안정화', 'First "worth building?" report; steadier daily collection'],
];

export default async function AboutPage() {
  const lang = await getLang();
  const t = translator(lang);
  return (
    <>
      <Header variant="site" />
      <main id="main-content" className="grow">
        <SiteHero
          word="Build from evidence"
          title={t('무엇을 만들지, 실제 사람의 말에서 시작합니다.', 'Decide what to build from what real people said.')}
          lead={t('코딩 에이전트 덕분에 어떻게 만들지는 열 배 빨라졌습니다. 그런데 무엇을, 왜 만들지는 그대로입니다. Seedup은 그 앞단을 맡습니다.', 'Coding agents made the how ten times faster. The what and the why did not move. Seedup takes that first step.')}
        />

        <SiteRow label="Why" title={t('AI에게 물으면 모든 아이디어가 좋다고 합니다.', 'Ask an AI and every idea is a good one.')}>
          <p className="max-w-[40em] text-[16px] leading-8 text-tertiary">{t('없는 근거를 지어내기도 합니다. 그래서 Seedup은 거꾸로 갑니다. 전 세계 개발자가 GitHub 이슈, Hacker News, Stack Overflow에 실제로 남긴 불만에서 출발하고, 그 원문을 PRD의 줄마다 붙여 코딩 에이전트에 넘깁니다.', 'It can even invent the evidence. So Seedup goes the other way: it starts from what developers actually wrote in GitHub issues, Hacker News and Stack Overflow, and attaches that source to every line of the PRD it hands to your coding agent.')}</p>
        </SiteRow>

        <SiteRow label="How it works" title={t('매일 아침 이렇게 돕니다', 'What runs every morning')}>
          <ol className="flex flex-wrap items-center gap-2 text-[15px]">
            {[t('글 수집', 'Collect posts'), t('불만 추출', 'Extract pains'), t('원문 대조', 'Match to source'), t('같은 불만 묶기', 'Group'), t('경쟁 도구 찾기', 'Find rivals'), t('관련성 재검사', 'Re-check'), t('기준 판정', 'Apply the bar')].map((step, index, list) => (
              <li key={step} className="reveal flex items-center gap-2" style={{ animationRange: `entry ${index * 6}% entry ${30 + index * 6}%` }}>
                <span className="rounded-lg border border-outline-soft bg-white px-3 py-2">{step}</span>
                {index < list.length - 1 && <span aria-hidden="true" className="text-muted">→</span>}
              </li>
            ))}
          </ol>
          <p className="mt-4 text-[14px] leading-6 text-muted">{t('자세한 기준과 지금까지의 결과는 인사이트에 있습니다.', 'The bar and the results so far are on the Signals page.')} <Link href="/newsletter-preview" className="link-seed">{t('인사이트', 'Insights')}</Link></p>
        </SiteRow>

        <SiteRow label="History" title={t('지금까지', 'So far')}>
          <div className="relative">
            <span aria-hidden="true" className="grow-y absolute bottom-3 left-[5px] top-3 w-px bg-outline-strong" />
            <ol className="grid gap-7">
              {HISTORY.map(([date, ko, en]) => (
                <li key={date} className="reveal relative grid gap-x-8 gap-y-1 pl-8 sm:grid-cols-[8rem_minmax(0,1fr)]">
                  <span aria-hidden="true" className="absolute left-0 top-[7px] h-[11px] w-[11px] rounded-full border-2 border-seed bg-surface" />
                  <time dateTime={date} className="num text-[14px] text-muted">{date}</time>
                  <span className="text-[16px] leading-7">{t(ko, en)}</span>
                </li>
              ))}
            </ol>
          </div>
        </SiteRow>

        <SiteRow label="Team" title={t('만드는 사람', 'Who builds it')}>
          <ul className="grid gap-6 sm:grid-cols-2">
            <li><p className="text-[17px] font-semibold">{t('정지훈', 'Jeong Jihun')}</p><p className="mt-1 text-[15px] leading-7 text-tertiary">{t('설계와 개발. 기회 엔진, 근거 추적 PRD, MCP 서버', 'Design and engineering: the opportunity engine, evidence-traced PRDs, the MCP server')}</p></li>
            <li><p className="text-[17px] font-semibold">{t('장차희', 'Jang Chahee')}</p><p className="mt-1 text-[15px] leading-7 text-tertiary">{t('서비스 기획, 데이터 검증, 화면과 품질', 'Product planning, data verification, interface and quality')}</p></li>
          </ul>
        </SiteRow>

        <SiteRow label="Contact" title={t('의견, 버그, 원문 삭제 요청', 'Feedback, bugs and quote removal')}>
          <p className="max-w-[40em] text-[16px] leading-8 text-tertiary">{t('인용된 글의 작성자가 삭제를 원하면 바로 뺍니다. 무엇이든 GitHub 이슈로 남겨 주세요.', 'If you wrote a quoted post and want it out, we remove it. Leave anything as a GitHub issue.')}</p>
          <a href={ISSUES} target="_blank" rel="noopener noreferrer" className="btn-quiet mt-5">{t('GitHub 이슈 남기기', 'Open a GitHub issue')}</a>
        </SiteRow>
      </main>
      <Footer />
    </>
  );
}
