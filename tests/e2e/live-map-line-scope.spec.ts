import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * live-map 상단바 라인 스코프 e2e (Phase 2 재설계 반영).
 *
 * Phase 2 에서 cluster polygon 보드는 react-konva 2.5D 빌더로 대체되었다. 라인 스코프는
 * 빌더 캔버스를 게이팅한다 — 전체(ALL) 스코프면 "라인 선택" 안내, 특정 라인 선택 시 캔버스 노출.
 * 모든 백엔드 응답은 route.fulfill 로 mock. console error / pageerror 0 도 함께 단언.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ'],
}

const LINES = [
  { lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' },
  { lineKey: 2, lineCode: 'B_LINE', lineName: 'B Line' },
]

const LIVE_MAP = { equipmentItems: [] }

const emptyLayout = (lineKey: number) => ({
  layoutKey: null,
  lineKey,
  canvasJson: null,
  placements: [],
  objects: [],
})

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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(emptyLayout(2))) })
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

test('상단바 라인 스코프가 2.5D 빌더 캔버스를 게이팅한다 (console/pageerror 0)', async ({ page }) => {
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')

  // 초기(전체 라인): 라인 미선택 안내, 캔버스 미노출.
  await expect(page.getByTestId('builder-select-line-hint')).toBeVisible()
  await expect(page.getByTestId('live-map-builder-canvas')).toHaveCount(0)

  // 상단바 라인 드롭다운 → B Line 선택.
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-B_LINE').click()

  // 선택 라인 캔버스 노출, 안내 사라짐.
  await expect(page.getByTestId('live-map-builder-canvas')).toBeVisible()
  await expect(page.getByTestId('builder-select-line-hint')).toHaveCount(0)

  // 다시 전체(ALL) → 안내 복귀.
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-ALL').click()
  await expect(page.getByTestId('builder-select-line-hint')).toBeVisible()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
