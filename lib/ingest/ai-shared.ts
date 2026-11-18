import type { ContentType, NewsletterSection } from '@/lib/recommendations';
import { truncate } from './text';

export function isContentType(value: unknown): value is ContentType {
  return typeof value === 'string' && ['news', 'article', 'ai_product', 'github_repo', 'paper', 'career_tip', 'build_idea', 'deep_dive'].includes(value);
}

export function isNewsletterSection(value: unknown): value is NewsletterSection {
  return typeof value === 'string' && ['daily_briefing', 'ai_product_radar', 'github_project_pick', 'build_idea', 'career_tip', 'deep_dive', 'paper_to_project'].includes(value);
}

export function ensureKoreanTitle(title: string) {
  const normalized = title.trim();
  if (!normalized) return '기술 뉴스 요약';
  if (containsHangul(normalized)) return normalized;
  return `영문 아티클 요약: ${truncate(normalized, 90)}`;
}

export function containsHangul(value: string) {
  return /[가-힣]/.test(value);
}

export function clampScore(value: unknown) {
  return Math.max(0, Math.min(100, Number(value ?? 0)));
}
