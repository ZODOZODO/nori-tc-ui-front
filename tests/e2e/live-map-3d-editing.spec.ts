import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d Phase 3 — 뷰어 3D 씬 admin 배치 편집 (admin).
 *
 * 편집모드에서 라이브러리 객체를 추가(자동 선택) → 회전 → 설비 객체(템플릿) 교체 → 저장 시 PUT /layout
 * 페이로드에 반영. (바닥 드래그는 캔버스 상호작용이라 별도; 여기선 오버레이 액션 + PUT 검증.) console/pageerror 0.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ', 'LIVE_MAP_LAYOUT_WRITE'],
}
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]
const LIVE_MAP = { equipmentItems: [] }

const box = (color: string) => ({
  v: 2,
  prims: [{ id: 'b', type: 'box', size: { x: 2, y: 2, z: 2 }, position: { x: 0, y: 1, z: 0 }, rotationY: 0, color }],
})
const OBJECTS = [
  { objectKey: 1, objectName: 'Etcher A', objectKind: 'EQUIPMENT' as const, shapeJson: box('#9aa7b8'), isActive: true },
  { objectKey: 2, objectName: 'Wall', objectKind: 'STRUCTURE' as const, shapeJson: box('#334155'), isActive: true },
  { objectKey: 3, objectName: 'Etcher B', objectKind: 'EQUIPMENT' as const, shapeJson: box('#6b7a8f'), isActive: true },
]
const EMPTY_LAYOUT = { layoutKey: null, lineKey: 1, canvasJson: null, placements: [], objects: OBJECTS }

interface PutPlacement {
  objectKey: number
  eqpKey: number | null
  transformJson: { x: number; y: number; rotation: number }
}
interface MockState {
  putCalls: number
  lastPlacements: PutPlacement[]
}
const newState = (): MockState => ({ putCalls: 0, lastPlacements: [] })

const setupMocks = async (page: Page, state: MockState) => {
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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(OBJECTS)) })
  })
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route, request) => {
    if (request.method() === 'PUT') {
      const body = (request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')) as {
        canvasJson: unknown
        placements: PutPlacement[]
      }
      state.putCalls += 1
      state.lastPlacements = body.placements
      const saved = {
        layoutKey: 100,
        lineKey: 1,
        canvasJson: body.canvasJson,
        placements: body.placements.map((placement, index) => ({ placementKey: index + 1, ...placement })),
        objects: OBJECTS,
      }
      await route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess(saved)) })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify(apiSuccess(EMPTY_LAYOUT)),
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

test('admin: 3D 편집모드에서 객체 추가 → 회전 → 템플릿 교체 → 저장이 PUT /layout 에 반영된다 (console/pageerror 0)', async ({
  page,
}) => {
  // r3f(three/drei) dev 첫 컴파일 + WebGL 초기화가 무거워 병렬 실행 시 기본 30s 초과 → 여유 부여.
  test.setTimeout(90_000)
  const state = newState()
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-A_LINE').click()
  await page.getByTestId('live-map-mode-3d').click()
  await expect(page.getByTestId('live-map-3d-scene')).toBeVisible()

  // 편집모드 진입.
  await page.getByTestId('live-map-3d-edit-toggle').click()

  // 라이브러리에서 Etcher A(EQUIPMENT, key 1) 추가 → 자동 선택 + placement 1.
  await page.getByTestId('live-map-3d-add-select').selectOption('1')
  await page.getByTestId('live-map-3d-add').click()
  await expect(page.getByTestId('live-map-3d-placement-count')).toHaveText('1')
  await expect(page.getByTestId('live-map-3d-selected')).toBeVisible()

  // 회전 +15° (1회).
  await page.getByTestId('live-map-3d-rotate-cw').click()

  // 설비 객체 교체: Etcher A(1) → Etcher B(3) (같은 EQUIPMENT).
  await page.getByTestId('live-map-3d-assign-select').selectOption('3')

  // 저장 → PUT /layout.
  await page.getByTestId('live-map-3d-save').click()
  await expect.poll(() => state.putCalls).toBe(1)
  expect(state.lastPlacements).toHaveLength(1)
  expect(state.lastPlacements[0].objectKey).toBe(3)
  expect(state.lastPlacements[0].eqpKey).toBeNull()
  expect(state.lastPlacements[0].transformJson.rotation).toBe(15)
  expect(state.lastPlacements[0].transformJson.x).toBe(675)
  expect(state.lastPlacements[0].transformJson.y).toBe(355)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
