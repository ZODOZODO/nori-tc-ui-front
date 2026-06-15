import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d — 기본 구조 시드 (admin).
 *
 * 편집모드의 '기본 구조 채우기' 버튼이 일반 fab 룸(바닥/외벽/기둥/파티션)을 시작점으로 working 에 한 번에 깐다.
 * 모두 빌트인 음수 키 placement 라 저장 시 4종 STRUCTURE 객체(벽/파티션/바닥/기둥)를 각 1회 생성(POST /objects)하고
 * PUT /layout 의 placement objectKey 를 실 키로 치환한다. 빈-레이아웃 자동시드가 아니라 버튼 opt-in. CSRF + console/pageerror 0.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ', 'LIVE_MAP_LAYOUT_WRITE'],
}
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]
// 실설비 0 — 자동표시 설비 없이 구조물 시드만 다룬다.
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

test('admin: 기본 구조 채우기 → 시드 배치 후 저장하면 4종 STRUCTURE(벽/파티션/바닥/기둥)가 1회씩 생성된다 (console/pageerror 0)', async ({
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

  // 편집모드 → '기본 구조 채우기' → 빈 레이아웃에 시드 배치가 한 번에 깔린다(placement-count 증가).
  await page.getByTestId('live-map-3d-edit-toggle').click()
  await expect(page.getByTestId('live-map-3d-placement-count')).toHaveText('0')
  await page.getByTestId('live-map-3d-seed-structures').click()
  const placementCount = page.getByTestId('live-map-3d-placement-count')
  const seededCount = Number(await placementCount.textContent())
  expect(seededCount).toBeGreaterThan(0)

  // 같은 층 재시드 금지(층마다 1회) — 시드 후 버튼 비활성 + 카운트 불변.
  await expect(page.getByTestId('live-map-3d-seed-structures')).toBeDisabled()
  expect(Number(await placementCount.textContent())).toBe(seededCount)

  // 저장 → 빌트인 4종(벽/파티션/바닥/기둥)을 각 1회 STRUCTURE 로 생성 + PUT 에 시드 전량 반영(실 키로 치환).
  await page.getByTestId('live-map-3d-save').click()
  await expect.poll(() => state.postObjects.length).toBe(4)
  expect(state.postObjects.every((object) => object.objectKind === 'STRUCTURE')).toBe(true)
  expect(new Set(state.postObjects.map((object) => object.objectName))).toEqual(new Set(['벽', '파티션', '바닥', '기둥']))

  await expect.poll(() => state.putCalls).toBe(1)
  expect(state.lastPlacements).toHaveLength(seededCount)
  expect(state.lastPlacements.every((placement) => placement.eqpKey === null)).toBe(true)
  // 모든 placement 의 objectKey 는 실 STRUCTURE 키(양수)로 치환됐다(빌트인 음수 키 잔존 0).
  expect(state.lastPlacements.every((placement) => placement.objectKey > 0)).toBe(true)

  // 쓰기 요청 CSRF 헤더(403 회귀 가드).
  expect(state.postCsrf, 'POST /objects must carry X-XSRF-TOKEN').toBeTruthy()
  expect(state.putCsrf, 'PUT /layout must carry X-XSRF-TOKEN').toBeTruthy()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
