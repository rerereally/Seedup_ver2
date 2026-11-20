import type { CodeCitation, CriterionVerdict } from '../supervisor/types';

/** Keep an exact match on the cited line, or recover the line of a unique literal in the same file. */
export function verifyCitation(citation: Pick<CodeCitation, 'path' | 'line' | 'quote'>, files: Record<string, string>): CodeCitation {
  const source = Object.hasOwn(files, citation.path) ? files[citation.path] : undefined;
  if (source === undefined || !Number.isInteger(citation.line) || citation.line < 1 || !citation.quote.trim()) {
    return { ...citation, verified: false };
  }
  const first = source.indexOf(citation.quote);
  if (first < 0) return { ...citation, verified: false };
  if (source.indexOf(citation.quote, first + 1) === -1) {
    const line = source.slice(0, first).split('\n').length;
    return { ...citation, line, verified: true };
  }
  const lines = source.split('\n');
  const tail = lines.slice(citation.line - 1).join('\n');
  const at = tail.indexOf(citation.quote);
  const verified = citation.line <= lines.length && at >= 0 && at <= lines[citation.line - 1].length;
  return { ...citation, verified };
}

export function verifyCitations(verdicts: CriterionVerdict[], files: Record<string, string>): CriterionVerdict[] {
  return verdicts.map((row) => {
    const citations = row.citations.map((citation) => verifyCitation(citation, files));
    const valid = citations.length > 0 && citations.every((citation) => citation.verified);
    return { ...row, citations, verdict: valid ? row.verdict : 'unclear', reason: valid ? row.reason : `${row.reason}\n코드 인용을 해당 SHA에서 확인하지 못했습니다.` };
  });
}
