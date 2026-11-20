import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

async function lockGoalAndVerifyHandoff(page: Page) {
  const goalCard = page.getByRole('region', { name: '목표 잠그기' });
  await expect(goalCard).toBeVisible({ timeout: 30_000 });
  await goalCard.getByRole('radio', { name: /A 개인용/ }).check();
  await goalCard.getByLabel('성공 기준 2').fill('미해결 이슈 누락 0건');
  await goalCard.getByLabel('재는 방법 2').fill('교대 직후 누락 건수 0건 확인');
  await goalCard.getByRole('button', { name: '목표 잠그기' }).click();

  const lockedCard = page.getByRole('region', { name: '잠긴 목표' });
  await expect(lockedCard).toBeVisible({ timeout: 15_000 });
  await expect(lockedCard.getByText('저장됨')).toBeVisible({ timeout: 15_000 });

  const handoff = page.getByRole('region', { name: '에이전트' });
  await expect(handoff).toBeVisible();
  const keyLocator = handoff.getByText(/^prd:[0-9a-f-]{36}$/);
  await expect(keyLocator).toBeVisible();
  const projectKey = (await keyLocator.textContent())!.trim();
  const expectedPrompt = `Seedup 프로젝트 ${projectKey}를 이어서 진행해. resume_project {"project":"${projectKey}"}로 잠긴 목표와 사람이 먼저 할 일을 확인하고, get_next_task {"project":"${projectKey}"}로 다음 기능 하나를 받아 시작해. 목표나 범위를 바꾸는 결정은 먼저 나에게 물어봐.`;
  await expect(handoff.getByText(expectedPrompt)).toBeVisible();

  await handoff.getByRole('button', { name: '시작 문장 복사' }).click();
  // The starter pack below has its own status line, so the copy result is picked by its text.
  await expect(handoff.getByRole('status').filter({ hasText: /시작 문장을 복사했습니다\.|아래 시작 문장을 선택해 직접 복사하세요\./ })).toBeVisible();
  expect(expectedPrompt).not.toMatch(/sdp_|Bearer|token|api[_-]?key/i);
  return { projectKey, expectedPrompt };
}

test('idea → tailored questions → streamed PRD → AGENTS.md export → goal lock → agent start prompt', async ({ page }) => {
  await page.goto('/prd/new');
  const idea = page.getByPlaceholder(/Tenor 대신/);
  await idea.fill('온콜 인수인계 메모와 Tenor GIF API를 자동으로 정리해 주는 슬랙 봇');
  await idea.press('Enter');

  // The questions come from the model (fixed here), not the built-in list.
  await expect(page.getByText('온콜 인수인계 봇을 가장 먼저 쓸 팀은 어디인가요?').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'SRE 팀', exact: true }).click();

  const dossierSaved = page.waitForResponse((res) => res.url().includes('/api/opportunities/dossiers') && res.request().method() === 'POST' && res.ok());
  await page.getByRole('button', { name: 'PRD 만들기', exact: true }).last().click();
  // While writing, the title stays put and the old question draft is gone.
  await expect(page.getByRole('heading', { name: /온콜 인수인계 메모와 Tenor GIF API를 자동으로 정리해 주는 슬랙 봇/ }).first()).toBeVisible();

  const prd = page.getByRole('region', { name: '생성된 PRD' });
  await expect(prd).toBeVisible({ timeout: 90_000 });
  await expect(prd.getByText('H-01').first()).toBeVisible();
  await expect(prd.getByRole('heading', { name: '기술 설계' })).toBeVisible();
  await dossierSaved;

  await prd.getByText('에이전트로 보내기', { exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'AGENTS.md 받기', exact: true }).click()]);
  expect(download.suggestedFilename()).toBe('AGENTS.md');
  const brief = readFileSync((await download.path())!, 'utf8');
  expect(brief).toMatch(/F-01/);
  expect(brief).toMatch(/슬랙/);
  expect(brief).toMatch(/### Implementation order\n1\. .*\(F-01\)/);

  await lockGoalAndVerifyHandoff(page);
});

