import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * AC9 — live-map 2.5D 빌더 EQUIPMENT 배치 → eqpKey 바인딩 → 실시간 상태 오버레이 e2e (admin).
 *
 * admin 이 EQUIPMENT 객체를 배치하고, 라인 스코프 실설비(GET /live-map 의 eqpKey)를 골라 바인딩하면
 * 해당 설비의 실시간 상태(RUN/IDLE/ERROR/DOWN)가 표시되고, 레이아웃 저장(PUT) 페이로드에 eqpKey 가
 * 실린다. console.error / pageerror 0 도 단언.
 *
 * <p>기존 AC7(object-reuse)은 STRUCTURE 경로만 검증해 EQUIPMENT 바인딩 누락을 잡지 못했다 — 이 스펙이 그 격차를 막는다.</p>
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

// B_LINE 의 실설비 1대 — eqpKey 77, 실시간 상태 RUN. A_LINE 설비는 라인 스코프 밖이라 드롭다운에 없어야 한다.
const LIVE_MAP = {
  equipmentItems: [
    {
      eqpKey: 77,
      eqpId: 'EQP-B-01',
      eqpName: 'Etcher B1',
      lineValue: 'B_LINE',
      lineLabel: 'B Line',
      clusterId: 'etch',
      clusterName: 'ETCH',
      equipmentModeLabel: 'SINGLE',
      status: 'RUN',
      statusLabel: 'RUN',
      portItems: [{ id: 'LP1', label: 'LP1', status: 'RUN', statusLabel: 'RUN' }],
      tooltipMeta: 'LP1',
      tooltipStep: '',
      alertMessage: null,
    },
    {
      eqpKey: 9,
      eqpId: 'EQP-A-09',
      eqpName: 'Coater A9',
      lineValue: 'A_LINE',
      lineLabel: 'A Line',
      clusterId: 'cvd',
      clusterName: 'CVD',
      equipmentModeLabel: 'SINGLE',
      status: 'IDLE',
      statusLabel: 'IDLE',
      portItems: [],
      tooltipMeta: '',
      tooltipStep: '',
      alertMessage: null,
    },
  ],
}

// 미리 저장된 EQUIPMENT 객체(팔레트). shape 의 첫 Rect 로컬 (24,24,96x48) → 화면 중심 ≈ (292,208).
const EQUIPMENT_OBJECT = {
  objectKey: 10,
  objectName: 'Etcher Cell',
  objectKind: 'EQUIPMENT' as const,
  shapeJson: {
    v: 1,
    root: {
      className: 'Group',
      attrs: {},
      children: [{ className: 'Rect', attrs: { x: 24, y: 24, width: 96, height: 48, fill: '#888' } }],
    },
  },
  isActive: true,
}

interface MockState {
  placements: { placementKey: number; objectKey: number; eqpKey: number | null; transformJson: unknown }[]
  canvasJson: unknown
  placementSeq: number
  layoutPutCalls: number
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
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'cache-control': 'no-store' },
        body: JSON.stringify(apiSuccess([EQUIPMENT_OBJECT])),
      })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiNullSuccess()) })
  })
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route, request) => {
    if (request.method() === 'PUT') {
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
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify(
        apiSuccess({
          layoutKey: state.placements.length > 0 ? 500 : null,
          lineKey: 2,
          canvasJson: state.canvasJson,
          placements: state.placements,
          objects: [EQUIPMENT_OBJECT],
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

test('admin: EQUIPMENT 배치 → 라인 스코프 설비 eqpKey 바인딩 → 실시간 상태 표시 → PUT 에 eqpKey (console/pageerror 0)', async ({
  page,
}) => {
  const state: MockState = { placements: [], canvasJson: null, placementSeq: 0, layoutPutCalls: 0 }
  test.setTimeout(90_000)
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-B_LINE').click()

  await expect(page.getByTestId('live-map-builder-toolbar')).toBeVisible()
  await expect(page.getByTestId('palette-place-10')).toBeVisible()

  // EQUIPMENT 객체 배치 → placement 1.
  await page.getByTestId('palette-place-10').click()
  await expect(page.getByTestId('builder-placement-count')).toHaveText('1')

  // 캔버스에서 배치를 선택 → EQUIPMENT 바인딩 패널 노출.
  const canvas = page.locator('[data-testid="live-map-builder-canvas"] canvas').first()
  await canvas.click({ position: { x: 292, y: 208 } })
  await expect(page.getByTestId('builder-selected-count')).toHaveText('1')
  await expect(page.getByTestId('placement-eqp-binding')).toBeVisible()

  // 바인딩 전 — unbound.
  await expect(page.getByTestId('placement-eqp-status')).toHaveText('unbound')

  // 라인 스코프 설비만 옵션에 있어야 한다(A_LINE 설비 제외).
  const select = page.getByTestId('placement-eqp-select')
  await expect(select.locator('option')).toHaveText(['— select equipment —', 'Etcher B1'])

  // eqpKey 77 바인딩 → 실시간 상태 RUN 표시.
  await select.selectOption('77')
  await expect(page.getByTestId('placement-eqp-status')).toHaveText('RUN')

  // 레이아웃 저장 → PUT 페이로드에 eqpKey 77.
  await page.getByTestId('builder-save-layout').click()
  await expect.poll(() => state.layoutPutCalls).toBe(1)
  expect(state.placements).toHaveLength(1)
  expect(state.placements[0].eqpKey).toBe(77)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
