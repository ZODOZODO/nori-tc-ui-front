import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * AC10 — live-map 2.5D 빌더 저작 UX e2e (admin): 팔레트 검색 / 드래그 배치 / 다중선택 + 배율(scale) +
 * z-order / Image primitive 렌더.
 *
 * 캔버스 인터랙션 결과(scale/zIndex)는 레이아웃 저장(PUT) 페이로드로 검증한다. console.error / pageerror 0 도 단언.
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

// 첫 Rect 로컬 (24,24,96x48) → 화면 중심 ≈ (292,208) (배치 원점 220,160 기준). object-reuse 좌표 컨벤션 답습.
const structureShape = (label: string) => ({
  v: 1,
  root: {
    className: 'Group',
    attrs: { name: label },
    children: [{ className: 'Rect', attrs: { x: 24, y: 24, width: 96, height: 48, fill: '#2563eb' } }],
  },
})

const ALPHA = { objectKey: 1, objectName: 'Alpha Pump', objectKind: 'STRUCTURE' as const, shapeJson: structureShape('alpha'), isActive: true }
const BETA = { objectKey: 2, objectName: 'Beta Tank', objectKind: 'STRUCTURE' as const, shapeJson: structureShape('beta'), isActive: true }

interface MockState {
  objects: typeof ALPHA[]
  placements: { placementKey: number; objectKey: number; eqpKey: number | null; transformJson: { scaleX: number; zIndex: number } }[]
  canvasJson: unknown
  placementSeq: number
  layoutPutCalls: number
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
      const body = (request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')) as {
        objectName: string
        objectKind: 'STRUCTURE' | 'EQUIPMENT'
        shapeJson: unknown
      }
      state.objectSeq += 1
      const saved = { objectKey: state.objectSeq, objectName: body.objectName, objectKind: body.objectKind, shapeJson: body.shapeJson, isActive: true }
      state.objects.push(saved as typeof ALPHA)
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
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route, request) => {
    if (request.method() === 'PUT') {
      const body = (request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')) as {
        canvasJson: unknown
        placements: { objectKey: number; eqpKey: number | null; transformJson: { scaleX: number; zIndex: number } }[]
      }
      state.layoutPutCalls += 1
      state.canvasJson = body.canvasJson
      state.placements = body.placements.map((placement) => {
        state.placementSeq += 1
        return { placementKey: state.placementSeq, ...placement }
      })
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify(
        apiSuccess({
          layoutKey: state.placements.length > 0 ? 500 : null,
          lineKey: 2,
          canvasJson: state.canvasJson,
          placements: state.placements,
          objects: state.objects,
        }),
      ),
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

const newState = (): MockState => ({
  objects: [ALPHA, BETA],
  placements: [],
  canvasJson: null,
  placementSeq: 0,
  layoutPutCalls: 0,
  objectSeq: 2,
})

// 뷰어가 기본 뷰이므로 B 라인 선택 후 "구조물 편집" 토글로 빌더 모드에 진입한다.
const selectBLine = async (page: Page) => {
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-B_LINE').click()
  await page.getByTestId('live-map-mode-builder').click()
}

test('admin: 팔레트 검색이 객체 목록을 이름으로 필터한다 (console/pageerror 0)', async ({ page }) => {
  await setupMocks(page, newState())
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await selectBLine(page)

  await expect(page.getByTestId('palette-place-1')).toBeVisible()
  await expect(page.getByTestId('palette-place-2')).toBeVisible()

  await page.getByTestId('palette-search').fill('alpha')
  await expect(page.getByTestId('palette-place-1')).toBeVisible()
  await expect(page.getByTestId('palette-place-2')).toHaveCount(0)

  await page.getByTestId('palette-search').fill('')
  await expect(page.getByTestId('palette-place-2')).toBeVisible()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('admin: 팔레트 드래그-드롭으로 캔버스에 배치한다 (console/pageerror 0)', async ({ page }) => {
  await setupMocks(page, newState())
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await selectBLine(page)
  await expect(page.getByTestId('palette-item-1')).toBeVisible()

  const dataTransfer = await page.evaluateHandle(() => new DataTransfer())
  await page.getByTestId('palette-item-1').dispatchEvent('dragstart', { dataTransfer })
  await page.getByTestId('live-map-builder-canvas').dispatchEvent('drop', { dataTransfer })

  await expect(page.getByTestId('builder-placement-count')).toHaveText('1')

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('admin: 다중선택 + 배율 + z-order 가 PUT 페이로드에 반영된다 (console/pageerror 0)', async ({ page }) => {
  const state = newState()
  test.setTimeout(90_000)
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await selectBLine(page)

  // 배치 1(원점 220,160). 우클릭 복사 → 배치 2(248,188) — 좌표가 겹치지 않아 개별 선택 가능.
  await page.getByTestId('palette-place-1').click()
  await expect(page.getByTestId('builder-placement-count')).toHaveText('1')

  const canvas = page.locator('[data-testid="live-map-builder-canvas"] canvas').first()
  // 캔버스가 board 좌표(1350×710)를 컨테이너 폭에 fit-to-width 스케일하므로, board 좌표 클릭 위치를 같은 배율로 환산한다.
  const scale = (await canvas.boundingBox())!.width / 1350
  await canvas.click({ button: 'right', position: { x: 292 * scale, y: 208 * scale } })
  await page.getByTestId('context-copy').click()
  await expect(page.getByTestId('builder-placement-count')).toHaveText('2')

  // 다중선택: 배치1(292,208) 클릭 → shift+배치2(320,236).
  await canvas.click({ position: { x: 292 * scale, y: 208 * scale } })
  await expect(page.getByTestId('builder-selected-count')).toHaveText('1')
  await canvas.click({ position: { x: 320 * scale, y: 236 * scale }, modifiers: ['Shift'] })
  await expect(page.getByTestId('builder-selected-count')).toHaveText('2')

  // 배율 + 맨 앞으로.
  await page.getByTestId('selection-scale-up').click()
  await page.getByTestId('selection-front').click()

  await page.getByTestId('builder-save-layout').click()
  await expect.poll(() => state.layoutPutCalls).toBe(1)
  expect(state.placements).toHaveLength(2)
  // 두 배치 모두 scale 적용(scaleX > 1) + z-order 상향(zIndex >= 2; 초기 0,1 → front 후 maxZ+offset).
  for (const placement of state.placements) {
    expect(placement.transformJson.scaleX).toBeGreaterThan(1)
    expect(placement.transformJson.zIndex).toBeGreaterThanOrEqual(2)
  }

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('admin: Image primitive 를 추가·저장·배치하면 캔버스에 렌더된다 (console/pageerror 0)', async ({ page }) => {
  const state = newState()
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await selectBLine(page)

  // Image primitive(기본 data URI src) 추가 → 합성 객체 저장.
  await page.getByTestId('builder-add-image').click()
  await expect(page.getByTestId('builder-draft-count')).toHaveText('1')
  await page.getByTestId('builder-save-object').click()
  await page.getByTestId('object-name-input').fill('Image Object')
  await page.getByTestId('object-save-confirm').click()
  await expect(page.getByTestId('palette-place-3')).toBeVisible()

  // 배치 → Image primitive 가 PrimitiveImage 로 렌더(콘솔 오류 없이).
  await page.getByTestId('palette-place-3').click()
  await expect(page.getByTestId('builder-placement-count')).toHaveText('1')

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
