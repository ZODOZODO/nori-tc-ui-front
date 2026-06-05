import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d Phase 2 — 구조물 편집 = 객체 라이브러리 CRUD (admin).
 *
 * "구조물 편집" 모드가 객체 에디터(폼/파라미터 도형 컴포저 + 3D 미리보기)로, 도형(box/cylinder/plane)을
 * 조합해 shape_json v2 객체를 생성(POST)·수정(PUT)·삭제(DELETE)한다. console.error / pageerror 0 단언.
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
const EMPTY_LAYOUT = { layoutKey: null, lineKey: 1, canvasJson: null, placements: [], objects: [] }

interface SavedObject {
  objectKey: number
  objectName: string
  objectKind: 'STRUCTURE' | 'EQUIPMENT'
  shapeJson: { v: number; prims?: { type: string }[] }
  isActive: boolean
}
interface MockState {
  objects: SavedObject[]
  seq: number
  posts: SavedObject[]
  puts: { objectKey: number; objectName: string }[]
  deletes: number[]
}
const newState = (): MockState => ({ objects: [], seq: 0, posts: [], puts: [], deletes: [] })

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
  // 객체 CRUD — 단일 라우트에서 method 분기.
  await page.route(/\/api\/live-map\/layout\/objects(\/\d+)?(\?.*)?$/, async (route, request) => {
    const method = request.method()
    const keyMatch = request.url().match(/\/objects\/(\d+)/)
    if (method === 'POST') {
      const body = (request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')) as Omit<SavedObject, 'objectKey' | 'isActive'>
      state.seq += 1
      const saved: SavedObject = { objectKey: state.seq, ...body, isActive: true }
      state.objects.push(saved)
      state.posts.push(saved)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(saved)) })
      return
    }
    if (method === 'PUT' && keyMatch) {
      const objectKey = Number(keyMatch[1])
      const body = (request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')) as Omit<SavedObject, 'objectKey' | 'isActive'>
      state.objects = state.objects.map((object) => (object.objectKey === objectKey ? { ...object, ...body } : object))
      state.puts.push({ objectKey, objectName: body.objectName })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ objectKey, ...body, isActive: true })) })
      return
    }
    if (method === 'DELETE' && keyMatch) {
      const objectKey = Number(keyMatch[1])
      state.objects = state.objects.filter((object) => object.objectKey !== objectKey)
      state.deletes.push(objectKey)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiNullSuccess()) })
      return
    }
    // GET
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify(apiSuccess(state.objects)),
    })
  })
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route) => {
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

test('admin: 구조물 편집에서 도형 조합 객체를 생성·수정·삭제한다 (console/pageerror 0)', async ({ page }) => {
  // r3f(three/drei) dev 첫 컴파일 + 3D 미리보기 WebGL 초기화 여유.
  test.setTimeout(90_000)
  const state = newState()
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await page.getByTestId('live-map-mode-builder').click()
  await expect(page.getByTestId('live-map-object-editor')).toBeVisible()

  // 도형(box) 추가 → shapes 1.
  await page.getByTestId('object-editor-add-box').click()
  await expect(page.getByTestId('object-editor-prim-count')).toHaveText('1')

  // 이름 입력 후 저장 → POST shape_json v2.
  await page.getByTestId('object-editor-name').fill('Pump 3D')
  await page.getByTestId('object-editor-save').click()

  await expect.poll(() => state.posts.length).toBe(1)
  expect(state.posts[0].objectName).toBe('Pump 3D')
  expect(state.posts[0].objectKind).toBe('EQUIPMENT')
  expect(state.posts[0].shapeJson.v).toBe(2)
  expect(state.posts[0].shapeJson.prims?.[0]?.type).toBe('box')

  // 리스트에 등록 + 저장 후 draft 초기화.
  await expect(page.getByTestId('object-list-item-1')).toBeVisible()
  await expect(page.getByTestId('object-editor-prim-count')).toHaveText('0')

  // 수정: 로드 → 이름 변경 → Update → PUT /objects/1.
  await page.getByTestId('object-list-item-1').click()
  await expect(page.getByTestId('object-editor-name')).toHaveValue('Pump 3D')
  await expect(page.getByTestId('object-editor-prim-count')).toHaveText('1')
  await page.getByTestId('object-editor-name').fill('Pump 3D v2')
  await page.getByTestId('object-editor-save').click()
  await expect.poll(() => state.puts.length).toBe(1)
  expect(state.puts[0]).toEqual({ objectKey: 1, objectName: 'Pump 3D v2' })

  // 삭제: DELETE /objects/1 + 리스트에서 제거.
  await page.getByTestId('object-list-delete-1').click()
  await expect.poll(() => state.deletes).toEqual([1])
  await expect(page.getByTestId('object-list-item-1')).toHaveCount(0)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
