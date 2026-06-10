import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d — 편집 고급: 다중 선택 그룹 조작(③) + 키보드 미세 이동(②) + 층 배치(④) (admin).
 *
 * ③ Shift+클릭으로 여러 설비 선택 → 그룹 회전 + 층 이동이 PUT 전체에 반영.
 * ② 화살표 키로 선택 배치 미세 이동(NUDGE 8px).
 * ④ 전역 층 버튼으로 새 추가의 기본 층 지정 → transformJson.floor 영속.
 * 쓰기 요청 CSRF 헤더. console/pageerror 0.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ', 'LIVE_MAP_LAYOUT_WRITE'],
}
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]

const eqp = (eqpKey: number, name: string, status: 'RUN' | 'IDLE') => ({
  eqpKey, eqpId: `EQP-${eqpKey}`, eqpName: name, lineValue: 'A_LINE', lineLabel: 'A Line',
  clusterId: 'c1', clusterName: 'C1', equipmentModeLabel: 'Auto', status, statusLabel: status,
  portItems: [], tooltipMeta: '', tooltipStep: '', alertMessage: null,
})
const EMPTY_LAYOUT = { layoutKey: null, lineKey: 1, canvasJson: null, placements: [], objects: [] }

interface PostObjectBody {
  objectName: string
  objectKind: string
  shapeJson: { v: number; prims?: { type: string }[] }
}
interface PutPlacement {
  objectKey: number
  eqpKey: number | null
  transformJson: { x: number; y: number; rotation: number; floor: number }
}
interface MockState {
  liveMap: { equipmentItems: ReturnType<typeof eqp>[] }
  postObjects: PostObjectBody[]
  seq: number
  putCalls: number
  lastPlacements: PutPlacement[]
  postCsrf: string | undefined
  putCsrf: string | undefined
}
const newState = (liveMap: MockState['liveMap']): MockState => ({
  liveMap, postObjects: [], seq: 0, putCalls: 0, lastPlacements: [], postCsrf: undefined, putCsrf: undefined,
})

const setupMocks = async (page: Page, state: MockState) => {
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(apiNullSuccess()) }))
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ME)) }))
  await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiNullSuccess()) }))
  await page.route('**/api/line', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LINES)) }))
  await page.route(/\/api\/live-map\/layout\/objects(\/\d+)?(\?.*)?$/, async (route, request) => {
    if (request.method() === 'POST') {
      const body = (request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')) as PostObjectBody
      state.seq += 1
      state.postObjects.push(body)
      state.postCsrf = request.headers()['x-xsrf-token']
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ objectKey: state.seq, ...body, isActive: true })) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess([])) })
  })
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route, request) => {
    if (request.method() === 'PUT') {
      const body = (request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')) as { canvasJson: unknown; placements: PutPlacement[] }
      state.putCalls += 1
      state.putCsrf = request.headers()['x-xsrf-token']
      state.lastPlacements = body.placements
      const saved = { layoutKey: 100, lineKey: 1, canvasJson: body.canvasJson, placements: body.placements.map((placement, index) => ({ placementKey: index + 1, ...placement })), objects: [] }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess(saved)) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess(EMPTY_LAYOUT)) })
  })
  await page.route(/.*\/api\/live-map(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(state.liveMap)) }))
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

