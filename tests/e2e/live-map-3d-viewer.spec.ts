import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d Phase 1 — 3D 등각 뷰어 씬 e2e (admin).
 *
 * admin 이 "3D" 모드로 전환하면 react-three-fiber 씬이 layout 의 v2(3D) 객체(EQUIPMENT/STRUCTURE)를
 * <canvas> 로 렌더한다. v1(Konva) 객체는 3D 에선 무시. console.error / pageerror 0 단언.
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

// v2(3D) 객체 — 기본 도형(box) 조합.
const EQUIP_OBJECT = {
  objectKey: 1,
  objectName: 'Etcher 3D',
  objectKind: 'EQUIPMENT' as const,
  shapeJson: {
    v: 2,
    prims: [{ id: 'body', type: 'box', size: { x: 2, y: 2, z: 2 }, position: { x: 0, y: 1, z: 0 }, rotationY: 0, color: '#9aa7b8' }],
  },
  isActive: true,
}
const WALL_OBJECT = {
  objectKey: 2,
  objectName: 'Wall 3D',
  objectKind: 'STRUCTURE' as const,
  shapeJson: {
    v: 2,
    prims: [{ id: 'w', type: 'box', size: { x: 6, y: 1.5, z: 0.3 }, position: { x: 0, y: 0.75, z: 0 }, rotationY: 0, color: '#334155' }],
  },
  isActive: true,
}

const transform = (x: number, y: number) => ({
  v: 1,
  x,
  y,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  skewX: 0,
  skewY: 0,
  zIndex: 0,
  depth: 0,
})

const LAYOUT = {
  layoutKey: 100,
  lineKey: 1,
  canvasJson: null,
  placements: [
    { placementKey: 1, objectKey: 1, eqpKey: null, transformJson: transform(700, 360) },
    { placementKey: 2, objectKey: 2, eqpKey: null, transformJson: transform(500, 300) },
  ],
  objects: [EQUIP_OBJECT, WALL_OBJECT],
}

const setupMocks = async (page: Page) => {
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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([EQUIP_OBJECT, WALL_OBJECT])) })
  })
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify(apiSuccess(LAYOUT)),
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

test('admin: 3D 모드가 layout 의 v2 객체를 react-three-fiber <canvas> 로 렌더한다 (console/pageerror 0)', async ({
  page,
}) => {
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')

  // 라인 스코프 선택 → lineKey 로 layout 조회.
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-A_LINE').click()

  // "3D" 모드 토글(admin) → r3f 씬.
  await page.getByTestId('live-map-mode-3d').click()
  const scene = page.getByTestId('live-map-3d-scene')
  await expect(scene).toBeVisible()
  await expect(scene.locator('canvas')).toHaveCount(1)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
