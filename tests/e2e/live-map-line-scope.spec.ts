import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * live-map 상단바 라인 스코프 e2e.
 *
 * - GET /api/line 로 상단바 라인 드롭다운이 채워지고,
 * - 라인 전환 시 해당 라인 설비만 활성(나머지는 dimmed=disabled)됨을 검증한다.
 * - 모든 백엔드 응답은 route.fulfill 로 mock. console error / pageerror 0 도 함께 단언.
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
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ'],
}

const LINES = [
  { lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' },
  { lineKey: 2, lineCode: 'B_LINE', lineName: 'B Line' },
]

const liveMapEquipment = (eqpId: string, lineValue: string, lineLabel: string, clusterId: string) => ({
  eqpId,
  eqpName: eqpId,
  lineValue,
  lineLabel,
  clusterId,
  clusterName: clusterId.toUpperCase(),
  equipmentModeLabel: 'Single',
  status: 'RUN' as const,
  statusLabel: 'RUN',
  portItems: [],
  tooltipMeta: '',
  tooltipStep: '',
  alertMessage: null,
})

const LIVE_MAP = {
  equipmentItems: [
    liveMapEquipment('EQP-A1', 'A_LINE', 'A Line', 'cvd'),
    liveMapEquipment('EQP-B1', 'B_LINE', 'B Line', 'cmp'),
  ],
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
  // 자동 선택된 설비의 comm-log 패널이 호출하는 엔드포인트(미목 시 500 → console error).
  await page.route(/.*\/api\/comm-logs\/.*$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) })
  })
  await page.route(/.*\/api\/live-map(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LIVE_MAP)) })
  })
  // live-map 외 메뉴 prefetch(eqp/model) 가 401 → /login redirect 되지 않도록 빈 응답.
  await page.route(/.*\/api\/(eqp|model)(\/.*)?(\?.*)?$/, async (route) => {
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

test('상단바 라인 드롭다운 전환 시 해당 라인 설비만 활성화된다 (console/pageerror 0)', async ({ page }) => {
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')

  const eqpA1 = page.getByRole('button', { name: /EQP-A1/ })
  const eqpB1 = page.getByRole('button', { name: /EQP-B1/ })

  // 초기(전체 라인): 두 설비 모두 활성.
  await expect(eqpA1).toBeVisible()
  await expect(eqpB1).toBeVisible()
  await expect(eqpA1).toBeEnabled()
  await expect(eqpB1).toBeEnabled()

  // 상단바 라인 드롭다운 → B Line 선택.
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-B_LINE').click()

  // B_LINE 설비만 활성, A_LINE 설비는 dimmed(disabled).
  await expect(eqpB1).toBeEnabled()
  await expect(eqpA1).toBeDisabled()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
