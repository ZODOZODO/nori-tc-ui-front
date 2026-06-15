import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * AC8 — live-map 비-admin(읽기 전용) 권한 e2e.
 *
 * LIVE_MAP_LAYOUT_WRITE 가 없고 LIVE_MAP_LAYOUT_READ 만 있는 사용자는:
 * - 테마형 뷰어(board) + "3D" 등각 뷰어를 읽기 전용으로 본다(구조물/배치 GET 로드).
 * - "구조물 편집(builder)" 토글, 3D 씬의 편집 토글/저장 버튼, 빌더 저작 UI 에는 진입할 수 없다.
 * console.error / pageerror 0 도 단언.
 */

const apiSuccess = <TData>(data: TData) => ({
  success: true,
  data,
  errorCode: null,
  errorMsg: null,
})

const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

// WRITE 권한 없음 — 조회 권한(LAYOUT_READ)만 보유.
const ME = {
  userPk: 200,
  userId: 'operator',
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ'],
}

const LINES = [
  { lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' },
  { lineKey: 2, lineCode: 'B_LINE', lineName: 'B Line' },
]

const LIVE_MAP = { equipmentItems: [] }

// v2(3D) 구조물 객체 — 읽기 전용 사용자도 GET /live-map/layout 으로 받아 3D 에 렌더된다.
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

// 읽기 전용 사용자도 구조물 배치를 본다는 것을 실증하기 위해 placement + object 를 채운다.
const LAYOUT = {
  layoutKey: 200,
  lineKey: 2,
  canvasJson: null,
  placements: [{ placementKey: 1, objectKey: 2, eqpKey: null, transformJson: transform(500, 300) }],
  objects: [WALL_OBJECT],
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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) })
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

test('읽기 전용: 뷰어 + 3D 토글은 보이되 구조물 편집(빌더) 토글은 없다 (console/pageerror 0)', async ({ page }) => {
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-B_LINE').click()

  // LAYOUT_READ 보유 → 뷰어/3D 토글 노출. WRITE 없음 → "구조물 편집(builder)" 토글 + 빌더 저작 UI 미렌더.
  await expect(page.getByTestId('live-map-viewer-board')).toBeVisible()
  await expect(page.getByTestId('live-map-mode-viewer')).toHaveCount(1)
  await expect(page.getByTestId('live-map-mode-3d')).toHaveCount(1)
  await expect(page.getByTestId('live-map-mode-builder')).toHaveCount(0)
  await expect(page.getByTestId('live-map-builder-toolbar')).toHaveCount(0)
  await expect(page.getByTestId('live-map-builder-palette')).toHaveCount(0)
  await expect(page.getByTestId('builder-add-rect')).toHaveCount(0)
  await expect(page.getByTestId('builder-save-object')).toHaveCount(0)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('읽기 전용: 3D 씬을 읽기 전용으로 렌더하고 편집 토글/저장은 없다 (console/pageerror 0)', async ({ page }) => {
  // r3f(three/drei) dev 첫 컴파일 + WebGL 초기화가 무거워 병렬 실행 시 기본 30s 초과 → 여유 부여.
  test.setTimeout(90_000)
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-B_LINE').click()

  // "3D" 모드 진입(WRITE 없이) → r3f 씬이 layout 의 구조물 배치를 <canvas> 로 렌더.
  await page.getByTestId('live-map-mode-3d').click()
  const scene = page.getByTestId('live-map-3d-scene')
  await expect(scene).toBeVisible()
  await expect(scene.locator('canvas')).toHaveCount(1)

  // 층 뷰는 읽기 전용에서도 노출. 편집 토글/저장은 WRITE 전용이라 렌더되지 않는다.
  await expect(page.getByTestId('live-map-3d-floors')).toBeVisible()
  await expect(page.getByTestId('live-map-3d-edit-toggle')).toHaveCount(0)
  await expect(page.getByTestId('live-map-3d-save')).toHaveCount(0)
  await expect(page.getByTestId('live-map-3d-add-select')).toHaveCount(0)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
