import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d — 설비 뱃지 드래그 (admin).
 *
 * 작은 줌에서 3D 메시를 직접 잡기 어렵고 뱃지가 그 위를 덮어, 설비는 상태 뱃지(큰 HTML 핸들)로 선택·이동한다.
 * 시드 바닥 위에 올린 설비를 뱃지로 끌면 바닥이 아니라 설비가 이동한다(과거 버그: 바닥이 끌림). 저장 시 PUT 에 새 좌표 반영. console/pageerror 0.
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

test('admin: 시드 바닥 위 설비를 뱃지로 끌면 설비가 이동한다(바닥 아님) (console/pageerror 0)', async ({ page }) => {
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

  // 바닥 시드(설비 밑에 바닥 = 버그 재현 조건) → 미배치 설비 77 추가.
  await page.getByTestId('live-map-3d-seed-structures').click()
  await page.getByTestId('live-map-3d-add-eqp-select').selectOption('77')
  await page.getByTestId('live-map-3d-add-eqp').click()
  const badge = page.getByTestId('live-map-3d-badge-77')
  await expect(badge).toBeVisible()
  await page.waitForTimeout(500)

  // 뱃지(드래그 핸들)를 잡고 끌기.
  const box = await badge.boundingBox()
  if (!box) throw new Error('badge box missing')
  const sx = box.x + box.width / 2
  const sy = box.y + box.height / 2
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx + 220, sy + 130, { steps: 14 })
  await page.mouse.up()

  await page.getByTestId('live-map-3d-save').click()
  await expect.poll(() => state.putCalls).toBe(1)
  const eqpPlacement = state.lastPlacements.find((placement) => placement.eqpKey === 77)
  expect(eqpPlacement, 'eqp 77 placement must exist').toBeTruthy()
  // 설비가 staging x(550)에서 벗어났다 = 바닥이 아니라 설비가 끌렸다.
  expect(eqpPlacement?.transformJson.x).not.toBe(550)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
