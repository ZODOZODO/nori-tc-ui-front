import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * AC8 — live-map 비-admin 권한 e2e.
 *
 * LIVE_MAP_LAYOUT_WRITE 가 없는 사용자는 테마형 뷰어(공정 플로우 board)만 보고,
 * "구조물 편집" 토글/빌더 저작 UI 에 진입할 수 없다(이중 차단의 프론트 절반).
 * console.error / pageerror 0 도 단언.
 */

const apiSuccess = <TData>(data: TData) => ({
  success: true,
  data,
  errorCode: null,
  errorMsg: null,
})

const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

// WRITE 권한 없음 — 조회 권한만 보유.
const ME = {
  userPk: 200,
  userId: 'operator',
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ'],
}

const LINES = [
  { lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' },
  { lineKey: 2, lineCode: 'B_LINE', lineName: 'B Line' },
]

const LIVE_MAP = { equipmentItems: [] }

const EMPTY_LAYOUT = {
  layoutKey: null,
  lineKey: 2,
  canvasJson: null,
  placements: [],
  objects: [],
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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LINES)) })
  })
  await page.route(/\/api\/live-map\/layout\/objects(\/\d+)?(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) })
  })
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(EMPTY_LAYOUT)) })
  })
  await page.route(/.*\/api\/live-map(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LIVE_MAP)) })
  })
  await page.route(/.*\/api\/(eqp|model|comm-logs)(\/.*)?(\?.*)?$/, async (route) => {
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

test('비-admin: 뷰어만 보이고 구조물 편집(빌더) 진입 불가 (console/pageerror 0)', async ({ page }) => {
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-B_LINE').click()

  // 테마형 뷰어(공정 플로우 board)만 노출. WRITE 권한이 없어 "구조물 편집" 토글 자체가 렌더되지 않고
  // 빌더 저작 툴바/팔레트도 없다.
  await expect(page.getByTestId('live-map-viewer-board')).toBeVisible()
  await expect(page.getByTestId('live-map-mode-builder')).toHaveCount(0)
  await expect(page.getByTestId('live-map-mode-viewer')).toHaveCount(0)
  await expect(page.getByTestId('live-map-builder-toolbar')).toHaveCount(0)
  await expect(page.getByTestId('live-map-builder-palette')).toHaveCount(0)
  await expect(page.getByTestId('builder-add-rect')).toHaveCount(0)
  await expect(page.getByTestId('builder-save-object')).toHaveCount(0)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
