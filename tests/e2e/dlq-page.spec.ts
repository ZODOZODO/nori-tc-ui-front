import { expect, test, type Page, type Request } from '@playwright/test'

/**
 * `/dlq` 페이지 e2e 시나리오 묶음. 모든 백엔드 응답은 `route.fulfill` 로 mock 한다.
 * 백엔드 endpoint 가 미배포 되었거나 데이터가 비어 있어도 일관된 컬럼 렌더 검증을 수행한다.
 */

interface MockGatewayDlq {
  dlqId: string
  equipmentId: string
  traceId: string | null
  commInterfaceType: string | null
  socketType: string | null
  stage: string | null
  reasonCode: string | null
  reasonMessage: string | null
  occurredAt: number
  payloadRefKey: string | null
  rawLen: number
  b64Len: number
  tags: Record<string, string> | null
  ttlSeconds: number | null
}

interface MockBusinessDlq {
  dlqId: string
  source: string | null
  stage: string | null
  topic: string | null
  partition: number | null
  offset: number | null
  eqpId: string | null
  messageType: string | null
  messageName: string | null
  reasonCode: string | null
  reasonMessage: string | null
  occurredAt: number
  payloadRef: string | null
  ttlSeconds: number | null
}

interface MockQuarantine {
  equipmentId: string
  reasonCode: string | null
  reasonMessage: string | null
  quarantinedAt: string
  ttlSeconds: number | null
}

interface MockRepairTask {
  taskId: string
  eqpId: string
  commandType: string
  repairAction: string
  errorCode: string | null
  errorMessage: string | null
  createdAt: string
}

const PERMISSIONED_ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['DLQ_READ'],
}

const UNPERMISSIONED_ME = {
  userPk: 200,
  userId: 'viewer',
  permissionCodes: [] as string[],
}

const apiSuccess = <TData>(data: TData) => ({
  success: true,
  data,
  errorCode: null,
  errorMsg: null,
})

const apiNullSuccess = () => ({
  success: true,
  data: null,
  errorCode: null,
  errorMsg: null,
})

interface DlqApiMockState {
  meResponse: typeof PERMISSIONED_ME
  gateway: MockGatewayDlq[]
  business: MockBusinessDlq[]
  quarantine: MockQuarantine[]
  repairTask: MockRepairTask[]
}

const buildGateway = (overrides: Partial<MockGatewayDlq>): MockGatewayDlq => ({
  dlqId: overrides.dlqId ?? 'GW-001',
  equipmentId: overrides.equipmentId ?? 'EQ001',
  traceId: overrides.traceId ?? null,
  commInterfaceType: overrides.commInterfaceType ?? 'SECS',
  socketType: overrides.socketType ?? 'ACTIVE',
  stage: overrides.stage ?? 'DECODE',
  reasonCode: overrides.reasonCode ?? 'PARSE_ERROR',
  reasonMessage: overrides.reasonMessage ?? '메시지 파싱 실패',
  occurredAt: overrides.occurredAt ?? Date.parse('2025-05-01T10:00:00Z'),
  payloadRefKey: overrides.payloadRefKey ?? 'tc:gateway:payload:GW-001',
  rawLen: overrides.rawLen ?? 128,
  b64Len: overrides.b64Len ?? 172,
  tags: overrides.tags ?? null,
  ttlSeconds: overrides.ttlSeconds ?? 86400,
})

const buildBusiness = (overrides: Partial<MockBusinessDlq>): MockBusinessDlq => ({
  dlqId: overrides.dlqId ?? 'BZ-001',
  source: overrides.source ?? 'KAFKA',
  stage: overrides.stage ?? 'CONSUME',
  topic: overrides.topic ?? 'tc.business.in',
  partition: overrides.partition ?? 0,
  offset: overrides.offset ?? 42,
  eqpId: overrides.eqpId ?? 'EQ002',
  messageType: overrides.messageType ?? 'COMMAND',
  messageName: overrides.messageName ?? 'START',
  reasonCode: overrides.reasonCode ?? 'HANDLER_FAIL',
  reasonMessage: overrides.reasonMessage ?? '핸들러 처리 실패',
  occurredAt: overrides.occurredAt ?? Date.parse('2025-05-02T11:00:00Z'),
  payloadRef: overrides.payloadRef ?? 'tc:business:payload:BZ-001',
  ttlSeconds: overrides.ttlSeconds ?? 86400,
})

