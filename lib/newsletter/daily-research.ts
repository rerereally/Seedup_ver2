import type { dailyResearch } from '@/lib/opportunities/research';
import type { Opportunity } from '@/lib/opportunities/types';
import { escapeHtml, opportunityUrl } from './opportunity-digest';

export function renderDailyResearchMail(research: ReturnType<typeof dailyResearch>, recommendation: Pick<Opportunity, 'slug' | 'name'>, siteUrl: string) {
  if (!research.changeCount) return null;

  const subject = 'Seedup 오늘 달라진 것';
  const window = research.windowDays === 1 ? '최근 1일' : '변화가 적어 최근 7일';
  const base = siteUrl.replace(/\/+$/, '');
  const unsubscribeUrl = `${base}/profile`;
  const groups = [
    { title: '새로 찾은 문제', items: research.newProblems.slice(0, 3).map((item) => ({ ...item, note: `원문 ${item.evidence}건` })) },
    { title: '수요 상승', items: research.demandRising.slice(0, 3).map((item) => ({ ...item, note: `원문 +${item.growth}건` })) },
    { title: '검증 기준 통과', items: research.newlyQualified.slice(0, 3).map((item) => ({ ...item, note: `원문 ${item.evidence}건, 플랫폼 ${item.platforms}곳` })) },
    { title: '빈틈 줄어듦', items: research.gapClosing.slice(0, 3).map((item) => ({ ...item, note: item.directGrowth > 0 ? `직접 경쟁 +${item.directGrowth}개` : '경쟁 늘어남' })) },
    { title: '오늘의 추천 문제', items: [{ ...recommendation, note: '' }] },
  ].filter(({ items }) => items.length);
  const fields = research.fieldTrend.map(({ label, growth }) => `${label} (원문 +${growth}건)`);
  const text = [
    window,
    ...groups.flatMap(({ title, items }) => ['', title, ...items.map(({ name, slug, note }) => `- ${name}${note ? ` (${note})` : ''}\n  ${opportunityUrl(base, slug)}`)]),
    ...(fields.length ? ['', '분야별 원문 증가', ...fields] : []),
    '',
    `구독 해지: ${unsubscribeUrl}`,
  ].join('\n');
  const html = [
    '<!doctype html><html lang="ko"><head><meta charset="utf-8"></head><body>',
    `<h1>${subject}</h1><p>${window}</p>`,
    ...groups.map(({ title, items }) => `<h2>${title}</h2><ul>${items.map(({ name, slug, note }) => `<li><a href="${escapeHtml(opportunityUrl(base, slug))}">${escapeHtml(name)}</a>${note ? ` (${escapeHtml(note)})` : ''}</li>`).join('')}</ul>`),
    ...(fields.length ? [`<h2>분야별 원문 증가</h2><ul>${fields.map((field) => `<li>${escapeHtml(field)}</li>`).join('')}</ul>`] : []),
    `<p><a href="${escapeHtml(unsubscribeUrl)}">구독 해지</a></p></body></html>`,
  ].join('\n');
  return { subject, text, html };
}
