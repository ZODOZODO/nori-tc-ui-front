import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * 정밀 분석 (b) — eqp 피처 모달 시각 스윕 (Playwright 로컬 렌더, Claude API 미사용).
 *
 * EqpManageFormModal(max-w-230=920px, flex-col, 대형 폼)은 interfaceType 에 따라 섹션이 달라진다.
 * 필드가 가장 조밀한 SECS(HSMS Settings: t3~t8 / linkTest / maxMsgBytes)와 Socket(Socket Settings)
 * 변형을 worst-case 로 렌더해 필드 그리드 정렬/비율이 깨지지 않는지 스크린샷으로 확인한다.
 * PLC 변형은 plc-eqp-form.spec.ts 가 기능 커버.
 *
 * 각 모달: console.error/pageerror 0 단언 + 스크린샷.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNull = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = { userPk: 100, userId: 'admin', permissionCodes: ['EQP_READ', 'EQP_WRITE', 'LINE_READ'] }
const LINES = [
  { lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' },
  { lineKey: 2, lineCode: 'B_LINE', lineName: 'B Line' },
]

const OPTIONS = {
  socketProtocolTypes: ['LINE_DELIMITED', 'LENGTH_PREFIXED'],
  gatewayJarOptions: ['nori-tc-gateway-1.2.3.jar'],
  businessJarOptions: ['nori-tc-business-1.2.3.jar'],
  developModelOptions: [
    { modelVersionKey: 8101, modelKey: 810, modelName: 'SECS_DEV_MODEL_WITH_A_LONG_NAME', parentModel: null, modelVersion: '0.9.0', commInterface: 'SECS', status: 'DEVELOP' },
  ],
  operateModelOptions: [
    { modelVersionKey: 9101, modelKey: 910, modelName: 'SECS_OPERATE_MODEL', parentModel: null, modelVersion: '1.0.0', commInterface: 'SECS', status: 'OPERATE' },
    { modelVersionKey: 9201, modelKey: 920, modelName: 'SOCKET_OPERATE_MODEL', parentModel: null, modelVersion: '1.0.0', commInterface: 'SOCKET', status: 'OPERATE' },
  ],
}

const setupMocks = async (page: Page) => {
  await page.route(
    (url) => {
      const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
      return pathname.startsWith('/api/')
    },
    async (route: Route, request) => {
      const p = new URL(request.url()).pathname
      if (p === '/api/auth/csrf') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(apiNull()) })
      if (p === '/api/auth/me') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ME)) })
      if (p === '/api/line') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LINES)) })
      if (p === '/api/eqp/options') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(OPTIONS)) })
      if (p === '/api/eqp') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })) })
    },
  )
}

const attachErrorSink = (page: Page, label: string) => {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(`[pageerror] ${error.message}`)

    console.log(`[${label}][pageerror] ${error.message}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`[console:error] ${message.text()}`)

      console.log(`[${label}][console:error] ${message.text()}`)
    }
  })
  return errors
}

const openCreateForm = async (page: Page, kind: 'SECS' | 'Socket') => {
  await page.addInitScript(() => window.localStorage.setItem('nori-tc-lang', 'ko'))
  await page.goto('/eqp')
  const gatewayButton = page.locator('aside button', { hasText: 'Gateway' }).first()
  await expect(gatewayButton).toBeVisible()
  await gatewayButton.click({ button: 'right' })
  await page.getByRole('menuitem', { name: `${kind} Eqp Create` }).click()
  await expect(page.getByTestId('eqp-form-line-select')).toBeVisible()
}

const logDialogBox = async (page: Page, label: string) => {
  const box = await page.getByRole('dialog').boundingBox()
  const viewport = page.viewportSize()

  console.log(`${label}_DIALOG`, JSON.stringify({ w: Math.round(box?.width ?? 0), h: Math.round(box?.height ?? 0), vw: viewport?.width }))
}

test('EqpManageFormModal(SECS create) — HSMS Settings 포함 대형 폼 시각', async ({ page }) => {
  test.setTimeout(60_000)
  const errors = attachErrorSink(page, 'eqp-secs')
  await setupMocks(page)
  await openCreateForm(page, 'SECS')

  await page.getByPlaceholder(/EQP-01/).fill('SECS-EQP-WITH-A-VERY-LONG-IDENTIFIER-0001')
  await page.getByTestId('eqp-form-line-select').click()
  await page.getByRole('option', { name: 'A Line' }).click()
  await page.waitForTimeout(400)

  await logDialogBox(page, 'EQP_SECS')
  await page.screenshot({ path: 'test-results/visual-eqp-secs-create.png' })

  // 폼 하단(HSMS Settings)까지 스크롤해 추가 스크린샷.
  await page.getByRole('dialog').evaluate((el) => {
    const scroller = el.querySelector('[class*="overflow-y-auto"], [class*="overflow-auto"]') as HTMLElement | null
    if (scroller) scroller.scrollTop = scroller.scrollHeight
  })
  await page.waitForTimeout(300)
  await page.screenshot({ path: 'test-results/visual-eqp-secs-create-bottom.png' })

  expect(errors, errors.join('\n')).toEqual([])
})

test('EqpManageFormModal(Socket create) — Socket Settings 포함 폼 시각', async ({ page }) => {
  test.setTimeout(60_000)
  const errors = attachErrorSink(page, 'eqp-socket')
  await setupMocks(page)
  await openCreateForm(page, 'Socket')

  await page.getByPlaceholder(/EQP-01/).fill('SOCKET-EQP-0001')
  await page.getByTestId('eqp-form-line-select').click()
  await page.getByRole('option', { name: 'A Line' }).click()
  await page.waitForTimeout(400)

  await logDialogBox(page, 'EQP_SOCKET')
  await page.screenshot({ path: 'test-results/visual-eqp-socket-create.png' })

  expect(errors, errors.join('\n')).toEqual([])
})