const buildQuarantine = (overrides: Partial<MockQuarantine>): MockQuarantine => ({
  equipmentId: overrides.equipmentId ?? 'EQ003',
  reasonCode: overrides.reasonCode ?? 'REPEATED_FAIL',
  reasonMessage: overrides.reasonMessage ?? '반복 실패로 격리',
  quarantinedAt: overrides.quarantinedAt ?? '2025-05-03T12:00:00Z',
  ttlSeconds: overrides.ttlSeconds ?? 3600,
})

const buildRepairTask = (overrides: Partial<MockRepairTask>): MockRepairTask => ({
  taskId: overrides.taskId ?? 'TASK-001',
  eqpId: overrides.eqpId ?? 'EQ004',
  commandType: overrides.commandType ?? 'RUNTIME_UPDATE',
  repairAction: overrides.repairAction ?? 'RUNTIME_UPDATE',
  errorCode: overrides.errorCode ?? 'TIMEOUT',
  errorMessage: overrides.errorMessage ?? '명령 응답 시간 초과',
  createdAt: overrides.createdAt ?? '2025-05-04T13:00:00Z',
})

const createDefaultMockState = (): DlqApiMockState => ({
  meResponse: { ...PERMISSIONED_ME },
  gateway: [buildGateway({})],
  business: [buildBusiness({})],
  quarantine: [buildQuarantine({})],
  repairTask: [buildRepairTask({})],
})

const setupMocks = async (page: Page, state: DlqApiMockState) => {
  // 일부 테스트는 /eqp 출발점에서 topbar 메뉴 노출/권한을 검증한다.
  // /eqp 진입 시 EqpPage 가 호출하는 /api/eqp* / /api/model 이 mock 되지 않으면 unmocked
  // 요청이 401 을 받아 api-client interceptor 가 /login 으로 redirect → topbar 가 사라진다.
  // 출발점 /eqp 가 빈 목록으로 정상 렌더되도록 eqp / model 계열을 빈 응답으로 mock.
  await page.route(/.*\/api\/(eqp|model)(\/.*)?(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess({ items: [], missingEqpIds: [], offset: 0, limit: 500, count: 0 })),
    })
  })

  await page.route('**/api/auth/csrf', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'set-cookie': 'XSRF-TOKEN=test-csrf-token; Path=/',
      },
      body: JSON.stringify(apiNullSuccess()),
    })
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess(state.meResponse)),
    })
  })

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiNullSuccess()),
    })
  })

  await page.route(/.*\/api\/dlq\/gateway(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess(state.gateway)),
    })
  })

  await page.route(/.*\/api\/dlq\/business(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess(state.business)),
    })
  })

  await page.route(/.*\/api\/dlq\/quarantine(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess(state.quarantine)),
    })
  })

  await page.route(/.*\/api\/dlq\/repair-task(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess(state.repairTask)),
    })
  })
}

test('DLQ_READ 보유 사용자는 /dlq 진입 시 4 사이드바 항목이 표시', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await page.goto('/dlq')

  await expect(page.getByTestId('dlq-sidebar-gateway')).toBeVisible()
  await expect(page.getByTestId('dlq-sidebar-business')).toBeVisible()
  await expect(page.getByTestId('dlq-sidebar-quarantine')).toBeVisible()
  await expect(page.getByTestId('dlq-sidebar-repair-task')).toBeVisible()
})

