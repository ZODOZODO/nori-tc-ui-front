import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * plc-gateway Phase 5: PLC 설비 생성 폼 e2e.
 *
 * - 사이드바 "PLC Eqp Create" 진입점 → interfaceType='PLC' 폼 오픈 + PLC Settings 섹션 렌더 (L1361/L1362)
 * - PLC 폼 제출 시 요청 body 에 plcSettings 포함 AND socketSettings/hsmsSettings 는 null
 *   (이분 분기 else=SOCKET 오전송 회귀 차단 — L1351)
 * - console error / pageerror 0 동반 단언.
 */

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

const ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['EQP_READ', 'EQP_WRITE', 'LINE_READ'],
}

const LINES = [
  { lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' },
  { lineKey: 2, lineCode: 'B_LINE', lineName: 'B Line' },
]

const OPTIONS = {
  socketProtocolTypes: ['LINE_DELIMITED'],
  gatewayJarOptions: [],
  businessJarOptions: [],
  developModelOptions: [],
  operateModelOptions: [
    {
      modelVersionKey: 9101,
      modelKey: 910,
      modelName: 'PLC_MODEL',
      parentModel: null,
      modelVersion: '1.0.0',
      commInterface: 'PLC',
      status: 'OPERATE',
    },
  ],
}

interface MockState {
  createCalls: { body: Record<string, unknown> }[]
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
  await page.route(/.*\/api\/eqp\/options(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(OPTIONS)) })
  })
  // eqp 생성 POST 캡처 + 목록은 빈 응답.
  await page.route(/.*\/api\/eqp(\?.*)?$/, async (route, request) => {
    if (request.method() === 'POST') {
      const body = (request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')) as Record<string, unknown>
      state.createCalls.push({ body })
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiNullSuccess()) })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })),
    })
  })
  await page.route(/.*\/api\/model(\/.*)?(\?.*)?$/, async (route) => {
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

const openPlcCreateForm = async (page: Page) => {
  await page.goto('/eqp')
  const gatewayButton = page.locator('aside button', { hasText: 'Gateway' }).first()
  await expect(gatewayButton).toBeVisible()
  await gatewayButton.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'PLC Eqp Create' }).click()
  await expect(page.getByTestId('eqp-form-line-select')).toBeVisible()
}

test('PLC Eqp Create 진입점 → PLC 폼 오픈 + PLC Settings 섹션 렌더 (console/pageerror 0)', async ({ page }) => {
  const state: MockState = { createCalls: [] }
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await openPlcCreateForm(page)

  // 다이얼로그 제목과 PLC 전용 섹션/필드가 렌더된다.
  await expect(page.getByRole('heading', { name: 'PLC Eqp Create' })).toBeVisible()
  await expect(page.getByText('PLC Settings', { exact: true })).toBeVisible()
  await expect(page.getByText('Unit ID', { exact: true })).toBeVisible()
  await expect(page.getByText('Poll Timeout (ms)', { exact: true })).toBeVisible()
  // Comm Interface read-only 필드가 PLC 로 고정.
  await expect(page.getByText('MODBUS_TCP', { exact: true })).toBeVisible()
  // Socket/SECS 전용 섹션은 미렌더.
  await expect(page.getByText('Socket Settings', { exact: true })).toHaveCount(0)
  await expect(page.getByText('SECS Settings', { exact: true })).toHaveCount(0)

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('PLC 폼 제출 body 에 plcSettings 포함 AND socketSettings/hsmsSettings null (오전송 회귀 차단)', async ({
  page,
}) => {
  const state: MockState = { createCalls: [] }
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await openPlcCreateForm(page)

  // 필수 필드 입력 (model name/version 은 PLC 옵션으로 자동 선택됨).
  await page.getByPlaceholder(/EQP-01/).fill('PLC-EQP-01')

  await page.getByTestId('eqp-form-line-select').click()
  await page.getByRole('option', { name: 'A Line' }).click()

  await page.getByTestId('eqp-form-comm-mode-select').click()
  await page.getByRole('option', { name: 'ACTIVE' }).click()

  await page.getByPlaceholder(/127\.0\.0\.1/).fill('10.0.0.5')
  await page.getByPlaceholder(/5000/).fill('502')

  await page.getByRole('button', { name: 'Save' }).click()

  await expect.poll(() => state.createCalls.length).toBe(1)
  const body = state.createCalls[0].body

  expect(body.interfaceType).toBe('PLC')
  // plcSettings 는 non-null 객체로 운반.
  expect(body.plcSettings, 'plcSettings 누락 — PLC 설정 미운반').toBeTruthy()
  const plcSettings = body.plcSettings as Record<string, unknown>
  expect(plcSettings.plcProtocol).toBe('MODBUS_TCP')
  expect(plcSettings.transport).toBe('TCP')
  expect(plcSettings.unitId).toBe(1)
  // 이분 분기 else=SOCKET 오전송 회귀 차단: socket/hsms 는 null.
  expect(body.socketSettings, 'PLC 인데 socketSettings 오전송됨 (else=SOCKET 회귀)').toBeNull()
  expect(body.hsmsSettings).toBeNull()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
