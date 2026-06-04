import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * Item 2 — live-map 2.5D 빌더 draft 캔버스 e2e (admin): 도구 클릭 시 도형이 캔버스에 즉시 추가·자동 선택되고
 * (= 핸들 부착), draft-only 선택 시 선택바는 Delete 만 노출(working 전용 z-order/Scale 은 숨김), Delete 로 제거,
 * Save as Object 가 추가한 도형을 shape_json 으로 직렬화한다.
 *
 * Konva 는 <canvas> 픽셀이라 draft 노드를 DOM 으로 쿼리할 수 없다 → draft/selected 카운터와 POST 페이로드로 검증.
 * console.error / pageerror 0 도 단언.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ', 'LIVE_MAP_LAYOUT_WRITE'],
}

const LINES = [
  { lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' },
  { lineKey: 2, lineCode: 'B_LINE', lineName: 'B Line' },
]

const LIVE_MAP = { equipmentItems: [] }

interface SavedObject {
  objectKey: number
  objectName: string
  objectKind: 'STRUCTURE' | 'EQUIPMENT'
  shapeJson: { v: number; root: { className: string; attrs: unknown; children: { className: string; attrs: unknown }[] } }
  isActive: boolean
}

interface MockState {
  objects: SavedObject[]
  objectSeq: number
}

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
  await page.route(/\/api\/live-map\/layout\/objects(\/\d+)?(\?.*)?$/, async (route, request) => {
    if (request.method() === 'POST') {
      const body = (request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')) as Omit<SavedObject, 'objectKey' | 'isActive'>
      state.objectSeq += 1
      const saved: SavedObject = { objectKey: state.objectSeq, ...body, isActive: true }
      state.objects.push(saved)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(saved)) })
      return
    }
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(apiSuccess(state.objects)),
      })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiNullSuccess()) })
  })
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify(apiSuccess({ layoutKey: null, lineKey: 1, canvasJson: null, placements: [], objects: state.objects })),
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

const newState = (): MockState => ({ objects: [], objectSeq: 0 })

test('admin: 도구 클릭 시 도형이 즉시 추가·자동선택되고 draft-only 선택바는 Delete 만 노출한다 (console/pageerror 0)', async ({
  page,
}) => {
  await setupMocks(page, newState())
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')

  // 전체 라인 스코프 없음 → 첫 라인 자동선택 → admin 빌더 툴바 노출.
  await expect(page.getByTestId('live-map-builder-toolbar')).toBeVisible()
  await expect(page.getByTestId('builder-draft-count')).toHaveText('0')

  // 사각형 도구 클릭 → 캔버스에 즉시 추가(draft 1) + 자동 선택(selected 1).
  await page.getByTestId('builder-add-rect').click()
  await expect(page.getByTestId('builder-draft-count')).toHaveText('1')
  await expect(page.getByTestId('builder-selected-count')).toHaveText('1')

  // draft-only 선택 → 선택바엔 Delete 만, working 전용(z-order/Scale) 버튼은 숨김.
  await expect(page.getByTestId('builder-selection-bar')).toBeVisible()
  await expect(page.getByTestId('selection-delete')).toBeVisible()
  await expect(page.getByTestId('selection-front')).toHaveCount(0)
  await expect(page.getByTestId('selection-scale-up')).toHaveCount(0)

  // 선 도구 추가 → draft 2, 새 도형만 선택(selected 1).
  await page.getByTestId('builder-add-line').click()
  await expect(page.getByTestId('builder-draft-count')).toHaveText('2')
  await expect(page.getByTestId('builder-selected-count')).toHaveText('1')

  // 선택된 draft 삭제 → draft 1.
  await page.getByTestId('selection-delete').click()
  await expect(page.getByTestId('builder-draft-count')).toHaveText('1')

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('admin: 추가한 draft 도형을 Save as Object 로 저장하면 POST shape_json 에 직렬화된다 (console/pageerror 0)', async ({
  page,
}) => {
  const state = newState()
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await expect(page.getByTestId('live-map-builder-toolbar')).toBeVisible()

  await page.getByTestId('builder-add-rect').click()
  await expect(page.getByTestId('builder-draft-count')).toHaveText('1')

  await page.getByTestId('builder-save-object').click()
  await page.getByTestId('object-name-input').fill('Pump-01')
  await page.getByTestId('object-save-confirm').click()

  // POST /objects 페이로드가 추가한 Rect 를 shape_json.root.children 에 담아 전송했다.
  await expect.poll(() => state.objects.length).toBe(1)
  const saved = state.objects[0]
  expect(saved.objectName).toBe('Pump-01')
  expect(saved.shapeJson.root.className).toBe('Group')
  expect(saved.shapeJson.root.children.map((child) => child.className)).toContain('Rect')

  // 저장 성공 시 draft 가 비워진다.
  await expect(page.getByTestId('builder-draft-count')).toHaveText('0')

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
