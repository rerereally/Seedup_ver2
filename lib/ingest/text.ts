export function stripHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function truncate(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}...`;
}

export function fallbackSummary(title: string, content: string) {
  const firstSentence = content.split(/[.!?。]\s/)[0] || content;
  return truncate(firstSentence || title, 220);
}

export function buildArticleContext(content: string, maxLength = 3600) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLength) return normalized;

  const paragraphs = splitParagraphs(content);
  if (!paragraphs.length) return sampleLongText(normalized, maxLength);

  const scored = paragraphs
    .map((paragraph, index) => ({
      paragraph,
      index,
      score: scoreParagraph(paragraph, index, paragraphs.length),
    }))
    .sort((a, b) => b.score - a.score);

  const selected = new Map<number, string>();
  for (const item of scored) {
    if (selected.size >= 8) break;
    selected.set(item.index, item.paragraph);
  }

  selected.set(0, paragraphs[0]);
  selected.set(paragraphs.length - 1, paragraphs[paragraphs.length - 1]);

  const ordered = [...selected.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, paragraph]) => paragraph);

  const context = ordered.join('\n\n');
  return context.length > maxLength ? sampleLongText(context, maxLength) : context;
}

function splitParagraphs(content: string) {
  return content
    .split(/\n{2,}|(?<=[.!?。])\s+(?=[A-Z가-힣0-9])/)
    .map((paragraph) => paragraph.replace(/\s+/g, ' ').trim())
    .filter((paragraph) => paragraph.length >= 60)
    .slice(0, 80);
}

function scoreParagraph(paragraph: string, index: number, total: number) {
  const keywordScore = [
    /launch|release|announce|introduce|update|feature|model|agent|developer|api|open source|benchmark/i,
    /출시|공개|발표|도입|업데이트|기능|모델|에이전트|개발자|오픈소스|벤치마크|자동화/,
    /because|therefore|however|result|impact|risk|problem|solution/i,
    /왜|결과|영향|문제|해결|전망|위험|중요|핵심/,
  ].reduce((score, pattern) => score + (pattern.test(paragraph) ? 8 : 0), 0);
  const lengthScore = Math.min(12, paragraph.length / 80);
  const positionScore = index === 0 || index === total - 1 ? 10 : index < 4 ? 6 : 0;
  return keywordScore + lengthScore + positionScore;
}

function sampleLongText(content: string, maxLength: number) {
  const segment = Math.floor(maxLength / 3);
  const head = content.slice(0, segment);
  const middleStart = Math.max(0, Math.floor(content.length / 2) - Math.floor(segment / 2));
  const middle = content.slice(middleStart, middleStart + segment);
  const tail = content.slice(Math.max(0, content.length - segment));
  return [head, middle, tail].map((part) => part.trim()).filter(Boolean).join('\n\n...\n\n');
}
