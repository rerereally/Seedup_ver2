import type { AIProduct, GitHubTrend, NewsItem, ProjectIdea, ResearchPaper } from '@/lib/data';

type NewsletterData = {
  news: NewsItem[];
  papers: ResearchPaper[];
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

function card(title: string, description: string | null | undefined, href: string, label: string) {
  return `
    <tr>
      <td style="padding:18px 0;border-bottom:1px solid #f0d7d2;">
        <div style="font-size:12px;font-weight:800;color:#ff4628;letter-spacing:.02em;text-transform:uppercase;">${escapeHtml(label)}</div>
        <a href="${href}" style="display:block;margin-top:6px;font-size:20px;line-height:1.35;font-weight:800;color:#191c1d;text-decoration:none;">${escapeHtml(title)}</a>
        ${description ? `<p style="margin:8px 0 0;font-size:15px;line-height:1.7;color:#5c403a;">${escapeHtml(description)}</p>` : ''}
      </td>
    </tr>
  `;
}

function pill(value: string) {
  return `<span style="display:inline-block;margin:0 6px 8px 0;padding:7px 11px;border:1px solid #e6bdb5;border-radius:999px;background:#fff;font-size:12px;font-weight:700;color:#5c403a;">${escapeHtml(value)}</span>`;
}

export function buildNewsletterHtml(data: NewsletterData) {
  const featuredNews = data.news[0];
  const featuredPaper = data.papers[0];
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
  <body style="margin:0;background:#f8f9fa;font-family:Pretendard,Apple SD Gothic Neo,Malgun Gothic,Arial,sans-serif;color:#191c1d;">
    <div style="display:none;max-height:0;overflow:hidden;">이번 주 개발 뉴스, AI 제품, 오픈소스, 만들 만한 프로젝트를 모았습니다.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f9fa;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#ffffff;border:1px solid #e6bdb5;border-radius:18px;overflow:hidden;">
            <tr>
              <td style="padding:34px 32px 28px;background:#191c1d;">
                <div style="font-size:28px;font-weight:900;color:#ff4628;">Seedup</div>
                <h1 style="margin:18px 0 0;font-size:34px;line-height:1.18;color:#ffffff;">이번 주 개발 트렌드 브리핑</h1>
                <p style="margin:14px 0 0;font-size:16px;line-height:1.7;color:#f4dcd7;">읽고 끝나는 뉴스가 아니라, 바로 만들 수 있는 프로젝트 단서까지 정리했습니다.</p>
                <div style="margin-top:20px;">${previewTags.map(pill).join('')}</div>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 32px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr><td style="padding:0 0 8px;font-size:14px;font-weight:900;color:#191c1d;">성향 맞춤 아티클 5</td></tr>
                  ${data.news.slice(0, 5).map((item, index) => card(item.title, item.beginner_summary ?? item.summary, `${data.siteUrl}/news/${item.id}`, `맞춤 글 ${index + 1}`)).join('')}
                  <tr><td style="padding:24px 0 8px;font-size:14px;font-weight:900;color:#191c1d;">오늘 추천 논문 3</td></tr>
                  ${data.papers.slice(0, 3).map((item, index) => card(item.title, item.beginner_summary ?? item.expert_summary, `${data.siteUrl}/papers/${item.id}`, `추천 논문 ${index + 1}`)).join('')}
                  ${topProduct ? card(topProduct.name, topProduct.description, `${data.siteUrl}/ai-products/${topProduct.id}`, 'AI 제품') : ''}
                  ${topRepo ? card(topRepo.repo_full_name, topRepo.beginner_summary ?? topRepo.description, `${data.siteUrl}/github-trends/${topRepo.id}`, '오픈소스') : ''}
                  ${topProject ? card(topProject.title, topProject.description, `${data.siteUrl}/projects/${topProject.id}`, '프로젝트 아이디어') : ''}
                </table>
                <div style="padding-top:24px;text-align:center;">
                  <a href="${data.siteUrl}" style="display:inline-block;padding:14px 22px;border-radius:12px;background:#ff4628;color:#ffffff;font-size:15px;font-weight:900;text-decoration:none;">Seedup에서 전체 보기</a>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;background:#f8f9fa;border-top:1px solid #f0d7d2;">
                <p style="margin:0;font-size:12px;line-height:1.7;color:#7a625d;">이 메일은 Seedup 뉴스레터 구독자에게 발송되었습니다. 구독 해지는 Seedup 프로필 관리 페이지에서 변경할 수 있습니다.</p>
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
  const lines = ['Seedup Weekly', '이번 주 개발 트렌드 브리핑', ''];
  lines.push('성향 맞춤 아티클 5');
  data.news.slice(0, 5).forEach((item, index) => lines.push(`${index + 1}. ${item.title}`, `${data.siteUrl}/news/${item.id}`));
  lines.push('', '오늘 추천 논문 3');
  data.papers.slice(0, 3).forEach((item, index) => lines.push(`${index + 1}. ${item.title}`, `${data.siteUrl}/papers/${item.id}`));
  lines.push('');
  if (data.products[0]) lines.push(`AI 제품: ${data.products[0].name}`, `${data.siteUrl}/ai-products/${data.products[0].id}`, '');
  if (data.repos[0]) lines.push(`오픈소스: ${data.repos[0].repo_full_name}`, `${data.siteUrl}/github-trends/${data.repos[0].id}`, '');
  if (data.projects[0]) lines.push(`프로젝트 아이디어: ${data.projects[0].title}`, `${data.siteUrl}/projects/${data.projects[0].id}`, '');
  lines.push(`전체 보기: ${data.siteUrl}`);
  return lines.join('\n');
}