test('사이드바 클릭 시 해당 mode 의 API 가 호출되고 응답 행이 렌더', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)

  const dlqRequests: Request[] = []
  page.on('request', (request) => {
    if (request.url().match(/\/api\/dlq\/(gateway|business|quarantine|repair-task)/)) {
      dlqRequests.push(request)
    }
  })

  await page.goto('/dlq')

  // R3 이후 기본 mode 가 dashboard 로 변경됨 — gateway 패널 검증 전에 명시 전환 필요.
  await page.getByTestId('dlq-sidebar-gateway').click()
  await expect(page.getByTestId('dlq-panel-gateway')).toBeVisible()
  await expect(page.getByTestId('dlq-row-gateway-GW-001')).toBeVisible()
  await expect(page.getByTestId('dlq-row-gateway-GW-001')).toContainText('EQ001')

  await page.getByTestId('dlq-sidebar-business').click()
  await expect(page.getByTestId('dlq-panel-business')).toBeVisible()
  await expect(page.getByTestId('dlq-row-business-BZ-001')).toBeVisible()
  await expect(page.getByTestId('dlq-row-business-BZ-001')).toContainText('tc.business.in')

  await page.getByTestId('dlq-sidebar-quarantine').click()
  await expect(page.getByTestId('dlq-panel-quarantine')).toBeVisible()
  await expect(page.getByTestId('dlq-row-quarantine-EQ003')).toBeVisible()
  await expect(page.getByTestId('dlq-row-quarantine-EQ003')).toContainText('REPEATED_FAIL')

  await page.getByTestId('dlq-sidebar-repair-task').click()
  await expect(page.getByTestId('dlq-panel-repair-task')).toBeVisible()
  await expect(page.getByTestId('dlq-row-repair-task-TASK-001')).toBeVisible()
  await expect(page.getByTestId('dlq-row-repair-task-TASK-001')).toContainText('RUNTIME_UPDATE')

  await expect
    .poll(() => dlqRequests.some((req) => req.url().includes('/api/dlq/gateway')))
    .toBe(true)
  await expect
    .poll(() => dlqRequests.some((req) => req.url().includes('/api/dlq/business')))
    .toBe(true)
  await expect
    .poll(() => dlqRequests.some((req) => req.url().includes('/api/dlq/quarantine')))
    .toBe(true)
  await expect
    .poll(() => dlqRequests.some((req) => req.url().includes('/api/dlq/repair-task')))
    .toBe(true)
})

test('DLQ_READ 미보유 사용자는 topbar Dlq 메뉴 미표시 + /dlq 직접 진입 시 /login 으로 redirect', async ({
  page,
}) => {
  const state = createDefaultMockState()
  state.meResponse = { ...UNPERMISSIONED_ME }
  await setupMocks(page, state)

  await page.goto('/eqp')
  // AppTopBar 는 lazy-load 되는 EqpPage(AppPageShell) 안에 렌더된다. 병렬 부하 시 청크 로드가
  // 5s 기본 타임아웃을 넘기면 Suspense 폴백("화면을 불러오는 중입니다")만 떠 topbar 가 DOM 에 없다.
  // 청크 + auth/me + 빈 eqp/model 응답이 안정될 때까지 기다린 뒤 topbar 를 단언한다.
  await page.waitForLoadState('networkidle')
  await expect(page.locator('header button:has-text("Eqp")')).toBeVisible()
  expect(await page.locator('header button:has-text("Dlq")').count()).toBe(0)

  await page.goto('/dlq')
  await expect(page).toHaveURL(/\/login$/)
})

test('기본 진입 시 대시보드 패널이 렌더된다', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)

  await page.goto('/dlq')

  await expect(page.getByTestId('dlq-dashboard-panel')).toBeVisible()
})

