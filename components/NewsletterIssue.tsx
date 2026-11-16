import Link from 'next/link';
import Logo from '@/components/Logo';
import type { DigestIssue } from '@/lib/newsletter/opportunity-digest';

/** One weekly issue, the same content the mail carries, laid out for reading on the site. */
export default function NewsletterIssue({ issue, dateLabel }: { issue: DigestIssue; dateLabel: string }) {
  const [lead, ...rest] = issue.top;
  const section = 'mt-12';
  const heading = 'text-[13px] font-semibold text-muted';
  return (
    <article className="card p-6 shadow-[0_20px_60px_rgba(0,0,0,.05)] sm:p-12">
      <p className="flex items-center justify-between gap-4 text-sm">
        <span className="inline-flex items-center gap-2 font-semibold text-seed"><Logo className="h-4 w-4" />Seedup 주간 신호</span>
        <span className="text-muted">{dateLabel}</span>
      </p>
      <h2 className="mt-5 text-[clamp(24px,3vw,32px)] font-bold leading-[1.3] tracking-[-0.025em] [text-wrap:balance]">{issue.headline}</h2>

      {lead && (
        <section className={section}>
          <h3 className={heading}>지금 근거가 가장 탄탄한 문제</h3>
          <Link href={`/opportunities/${lead.slug}`} className="mt-3 block text-[20px] font-semibold leading-snug tracking-tight underline-offset-4 hover:underline">{lead.name}</Link>
          <p className="mt-2 text-[15px] leading-7 text-tertiary">{lead.problem}</p>
          {lead.quote && (
            <blockquote className="mt-5 border-l-2 border-seed pl-4">
              <p lang="en" className="text-[16px] leading-7">“{lead.quote.text}”</p>
              <footer className="mt-1.5 text-[13px] text-muted">{lead.quote.source} · 원문과 일치 · <a href={lead.quote.url} target="_blank" rel="noopener noreferrer" className="text-seed underline-offset-4 hover:underline">원문 보기</a></footer>
            </blockquote>
          )}
          <Link href={`/prd?opportunity=${encodeURIComponent(lead.slug)}`} className="btn mt-6 h-11 px-5">이 문제로 PRD 만들기</Link>
          {rest.length > 0 && (
            <ul className="rows mt-8">
              {rest.map((item) => (
                <li key={item.slug}>
                  <Link href={`/opportunities/${item.slug}`} className="flex items-baseline justify-between gap-4 py-4 hover:bg-surface-low">
                    <span className="min-w-0">
                      <span className="block text-[15px] font-semibold">{item.name}</span>
                      <span className="mt-0.5 line-clamp-1 block text-sm text-muted">{item.problem}</span>
                    </span>
                    <span className="num shrink-0 text-sm text-muted">{item.score}점</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {issue.lines.length > 0 && (
        <section className={section}>
          <h3 className={heading}>이번 주에 달라진 것</h3>
          <ul className="rows mt-3">
            {issue.lines.map((line) => (
              <li key={line.slug}>
                <Link href={`/opportunities/${line.slug}`} className="block py-4 hover:bg-surface-low">
                  <span className="block text-[16px] font-semibold leading-6">{line.name}</span>
                  <span className={`mt-1 block text-sm leading-6 ${line.important ? 'font-medium text-seed' : 'text-muted'}`}>{line.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {issue.reads.length > 0 && (
        <section className={section}>
          <h3 className={heading}>읽을거리</h3>
          <ul className="rows mt-3">
            {issue.reads.map((read) => (
              <li key={read.href}>
                <Link href={read.href} className="block py-4 hover:bg-surface-low">
                  <span className="block text-[15px] font-medium leading-6">{read.title}</span>
                  <span className="mt-1 block text-[13px] text-muted">{[read.source, read.reason].filter(Boolean).join(' · ')}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-12 border-t border-outline-soft pt-5 text-[13px] leading-6 text-muted">공개 게시글의 원문 문장과 저장된 수치로만 만들었습니다. 메일에는 내 관심 분야와 저장한 문제에 맞춘 순서로 들어갑니다.</p>
    </article>
  );
}
