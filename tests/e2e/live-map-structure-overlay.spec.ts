import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * Phase B — live-map 뷰어 구조물 오버레이 e2e.
 *
 * admin 이 빌더로 저작·저장한 STRUCTURE placement(벽/기둥/통로 등)가 뷰어 board 뒤 배경 레이어로
 * read-only 렌더된다. WRITE 권한 없는 사용자(operator)도 구조물을 본다(저작 불가, 표시는 가능).
 * console.error / pageerror 0 도 단언.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

// WRITE 없음 — 구조물 표시는 권한 무관(저작만 admin).
const ME = {
  userPk: 200,
  userId: 'operator',
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ'],
}

const LINES = [
  { lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' },
  { lineKey: 2, lineCode: 'B_LINE', lineName: 'B Line' },
]

// 설비는 비워 상세 패널/통신로그 호출 없이 구조물 렌더에만 집중.
const LIVE_MAP = { equipmentItems: [] }

const STRUCTURE_OBJECT = {
  objectKey: 1,
  objectName: 'Wall A',
  objectKind: 'STRUCTURE' as const,
  shapeJson: {
    v: 1,
    root: {
      className: 'Group',
      attrs: {},
      children: [{ className: 'Rect', attrs: { x: 0, y: 0, width: 320, height: 40, fill: '#334155' } }],
    },
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

// 첫 라인(A_LINE) 자동선택 → lineKey 1 의 레이아웃에 STRUCTURE placement 1건.
const LAYOUT = {
  layoutKey: 100,
  lineKey: 1,
  canvasJson: null,
  placements: [{ placementKey: 1, objectKey: 1, eqpKey: null, transformJson: transform(120, 120) }],
  objects: [STRUCTURE_OBJECT],
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

test('operator: 저장된 STRUCTURE placement 가 뷰어 board 배경 레이어로 렌더된다 (console/pageerror 0)', async ({
  page,
}) => {
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')

  // 뷰어 board + 구조물 배경 레이어(Konva canvas) 노출.
  await expect(page.getByTestId('live-map-viewer-board')).toBeVisible()
  const structureLayer = page.getByTestId('live-map-structure-layer')
  await expect(structureLayer).toBeVisible()
  await expect(structureLayer.locator('canvas')).toHaveCount(1)

  // WRITE 없음 → 구조물 편집 토글/빌더 진입 불가(표시만 가능).
  await expect(page.getByTestId('live-map-mode-builder')).toHaveCount(0)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
