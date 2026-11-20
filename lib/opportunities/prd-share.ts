import { translator } from '../i18n';
import type { Lang } from '../i18n';

/** Saved dossiers keep the rendered PRD, so use its IDs and priority markers as written. */
export function savedPrdPreview(markdown: string) {
  const summary = (markdown.match(/^#{1,2} (?:한 줄 요약|Summary)[ \t]*\r?\n(?:[ \t]*\r?\n)*([^#\r\n][^\r\n]*)/im)?.[1] ?? '').trim();
  const id = (letter: string, number: string) => `${letter.toUpperCase()}-${Number(number)}`;
  const p0 = new Set([...markdown.matchAll(/^### ([RH])-?(\d+)\.[ \t]+\[P0\]/gim)].map((match) => id(match[1], match[2])));
  const features = markdown.match(/^## (?:기능 명세|기능|Features?)(?:[ \t(][^\r\n]*)?\r?\n([\s\S]*?)(?=^## |$(?![\s\S]))/im);
  const p0Features = (features?.[1] ?? '').split(/^### (?=F-?\d+\.)/im).flatMap((section) => {
    const heading = section.match(/^(F-?\d+\.[ \t]+[^\r\n]+)/i)?.[1];
    if (!heading) return [];
    const refs = section.match(/^(?:충족하는 요구사항|Serves):[ \t]*([^\r\n]*)/im)?.[1]
      ?? heading.match(/\(([^()]*)\)$/)?.[1] ?? '';
    const primary = [...refs.matchAll(/\b([RH])-?(\d+)\b/gi)].some((match) => p0.has(id(match[1], match[2])));
    return primary ? [heading.replace(/\.[ \t]+/, ' ')] : [];
  });
  return { summary, p0Features };
}

export function slackPrdSummary(title: string, summary: string, p0Features: string[], shareUrl: string | undefined, lang: Lang) {
  const t = translator(lang);
  return [
    title,
    summary,
    `P0\n${p0Features.length ? p0Features.map((feature) => `- ${feature}`).join('\n') : t('표시된 P0 기능이 없습니다.', 'No features are marked P0.')}`,
    shareUrl ?? t('공유 링크는 Seedup 북마크에서 켤 수 있습니다.', 'Enable the share link in Seedup Bookmarks.'),
  ].filter(Boolean).join('\n\n');
}
