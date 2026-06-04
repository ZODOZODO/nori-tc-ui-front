import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * eqp 생성 폼 라인 Select e2e.
 *
 * - 라인 드롭다운이 GET /api/line 으로 채워지고 선택 가능,
 * - 라인 미선택 시 저장이 차단(POST 미발생)됨을 검증한다.
 * - console error / pageerror 0 도 함께 단언.
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
      modelVersionKey: 9001,
      modelKey: 900,
      modelName: 'SOCKET_MODEL',
      parentModel: null,
      modelVersion: '1.0.0',
      commInterface: 'SOCKET',
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
  // eqp 생성 POST 캡처 + 목록/모델은 빈 응답.
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

const openSocketCreateForm = async (page: Page) => {
  await page.goto('/eqp')
  const gatewayButton = page.locator('aside button', { hasText: 'Gateway' }).first()
  await expect(gatewayButton).toBeVisible()
  await gatewayButton.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Socket Eqp Create' }).click()
  await expect(page.getByTestId('eqp-form-line-select')).toBeVisible()
}

test('eqp 폼 라인 드롭다운이 GET /api/line 으로 채워지고 선택된다 (console/pageerror 0)', async ({ page }) => {
  const state: MockState = { createCalls: [] }
  await setupMocks(page, state)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await openSocketCreateForm(page)

  await page.getByTestId('eqp-form-line-select').click()
  await expect(page.getByRole('option', { name: 'A Line' })).toBeVisible()
  await expect(page.getByRole('option', { name: 'B Line' })).toBeVisible()
  await page.getByRole('option', { name: 'A Line' }).click()

  await expect(page.getByTestId('eqp-form-line-select')).toContainText('A Line')

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('eqp 폼에서 라인 미선택 시 저장이 차단된다 (POST 미발생)', async ({ page }) => {
  const state: MockState = { createCalls: [] }
  await setupMocks(page, state)

  await openSocketCreateForm(page)

  // eqpId 만 채우고 라인은 미선택 상태로 저장 시도.
  await page.getByPlaceholder(/EQP-01/).fill('EQP-NEW-01')
  await page.getByRole('button', { name: 'Save' }).click()

  // 라인 미선택 에러 노출 + POST 미발생.
  await expect(page.getByText('Please select a line.')).toBeVisible()
  await expect.poll(() => state.createCalls.length).toBe(0)
})
