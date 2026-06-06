import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d — 실설비 자동 표시 (admin).
 *
 * 실제 환경(저장 layout 0 / 객체 라이브러리 0)에서도 선택 라인의 실설비(equipmentItems)를 캐비닛으로 자동 표시한다.
 * admin 이 자동 표시 설비를 편집(회전)하면 working 으로 승격되고, 저장 시 object_key NOT NULL FK 를 위해
 * 백킹 EQUIPMENT 객체를 1회 자동 생성(POST /objects) 후 PUT /layout 에 반영. console/pageerror 0.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ', 'LIVE_MAP_LAYOUT_WRITE'],
}
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]

const eqp = (eqpKey: number, name: string, status: 'RUN' | 'IDLE' | 'ERROR' | 'DOWN') => ({
  eqpKey, eqpId: `EQP-${eqpKey}`, eqpName: name, lineValue: 'A_LINE', lineLabel: 'A Line',
  clusterId: 'c1', clusterName: 'C1', equipmentModeLabel: 'Auto', status, statusLabel: status,
  portItems: [{ id: 'p1', label: 'P1', status: 'RUN', statusLabel: 'Run' }], tooltipMeta: '', tooltipStep: '', alertMessage: null,
})
// 실설비는 있으나(2D 뷰어가 쓰는 데이터원), 저장 layout/객체 라이브러리는 비어 있음 = 사용자의 실제 상황.
const LIVE_MAP = { equipmentItems: [eqp(77, 'Etcher B1', 'RUN'), eqp(78, 'Etcher B2', 'IDLE')] }
const EMPTY_LAYOUT = { layoutKey: null, lineKey: 1, canvasJson: null, placements: [], objects: [] }
const CREATED_OBJECT = { objectKey: 9, objectName: '기본 설비', objectKind: 'EQUIPMENT' as const, shapeJson: { v: 2, prims: [] }, isActive: true }

interface PutPlacement {
  objectKey: number
  eqpKey: number | null
  transformJson: { x: number; y: number; rotation: number }
}
interface MockState {
  postObjectCalls: number
  putCalls: number
  lastPlacements: PutPlacement[]
  postCsrf: string | undefined
  putCsrf: string | undefined
}
const newState = (): MockState => ({ postObjectCalls: 0, putCalls: 0, lastPlacements: [], postCsrf: undefined, putCsrf: undefined })

const setupMocks = async (page: Page, state: MockState) => {
  await page.route('**/api/auth/csrf', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(apiNullSuccess()) }))
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ME)) }))
  await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiNullSuccess()) }))
  await page.route('**/api/line', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LINES)) }))
  await page.route(/\/api\/live-map\/layout\/objects(\/\d+)?(\?.*)?$/, async (route, request) => {
    if (request.method() === 'POST') {
      state.postObjectCalls += 1
      state.postCsrf = request.headers()['x-xsrf-token']
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(CREATED_OBJECT)) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) })
  })
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route, request) => {
    if (request.method() === 'PUT') {
      const body = (request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')) as { canvasJson: unknown; placements: PutPlacement[] }
      state.putCalls += 1
      state.putCsrf = request.headers()['x-xsrf-token']
      state.lastPlacements = body.placements
      const saved = { layoutKey: 100, lineKey: 1, canvasJson: body.canvasJson, placements: body.placements.map((placement, index) => ({ placementKey: index + 1, ...placement })), objects: [CREATED_OBJECT] }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess(saved)) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess(EMPTY_LAYOUT)) })
  })
  await page.route(/.*\/api\/live-map(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LIVE_MAP)) }))
  await page.route(/.*\/api\/(eqp|model|comm-logs)(\/.*)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })) }))
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

test('admin: 저장 placement 0 이어도 라인 실설비가 캐비닛으로 자동 표시되고, 편집→저장 시 백킹 객체를 자동 생성한다 (console/pageerror 0)', async ({
  page,
}) => {
  // r3f(three/drei) dev 첫 컴파일 + WebGL 초기화 여유.
  test.setTimeout(90_000)
  const state = newState()
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-A_LINE').click()
  await page.getByTestId('live-map-mode-3d').click()
  await expect(page.getByTestId('live-map-3d-scene')).toBeVisible()

  // 저장 0 인데도 실설비 2대가 자동 표시 — 상태 뱃지로 확인.
  await expect(page.getByTestId('live-map-3d-badge-77')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-badge-78')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-visible-count')).toHaveText('2')
  await expect(page.getByTestId('live-map-3d-placement-count')).toHaveText('0')

  // 편집모드 → 자동 표시 설비(77) 선택 → 회전(승격) → 저장.
  await page.getByTestId('live-map-3d-edit-toggle').click()
  await page.getByTestId('live-map-3d-badge-77').click()
  await expect(page.getByTestId('live-map-3d-selected')).toBeVisible()
  await page.getByTestId('live-map-3d-rotate-cw').click()
  await expect(page.getByTestId('live-map-3d-placement-count')).toHaveText('1')

  await page.getByTestId('live-map-3d-save').click()

  // 백킹 EQUIPMENT 객체 1회 생성 + PUT /layout 에 그 objectKey 로 1건 반영.
  await expect.poll(() => state.postObjectCalls).toBe(1)
  await expect.poll(() => state.putCalls).toBe(1)
  expect(state.lastPlacements).toHaveLength(1)
  expect(state.lastPlacements[0].objectKey).toBe(9)
  expect(state.lastPlacements[0].eqpKey).toBe(77)
  expect(state.lastPlacements[0].transformJson.rotation).toBe(15)
  expect(state.lastPlacements[0].transformJson.x).toBeGreaterThan(0)
  expect(state.lastPlacements[0].transformJson.y).toBeGreaterThan(0)

  // 회귀: 쓰기 요청에 CSRF 헤더(X-XSRF-TOKEN)가 실려야 한다 — 누락 시 서버 403(이번 버그).
  expect(state.postCsrf, 'POST /objects must carry X-XSRF-TOKEN').toBeTruthy()
  expect(state.putCsrf, 'PUT /layout must carry X-XSRF-TOKEN').toBeTruthy()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
