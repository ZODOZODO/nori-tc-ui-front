import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'
import viLocale from '../../src/i18n/locales/vi.json' with { type: 'json' }

/**
 * vi(베트남어) 추가의 전환 동작 + 영속 e2e 회귀 가드.
 *
 * - AC7: AppTopBar 의 LanguageToggle 에 3개 언어(한국어/English/Tiếng Việt)가 노출되고,
 *   Tiếng Việt 선택 시 대표 화면(eqp 사이드바 제목)이 vi.json 의 vi 값으로 렌더된다.
 *   en 값("Equipment Info")도 raw key("eqp.sidebar.title")도 아님 + console/pageerror 0.
 * - AC8: vi 선택 후 page.reload() 시 활성 언어가 여전히 vi (index.ts detector localStorage
 *   화이트리스트가 supportedLngs 를 추종하도록 일반화한 수정의 회귀 가드).
 */

const VI = viLocale as Record<string, string>

const apiSuccess = <TData>(data: TData) => ({
  success: true,
  data,
  errorCode: null,
  errorMsg: null,
})

const apiNullSuccess = () => ({
  success: true,
  data: null,
  errorCode: null,
  errorMsg: null,
})

const ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['EQP_READ', 'EQP_WRITE', 'LINE_READ'],
}

const setupMocks = async (page: Page) => {
  await page.route('**/api/auth/csrf', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'set-cookie': 'XSRF-TOKEN=test-csrf-token; Path=/' },
      body: JSON.stringify(apiNullSuccess()),
    })
  })
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ME)) })
  })
  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiNullSuccess()) })
  })
  await page.route('**/api/line', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) })
  })
  await page.route(/.*\/api\/eqp\/options(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        apiSuccess({
          socketProtocolTypes: [],
          gatewayJarOptions: [],
          businessJarOptions: [],
          developModelOptions: [],
          operateModelOptions: [],
        }),
      ),
    })
  })
  await page.route(/.*\/api\/eqp(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })),
    })
  })
  await page.route(/.*\/api\/model(\/.*)?(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })),
    })
  })
}

const attachConsoleGuards = (page: Page) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })
  return { consoleErrors, pageErrors }
}

const sidebarTitle = (page: Page) => page.locator('aside').first().getByText(VI['eqp.sidebar.title'])

const switchToVietnamese = async (page: Page) => {
  // 초기 locale 은 Playwright 기본(en-US) → 'en'. 토글 버튼 aria-label = en "Switch language".
  await page.getByRole('button', { name: 'Switch language' }).click()
  await expect(page.getByRole('option', { name: '한국어' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'English' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'Tiếng Việt' })).toBeVisible()
  await page.getByRole('option', { name: 'Tiếng Việt' }).click()
}

test('AC7 — LanguageToggle 3개 언어 노출 + Tiếng Việt 선택 시 vi 렌더 (console/pageerror 0)', async ({ page }) => {
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)
  await setupMocks(page)

  await page.goto('/eqp')
  // 전환 전: en 사이드바 제목.
  await expect(page.locator('aside').first().getByText('Equipment Info')).toBeVisible()

  await switchToVietnamese(page)

  // 전환 후: vi 값으로 렌더, en 값/raw key 아님.
  await expect(sidebarTitle(page)).toBeVisible()
  await expect(page.getByText('Equipment Info')).toHaveCount(0)
  await expect(page.getByText('eqp.sidebar.title')).toHaveCount(0)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('AC8 — vi 선택 후 reload 시 활성 언어가 vi 로 유지된다', async ({ page }) => {
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)
  await setupMocks(page)

  await page.goto('/eqp')
  await switchToVietnamese(page)
  await expect(sidebarTitle(page)).toBeVisible()

  await page.reload()

  // 새로고침 후에도 vi 유지: 사이드바 제목이 vi 값 + 토글 버튼이 'Tiếng Việt' 라벨.
  await expect(sidebarTitle(page)).toBeVisible()
  await expect(page.getByText('Tiếng Việt')).toBeVisible()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
