import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d — 공정별 자동 층 배치 + 층 뷰 필터(④) (admin/viewer).
 *
 * 자동 표시 설비는 clusterId(공정)로 층이 정해진다: photo/etch/cvd→1F, cmp/diff/imp→2F, wet/metal→3F.
 * 좌측 1F/2F/3F 는 그 층만, 전체는 모두 보여준다(읽기 전용에서도 동작). console/pageerror 0.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ', 'LIVE_MAP_LAYOUT_WRITE'],
}
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]

const eqp = (eqpKey: number, clusterId: string, clusterName: string) => ({
  eqpKey, eqpId: `EQP-${eqpKey}`, eqpName: `${clusterName}-${eqpKey}`, lineValue: 'A_LINE', lineLabel: 'A Line',
  clusterId, clusterName, equipmentModeLabel: 'Auto', status: 'RUN' as const, statusLabel: 'Run',
  portItems: [], tooltipMeta: '', tooltipStep: '', alertMessage: null,
})
// photo→1F, cmp→2F, wet→3F.
const LIVE_MAP = { equipmentItems: [eqp(77, 'photo', 'PHOTO'), eqp(88, 'cmp', 'CMP'), eqp(99, 'wet', 'WET')] }
const EMPTY_LAYOUT = { layoutKey: null, lineKey: 1, canvasJson: null, placements: [], objects: [] }

const setupMocks = async (page: Page) => {
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(apiNullSuccess()) }))
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ME)) }))
  await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiNullSuccess()) }))
  await page.route('**/api/line', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LINES)) }))
  await page.route(/\/api\/live-map\/layout\/objects(\/\d+)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) }))
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess(EMPTY_LAYOUT)) }))
  await page.route(/.*\/api\/live-map(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LIVE_MAP)) }))
  await page.route(/.*\/api\/(eqp|model)(\/.*)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })) }))
  await page.route(/.*\/api\/comm-logs(\/.*)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) }))
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

test('admin: 공정별로 설비가 1/2/3층에 자동 배치되고, 층 버튼이 그 층만 / 전체가 모두 보여준다 (console/pageerror 0)', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-A_LINE').click()
  await page.getByTestId('live-map-mode-3d').click()
  await expect(page.getByTestId('live-map-3d-scene')).toBeVisible()

  // 기본 전체 보기 — 3대 모두 표시.
  await expect(page.getByTestId('live-map-3d-badge-77')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-badge-88')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-badge-99')).toBeVisible()

  // 1F → photo(77)만, cmp(88)/wet(99) 숨김.
  await page.getByTestId('live-map-3d-floor-1').click()
  await expect(page.getByTestId('live-map-3d-badge-77')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-badge-88')).toHaveCount(0)
  await expect(page.getByTestId('live-map-3d-badge-99')).toHaveCount(0)

  // 2F → cmp(88)만.
  await page.getByTestId('live-map-3d-floor-2').click()
  await expect(page.getByTestId('live-map-3d-badge-88')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-badge-77')).toHaveCount(0)
  await expect(page.getByTestId('live-map-3d-badge-99')).toHaveCount(0)

  // 3F → wet(99)만.
  await page.getByTestId('live-map-3d-floor-3').click()
  await expect(page.getByTestId('live-map-3d-badge-99')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-badge-88')).toHaveCount(0)

  // 전체 → 다시 3대 모두.
  await page.getByTestId('live-map-3d-floor-all').click()
  await expect(page.getByTestId('live-map-3d-badge-77')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-badge-88')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-badge-99')).toBeVisible()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
