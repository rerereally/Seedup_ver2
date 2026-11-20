import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

test('idea → tailored questions → streamed PRD → AGENTS.md export', async ({ page }) => {
  await page.goto('/prd/new');
  const idea = page.getByPlaceholder(/Tenor 대신/);
  await idea.fill('온콜 인수인계 메모를 자동으로 정리해 주는 슬랙 봇');
  await idea.press('Enter');

  // The questions come from the model (fixed here), not the built-in list.
  await expect(page.getByText('온콜 인수인계 봇을 가장 먼저 쓸 팀은 어디인가요?').first()).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'SRE 팀', exact: true }).click();

  await page.getByRole('button', { name: 'PRD 만들기', exact: true }).last().click();
  // While writing, the title stays put and the old question draft is gone.
  await expect(page.getByRole('heading', { name: /온콜 인수인계 메모를 자동으로 정리해 주는 슬랙 봇/ }).first()).toBeVisible();

  const prd = page.getByRole('region', { name: '생성된 PRD' });
  await expect(prd).toBeVisible({ timeout: 90_000 });
  await expect(prd.getByText('H-01').first()).toBeVisible();
  await expect(prd.getByRole('heading', { name: '기술 설계' })).toBeVisible();

  await prd.getByText('에이전트로 보내기', { exact: true }).click();
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'AGENTS.md 받기' }).click()]);
  expect(download.suggestedFilename()).toBe('AGENTS.md');
  const brief = readFileSync((await download.path())!, 'utf8');
  expect(brief).toMatch(/F-01/);
  expect(brief).toMatch(/슬랙/);
  expect(brief).toMatch(/### Implementation order\n1\. .*\(F-01\)/);
});
