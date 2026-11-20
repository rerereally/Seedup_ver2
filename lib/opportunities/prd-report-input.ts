export const REPORT_REASONS = {
  spam: ['스팸·홍보', 'Spam or promotion'],
  personal_information: ['개인정보', 'Personal information'],
  inappropriate: ['부적절한 내용', 'Inappropriate content'],
  other: ['기타', 'Other'],
} as const;

export const REPORT_NOTE_LIMIT = 200;
export const isReportId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

export type ReportReason = keyof typeof REPORT_REASONS;

export function readPrdReport(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const note = typeof row.note === 'string' ? row.note.trim() : '';
  if (typeof row.reason !== 'string' || !Object.hasOwn(REPORT_REASONS, row.reason)
    || !note || [...note].length > REPORT_NOTE_LIMIT || /[\x00-\x1f\x7f\u2028\u2029]/u.test(note)) return null;
  return { reason: row.reason as ReportReason, note };
}
