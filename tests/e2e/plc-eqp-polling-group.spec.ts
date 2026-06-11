import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * plc-gateway Phase 5: PLC 설비 폴링 그룹 start/end 컨트롤 e2e.
 *
 * PLC 설비 선택 → 폴링 그룹 컨트롤 노출 → 그룹 messageName 입력 + Start 클릭 →
 * POST /api/eqp/{id}/polling-group/{group}/start (EQP_PLC_GROUP_START) 발행 →
 * 202+traceId → GET /api/async/{traceId} 폴링 → PASS → 성공 메시지 (L1353/L1365).
 * console error / pageerror 0 동반 단언.
 */

const EQP_ID = 'PLC-EQP-01'
const GROUP_NAME = 'EQP_STATUS_REPORT'

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = { userPk: 100, userId: 'admin', permissionCodes: ['EQP_READ', 'EQP_WRITE', 'LINE_READ'] }

const PLC_EQP = {
  eqpKey: 1,
  eqpId: EQP_ID,
  lineKey: 1,
  commInterface: 'PLC',
  commMode: 'ACTIVE',
  isDev: false,
  routePartition: 0,
  eqpIp: '10.0.0.5',
  eqpPort: 502,
  modelVersionKey: 9101,
  enabled: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  createdBy: 'system',
  updatedBy: 'system',
}

const RUNTIME_STATE = { controlState: 'ONLINE_REMOTE', eqpState: 'IDLE', connectionState: 'CONNECTED' }

const MODEL_INFO = {
  modelVersionKey: 9101,
  modelKey: 910,
  modelName: 'PLC_MODEL',
  parentModel: null,
  modelVersion: '1.0.0',
  commInterface: 'PLC',
  status: 'OPERATE',
  description: null,
  maker: null,
}

interface MockState {
  pollingGroupCalls: { url: string; method: string }[]
}

const setupMocks = async (page: Page, state: MockState) => {
  // 미모킹 /api 요청이 실 백엔드로 새어 401 → /login 리다이렉트되는 것을 막는 fallback.
  // (먼저 등록 = 최저 우선순위. 아래 구체 라우트가 덮어쓴다 — group-page.spec 패턴.)
  await page.route(
    (url) => {
      const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
      return pathname.startsWith('/api/')
    },
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })),
      })
    },
  )
  await page.route(/.*\/api\/line(\?.*)?$/, async (route) => {
    // 라인 1개 — 자동 시드로 lineKey=1 스코프가 적용되어 PLC_EQP 가 표시된다.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess([{ lineKey: 1, lineCode: 'LINE_A', lineName: 'Line A' }])),
    })
  })
  await page.route(/.*\/api\/eqp\/options(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        apiSuccess({
          socketProtocolTypes: [],
          gatewayJarOptions: [],
          businessJarOptions: [],
          developModelOptions: [],
          operateModelOptions: [],
        }),
      ),
    })
  })
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

  // 폴링 그룹 start/end POST 캡처 → 202 traceId.
  await page.route(/.*\/api\/eqp\/[^/]+\/polling-group\/[^/]+\/(start|end)$/, async (route, request) => {
    state.pollingGroupCalls.push({ url: request.url(), method: request.method() })
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess({ traceId: 'trace-plc-group-1' })),
    })
  })
  // async 결과 → 즉시 PASS.
  await page.route(/.*\/api\/async\/[^/]+$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        apiSuccess({ traceId: 'trace-plc-group-1', eqpId: EQP_ID, status: 'PASS', errorCode: null, errorMsg: null }),
      ),
    })
  })

  await page.route(new RegExp(`/api/eqp/${EQP_ID}/runtime-state$`), async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(RUNTIME_STATE)) })
  })
  await page.route(new RegExp(`/api/eqp/${EQP_ID}/param-versions$`), async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) })
  })
  await page.route(new RegExp(`/api/eqp/${EQP_ID}/checkout-status$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess({ checkedOut: false, checkedOutBy: null })),
    })
  })
  await page.route(new RegExp(`/api/eqp/${EQP_ID}/manage$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        apiSuccess({
          ...PLC_EQP,
          lineKey: 1,
          runtimeState: RUNTIME_STATE,
          logPolicy: null,
          jars: null,
          modelBinding: null,
          hsmsSettings: null,
          socketSettings: null,
          plcSettings: {
            plcProtocol: 'MODBUS_TCP',
            transport: 'TCP',
            unitId: 1,
            pollTimeoutMs: 3000,
            reconnectMaxRetries: 3,
          },
          appliedParamVersion: null,
          appliedParamDescription: null,
          paramVersions: [],
          portStatuses: [],
        }),
      ),
    })
  })
  // 단건 상세 (sub-path 가 아닌 정확 매칭).
  await page.route(new RegExp(`/api/eqp/${EQP_ID}$`), async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(PLC_EQP)) })
  })
  // 목록.
  await page.route(/.*\/api\/eqp(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess({ items: [PLC_EQP], offset: 0, limit: 500, count: 1 })),
    })
  })
  // gateway 그룹 분류 기준 shard lease — partition 0 보유 group-1 → gateway_app1.
  await page.route(/.*\/api\/eqp\/gateway-shard-leases$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        apiSuccess([{ groupId: 'group-1', ownedPartitions: [0, 1], ownerInstanceId: 'gw-e2e-1' }]),
      ),
    })
  })
  await page.route(/.*\/api\/model\/\d+(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(MODEL_INFO)) })
  })
  await page.route(/.*\/api\/model(\?.*)?$/, async (route) => {
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

const selectPlcEqp = async (page: Page) => {
  await page.goto('/eqp')
  await page.locator('aside button', { hasText: 'Gateway' }).first().click()
  await page.locator('aside button', { hasText: 'gateway_app1' }).first().click()
  await page.locator('aside button', { hasText: EQP_ID }).first().click()
  await expect(page.getByTestId('eqp-polling-group-control')).toBeVisible()
}

test('PLC 설비 폴링 그룹 Start → EQP_PLC_GROUP_START 발행 + async PASS (console/pageerror 0)', async ({
  page,
}) => {
  const state: MockState = { pollingGroupCalls: [] }
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await selectPlcEqp(page)

  await page.getByTestId('eqp-polling-group-input').fill(GROUP_NAME)
  await page.getByTestId('eqp-polling-group-start').click()

  await expect.poll(() => state.pollingGroupCalls.length).toBe(1)
  expect(state.pollingGroupCalls[0].method).toBe('POST')
  expect(state.pollingGroupCalls[0].url).toContain(`/api/eqp/${EQP_ID}/polling-group/${GROUP_NAME}/start`)

  // async PASS → 성공 결과 메시지 노출.
  await expect(page.getByTestId('eqp-polling-group-result')).toContainText(GROUP_NAME)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('PLC 설비 폴링 그룹 End → EQP_PLC_GROUP_END 발행 (console/pageerror 0)', async ({ page }) => {
  const state: MockState = { pollingGroupCalls: [] }
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await selectPlcEqp(page)

  await page.getByTestId('eqp-polling-group-input').fill(GROUP_NAME)
  await page.getByTestId('eqp-polling-group-end').click()

  await expect.poll(() => state.pollingGroupCalls.length).toBe(1)
  expect(state.pollingGroupCalls[0].url).toContain(`/api/eqp/${EQP_ID}/polling-group/${GROUP_NAME}/end`)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
