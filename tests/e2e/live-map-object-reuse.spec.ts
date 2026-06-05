import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * AC7 — live-map 2.5D 빌더 객체 재사용 + 영속 e2e (admin).
 *
 * admin 이 primitive 여러 개 → 합성 객체 저장(POST) → 팔레트 신규 배치 → 우클릭 복사 →
 * 레이아웃 저장(PUT) → 새로고침 후 배치 영속(GET) 을 검증한다. console.error / pageerror 0 도 단언.
 */

const apiSuccess = <TData>(data: TData) => ({
  success: true,
  data,
  errorCode: null,
  errorMsg: null,
})

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
  shapeJson: unknown
  isActive: boolean
}
interface SavedPlacement {
  placementKey: number
  objectKey: number
  eqpKey: number | null
  transformJson: unknown
}
interface MockState {
  objects: SavedObject[]
  placements: SavedPlacement[]
  canvasJson: unknown
  objectSeq: number
  placementSeq: number
  layoutPutCalls: number
  objectPostCalls: number
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
  // 객체 라이브러리 CRUD.
  await page.route(/\/api\/live-map\/layout\/objects(\/\d+)?(\?.*)?$/, async (route, request) => {
    const method = request.method()
    if (method === 'POST') {
      const body = (request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')) as Omit<SavedObject, 'objectKey' | 'isActive'>
      state.objectPostCalls += 1
      state.objectSeq += 1
      const saved: SavedObject = {
        objectKey: state.objectSeq,
        objectName: body.objectName,
        objectKind: body.objectKind,
        shapeJson: body.shapeJson,
        isActive: true,
      }
      state.objects.push(saved)
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(saved)) })
      return
    }
    if (method === 'GET') {
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
  // 라인 캔버스 GET/PUT.
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route, request) => {
    const method = request.method()
    if (method === 'PUT') {
      const body = (request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')) as {
        canvasJson: unknown
        placements: { objectKey: number; eqpKey: number | null; transformJson: unknown }[]
      }
      state.layoutPutCalls += 1
      state.canvasJson = body.canvasJson
      state.placements = body.placements.map((placement) => {
        state.placementSeq += 1
        return {
          placementKey: state.placementSeq,
          objectKey: placement.objectKey,
          eqpKey: placement.eqpKey,
          transformJson: placement.transformJson,
        }
      })
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      // 새로고침 후 GET 이 브라우저 캐시(=PUT 이전 빈 응답)로 서빙되지 않도록 캐시 금지.
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
  // 페이지의 useLiveMap.
  await page.route(/.*\/api\/live-map(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LIVE_MAP)) })
  })
  // 메뉴 prefetch 빈 응답.
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

// 뷰어가 기본 뷰이므로 B 라인 선택 후 "구조물 편집" 토글로 빌더 모드에 진입한다.
const selectBLine = async (page: Page) => {
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-B_LINE').click()
  await page.getByTestId('live-map-mode-builder').click()
}

test('admin: 합성 객체 저장 → 팔레트 배치 → 우클릭 복사 → 레이아웃 저장 → 새로고침 영속 (console/pageerror 0)', async ({
  page,
}) => {
  const state: MockState = {
    objects: [],
    placements: [],
    canvasJson: null,
    objectSeq: 0,
    placementSeq: 0,
    layoutPutCalls: 0,
    objectPostCalls: 0,
  }
  test.setTimeout(90_000)
  // 새로고침 후 GET 이 브라우저 캐시(PUT 이전 빈 응답)로 서빙되지 않도록 캐시 완전 비활성화.
  const cdpSession = await page.context().newCDPSession(page)
  await cdpSession.send('Network.setCacheDisabled', { cacheDisabled: true })
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await selectBLine(page)

  // admin 저작 툴바 노출.
  await expect(page.getByTestId('live-map-builder-toolbar')).toBeVisible()

  // primitive 3개 그리기 → draft 3.
  await page.getByTestId('builder-add-rect').click()
  await page.getByTestId('builder-add-line').click()
  await page.getByTestId('builder-add-text').click()
  await expect(page.getByTestId('builder-draft-count')).toHaveText('3')

  // 합성 객체 저장(STRUCTURE).
  await page.getByTestId('builder-save-object').click()
  await page.getByTestId('object-name-input').fill('Pump Station')
  await page.getByTestId('object-kind-select').selectOption('STRUCTURE')
  await page.getByTestId('object-save-confirm').click()

  await expect.poll(() => state.objectPostCalls).toBe(1)
  await expect(page.getByTestId('palette-place-1')).toBeVisible()

  // 팔레트에서 신규 배치 → placement 1.
  await page.getByTestId('palette-place-1').click()
  await expect(page.getByTestId('builder-placement-count')).toHaveText('1')

  // 우클릭 복사 → placement 2.
  // 배치 그룹은 (220,160), 객체의 첫 Rect 는 로컬 (96,80,132x72) → 화면 중심 ≈ (382,276).
  const canvas = page.locator('[data-testid="live-map-builder-canvas"] canvas').first()
  // 캔버스가 board 좌표(1350×710)를 컨테이너 폭에 fit-to-width 스케일하므로, board 좌표 클릭 위치를 같은 배율로 환산한다.
  const scale = (await canvas.boundingBox())!.width / 1350
  await canvas.click({ button: 'right', position: { x: 382 * scale, y: 276 * scale } })
  await expect(page.getByTestId('placement-context-menu')).toBeVisible()
  await page.getByTestId('context-copy').click()
  await expect(page.getByTestId('builder-placement-count')).toHaveText('2')

  // 레이아웃 저장(PUT) — placement 2건 전송.
  await page.getByTestId('builder-save-layout').click()
  await expect.poll(() => state.layoutPutCalls).toBe(1)
  expect(state.placements.length).toBe(2)

  // 새로고침 후 라인 재선택 → 배치 영속(GET) 확인.
  await page.reload()
  await selectBLine(page)
  // 저장 객체 영속(팔레트) + 배치 영속(GET → 작업 사본 재시드) 확인.
  await expect(page.getByTestId('palette-place-1')).toBeVisible()
  await expect(page.getByTestId('builder-placement-count')).toHaveText('2', { timeout: 15_000 })

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
