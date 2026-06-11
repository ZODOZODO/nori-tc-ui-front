import { expect, test, type Page } from '@playwright/test'

/**
 * SPEC `selectable-table-rollout` R2-AC-1 — BusinessDlqPanel SelectableTable 마이그레이션 후
 * 2x2 영역 Ctrl+C → 클립보드 TSV 형식 검증.
 *
 * mock 패턴은 `dlq-page.spec.ts` 답습 — `/api/dlq/business` 2 행 fixture.
 * 글로벌 CLAUDE.md 14 — assertion 통과 + page.on('console','error') / page.on('pageerror') 0 건 모두 충족만 PASS.
 */

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

const PERMISSIONED_ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['DLQ_READ'],
}

const buildBusiness = (overrides: Partial<MockBusinessDlq>): MockBusinessDlq => ({
  dlqId: overrides.dlqId ?? 'BZ-001',
  source: overrides.source ?? 'KAFKA',
  stage: overrides.stage ?? 'CONSUME',
  topic: overrides.topic ?? 'tc.business.in',
  partition: overrides.partition ?? 0,
  offset: overrides.offset ?? 42,
  eqpId: overrides.eqpId ?? 'EQ001',
  messageType: overrides.messageType ?? 'COMMAND',
  messageName: overrides.messageName ?? 'START',
  reasonCode: overrides.reasonCode ?? 'HANDLER_FAIL',
  reasonMessage: overrides.reasonMessage ?? '핸들러 처리 실패',
  occurredAt: overrides.occurredAt ?? Date.parse('2026-05-26T11:00:00Z'),
  payloadRef: overrides.payloadRef ?? 'tc:business:payload:BZ-001',
  ttlSeconds: overrides.ttlSeconds ?? 86400,
})

// DLQ 패널 라인 스코프 기준 — eqp 목록의 lineKey 매핑으로 분류 (dlq-line-scope.ts).
const LINES = [{ lineKey: 1, lineCode: 'LINE_A', lineName: 'Line A' }]
const EQP_ITEMS = [
  { eqpKey: 1, eqpId: 'EQ001', lineKey: 1 },
  { eqpKey: 2, eqpId: 'EQ002', lineKey: 1 },
  { eqpKey: 3, eqpId: 'EQ_OTHER_LINE', lineKey: 2 },
]

const setupMocks = async (page: Page, business: MockBusinessDlq[]) => {
  await page.route(/.*\/api\/line(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess(LINES)),
    })
  })

  await page.route(/.*\/api\/eqp(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        apiSuccess({ items: EQP_ITEMS, offset: 0, limit: 500, count: EQP_ITEMS.length }),
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
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess(PERMISSIONED_ME)),
    })
  })

  await page.route(/.*\/api\/dlq\/gateway(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess([])),
    })
  })

  await page.route(/.*\/api\/dlq\/business(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess(business)),
    })
  })

  await page.route(/.*\/api\/dlq\/quarantine(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess([])),
    })
  })

  await page.route(/.*\/api\/dlq\/repair-task(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess([])),
    })
  })
}

interface ConsoleErrorBucket {
  errors: string[]
}

const attachConsoleErrorListeners = (page: Page): ConsoleErrorBucket => {
  const bucket: ConsoleErrorBucket = { errors: [] }
  page.on('pageerror', (error) => {
    bucket.errors.push(`[pageerror] ${error.message}`)
    console.log(`[pageerror] ${error.message}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      bucket.errors.push(`[console:error] ${message.text()}`)
      console.log(`[console:error] ${message.text()}`)
    }
  })
  return bucket
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

test('Selectable-Table-R2-AC-1: BusinessDlqPanel 2x2 영역 Ctrl+C → 클립보드 TSV', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  const business = [
    buildBusiness({
      dlqId: 'BZ-001',
      eqpId: 'EQ001',
      messageName: 'START',
      occurredAt: Date.parse('2026-05-26T11:00:00Z'),
    }),
    buildBusiness({
      dlqId: 'BZ-002',
      eqpId: 'EQ002',
      messageName: 'STOP',
      occurredAt: Date.parse('2026-05-26T12:00:00Z'),
    }),
  ]
  await setupMocks(page, business)

  await page.goto('/dlq')
  await page.getByTestId('dlq-sidebar-business').click()
  await expect(page.getByTestId('dlq-panel-business')).toBeVisible()

  const container = page.getByTestId('selectable-table-business-dlq')
  await expect(container).toBeVisible()
  // 최신 시각 (BZ-002) 가 위로 정렬되므로 row 0 = BZ-002 / row 1 = BZ-001.
  // col 0 = ID (dlqId), col 1 = 출처 (source) — 2x2 영역.
  const start = container.locator('[data-row-idx="0"][data-col-idx="0"]')
  const end = container.locator('[data-row-idx="1"][data-col-idx="1"]')
  await start.hover()
  await page.mouse.down()
  await end.hover()
  await page.mouse.up()

  await page.keyboard.press('ControlOrMeta+C')

  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  const lines = clipboard.split('\n')
  expect(lines).toHaveLength(2)
  const cells = lines.flatMap((line) => line.split('\t'))
  expect(cells).toHaveLength(4)
  // 정렬 순서는 BE 응답이 아닌 occurredAt desc — 클립보드 셀 집합만 단언.
  expect(new Set(cells)).toEqual(new Set(['BZ-001', 'BZ-002', 'KAFKA']))

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})

test('Selectable-Table-R2-AC-1 회귀: BusinessDlqPanel row testId / pagination / refresh 보존', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  const business = [
    buildBusiness({ dlqId: 'BZ-001', eqpId: 'EQ001' }),
    // 타 라인(lineKey=2) 설비 항목 — 선택 라인(LINE_A) 스코프에서 숨겨져야 한다.
    buildBusiness({ dlqId: 'BZ-OTHER', eqpId: 'EQ_OTHER_LINE' }),
  ]
  await setupMocks(page, business)

  await page.goto('/dlq')
  await page.getByTestId('dlq-sidebar-business').click()

  // row data-testid 패턴 보존 (기존 dlq-page e2e 의 dlq-row-business-${id})
  await expect(page.getByTestId('dlq-row-business-BZ-001')).toBeVisible()
  // 라인 스코프 — 타 라인 설비의 DLQ 항목은 표시되지 않는다.
  await expect(page.getByTestId('dlq-row-business-BZ-OTHER')).toHaveCount(0)
  await expect(page.getByTestId('dlq-row-business-BZ-001')).toContainText('tc.business.in')

  // DlqTableShell 의 pagination(PagePagination) / refresh 컨트롤이 그대로 노출.
  // R5-dlq 에서 prev/next 버튼이 forked PagePagination(이전/다음 페이지 + 페이지번호 + 사이즈셀렉트)로
  // 교체됨 — 단언 의미(페이지네이션 컨트롤 노출) 동일, locale 무관 aria-label 로 보정.
  await expect(page.getByRole('button', { name: 'previous page' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'next page' })).toBeVisible()
  await expect(page.getByTestId('dlq-panel-business-refresh')).toBeVisible()

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})
