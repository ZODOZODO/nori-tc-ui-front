import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d Phase 4 — 뷰어 상태 뱃지 + 선택 설비 상세(R5) (admin).
 *
 * 실설비(eqpKey)에 바인딩된 배치는 3D 씬 위에 실시간 상태 뱃지(HTML)를 띄우고, 뱃지 클릭 시 상세 패널
 * (상태/포트)을 연다. console.error / pageerror 0 단언.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ', 'LIVE_MAP_LAYOUT_WRITE'],
}
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]

const EQUIPMENT = {
  eqpKey: 77,
  eqpId: 'EQP-77',
  eqpName: 'Etcher B1',
  lineValue: 'A_LINE',
  lineLabel: 'A Line',
  clusterId: 'c1',
  clusterName: 'C1',
  equipmentModeLabel: 'Auto',
  status: 'RUN',
  statusLabel: 'Run',
  portItems: [{ id: 'p1', label: 'P1', status: 'RUN', statusLabel: 'Run' }],
  tooltipMeta: '',
  tooltipStep: '',
  alertMessage: null,
}
const LIVE_MAP = { equipmentItems: [EQUIPMENT] }

const EQUIP_OBJECT = {
  objectKey: 1,
  objectName: 'Etcher 3D',
  objectKind: 'EQUIPMENT' as const,
  shapeJson: {
    v: 2,
    prims: [{ id: 'b', type: 'box', size: { x: 2, y: 2, z: 2 }, position: { x: 0, y: 1, z: 0 }, rotationY: 0, color: '#9aa7b8' }],
  },
  isActive: true,
}
const transform = (x: number, y: number) => ({ v: 1, x, y, rotation: 0, scaleX: 1, scaleY: 1, skewX: 0, skewY: 0, zIndex: 0, depth: 0 })
const LAYOUT = {
  layoutKey: 100,
  lineKey: 1,
  canvasJson: null,
  placements: [{ placementKey: 1, objectKey: 1, eqpKey: 77, transformJson: transform(700, 360) }],
  objects: [EQUIP_OBJECT],
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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([EQUIP_OBJECT])) })
  })
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify(apiSuccess(LAYOUT)),
    })
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
  // comm-logs 는 배열 응답(CommLogEntry[]) — generic 뒤 등록(후순위 우선)으로 viewer 상세의 통신로그 크래시 방지.
  await page.route(/.*\/api\/comm-logs(\/.*)?(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) })
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

test('admin: 바인딩된 설비의 상태 뱃지 → 클릭 시 선택 설비 상세(상태/포트)를 연다 (console/pageerror 0)', async ({
  page,
}) => {
  // r3f(three/drei) dev 첫 컴파일 + WebGL 초기화 여유.
  test.setTimeout(90_000)
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-A_LINE').click()
  await page.getByTestId('live-map-mode-3d').click()
  await expect(page.getByTestId('live-map-3d-scene')).toBeVisible()

  // 바인딩된 설비(eqpKey 77) 상태 뱃지 노출 → 클릭 → 상세 패널.
  const badge = page.getByTestId('live-map-3d-badge-77')
  await expect(badge).toBeVisible()
  await expect(badge).toContainText('EQP-77')
  await badge.click()

  // 뷰어와 동일한 상세 카드(LiveMapTooltipCard) — eqpId/상태/포트 + line/wafer mode 등 풍부한 정보.
  const detail = page.getByTestId('live-map-3d-detail')
  await expect(detail).toBeVisible()
  await expect(detail.getByTestId('live-map-detail-panel')).toBeVisible()
  await expect(detail).toContainText('EQP-77')
  await expect(detail).toContainText('Run')
  await expect(detail).toContainText('P1')
  await expect(detail).toContainText('A Line')
  await expect(detail).toContainText('Auto')

  // 닫기(카드 헤더 X).
  await detail.getByRole('button').first().click()
  await expect(detail).toHaveCount(0)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
