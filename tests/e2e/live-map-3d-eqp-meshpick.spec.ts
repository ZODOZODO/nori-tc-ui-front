import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d — 캔버스 3D 메시 선택/드래그 후 재선택 회귀 (admin).
 *
 * 사용자 실제 경로: HTML 뱃지가 아니라 캔버스의 3D 설비 메시를 클릭해 선택/이동한다. 과거 버그: 설비를 한 번 끌면
 * InstancedMesh.boundingSphere 가 stale 이라(three.js 는 1회만 계산·캐시) 옮긴 설비의 새 위치 raycast 가 early-out →
 * 다시 못 집는다. 수정: 인스턴스 행렬 갱신 후 boundingSphere=null 로 무효화 + 드래그를 포인터캡처 대신 window 리스너로
 * 처리(r3f 이벤트 시스템 비간섭). 검증: 설비를 멀리 끈 뒤 그 새 위치 메시를 클릭하면 다시 선택된다.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })
const ME = { userPk: 100, userId: 'admin', permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ', 'LIVE_MAP_LAYOUT_WRITE'] }
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]
const EQUIP_OBJECT = { objectKey: 10, objectName: '설비', objectKind: 'EQUIPMENT', shapeJson: { v: 2, prims: [] }, isActive: true }
const EQ = [
  { key: 501, x: 1100, y: 700 },
  { key: 502, x: 1500, y: 500 },
  { key: 503, x: 700, y: 950 },
]
const liveItems = EQ.map((e) => ({
  eqpKey: e.key, eqpId: `CMP_${e.key - 500}`, eqpName: `CMP ${e.key - 500}`, lineValue: 'A_LINE', lineLabel: 'A Line',
  clusterId: 'c1', clusterName: 'C1', equipmentModeLabel: 'Auto', status: 'RUN' as const, statusLabel: 'Run',
  portItems: [{ id: 'p1', label: 'P1', status: 'RUN', statusLabel: 'Run' }], tooltipMeta: '', tooltipStep: '', alertMessage: null,
}))
const LIVE_MAP = { equipmentItems: liveItems }
const SAVED_LAYOUT = {
  layoutKey: 100, lineKey: 1, canvasJson: null,
  placements: EQ.map((e, i) => ({ placementKey: i + 1, objectKey: 10, eqpKey: e.key, transformJson: { x: e.x, y: e.y, rotation: 0, floor: 1 } })),
  objects: [EQUIP_OBJECT],
}

const setupMocks = async (page: Page) => {
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(apiNullSuccess()) }))
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ME)) }))
  await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiNullSuccess()) }))
  await page.route('**/api/line', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LINES)) }))
  await page.route(/\/api\/live-map\/layout\/objects(\/\d+)?(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([EQUIP_OBJECT])) })
  })
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route, request) => {
    if (request.method() === 'PUT') { await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess({ ...SAVED_LAYOUT })) }); return }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess(SAVED_LAYOUT)) })
  })
  await page.route(/.*\/api\/live-map(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LIVE_MAP)) }))
  await page.route(/.*\/api\/(eqp|model)(\/.*)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })) }))
  await page.route(/.*\/api\/comm-logs(\/.*)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) }))
}

// 설비 메시는 뱃지보다 화면상 아래. 여러 오프셋을 시도해 그 설비가 선택되면(선택 패널의 eqp-select 값 = 그 eqpKey) 성공.
const pickMesh = async (page: Page, key: number): Promise<boolean> => {
  for (const off of [40, 55, 28, 68, 16]) {
    const b = await page.getByTestId(`live-map-3d-badge-${key}`).boundingBox()
    if (!b) throw new Error(`badge ${key} gone`)
    const x = b.x + b.width / 2
    const y = b.y + b.height / 2 + off
    await page.mouse.click(x, y)
    await page.waitForTimeout(250)
    const val = await page.getByTestId('live-map-3d-eqp-select').inputValue().catch(() => null)
    if (val === String(key)) return true
  }
  return false
}

test('admin: 캔버스 메시를 멀리 끈 뒤 새 위치에서 다시 선택된다 (console/pageerror 0)', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1680, height: 1020 })
  await setupMocks(page)
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (m: ConsoleMessage) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push(e.message))

  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-A_LINE').click()
  await page.getByTestId('live-map-mode-3d').click()
  await expect(page.getByTestId('live-map-3d-scene')).toBeVisible()
  await page.getByTestId('live-map-3d-edit-toggle').click()
  await expect(page.getByTestId('live-map-3d-badge-501')).toBeVisible()
  await page.waitForTimeout(800)

  // 1) 501 메시 선택
  expect(await pickMesh(page, 501), '첫 메시 선택이 돼야 함').toBe(true)

  // 2) 501 을 멀리 드래그(원래 boundingSphere 밖으로) — 캔버스에서 끈다.
  const b = await page.getByTestId('live-map-3d-badge-501').boundingBox()
  if (!b) throw new Error('501 badge gone')
  const sx = b.x + b.width / 2
  const sy = b.y + b.height / 2 + 40
  await page.mouse.move(sx, sy)
  await page.mouse.down()
  await page.mouse.move(sx - 260, sy + 150, { steps: 20 })
  await page.mouse.up()
  await page.waitForTimeout(400)

  // 3) 502 선택(501 에서 선택 옮김)
  expect(await pickMesh(page, 502), '다른 설비 선택이 돼야 함').toBe(true)

  // 4) 멀리 옮긴 501 을 새 위치에서 다시 선택 — boundingSphere 무효화 안 하면 여기서 실패(stale sphere).
  const reselected = await pickMesh(page, 501)
  expect(reselected, '멀리 옮긴 설비를 새 위치에서 다시 선택할 수 있어야 함(boundingSphere 회귀)').toBe(true)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
