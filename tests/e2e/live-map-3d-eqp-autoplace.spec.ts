import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d — gateway_app 기준 층 자동 배치 (admin).
 *
 * 요구: 미배치 설비를 한 번에 배치하되, gateway_app1 설비는 1층, gateway_app2 설비는 2층으로. live-map 설비 응답엔
 * routePartition 이 없어 eqp 목록(routePartition) + shard lease 를 따로 받아 gateway_app 을 산출한다(eqpKey 조인).
 * 검증: 자동 배치 후 1층 뷰엔 gateway_app1 설비 뱃지만, 2층 뷰엔 gateway_app2 설비 뱃지만 렌더된다.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })
const ME = { userPk: 100, userId: 'admin', permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ', 'LIVE_MAP_LAYOUT_WRITE'] }
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]
const EQUIP_OBJECT = { objectKey: 10, objectName: '설비', objectKind: 'EQUIPMENT', shapeJson: { v: 2, prims: [] }, isActive: true }

// gateway_app1 = ownedPartitions [0,1,2] → 501/502/503(1층), gateway_app2 = [3,4,5] → 504/505(2층).
const SHARD_LEASES = [
  { groupId: 'group-1', ownedPartitions: [0, 1, 2], ownerInstanceId: 'gw-1' },
  { groupId: 'group-2', ownedPartitions: [3, 4, 5], ownerInstanceId: 'gw-2' },
]
const GW1_KEYS = [501, 502, 503]
const GW2_KEYS = [504, 505]
const EQ = [
  { key: 501, partition: 0 },
  { key: 502, partition: 1 },
  { key: 503, partition: 2 },
  { key: 504, partition: 3 },
  { key: 505, partition: 4 },
]
const eqpInfos = EQ.map((e) => ({
  eqpKey: e.key, eqpId: `CMP_${e.key - 500}`, lineKey: 1, commInterface: 'SECS', commMode: 'ACTIVE', isDev: false,
  routePartition: e.partition, eqpIp: '10.0.0.1', eqpPort: 5000, modelVersionKey: 1, enabled: true,
  createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', createdBy: 'admin', updatedBy: 'admin',
}))
const liveItems = EQ.map((e) => ({
  eqpKey: e.key, eqpId: `CMP_${e.key - 500}`, eqpName: `CMP ${e.key - 500}`, lineValue: 'A_LINE', lineLabel: 'A Line',
  clusterId: 'c1', clusterName: 'C1', equipmentModeLabel: 'Auto', status: 'RUN' as const, statusLabel: 'Run',
  portItems: [{ id: 'p1', label: 'P1', status: 'RUN', statusLabel: 'Run' }], tooltipMeta: '', tooltipStep: '', alertMessage: null,
}))
const LIVE_MAP = { equipmentItems: liveItems }
// 시작 레이아웃 — 설비 5대가 "이미 1층에 배치+저장"된 상태(사용자 실제 상황). 자동 배치는 이걸 gateway_app 기준
// 층·라인으로 "재배치"해야 한다(504/505 → 2층). 구조물은 검증에 불필요해 비운다.
const SAVED_LAYOUT = {
  layoutKey: 100, lineKey: 1, canvasJson: null,
  placements: EQ.map((e, i) => ({ placementKey: i + 1, objectKey: 10, eqpKey: e.key, transformJson: { x: 700 + (i % 6) * 200, y: 700, rotation: 0, floor: 1 } })),
  objects: [EQUIP_OBJECT],
}

const setupMocks = async (page: Page) => {
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(apiNullSuccess()) }))
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ME)) }))
  await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiNullSuccess()) }))
  await page.route('**/api/line', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LINES)) }))
  await page.route(/\/api\/live-map\/layout\/objects(\/\d+)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([EQUIP_OBJECT])) }))
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route, request) => {
    if (request.method() === 'PUT') { await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess({ ...SAVED_LAYOUT })) }); return }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess(SAVED_LAYOUT)) })
  })
  await page.route(/.*\/api\/live-map(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LIVE_MAP)) }))
  await page.route(/.*\/api\/model(\/.*)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })) }))
  await page.route(/.*\/api\/comm-logs(\/.*)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) }))
  // shard lease — gateway_app 산출 기준. /api/eqp 일반 패턴보다 먼저 매칭되도록 더 구체적인 경로를 나중에 등록(LIFO).
  await page.route(/.*\/api\/eqp\/gateway-shard-leases(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(SHARD_LEASES)) }))
  // eqp 목록 — routePartition 포함. 자동 배치가 eqpKey 로 live-map 설비와 조인한다.
  await page.route(/.*\/api\/eqp(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: eqpInfos, offset: 0, limit: 500, count: eqpInfos.length })) }))
}

const enterEdit = async (page: Page) => {
  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-A_LINE').click()
  await page.getByTestId('live-map-mode-3d').click()
  await expect(page.getByTestId('live-map-3d-scene')).toBeVisible()
  await page.getByTestId('live-map-3d-edit-toggle').click()
}

const badgeCount = (page: Page, key: number) => page.getByTestId(`live-map-3d-badge-${key}`).count()

test('admin: gateway_app 자동 배치 — gateway_app1→1층, gateway_app2→2층 (console/pageerror 0)', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1680, height: 1020 })
  await setupMocks(page)
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (m: ConsoleMessage) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
  page.on('pageerror', (e) => pageErrors.push(e.message))

  await enterEdit(page)

  // 시작: 5대 모두 1층에 이미 배치됨 → 2층 뷰엔 아무 설비도 없다(재배치 전 상태 확인).
  await page.getByTestId('live-map-3d-floor-2').click()
  await page.waitForTimeout(300)
  for (const key of [...GW1_KEYS, ...GW2_KEYS]) {
    expect(await badgeCount(page, key), `재배치 전 2층엔 설비 ${key} 없음(전부 1층)`).toBe(0)
  }
  await page.getByTestId('live-map-3d-floor-all').click()
  await page.waitForTimeout(200)

  // 이미 배치+저장된 상태에서도 자동 배치 버튼은 활성(재배치 가능) — 미배치 0 이어도 비활성 아님.
  const autoPlace = page.getByTestId('live-map-3d-auto-place')
  await expect(autoPlace).toBeEnabled()
  await autoPlace.click()
  await page.waitForTimeout(400)

  // 재배치이므로 개수는 그대로 5(중복 추가 아님 — 추가였다면 10).
  await expect(page.getByTestId('live-map-3d-placement-count')).toHaveText('5')

  // 1층 뷰 — gateway_app1(501/502/503) 뱃지만, gateway_app2(504/505) 없음.
  await page.getByTestId('live-map-3d-floor-1').click()
  await page.waitForTimeout(300)
  for (const key of GW1_KEYS) {
    expect(await badgeCount(page, key), `1층에 gateway_app1 설비 ${key} 뱃지`).toBe(1)
  }
  for (const key of GW2_KEYS) {
    expect(await badgeCount(page, key), `1층에 gateway_app2 설비 ${key} 뱃지 없음`).toBe(0)
  }

  // 2층 뷰 — gateway_app2(504/505) 뱃지만, gateway_app1(501/502/503) 없음.
  await page.getByTestId('live-map-3d-floor-2').click()
  await page.waitForTimeout(300)
  for (const key of GW2_KEYS) {
    expect(await badgeCount(page, key), `2층에 gateway_app2 설비 ${key} 뱃지`).toBe(1)
  }
  for (const key of GW1_KEYS) {
    expect(await badgeCount(page, key), `2층에 gateway_app1 설비 ${key} 뱃지 없음`).toBe(0)
  }

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
