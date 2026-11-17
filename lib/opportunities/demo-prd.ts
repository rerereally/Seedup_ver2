import type { Platform } from './types';

/**
 * The PRD the landing demo plays. It is a real one: the saved PRD for "GIF 검색 API 대안" (prd_cache, made 2026-11-16
 * from five verified quotes), frozen here so the front page never changes under a visitor or a demo. The English titles
 * are translations of the Korean ones the model wrote; the quotes are the developers' own words.
 */
export type DemoText = { ko: string; en: string };
export type DemoPrd = {
  slug: string;
  name: DemoText;
  madeAt: string;
  evidence: Array<{ id: string; platform: Platform; quote: string; quoteKo: string; url: string; postedAt: string }>;
  requirements: Array<{ id: string; title: DemoText; evidence: number[] }>;
  features: Array<{ id: string; title: DemoText; requirementIds: string[] }>;
  screens: Array<{ id: string; name: DemoText; featureIds: string[] }>;
};

export const DEMO_PRD: DemoPrd = {
  slug: 'gif-api-replacement',
  name: { ko: 'GIF 검색 API 대안', en: 'A replacement for the GIF search API' },
  madeAt: '2026-11-16',
  evidence: [
    { id: 'ev_ef6df13b6d1c88c6', platform: 'hn', quote: 'No public announcement. Just quietly added to killed by google.', quoteKo: "공식 발표는 없습니다. 그냥 조용히 'Killed by Google'에 추가되었습니다.", url: 'https://news.ycombinator.com/item?id=46603473', postedAt: '2026-01-13' },
    { id: 'ev_5bd7100a28bddf0a', platform: 'github', quote: 'Tenor recently announced they will be shutting down their API on June 30.', quoteKo: 'Tenor가 최근 6월 30일자로 API를 종료한다고 발표했습니다.', url: 'https://github.com/bluesky-social/social-app/issues/9728', postedAt: '2026-01-19' },
    { id: 'ev_1855150a668a51d0', platform: 'github', quote: 'The GIF integration is currently broken due to the deprecation and shutdown of the Tenor API.', quoteKo: 'Tenor API의 지원 중단 및 종료로 인해 현재 GIF 연동이 작동하지 않습니다.', url: 'https://github.com/gustavosett/Windows-11-Clipboard-History-For-Linux/issues/277', postedAt: '2026-07-15' },
    { id: 'ev_7cd7abded751d0fa', platform: 'github', quote: 'Google’s Tenor API shutdown (June 30, 2026) causes gif insert = error', quoteKo: 'Google의 Tenor API 종료(2026년 6월 30일)로 인해 GIF 삽입 시 오류가 발생합니다.', url: 'https://github.com/frappe/raven/issues/2193', postedAt: '2026-07-10' },
    { id: 'ev_1bae684854e5aeb6', platform: 'github', quote: 'Google has announced that the Tenor GIF API will be fully discontinued on June 30, 2026.', quoteKo: 'Google은 2026년 6월 30일을 기해 Tenor GIF API를 완전히 중단한다고 발표했습니다.', url: 'https://github.com/galnir/Master-Bot/issues/824', postedAt: '2026-04-06' },
  ],
  requirements: [
    { id: 'R-01', title: { ko: 'GIF 삽입 오류 해결', en: 'Fix the GIF insert error' }, evidence: [3, 4] },
    { id: 'R-02', title: { ko: '대체 GIF 검색 API 제공', en: 'Offer a replacement search API' }, evidence: [2, 5] },
    { id: 'R-03', title: { ko: '예고 없는 서비스 중단 대비', en: 'Survive unannounced shutdowns' }, evidence: [1] },
    { id: 'R-04', title: { ko: '기존 연동 마이그레이션 지원', en: 'Help migrate existing integrations' }, evidence: [3, 4] },
    { id: 'R-05', title: { ko: 'June 30 이전 대응 완료', en: 'Ship before June 30' }, evidence: [2, 4, 5] },
  ],
  features: [
    { id: 'F-01', title: { ko: '대체 GIF 검색 API', en: 'Replacement GIF search API' }, requirementIds: ['R-02', 'R-05'] },
    { id: 'F-02', title: { ko: 'GIF 삽입 오류 대체 처리', en: 'Fallback for failed inserts' }, requirementIds: ['R-01', 'R-03', 'R-04'] },
    { id: 'F-03', title: { ko: '마이그레이션 가이드 및 SDK', en: 'Migration guide and SDK' }, requirementIds: ['R-04', 'R-05'] },
    { id: 'F-04', title: { ko: '서비스 상태 알림', en: 'Service status alerts' }, requirementIds: ['R-03'] },
  ],
  screens: [
    { id: 'S-01', name: { ko: 'API 키 발급', en: 'API keys' }, featureIds: ['F-01'] },
    { id: 'S-02', name: { ko: '마이그레이션 가이드', en: 'Migration guide' }, featureIds: ['F-03'] },
    { id: 'S-03', name: { ko: 'GIF 검색과 삽입', en: 'Search and insert' }, featureIds: ['F-01', 'F-02'] },
    { id: 'S-04', name: { ko: '상태 알림 설정', en: 'Status alerts' }, featureIds: ['F-04'] },
  ],
};
