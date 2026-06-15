import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d — bay 라벨 + 자동 표시 제거 회귀 (admin/viewer).
 *
 * 공정 bay(자동 클러스터 존/벽/라벨)도, 미배치 설비 자동 표시도 모두 제거됐다. 어떤 bay 라벨 DOM 도 뜨지 않고,
 * 배치하지 않은 설비는 3D 에 보이지 않는다(과거: 'ETC'/'PHOTO' 자동 라벨 + 설비 자동 표시가 혼란을 줬음). console/pageerror 0.
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
// 과거엔 공정(clusterId)별 bay 라벨이 떴다. 이제는 어떤 clusterId 여도 라벨이 없어야 한다.
const LIVE_MAP = {
  equipmentItems: [eqp(71, 'photo', 'PHOTO'), eqp(72, 'photo', 'PHOTO'), eqp(88, 'cmp', 'CMP'), eqp(99, 'wet', 'WET')],
}
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

test('bay 라벨이 없고, 미배치 설비는 자동 표시되지 않는다 (console/pageerror 0)', async ({ page }) => {
  // r3f(three/drei) dev 첫 컴파일 + WebGL 초기화 여유.
  test.setTimeout(90_000)
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-A_LINE').click()
  await page.getByTestId('live-map-mode-3d').click()
  await expect(page.getByTestId('live-map-3d-scene')).toBeVisible()

  // 미배치 설비는 자동 표시되지 않는다 — 설비 뱃지 0 + visible-count 0.
  await expect(page.getByTestId('live-map-3d-visible-count')).toHaveText('0')
  await expect(page.getByTestId('live-map-3d-badge-71')).toHaveCount(0)
  await expect(page.getByTestId('live-map-3d-badge-88')).toHaveCount(0)

  // 어떤 bay 라벨 DOM 도 존재하지 않는다(자동 bay 전면 제거).
  await expect(page.locator('[data-testid^="live-map-3d-bay-label-"]')).toHaveCount(0)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
