import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d — 빌트인(기성) 구조물 벽/파티션 (admin).
 *
 * 저장 객체 라이브러리가 비어 있어도 뷰어 추가 드롭다운에 빌트인 벽/파티션이 항상 뜬다(음수 키). 배치 후 저장 시
 * object_key NOT NULL FK 를 위해 같은 이름의 STRUCTURE 객체를 1회 지연 생성(POST /objects)하고, PUT /layout 의
 * placement objectKey 를 그 실 객체 키로 치환한다. 쓰기 요청엔 CSRF 헤더. console/pageerror 0.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ', 'LIVE_MAP_LAYOUT_WRITE'],
}
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]
// 실설비 0 — 자동표시 설비 없이 빌트인 구조물만 다룬다.
const LIVE_MAP = { equipmentItems: [] }
const EMPTY_LAYOUT = { layoutKey: null, lineKey: 1, canvasJson: null, placements: [], objects: [] }

interface PostObjectBody {
  objectName: string
  objectKind: string
  shapeJson: { v: number; prims?: { type: string }[] }
}
interface PutPlacement {
  objectKey: number
  eqpKey: number | null
  transformJson: { x: number; y: number; rotation: number }
}
interface MockState {
  postObjects: PostObjectBody[]
  seq: number
  putCalls: number
  lastPlacements: PutPlacement[]
  postCsrf: string | undefined
  putCsrf: string | undefined
}
const newState = (): MockState => ({ postObjects: [], seq: 0, putCalls: 0, lastPlacements: [], postCsrf: undefined, putCsrf: undefined })

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

test('admin: 빈 라이브러리에서도 빌트인 벽을 뷰어에 추가→저장하면 STRUCTURE 객체가 1회 생성되고 PUT 에 그 키로 반영된다 (console/pageerror 0)', async ({
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

  // 편집모드 → 추가 드롭다운에서 빌트인 벽(objectKey -1) 선택 → 추가 → placement 1.
  await page.getByTestId('live-map-3d-edit-toggle').click()
  await page.getByTestId('live-map-3d-add-select').selectOption('-1')
  await page.getByTestId('live-map-3d-add').click()
  await expect(page.getByTestId('live-map-3d-placement-count')).toHaveText('1')
  await expect(page.getByTestId('live-map-3d-selected')).toBeVisible()

  // 저장 → 백킹 STRUCTURE '벽' 1회 생성 + PUT placement objectKey 가 그 실 키로 치환.
  await page.getByTestId('live-map-3d-save').click()
  await expect.poll(() => state.postObjects.length).toBe(1)
  expect(state.postObjects[0].objectKind).toBe('STRUCTURE')
  expect(state.postObjects[0].objectName).toBe('벽')
  expect(state.postObjects[0].shapeJson.prims?.[0]?.type).toBe('box')

  await expect.poll(() => state.putCalls).toBe(1)
  expect(state.lastPlacements).toHaveLength(1)
  expect(state.lastPlacements[0].objectKey).toBe(1)
  expect(state.lastPlacements[0].eqpKey).toBeNull()

  // 쓰기 요청 CSRF 헤더(403 회귀 가드).
  expect(state.postCsrf, 'POST /objects must carry X-XSRF-TOKEN').toBeTruthy()
  expect(state.putCsrf, 'PUT /layout must carry X-XSRF-TOKEN').toBeTruthy()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
