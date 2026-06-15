import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d — 층 뷰 필터(④) (admin/viewer).
 *
 * 배치(placement)는 자체 transform.floor 를 가진다. 좌측 1F/2F 버튼은 그 층 배치만, 전체는 모두 보여준다.
 * (공정→층 자동 배치는 제거 — 자동 표시 설비는 1층 중립 그리드, 층은 사용자가 직접 지정한다.) console/pageerror 0.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ', 'LIVE_MAP_LAYOUT_WRITE'],
}
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]

const eqp = (eqpKey: number, name: string) => ({
  eqpKey, eqpId: `EQP-${eqpKey}`, eqpName: name, lineValue: 'A_LINE', lineLabel: 'A Line',
  clusterId: 'c1', clusterName: 'C1', equipmentModeLabel: 'Auto', status: 'RUN' as const, statusLabel: 'Run',
  portItems: [], tooltipMeta: '', tooltipStep: '', alertMessage: null,
})
const LIVE_MAP = { equipmentItems: [eqp(77, 'A1'), eqp(88, 'A2'), eqp(99, 'A3')] }

const EQUIP_OBJECT = { objectKey: 1, objectName: '기본 설비', objectKind: 'EQUIPMENT' as const, shapeJson: { v: 2, prims: [] }, isActive: true }
const transform = (x: number, y: number, floor: number) => ({ v: 1, x, y, rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, zIndex: 0, depth: 0, floor })
// 저장된 배치 — 77/99 는 1F, 88 은 2F. 자동 표시가 아니라 사용자가 층을 지정한 placement.
const LAYOUT = {
  layoutKey: 100,
  lineKey: 1,
  canvasJson: null,
  placements: [
    { placementKey: 1, objectKey: 1, eqpKey: 77, transformJson: transform(400, 355, 1) },
    { placementKey: 2, objectKey: 1, eqpKey: 88, transformJson: transform(520, 355, 2) },
    { placementKey: 3, objectKey: 1, eqpKey: 99, transformJson: transform(640, 355, 1) },
  ],
  objects: [EQUIP_OBJECT],
}

const setupMocks = async (page: Page) => {
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(apiNullSuccess()) }))
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ME)) }))
  await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiNullSuccess()) }))
  await page.route('**/api/line', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LINES)) }))
  await page.route(/\/api\/live-map\/layout\/objects(\/\d+)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([EQUIP_OBJECT])) }))
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess(LAYOUT)) }))
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

test('admin: 층 버튼이 그 층 배치만 / 전체가 모두 보여준다 (console/pageerror 0)', async ({
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

  // 1F → 77·99, 88 숨김.
  await page.getByTestId('live-map-3d-floor-1').click()
  await expect(page.getByTestId('live-map-3d-badge-77')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-badge-99')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-badge-88')).toHaveCount(0)

  // 2F → 88만, 77/99 숨김.
  await page.getByTestId('live-map-3d-floor-2').click()
  await expect(page.getByTestId('live-map-3d-badge-88')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-badge-77')).toHaveCount(0)
  await expect(page.getByTestId('live-map-3d-badge-99')).toHaveCount(0)

  // 전체 → 다시 3대 모두.
  await page.getByTestId('live-map-3d-floor-all').click()
  await expect(page.getByTestId('live-map-3d-badge-77')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-badge-88')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-badge-99')).toBeVisible()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
