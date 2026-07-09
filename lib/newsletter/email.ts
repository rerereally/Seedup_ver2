import type { AIProduct, GitHubTrend, NewsItem, ProjectIdea, ResearchPaper } from '@/lib/data';
import type { RecommendedItem } from '@/lib/recommendations';

type NewsletterData = {
  news: RecommendedItem<NewsItem>[];
  papers: RecommendedItem<ResearchPaper>[];
  products: AIProduct[];
  repos: GitHubTrend[];
  projects: ProjectIdea[];
  siteUrl: string;
};

function escapeHtml(value: string | null | undefined) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function card(title: string, description: string | null | undefined, href: string, label: string, reasons: string[] = []) {
  return `
    <tr>
      <td style="padding:18px 0;border-bottom:1px solid #d9d9d9;">
        <div style="font-size:12px;font-weight:800;color:#111111;letter-spacing:.02em;text-transform:uppercase;">${escapeHtml(label)}</div>
        <a href="${href}" style="display:block;margin-top:6px;font-size:20px;line-height:1.35;font-weight:800;color:#111111;text-decoration:none;">${escapeHtml(title)}</a>
        ${description ? `<p style="margin:8px 0 0;font-size:15px;line-height:1.7;color:#666666;">${escapeHtml(description)}</p>` : ''}
        ${reasons.length ? `<div style="margin-top:10px;">${reasons.map(pill).join('')}</div>` : ''}
      </td>
    </tr>
  `;
}

function pill(value: string) {
  return `<span style="display:inline-block;margin:0 6px 8px 0;padding:6px 9px;border:1px solid #d9d9d9;background:#ffffff;font-size:12px;font-weight:700;color:#666666;">${escapeHtml(value)}</span>`;
}

export function buildNewsletterHtml(data: NewsletterData) {
  const featuredNews = data.news[0]?.item;
  const featuredPaper = data.papers[0]?.item;
  const topProduct = data.products[0];
  const topRepo = data.repos[0];
  const topProject = data.projects[0];
  const previewTags = [
    featuredNews?.category,
    featuredPaper?.review_type,
    topProduct?.category,
    topRepo?.language,
    topProject?.level,
  ].filter(Boolean) as string[];

  return `<!doctype html>
<html lang="ko">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Seedup Weekly</title>
  </head>
  <body style="margin:0;background:#f6f6f6;font-family:Pretendard,Apple SD Gothic Neo,Malgun Gothic,Arial,sans-serif;color:#111111;">
    <div style="display:none;max-height:0;overflow:hidden;">최근 신호를 기준으로 추천 아티클과 논문을 골랐습니다.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f6f6;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #d9d9d9;">
            <tr>
              <td style="padding:34px 32px 28px;background:#111111;">
                <div style="font-size:28px;font-weight:900;color:#ffffff;">Seedup</div>
                <h1 style="margin:18px 0 0;font-size:34px;line-height:1.18;color:#ffffff;">오늘 읽을 개발 신호</h1>
                <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#d9d9d9;">최신성, 관심사, 프로젝트 연결성을 기준으로 아티클과 논문을 추천했습니다.</p>
                <div style="margin-top:20px;">${previewTags.map(pill).join('')}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr><td style="padding:0 0 8px;font-size:14px;font-weight:900;color:#111111;">오늘 추천 아티클 5</td></tr>
                  ${data.news.slice(0, 5).map(({ item, reasons }, index) => card(item.title, item.beginner_summary ?? item.summary, `${data.siteUrl}/news/${item.id}`, `추천 글 ${index + 1}`, reasons)).join('')}
                  <tr><td style="padding:24px 0 8px;font-size:14px;font-weight:900;color:#111111;">오늘 추천 논문 3</td></tr>
                  ${data.papers.slice(0, 3).map(({ item, reasons }, index) => card(item.title, item.beginner_summary ?? item.expert_summary, `${data.siteUrl}/papers/${item.id}`, `추천 논문 ${index + 1}`, reasons)).join('')}
                  ${topProduct ? card(topProduct.name, topProduct.description, `${data.siteUrl}/ai-products/${topProduct.id}`, 'AI 제품') : ''}
                  ${topRepo ? card(topRepo.repo_full_name, topRepo.beginner_summary ?? topRepo.description, `${data.siteUrl}/github-trends/${topRepo.id}`, '오픈소스') : ''}
                  ${topProject ? card(topProject.title, topProject.description, `${data.siteUrl}/projects/${topProject.id}`, '프로젝트 아이디어') : ''}
                </table>
                <div style="padding-top:24px;text-align:center;">
                  <a href="${data.siteUrl}" style="display:inline-block;padding:14px 22px;background:#111111;color:#ffffff;font-size:15px;font-weight:900;text-decoration:none;">Seedup에서 전체 보기</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f6f6f6;border-top:1px solid #d9d9d9;">
                <p style="margin:0;font-size:12px;line-height:1.7;color:#666666;">이 메일은 Seedup 뉴스레터 구독자에게 발송되었습니다. 구독 해지는 Seedup 프로필 관리 페이지에서 변경할 수 있습니다.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildNewsletterText(data: NewsletterData) {
  const lines = ['Seedup Weekly', '오늘 읽을 개발 신호', ''];
  lines.push('오늘 추천 아티클 5');
  data.news.slice(0, 5).forEach(({ item, reasons }, index) => lines.push(`${index + 1}. ${item.title}`, `추천 이유: ${reasons.join(', ')}`, `${data.siteUrl}/news/${item.id}`));
  lines.push('', '오늘 추천 논문 3');
  data.papers.slice(0, 3).forEach(({ item, reasons }, index) => lines.push(`${index + 1}. ${item.title}`, `추천 이유: ${reasons.join(', ')}`, `${data.siteUrl}/papers/${item.id}`));
  lines.push('');
  if (data.products[0]) lines.push(`AI 제품: ${data.products[0].name}`, `${data.siteUrl}/ai-products/${data.products[0].id}`, '');
  if (data.repos[0]) lines.push(`오픈소스: ${data.repos[0].repo_full_name}`, `${data.siteUrl}/github-trends/${data.repos[0].id}`, '');
  if (data.projects[0]) lines.push(`프로젝트 아이디어: ${data.projects[0].title}`, `${data.siteUrl}/projects/${data.projects[0].id}`, '');
  lines.push(`전체 보기: ${data.siteUrl}`);
  return lines.join('\n');
}