test('idea validation entry (/prd/validate) → PRD workspace with evidence & competitors → goal lock → agent handoff', async ({ page }) => {
  const ideaText = '온콜 인수인계 메모를 자동으로 정리해 주는 슬랙 봇';
  await page.route('**/api/opportunities/report', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        idea: ideaText,
        phrases: ['oncall handoff slack'],
        quotes: [],
        related: [{ slug: 'gif-api-replacement', name: 'GIF 검색 API 대안', qualified: true, quotes: 5 }],
        rivals: [{ kind: 'web', name: 'PagerDuty Handoff', description: '복잡한 설정 필요', url: 'https://example.com/pd', popularity: 10, createdAt: null, relation: 'direct' }],
        gap: '슬랙 메시지만으로 5분 안에 요약하는 가벼운 도구가 없습니다.',
        build: null,
        firstUsers: [],
        verdict: { level: 'go', reason: '검증 통과' },
        generatedAt: new Date().toISOString(),
        checks: [],
        counterQuotes: [],
        rivalStats: { candidates: 1, direct: 1, researchQueries: 0 },
        markdown: `# ${ideaText}\n\n## 판정: 실험해 볼 만함\n슬랙 메시지만으로 빠르게 요약합니다.`,
      }),
    });
  });

  await page.goto(`/prd/validate?idea=${encodeURIComponent(ideaText)}`);
  await page.locator('#check-report').getByRole('button', { name: /검증 리포트 만들기|그대로 검증하기/ }).click();

  const toPrd = page.getByRole('link', { name: '이 아이디어로 PRD 만들기' });
  await expect(toPrd).toBeVisible({ timeout: 15_000 });
  await expect(toPrd).toHaveAttribute('href', /related=gif-api-replacement/);
  await toPrd.click();

  await expect(page.getByText(/검증 리포트의 경쟁 도구 1개를 함께 반영합니다: PagerDuty Handoff/)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText('온콜 인수인계 봇을 가장 먼저 쓸 팀은 어디인가요?').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'SRE 팀', exact: true }).click();

  const dossierSaved = page.waitForResponse((res) => res.url().includes('/api/opportunities/dossiers') && res.request().method() === 'POST' && res.ok());
  await page.getByRole('button', { name: 'PRD 만들기', exact: true }).last().click();
  await expect(page.getByRole('region', { name: '생성된 PRD' })).toBeVisible({ timeout: 90_000 });
  await dossierSaved;

  await lockGoalAndVerifyHandoff(page);
});

test('repo analysis entry (/prd/repo) → reverse-spec personal PRD → goal lock → agent handoff', async ({ page }) => {
  await page.route('**/api/seeds*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === 'GET') {
      const step = url.searchParams.get('step');
      if (step === 'ideas') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ idea: null }) });
        return;
      }
      if (step === 'papers') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ papers: [] }) });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          login: 'octocat',
          repos: [{
            name: 'demo-cli',
            url: 'https://github.com/octocat/demo-cli',
            description: 'CLI for oncall handoff notes',
            language: 'TypeScript',
            topics: ['cli', 'oncall'],
            stars: 42,
            pushedAt: '2026-11-20T00:00:00Z',
            near: [],
            news: [],
            similar: [],
          }],
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        input: {
          title: 'demo-cli 역기획',
          problem: 'CLI for oncall handoff notes',
          gap: '',
          evidence: [],
          competitors: [],
        },
        spec: {
          summary: '온콜 교대 메모를 CLI에서 5분 안에 요약한다.',
          targetUsers: ['SRE 팀'],
          requirements: [{
            id: 'R-01',
            title: '교대 메모 요약',
            detail: '최근 경고를 묶어 요약한다.',
            priority: 'P0',
            evidence: [],
            acceptance: ['7일치 경고를 30초 안에 요약한다.'],
          }],
          hypotheses: [],
          features: [{
            id: 'F-01',
            title: '메시지 수집과 요약',
            detail: '경고별 요약을 출력한다.',
            requirementIds: ['R-01'],
            slots: null,
          }],
          screens: [],
          nonGoals: ['경고를 자동으로 해결하지 않는다.'],
          risks: [],
          metrics: ['첫 팀의 인수인계 시간 4주 안에 절반 감소. 측정: 도입 전후 소요 시간 중간값 비교.'],
          draft: false,
        },
      }),
    });
  });

  await page.goto('/prd/repo?user=octocat');
  const makePrd = page.getByRole('button', { name: '이 저장소로 PRD·기능 명세 만들기' });
  await expect(makePrd).toBeVisible({ timeout: 30_000 });

  const dossierSaved = page.waitForResponse((res) => res.url().includes('/api/opportunities/dossiers') && res.request().method() === 'POST' && res.ok());
  await makePrd.click();
  await dossierSaved;
  await expect(page.getByText(/개인 PRD\(prd:[0-9a-f-]{36}\)로 저장/)).toBeVisible({ timeout: 15_000 });

  await lockGoalAndVerifyHandoff(page);
});
