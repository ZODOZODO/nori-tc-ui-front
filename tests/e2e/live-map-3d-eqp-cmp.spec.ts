import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d — 저장된 설비 이동 후 재선택 회귀 (admin).
 *
 * 사용자 시나리오: 편집모드에서 이미 배치된 설비(CMP_001)를 선택→이동→다시 선택. 과거 버그: 설비를 옮기면 그 위치에
 * 컨트롤 패널/씬 경계 밖으로 뱃지가 가려져 "한 번 옮기면 재선택 불가". 수정:
 *   (1) 편집모드 뱃지 오버레이를 패널 위로(z-20) + overflow 비클립,
 *   (2) 뱃지 투영 좌표를 씬 안으로 clamp(가장자리 이동 시 씬 밖 이탈 방지).
 * 검증: 작은 뷰포트(패널 비중↑)에서 각 방향(우/상/좌/하)으로 옮긴 뒤, 뱃지 중심의 최상단 요소가 항상 그 뱃지여야 한다.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })
const ME = { userPk: 100, userId: 'admin', permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ', 'LIVE_MAP_LAYOUT_WRITE'] }
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]
const EQP_KEY = 501
const liveEqp = {
  eqpKey: EQP_KEY, eqpId: 'CMP_001', eqpName: 'CMP 001', lineValue: 'A_LINE', lineLabel: 'A Line',
  clusterId: 'c1', clusterName: 'C1', equipmentModeLabel: 'Auto', status: 'RUN' as const, statusLabel: 'Run',
  portItems: [{ id: 'p1', label: 'P1', status: 'RUN', statusLabel: 'Run' }], tooltipMeta: '', tooltipStep: '', alertMessage: null,
}
const LIVE_MAP = { equipmentItems: [liveEqp] }
const EQUIP_OBJECT = { objectKey: 10, objectName: '설비', objectKind: 'EQUIPMENT', shapeJson: { v: 2, prims: [] }, isActive: true }
const SAVED_LAYOUT = {
  layoutKey: 100, lineKey: 1, canvasJson: null,
  placements: [{ placementKey: 1, objectKey: 10, eqpKey: EQP_KEY, transformJson: { x: 1100, y: 700, rotation: 0, floor: 1 } }],
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
    if (request.method() === 'PUT') {
      const body = (request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')) as { canvasJson: unknown; placements: unknown[] }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess({ layoutKey: 100, lineKey: 1, canvasJson: body.canvasJson, placements: body.placements, objects: [EQUIP_OBJECT] })) }); return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess(SAVED_LAYOUT)) })
  })
  await page.route(/.*\/api\/live-map(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LIVE_MAP)) }))
  await page.route(/.*\/api\/(eqp|model)(\/.*)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })) }))
  await page.route(/.*\/api\/comm-logs(\/.*)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) }))
}

const attachConsoleGuards = (page: Page) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (m: ConsoleMessage) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push(e.message))
  return { consoleErrors, pageErrors }
}

const badgeCenter = async (page: Page) => {
  const b = await page.getByTestId(`live-map-3d-badge-${EQP_KEY}`).boundingBox()
  if (!b) throw new Error('badge box missing')
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}
const topTestidAt = (page: Page, x: number, y: number) =>
  page.evaluate(([px, py]) => {
    let cur = document.elementFromPoint(px, py) as HTMLElement | null
    while (cur) { const t = cur.getAttribute('data-testid'); if (t) return t; cur = cur.parentElement }
    return cur?.tagName ?? 'null'
  }, [x, y])

const enterEditAndSelect = async (page: Page) => {
  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-A_LINE').click()
  await page.getByTestId('live-map-mode-3d').click()
  await expect(page.getByTestId('live-map-3d-scene')).toBeVisible()
  await page.getByTestId('live-map-3d-edit-toggle').click()
  await expect(page.getByTestId(`live-map-3d-badge-${EQP_KEY}`)).toBeVisible()
  await page.waitForTimeout(600)
  const c = await badgeCenter(page)
  await page.mouse.click(c.x, c.y)
  await page.waitForTimeout(200)
}

// 한 방향으로 옮긴 뒤, 뱃지 중심 최상단 요소가 그 뱃지인지(= 재선택/재드래그 가능).
const moveAndAssertReselectable = async (page: Page, dx: number, dy: number) => {
  await enterEditAndSelect(page)
  const c = await badgeCenter(page)
  await page.mouse.move(c.x, c.y)
  await page.mouse.down()
  await page.mouse.move(c.x + dx, c.y + dy, { steps: 16 })
  await page.mouse.up()
  await page.waitForTimeout(350)
  const c2 = await badgeCenter(page)
  const top = await topTestidAt(page, c2.x, c2.y)
  expect(top, `(${dx},${dy}) 이동 후 뱃지 최상단이어야 재선택 가능 — 실제 top=${top}`).toBe(`live-map-3d-badge-${EQP_KEY}`)
}

test('admin: 저장된 설비를 어느 방향으로 옮겨도 뱃지가 안 가려진다(재선택 가능) (console/pageerror 0)', async ({ page }) => {
  test.setTimeout(180_000)
  // 작은 뷰포트 — 컨트롤 패널이 차지하는 비중이 커 가려짐 회귀가 잘 드러난다.
  await page.setViewportSize({ width: 1280, height: 800 })
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await moveAndAssertReselectable(page, 300, 0) // 우(과거 상세 패널 영역)
  await moveAndAssertReselectable(page, -120, -180) // 상단(추가 패널 영역)
  await moveAndAssertReselectable(page, -200, -320) // 상단 극단(씬 경계 밖 투영 → clamp)
  await moveAndAssertReselectable(page, -350, 0) // 좌
  await moveAndAssertReselectable(page, 0, 220) // 하

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