test('admin: Shift+클릭 다중 선택 → 그룹 회전 + 층 이동이 PUT 전체에 반영된다 (console/pageerror 0)', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const state = newState({ equipmentItems: [eqp(77, 'Etcher B1', 'RUN'), eqp(78, 'Etcher B2', 'IDLE')] })
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-A_LINE').click()
  await page.getByTestId('live-map-mode-3d').click()
  await expect(page.getByTestId('live-map-3d-scene')).toBeVisible()
  await page.getByTestId('live-map-3d-edit-toggle').click()

  // ③ 단일 클릭 → Shift+클릭으로 두 번째 추가 = 2개 선택. (e2e 기본 locale = en → en 라벨 단언)
  await page.getByTestId('live-map-3d-badge-77').click()
  await page.getByTestId('live-map-3d-badge-78').click({ modifiers: ['Shift'] })
  await expect(page.getByTestId('live-map-3d-selected-count')).toHaveText('+1 more')

  // 그룹 회전 → 둘 다 승격(placement 2) + rotation 15.
  await page.getByTestId('live-map-3d-rotate-cw').click()
  await expect(page.getByTestId('live-map-3d-placement-count')).toHaveText('2')

  // ④ 선택 패널에서 2층으로 이동 → 둘 다 floor 2.
  await page.getByTestId('live-map-3d-set-floor-2').click()

  await page.getByTestId('live-map-3d-save').click()
  await expect.poll(() => state.putCalls).toBe(1)
  expect(state.lastPlacements).toHaveLength(2)
  const byEqp = new Map(state.lastPlacements.map((placement) => [placement.eqpKey, placement]))
  // 77 = c1 index0(bay 좌 열, base 90°), 78 = index1(우 열, base 270°) → 그룹 CW 회전 +15.
  expect(byEqp.get(77)?.transformJson.rotation).toBe(105)
  expect(byEqp.get(78)?.transformJson.rotation).toBe(285)
  for (const placement of state.lastPlacements) {
    expect(placement.transformJson.floor).toBe(2)
  }
  expect(new Set(state.lastPlacements.map((placement) => placement.eqpKey))).toEqual(new Set([77, 78]))
  // 자동 설비 백킹 EQUIPMENT 객체는 1회만 생성.
  expect(state.postObjects).toHaveLength(1)
  expect(state.postObjects[0].objectKind).toBe('EQUIPMENT')

  expect(state.putCsrf, 'PUT /layout must carry X-XSRF-TOKEN').toBeTruthy()
  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('admin: 2층 활성 + 빌트인 벽 추가 → 화살표로 미세 이동 후 저장이 floor=2, x=699 로 반영된다 (console/pageerror 0)', async ({
  page,
}) => {
  test.setTimeout(90_000)
  const state = newState({ equipmentItems: [] })
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-A_LINE').click()
  await page.getByTestId('live-map-mode-3d').click()
  await expect(page.getByTestId('live-map-3d-scene')).toBeVisible()
  await page.getByTestId('live-map-3d-edit-toggle').click()

  // ④ 전역 2층 활성 → 새 추가 기본 층 2.
  await page.getByTestId('live-map-3d-floor-2').click()

  // 빌트인 벽 추가(x=675 기본) → 자동 선택.
  await page.getByTestId('live-map-3d-add-select').selectOption('-1')
  await page.getByTestId('live-map-3d-add').click()
  await expect(page.getByTestId('live-map-3d-placement-count')).toHaveText('1')
  await expect(page.getByTestId('live-map-3d-selected')).toBeVisible()

  // ② 화살표 오른쪽 3회 = +24px (NUDGE 8 × 3).
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')
  await page.keyboard.press('ArrowRight')

  await page.getByTestId('live-map-3d-save').click()
  await expect.poll(() => state.putCalls).toBe(1)
  expect(state.lastPlacements).toHaveLength(1)
  expect(state.lastPlacements[0].transformJson.x).toBe(699)
  expect(state.lastPlacements[0].transformJson.floor).toBe(2)
  expect(state.lastPlacements[0].eqpKey).toBeNull()
  // 빌트인 구조물 백킹 STRUCTURE 객체 1회 생성.
  expect(state.postObjects).toHaveLength(1)
  expect(state.postObjects[0].objectKind).toBe('STRUCTURE')
  expect(state.postObjects[0].objectName).toBe('벽')

  expect(state.postCsrf, 'POST /objects must carry X-XSRF-TOKEN').toBeTruthy()
  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
