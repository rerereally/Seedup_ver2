const KO_AUDIENCES = [
  '프론트엔드 개발자',
  '백엔드 개발자',
  '풀스택 개발자',
  '1인 개발자',
  '초보 개발자',
  '입문 개발자',
  '소상공인',
  '자영업자',
  '프리랜서',
  '디자이너',
  '대학원생',
  '대학생',
  '직장인',
  '마케터',
  '개발자',
  '창업자',
  '연구자',
  '기획자',
  '학생',
  '부모',
  '교사',
  'PM',
] as const;

const EN_AUDIENCES: Array<[RegExp, string]> = [
  [/\bsolo\s+developers?\b/i, 'Solo developers'],
  [/\bsmall\s+(?:dev\s+)?teams?\b/i, 'Small dev teams'],
  [/\bsmall\s+business\s+owners?\b/i, 'Small business owners'],
  [/\bproduct\s+managers?\b|\bpms?\b/i, 'Product managers'],
  [/\bcollege\s+students?\b|\buniversity\s+students?\b/i, 'College students'],
  [/\bstudents?\b/i, 'Students'],
  [/\bfreelancers?\b/i, 'Freelancers'],
  [/\bdesigners?\b/i, 'Designers'],
  [/\bmarketers?\b/i, 'Marketers'],
  [/\bdevelopers?\b/i, 'Developers'],
  [/\bparents?\b/i, 'Parents'],
  [/\bteachers?\b/i, 'Teachers'],
  [/\bfounders?\b/i, 'Founders'],
  [/\bresearchers?\b/i, 'Researchers'],
];

function matchKoAudience(text: string): string | null {
  const sorted = [...KO_AUDIENCES].sort((a, b) => b.length - a.length);
  for (const word of sorted) {
    if (/^[A-Za-z]+$/.test(word)) {
      if (new RegExp(`(?:^|[^A-Za-z])${word}(?=$|[^A-Za-z])`, 'i').test(text)) return word;
    } else if (text.includes(word)) {
      return word;
    }
  }
  return null;
}

function matchEnAudience(text: string): string | null {
  for (const [pattern, label] of EN_AUDIENCES) {
    if (pattern.test(text)) return label;
  }
  return null;
}

/** Extracts a target audience noun from a one-line idea by rule (longer words first), or returns null. */
export function ideaAudience(idea: string, lang: 'ko' | 'en' = 'ko'): string | null {
  const text = idea.normalize('NFKC').trim();
  if (!text) return null;
  return lang === 'en'
    ? matchEnAudience(text) ?? matchKoAudience(text)
    : matchKoAudience(text) ?? matchEnAudience(text);
}
