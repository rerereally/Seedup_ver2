import { saveScrap } from '@/app/actions/scraps';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import MarkdownContent from '@/components/MarkdownContent';
import ShareButton from '@/components/ShareButton';
import { getExistingScrap, getNewsItem, getRelatedPapersForNews } from '@/lib/data';
import { ArrowLeft, Bookmark, BookOpenText, CheckCircle2, ExternalLink, GraduationCap, Lightbulb } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [item, existingScrap, relatedPapers] = await Promise.all([
    getNewsItem(id),
    getExistingScrap('news', id),
    getRelatedPapersForNews(id),
  ]);

  if (!item) notFound();

  return (
    <>
      <Header />
      <main className="grow bg-surface">
        <article className="mx-auto max-w-[1180px] px-4 py-12 md:px-10 md:py-16">
          <Link href="/news" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand-primary">
            <ArrowLeft className="h-4 w-4" />
            뉴스 목록으로
          </Link>
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div>
              <div className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-primary">
                {item.category}
                <span className="text-muted">•</span>
                <span className="text-muted">{item.source}</span>
              </div>
              <h1 className="text-4xl font-bold leading-tight text-ink md:text-5xl">{item.title}</h1>
              {item.summary && <p className="mt-6 text-xl leading-9 text-muted">{item.summary}</p>}

              <div className="mt-8 flex flex-wrap gap-3">
                <form action={saveScrap}>
                  <input type="hidden" name="item_type" value="news" />
                  <input type="hidden" name="item_id" value={item.id} />
                  <input type="hidden" name="title" value={item.title} />
                  <input type="hidden" name="description" value={item.summary ?? item.beginner_summary ?? ''} />
                  <input type="hidden" name="tag" value={item.category ?? 'news'} />
                  <input type="hidden" name="return_to" value={`/news/${item.id}`} />
                  <button type="submit" className="inline-flex items-center gap-2 rounded-lg border border-outline-soft bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-brand-primary hover:text-brand-primary">
                    <Bookmark className={`h-4 w-4 ${existingScrap ? 'fill-brand-primary text-brand-primary' : ''}`} />
                    {existingScrap ? '스크랩 해제' : '스크랩'}
                  </button>
                </form>
                {item.original_url && (
                  <Link href={item.original_url} target="_blank" className="inline-flex items-center gap-2 rounded-lg border border-outline-soft bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-brand-primary hover:text-brand-primary">
                    <ExternalLink className="h-4 w-4" />
                    원문
                  </Link>
                )}
                <ShareButton title={item.title} url={item.original_url} />
              </div>

              <div className="relative my-10 h-80 overflow-hidden rounded-xl border border-outline-soft bg-[#191c1d] p-8 text-white">
                {item.image_url && <Image src={item.image_url} alt={item.title} fill sizes="980px" className="object-cover opacity-80" />}
              </div>

              {item.content && <MarkdownContent content={item.content} />}

              {item.project_idea && (
                <section className="mt-10 rounded-xl border border-outline-soft bg-white p-6">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-tertiary/10 px-3 py-1 text-xs font-bold text-tertiary">
                    <Lightbulb className="h-4 w-4" />
                    이 뉴스로 만들 수 있는 프로젝트
                  </div>
                  <h2 className="text-2xl font-semibold text-ink">{item.project_idea}</h2>
                  <Link href="/projects" className="mt-5 inline-flex rounded-lg bg-brand-primary px-5 py-3 text-sm font-semibold text-white">
                    프로젝트 플랜 보기
                  </Link>
                </section>
              )}
            </div>

            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="rounded-xl border border-outline-soft bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center gap-2 text-sm font-bold text-brand-primary">
                  <GraduationCap className="h-5 w-5" />
                  초보자용 요약
                </div>
                <p className="text-sm leading-7 text-muted">{item.beginner_summary ?? item.summary ?? 'AI 요약 데이터가 아직 생성되지 않았습니다.'}</p>

                {item.why_it_matters && (
                  <div className="mt-5 border-t border-outline-soft pt-5">
                    <h3 className="mb-2 text-sm font-semibold text-ink">왜 중요한가요?</h3>
                    <p className="text-sm leading-7 text-muted">{item.why_it_matters}</p>
                  </div>
                )}

                {!!item.key_points?.length && (
                  <div className="mt-5 border-t border-outline-soft pt-5">
                    <h3 className="mb-3 text-sm font-semibold text-ink">핵심 포인트</h3>
                    <ul className="space-y-2">
                      {item.key_points.map((point) => (
                        <li key={point} className="flex gap-2 text-sm leading-6 text-muted">
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-primary" />
                          {point}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!!item.related_skills?.length && (
                  <div className="mt-5 border-t border-outline-soft pt-5">
                    <h3 className="mb-3 text-sm font-semibold text-ink">연관 기술</h3>
                    <div className="flex flex-wrap gap-2">
                      {item.related_skills.map((skill) => (
                        <span key={skill} className="rounded-full border border-outline-soft bg-surface px-3 py-1 text-xs font-semibold text-muted">{skill}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-outline-soft pt-5 text-sm">
                  <div>
                    <div className="text-xs font-semibold text-muted">난이도</div>
                    <div className="mt-1 font-bold text-ink">{item.difficulty ?? '-'}</div>
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-muted">관련도</div>
                    <div className="mt-1 font-bold text-ink">{item.relevance_score ?? '-'}</div>
                  </div>
                </div>
              </div>

              {!!relatedPapers.length && (
                <div className="mt-5 rounded-xl border border-outline-soft bg-white p-5 shadow-sm">
                  <div className="mb-4 flex items-center gap-2 text-sm font-bold text-brand-primary">
                    <BookOpenText className="h-5 w-5" />
                    관련 논문 리뷰
                  </div>
                  <div className="space-y-4">
                    {relatedPapers.map((link) => {
                      const paper = link.research_papers;
                      if (!paper) return null;

                      return (
                        <article key={link.id} className="rounded-lg border border-surface-high bg-surface p-4">
                          <div className="mb-2 flex flex-wrap gap-2">
                            <span className="rounded-full bg-brand-primary/10 px-2.5 py-1 text-xs font-bold text-brand-primary">{paper.review_type ?? '논문 리뷰'}</span>
                            {paper.difficulty && <span className="rounded-full border border-outline-soft bg-white px-2.5 py-1 text-xs font-bold text-muted">{paper.difficulty}</span>}
                          </div>
                          <h3 className="line-clamp-2 text-sm font-bold leading-6 text-ink">{paper.title}</h3>
                          {paper.beginner_summary && <p className="mt-2 line-clamp-3 text-xs leading-6 text-muted">{paper.beginner_summary}</p>}
                          {link.relevance_reason && <p className="mt-3 border-l-2 border-brand-primary pl-3 text-xs leading-5 text-muted">{link.relevance_reason}</p>}
                          {paper.paper_url && (
                            <Link href={paper.paper_url} target="_blank" className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-primary">
                              논문 보기
                              <ExternalLink className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