test('KPI 카드 4개 카운트가 mock 데이터와 일치한다', async ({ page }) => {
  const state = createDefaultMockState()
  state.gateway = [
    buildGateway({ dlqId: 'GW-001' }),
    buildGateway({ dlqId: 'GW-002' }),
  ]
  state.business = [
    buildBusiness({ dlqId: 'BZ-001' }),
    buildBusiness({ dlqId: 'BZ-002' }),
    buildBusiness({ dlqId: 'BZ-003' }),
  ]
  state.quarantine = [buildQuarantine({ equipmentId: 'EQ-Q-1' })]
  state.repairTask = [
    buildRepairTask({ taskId: 'TASK-1' }),
    buildRepairTask({ taskId: 'TASK-2' }),
    buildRepairTask({ taskId: 'TASK-3' }),
    buildRepairTask({ taskId: 'TASK-4' }),
  ]
  await setupMocks(page, state)

  await page.goto('/dlq')

  await expect(page.getByTestId('dlq-dashboard-panel')).toBeVisible()
  await expect(page.getByTestId('dlq-kpi-gateway')).toHaveAttribute(
    'data-value',
    String(state.gateway.length),
  )
  await expect(page.getByTestId('dlq-kpi-business')).toHaveAttribute(
    'data-value',
    String(state.business.length),
  )
  await expect(page.getByTestId('dlq-kpi-quarantine')).toHaveAttribute(
    'data-value',
    String(state.quarantine.length),
  )
  await expect(page.getByTestId('dlq-kpi-repair-task')).toHaveAttribute(
    'data-value',
    String(state.repairTask.length),
  )
})

test('최근 장애 피드가 시간 역순으로 정렬된다', async ({ page }) => {
  const state = createDefaultMockState()
  state.gateway = [
    buildGateway({ dlqId: 'GW-A', occurredAt: Date.parse('2025-05-10T01:00:00Z') }),
    buildGateway({ dlqId: 'GW-B', occurredAt: Date.parse('2025-05-08T01:00:00Z') }),
  ]
  state.business = [
    buildBusiness({ dlqId: 'BZ-A', occurredAt: Date.parse('2025-05-09T01:00:00Z') }),
    buildBusiness({ dlqId: 'BZ-B', occurredAt: Date.parse('2025-05-07T01:00:00Z') }),
  ]
  state.quarantine = [
    buildQuarantine({ equipmentId: 'EQ-Q-1', quarantinedAt: '2025-05-11T01:00:00Z' }),
    buildQuarantine({ equipmentId: 'EQ-Q-2', quarantinedAt: '2025-05-06T01:00:00Z' }),
  ]
  state.repairTask = [
    buildRepairTask({ taskId: 'TASK-A', createdAt: '2025-05-12T01:00:00Z' }),
    buildRepairTask({ taskId: 'TASK-B', createdAt: '2025-05-05T01:00:00Z' }),
  ]
  await setupMocks(page, state)

  await page.goto('/dlq')

  await expect(page.getByTestId('dlq-dashboard-panel')).toBeVisible()
  const rows = page.getByTestId('dlq-dashboard-feed-row')
  await expect(rows).toHaveCount(8)

  const timestamps = await rows.evaluateAll((nodes) =>
    nodes.map((node) => Number(node.getAttribute('data-timestamp'))),
  )
  for (let i = 1; i < timestamps.length; i += 1) {
    expect(timestamps[i - 1]).toBeGreaterThanOrEqual(timestamps[i])
  }
})

test('새로고침 버튼 클릭 시 4 endpoint 재호출된다', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)

  const dlqRequests: Request[] = []
  page.on('request', (request) => {
    if (request.url().match(/\/api\/dlq\/(gateway|business|quarantine|repair-task)/)) {
      dlqRequests.push(request)
    }
  })

  await page.goto('/dlq')
  await expect(page.getByTestId('dlq-dashboard-panel')).toBeVisible()

  const countFor = (slug: string) =>
    dlqRequests.filter((req) => req.url().includes(`/api/dlq/${slug}`)).length

  await expect.poll(() => countFor('gateway')).toBeGreaterThanOrEqual(1)
  await expect.poll(() => countFor('business')).toBeGreaterThanOrEqual(1)
  await expect.poll(() => countFor('quarantine')).toBeGreaterThanOrEqual(1)
  await expect.poll(() => countFor('repair-task')).toBeGreaterThanOrEqual(1)

  await page.getByTestId('dlq-dashboard-refresh').click()

  await expect.poll(() => countFor('gateway')).toBeGreaterThanOrEqual(2)
  await expect.poll(() => countFor('business')).toBeGreaterThanOrEqual(2)
  await expect.poll(() => countFor('quarantine')).toBeGreaterThanOrEqual(2)
  await expect.poll(() => countFor('repair-task')).toBeGreaterThanOrEqual(2)
})
