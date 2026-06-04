import { expect, test } from '@playwright/test'

/**
 * Playwright 도입 직후 가장 먼저 깨짐 여부를 확인할 수 있는 최소 smoke 시나리오입니다.
 * 인증 API 성공 여부와 무관하게 로그인 화면의 핵심 골격이 렌더링되는지만 검증합니다.
 * 라벨 텍스트는 i18n(브라우저 locale) 에 따라 ko/en 으로 바뀌므로, 검증은 locale 무관한
 * id / role 기반으로 한다.
 */
test('로그인 페이지 핵심 요소가 렌더링됩니다.', async ({ page }) => {
  await page.goto('/login')

  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('img', { name: 'nori-tc' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.locator('#userId')).toBeVisible()
  await expect(page.locator('#password')).toBeVisible()
  await expect(page.locator('button[type="submit"]')).toBeVisible()
})
