import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * 정밀 분석 #2(a) — 정적으로 clear 한 모달도 worst-case 로 렌더해 모달 폭 밖 오버플로우가
 * 없음을 자동으로 못박는 회귀 가드. (Playwright 로컬, API 미사용.)
 *
 *  - eqp CheckInModal (max-w-4xl=896px): 긴 Param Value / Description.
 *  - ParentModelCommitModal (전체화면): 컬럼 多 + 긴 값.
 *
 * 공통 PASS 조건: 모달이 자기 max(또는 viewport)를 안 넘는다 + diff 테이블 우측 edge 가
 * 모달 우측 edge 안 + console.error/pageerror 0. (내부 가로 스크롤은 정상.)
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNull = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const longVal = (label: string) => `${label}_VERY_LONG_VALUE_FOR_OVERFLOW_TEST_0123456789_ABCDEFGHIJ`

const attachErrors = (page: Page, tag: string) => {
  const errors: string[] = []
  page.on('pageerror', (error) => {
    errors.push(`[pageerror] ${error.message}`)
    // eslint-disable-next-line no-console
    console.log(`[${tag}][pageerror] ${error.message}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`[console:error] ${message.text()}`)
      // eslint-disable-next-line no-console
      console.log(`[${tag}][console:error] ${message.text()}`)
    }
  })
  return errors
}

const logBoxes = async (page: Page, tag: string, tableTestId: string) => {
  const dialog = page.getByRole('dialog')
  const table = page.getByTestId(tableTestId)
  const dialogBox = await dialog.boundingBox()
  const tableBox = await table.boundingBox()
  const metrics = await table.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }))
  const viewport = page.viewportSize()
  // eslint-disable-next-line no-console
  console.log(`[${tag}] DIALOG ${JSON.stringify({ x: Math.round(dialogBox?.x ?? 0), w: Math.round(dialogBox?.width ?? 0) })}`)
  // eslint-disable-next-line no-console
  console.log(`[${tag}] TABLE_BOX ${JSON.stringify({ x: Math.round(tableBox?.x ?? 0), w: Math.round(tableBox?.width ?? 0) })}`)
  // eslint-disable-next-line no-console
  console.log(`[${tag}] TABLE_SCROLL ${JSON.stringify(metrics)} VIEWPORT ${JSON.stringify(viewport)}`)
  return { dialogBox, tableBox, viewport }
}

// ───────────────────────── eqp CheckInModal ─────────────────────────

const EQP_ID = 'EQ_CHECKIN'
const APPLIED_VERSION = '25.01.01.0000'

const EQP_INFO = {
  eqpKey: 1, eqpId: EQP_ID, lineKey: 1, commInterface: 'SECS' as const, commMode: 'ACTIVE',
  isDev: false, routePartition: 0, eqpIp: '127.0.0.1', eqpPort: 5000, modelVersionKey: 0,
  enabled: true, createdAt: '2026-05-27T00:00:00Z', updatedAt: '2026-05-27T00:00:00Z', createdBy: 'admin', updatedBy: 'admin',
}

// worst-case: 긴 paramValue / description.
const EDIT_PARAMS = [
  { paramName: 'ITEM_ADD', paramValue: longVal('ADD_VALUE'), description: longVal('ADD_DESC'), createdBy: 'admin' },
  { paramName: 'ITEM_CHG', paramValue: longVal('CHG_BRANCH_VALUE'), description: longVal('CHG_BRANCH_DESC'), createdBy: 'admin' },
]
const APPLIED_PARAMS = [
  { paramName: 'ITEM_CHG', paramValue: longVal('CHG_PARENT_VALUE'), description: longVal('CHG_PARENT_DESC'), createdBy: 'admin' },
  { paramName: 'ITEM_DEL', paramValue: longVal('DEL_VALUE'), description: longVal('DEL_DESC'), createdBy: 'admin' },
]

const setupCheckInMocks = async (page: Page) => {
  await page.route(
    (url) => (typeof url === 'string' ? new URL(url).pathname : url.pathname).startsWith('/api/'),
    async (route: Route, request) => {
      const url = new URL(request.url())
      const p = url.pathname
      const method = request.method()
      if (p === '/api/auth/csrf') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(apiNull()) })
      if (p === '/api/auth/me') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ userPk: 1, userId: 'admin', permissionCodes: ['EQP_RW'] })) })
      if (p === '/api/line') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([{ lineKey: 1, lineCode: 'LINE_A', lineName: 'Line A' }])) })
      if (p === '/api/eqp' && method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [EQP_INFO], offset: 0, limit: 500, count: 1 })) })
      if (p === '/api/eqp/gateway-shard-leases') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([{ groupId: 'group-1', ownedPartitions: [0, 1], ownerInstanceId: 'gw-e2e-1' }])) })
      if (p === `/api/eqp/${EQP_ID}` && method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(EQP_INFO)) })
      if (p === `/api/eqp/${EQP_ID}/param-versions`) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([APPLIED_VERSION])) })
      if (p === `/api/eqp/${EQP_ID}/runtime-state`) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ controlState: null, eqpState: null, connectionState: null })) })
      if (p === `/api/eqp/${EQP_ID}/checkout-status`) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ checkedOut: true, checkedOutBy: null })) })
      if (p === `/api/eqp/${EQP_ID}/params`) {
        const version = url.searchParams.get('version')
        const params = version === 'EDIT' ? EDIT_PARAMS : version === APPLIED_VERSION ? APPLIED_PARAMS : []
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(params)) })
      }
      if (p === `/api/eqp/${EQP_ID}/manage` && method === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({
          eqpId: EQP_ID, commInterface: 'SECS', commMode: 'ACTIVE', isDev: false, routePartition: 0, eqpIp: '127.0.0.1', eqpPort: 5000,
          enabled: true, runtimeState: null, logPolicy: null, jars: null, modelBinding: null, hsmsSettings: null, socketSettings: null,
          appliedParamVersion: APPLIED_VERSION, appliedParamDescription: null, paramVersions: [], portStatuses: [],
        })) })
      }
      if (p === '/api/model' && method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [] })) })
    },
  )
}

test('eqp CheckInModal — 긴 Param Value/Description diff 가 모달 폭 밖으로 안 나간다', async ({ page }) => {
  test.setTimeout(60_000)
  const errors = attachErrors(page, 'checkin')
  await setupCheckInMocks(page)
  await page.addInitScript(() => window.localStorage.setItem('nori-tc-lang', 'ko'))
  await page.goto('/eqp')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'Gateway', exact: true }).click()
  await page.getByRole('button', { name: 'gateway_app1', exact: true }).click()
  await page.getByRole('button', { name: EQP_ID, exact: true }).click()
  const checkInButton = page.getByRole('button', { name: 'Check In' })
  await expect(checkInButton).toBeEnabled()
  await checkInButton.click()

  const table = page.getByTestId('selectable-table-check-in-diff')
  await expect(table).toBeVisible()

  const { dialogBox, tableBox } = await logBoxes(page, 'checkin', 'selectable-table-check-in-diff')
  await page.screenshot({ path: 'test-results/overflow-guard-checkin-modal.png' })

  expect(dialogBox?.width ?? 0).toBeLessThanOrEqual(896 + 4)
  expect((tableBox?.x ?? 0) + (tableBox?.width ?? 0)).toBeLessThanOrEqual((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0) + 1)
  expect(errors, errors.join('\n')).toEqual([])
})

// ──────────────────── ParentModelCommitModal ────────────────────

const ROOT_MODEL = {
  modelVersionKey: 300, modelKey: 30, modelName: 'PARENT_COMMIT_MODEL', parentModel: null, modelVersion: '26.05.26.0000',
  commInterface: 'SECS' as const, status: 'OPERATE', description: 'root', maker: 'demo',
  createdAt: '2026-05-26T00:00:00Z', updatedAt: '2026-05-26T00:00:00Z', createdBy: 'admin', updatedBy: 'admin',
}
const BRANCH_MODEL = {
  modelVersionKey: 310, modelKey: 31, modelName: 'PARENT_COMMIT_MODEL_admin', parentModel: 'PARENT_COMMIT_MODEL', modelVersion: '26.05.26.0100',
  commInterface: 'SECS' as const, status: 'DEVELOP', description: 'branch', maker: 'demo',
  createdAt: '2026-05-26T00:05:00Z', updatedAt: '2026-05-26T00:05:00Z', createdBy: 'admin', updatedBy: 'admin',
}

// worst-case: 8 컬럼 + 긴 값. changed table 은 2*N+1 컬럼이 되어 더 넓어진다.
const WIDE_COLS = ['Parameter Name', 'Parameter Value', 'Unit', 'Min', 'Max', 'Default', 'Format', 'Comment']
const wideRow = (id: string, prefix: string) => ({ identity: id, branchValues: WIDE_COLS.map((c, i) => longVal(`${prefix}_B_${i}`)), parentValues: WIDE_COLS.map((c, i) => longVal(`${prefix}_P_${i}`)) })

const buildWidePreview = () => ({
  committed: false, branchModelKey: BRANCH_MODEL.modelKey, parentModelKey: ROOT_MODEL.modelKey,
  branchModelName: BRANCH_MODEL.modelName, parentModelName: ROOT_MODEL.modelName,
  branchLatestVersion: BRANCH_MODEL.modelVersion, parentLatestVersion: ROOT_MODEL.modelVersion,
  newParentVersion: null, committedParentModelVersionKey: null,
  sections: [
    {
      detailNode: 'model-parameter', columns: WIDE_COLS,
      added: [{ identity: 'P_ADD1', branchValues: WIDE_COLS.map((c, i) => longVal(`ADD_${i}`)), parentValues: [] }],
      changed: [wideRow('P_ITEM1', 'CHG1'), wideRow('P_ITEM2', 'CHG2')],
      deleted: [{ identity: 'P_DEL1', branchValues: [], parentValues: WIDE_COLS.map((c, i) => longVal(`DEL_${i}`)) }],
    },
  ],
})

const setupParentCommitMocks = async (page: Page) => {
  await page.route(
    (url) => (typeof url === 'string' ? new URL(url).pathname : url.pathname).startsWith('/api/'),
    async (route: Route, request) => {
      const p = new URL(request.url()).pathname
      const method = request.method()
      if (p === '/api/auth/csrf') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(apiNull()) })
      if (p === '/api/auth/me') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ userPk: 1, userId: 'admin', permissionCodes: ['MODEL_RW'] })) })
      if (p === '/api/line') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }])) })
      if (p === '/api/model' && method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [ROOT_MODEL, BRANCH_MODEL], offset: 0, limit: 500, count: 2 })) })
      if (p === `/api/model/${ROOT_MODEL.modelVersionKey}` && method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ROOT_MODEL)) })
      if (p === `/api/model/${BRANCH_MODEL.modelVersionKey}` && method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(BRANCH_MODEL)) })
      if (p === `/api/model/${BRANCH_MODEL.modelKey}/commit-parent` && method === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(buildWidePreview())) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [] })) })
    },
  )
}

test('ParentModelCommitModal — 컬럼 多/긴 값 diff 가 모달 폭 밖으로 안 나간다', async ({ page }) => {
  test.setTimeout(60_000)
  const errors = attachErrors(page, 'parent-commit')
  await setupParentCommitMocks(page)
  await page.addInitScript(() => window.localStorage.setItem('nori-tc-lang', 'ko'))
  await page.goto('/model')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'SECS', exact: true }).click()
  await page.getByRole('button', { name: 'PARENT_COMMIT_MODEL', exact: true }).click()
  await page.getByRole('button', { name: BRANCH_MODEL.modelName, exact: true }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Parent Model Commit' }).click()

  const table = page.getByTestId('parent-commit-diff-table-changed')
  await expect(table).toBeVisible()

  const dialog = page.getByRole('dialog')
  const dialogBox = await dialog.boundingBox()
  const { tableBox, viewport } = await logBoxes(page, 'parent-commit', 'parent-commit-diff-table-changed')
  await page.screenshot({ path: 'test-results/overflow-guard-parent-commit-modal.png' })

  // 전체화면 모달: 모달이 viewport 를 안 넘고, 테이블이 모달 우측 edge 안.
  expect(dialogBox?.width ?? 0).toBeLessThanOrEqual((viewport?.width ?? 0) + 1)
  expect((tableBox?.x ?? 0) + (tableBox?.width ?? 0)).toBeLessThanOrEqual((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0) + 1)
  expect(errors, errors.join('\n')).toEqual([])
})
