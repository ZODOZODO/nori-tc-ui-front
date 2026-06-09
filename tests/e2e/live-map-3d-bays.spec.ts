import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d — 공정 bay 레이아웃 (admin/viewer).
 *
 * 자동 표시 설비는 평면 그리드가 아니라 공정(cluster)별 bay 로 묶여 배치되고, bay 마다 공정명 라벨(DOM 오버레이)이 뜬다.
 * 라벨은 층 필터를 따른다(그 층 bay 만). 좌표는 BayLabelProjector 가 갱신. console/pageerror 0.
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
// photo→1F, cmp→2F, wet→1F (2개 층). 같은 공정 2대(photo)는 한 bay 에 묶인다.
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

test('공정별 bay 라벨이 뜨고, 층 필터를 따른다 (console/pageerror 0)', async ({ page }) => {
  // r3f(three/drei) dev 첫 컴파일 + WebGL 초기화 여유.
  test.setTimeout(90_000)
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-A_LINE').click()
  await page.getByTestId('live-map-mode-3d').click()
  await expect(page.getByTestId('live-map-3d-scene')).toBeVisible()

  // 전체 보기 — 공정 3종 = bay 라벨 3개(photo/cmp/wet). photo 2대여도 라벨은 bay 1개.
  await expect(page.getByTestId('live-map-3d-bay-label-photo')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-bay-label-cmp')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-bay-label-wet')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-bay-label-photo')).toHaveText('PHOTO')

  // 1F → photo·wet bay, cmp 숨김.
  await page.getByTestId('live-map-3d-floor-1').click()
  await expect(page.getByTestId('live-map-3d-bay-label-photo')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-bay-label-wet')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-bay-label-cmp')).toHaveCount(0)

  // 2F → cmp bay 만.
  await page.getByTestId('live-map-3d-floor-2').click()
  await expect(page.getByTestId('live-map-3d-bay-label-cmp')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-bay-label-photo')).toHaveCount(0)
  await expect(page.getByTestId('live-map-3d-bay-label-wet')).toHaveCount(0)

  // 전체 → 다시 3개.
  await page.getByTestId('live-map-3d-floor-all').click()
  await expect(page.getByTestId('live-map-3d-bay-label-photo')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-bay-label-cmp')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-bay-label-wet')).toBeVisible()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
