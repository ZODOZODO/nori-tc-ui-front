import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d — 설비 뱃지 연속 드래그 회귀 (admin).
 *
 * 뱃지 버튼(재렌더되는 React 노드) 대신 안정 노드(canvas)에 포인터 캡처를 걸어 Canvas 드래그 리스너로 처리한다.
 * 과거 버그: 뱃지 버튼 자체에 캡처를 걸어 첫 이동 뒤 노드 재조정으로 lostpointercapture → "한 번만 움직이고 멈춤".
 * 두 번 연속 끌면 두 번 다 이동해야 한다(두 번째도 캡처가 유지된다). console/pageerror 0.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })
const ME = { userPk: 100, userId: 'admin', permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ', 'LIVE_MAP_LAYOUT_WRITE'] }
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]
const eqp = (eqpKey: number, name: string) => ({
  eqpKey, eqpId: `EQP-${eqpKey}`, eqpName: name, lineValue: 'A_LINE', lineLabel: 'A Line',
  clusterId: 'c1', clusterName: 'C1', equipmentModeLabel: 'Auto', status: 'RUN' as const, statusLabel: 'Run',
  portItems: [{ id: 'p1', label: 'P1', status: 'RUN', statusLabel: 'Run' }], tooltipMeta: '', tooltipStep: '', alertMessage: null,
})
const LIVE_MAP = { equipmentItems: [eqp(77, 'Etcher B1')] }
const EMPTY_LAYOUT = { layoutKey: null, lineKey: 1, canvasJson: null, placements: [], objects: [] }

interface PutPlacement { objectKey: number; eqpKey: number | null; transformJson: { x: number; y: number; rotation: number; floor: number } }
interface MockState { putCalls: number; lastPlacements: PutPlacement[]; seq: number }
const newState = (): MockState => ({ putCalls: 0, lastPlacements: [], seq: 0 })

const setupMocks = async (page: Page, state: MockState) => {
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(apiNullSuccess()) }))
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ME)) }))
  await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiNullSuccess()) }))
  await page.route('**/api/line', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LINES)) }))
  await page.route(/\/api\/live-map\/layout\/objects(\/\d+)?(\?.*)?$/, async (route, request) => {
    if (request.method() === 'POST') { state.seq += 1; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ objectKey: state.seq, objectName: 'x', objectKind: 'STRUCTURE', shapeJson: { v: 2, prims: [] }, isActive: true })) }); return }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) })
  })
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route, request) => {
    if (request.method() === 'PUT') {
      const body = (request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')) as { canvasJson: unknown; placements: PutPlacement[] }
      state.putCalls += 1; state.lastPlacements = body.placements
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess({ layoutKey: 100, lineKey: 1, canvasJson: body.canvasJson, placements: body.placements, objects: [] })) }); return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess(EMPTY_LAYOUT)) })
  })
  await page.route(/.*\/api\/live-map(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LIVE_MAP)) }))
  await page.route(/.*\/api\/(eqp|model)(\/.*)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })) }))
  await page.route(/.*\/api\/comm-logs(\/.*)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) }))
}

const attachConsoleGuards = (page: Page) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message: ConsoleMessage) => { if (message.type() === 'error') consoleErrors.push(message.text()) })
  page.on('pageerror', (error) => pageErrors.push(error.message))
  return { consoleErrors, pageErrors }
}

const dragBadgeBy = async (page: Page, dx: number, dy: number) => {
  const badge = page.getByTestId('live-map-3d-badge-77')
  const box = await badge.boundingBox()
  if (!box) throw new Error('badge box missing')
  const sx = box.x + box.width / 2
  const sy = box.y + box.height / 2
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + dx, sy + dy, { steps: 14 })
  await page.mouse.up()
  return { sx, sy }
}

test('admin: 뱃지를 두 번 연속 끌면 두 번 다 이동한다(캡처가 유지된다)', async ({ page }) => {
  test.setTimeout(90_000)
  await page.setViewportSize({ width: 1680, height: 1020 })
  const state = newState()
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-A_LINE').click()
  await page.getByTestId('live-map-mode-3d').click()
  await expect(page.getByTestId('live-map-3d-scene')).toBeVisible()
  await page.getByTestId('live-map-3d-edit-toggle').click()

  await page.getByTestId('live-map-3d-seed-structures').click()
  await page.getByTestId('live-map-3d-add-eqp-select').selectOption('77')
  await page.getByTestId('live-map-3d-add-eqp').click()
  await expect(page.getByTestId('live-map-3d-badge-77')).toBeVisible()
  await page.waitForTimeout(500)

  // 1차 드래그 — 왼쪽 위로(패널 회피).
  const first = await dragBadgeBy(page, -180, -120)
  await page.waitForTimeout(300)
  const afterFirst = await page.getByTestId('live-map-3d-badge-77').boundingBox()
  if (!afterFirst) throw new Error('badge gone after first drag')
  const firstCenter = { x: afterFirst.x + afterFirst.width / 2, y: afterFirst.y + afterFirst.height / 2 }
  console.log(`[REDRAG] start=(${first.sx.toFixed(0)},${first.sy.toFixed(0)}) afterFirst=(${firstCenter.x.toFixed(0)},${firstCenter.y.toFixed(0)})`)

  // 2차 드래그 — 현재 위치에서 다시.
  await dragBadgeBy(page, -150, 0)
  await page.waitForTimeout(300)
  const afterSecond = await page.getByTestId('live-map-3d-badge-77').boundingBox()
  if (!afterSecond) throw new Error('badge gone after second drag')
  const secondCenter = { x: afterSecond.x + afterSecond.width / 2, y: afterSecond.y + afterSecond.height / 2 }
  console.log(`[REDRAG] afterSecond=(${secondCenter.x.toFixed(0)},${secondCenter.y.toFixed(0)})`)

  // 2차 드래그가 실제로 움직였는지 — 화면상 뱃지가 1차 후 위치에서 또 이동해야 한다.
  const movedAgain = Math.abs(secondCenter.x - firstCenter.x) > 20 || Math.abs(secondCenter.y - firstCenter.y) > 20
  console.log(`[REDRAG] movedAgain=${movedAgain}`)
  expect(movedAgain, '2차 드래그도 이동해야 함(버그면 false)').toBe(true)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
