// shortcut: legacy quotes have no source context, so only visible signs of truncation can be detected.
export function isCutOffEvidenceQuote(quote: string) {
  const text = quote.trim().replace(/["'”’»）)\]}]+$/u, '').trimEnd();
  return /[:;,：；，…]$|\.{2,}$/u.test(text)
    || /:\s*[^.!?]*\bit(?:['’]s| is)\s+(?:hard|difficult|impossible)\s+to\s+answer$/iu.test(text);
}
