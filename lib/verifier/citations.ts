import type { CodeCitation, CriterionVerdict } from '../supervisor/types';

/** Exact characters, starting on the claimed 1-based line. No case/whitespace normalization for code. */
export function verifyCitation(citation: Pick<CodeCitation, 'path' | 'line' | 'quote'>, files: Record<string, string>): CodeCitation {
  const source = Object.hasOwn(files, citation.path) ? files[citation.path] : undefined;
  let verified = false;
  if (source !== undefined && Number.isInteger(citation.line) && citation.line > 0 && citation.quote.trim()) {
    const lines = source.split('\n');
    const tail = lines.slice(citation.line - 1).join('\n');
    const at = tail.indexOf(citation.quote);
    verified = citation.line <= lines.length && at >= 0 && at <= lines[citation.line - 1].length;
  }
  return { ...citation, verified };
}

export function verifyCitations(verdicts: CriterionVerdict[], files: Record<string, string>): CriterionVerdict[] {
  return verdicts.map((row) => {
    const citations = row.citations.map((citation) => verifyCitation(citation, files));
    const valid = citations.length > 0 && citations.every((citation) => citation.verified);
    return { ...row, citations, verdict: valid ? row.verdict : 'unclear', reason: valid ? row.reason : `${row.reason}\n코드 인용을 해당 SHA에서 확인하지 못했습니다.` };
  });
}
