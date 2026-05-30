import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * SPEC `selectable-table-rollout` R5 (W-CI1) — eqp CheckInModal SelectableTable
 * 마이그레이션 e2e.
 *
 * 진입 흐름 (Plan §4 / 자동 복원 결정):
 *   /eqp → 사이드바 gateway_app 그룹 안의 EQP 노드 클릭 → selectEqp →
 *   checkout-status { checkedOut:true, checkedOutBy:null } → isCheckedOutByCurrentUser
 *   (EqpPage.tsx:402-404) → useEffect 가 isEditMode 자동 복원 (EqpPage.tsx:698-705) →
 *   editParams(EDIT) → localEditRows / checkInBaseParams(appliedVersion) → Check In 버튼 →
 *   computeEqpParamDiffRows (EqpPage.tsx:1178) → CheckInModal diff 모달 open.
 *
 * 검증 대상 (SPEC L132 / Plan §4):
 *   AC-R5-CI-1: 2x2 영역 Ctrl+C → 클립보드 TSV 4 셀 fixture 정합 + console.error/pageerror 0
 *   AC-R5-CI-2: added/changed/deleted 행 background (#F0FFF7 / #FFFDF0 / #FFF7F7)
 *               + changed 셀 strikethrough/green + deleted line-through 보존 + console.error/pageerror 0
 */

const createApiResponse = <TData>(data: TData) => ({
  success: true,
  data,
  errorCode: null,
  errorMsg: null,
})

const createNullSuccessResponse = () => ({
  success: true,
  data: null,
  errorCode: null,
  errorMsg: null,
})

const EQP_ID = 'EQ_CHECKIN'
const APPLIED_VERSION = '25.01.01.0000'

// routePartition 0 → gateway_app1 그룹으로 묶여 사이드바 클릭 노드로 렌더 (eqp-group.util.ts:39).
// modelVersionKey 0 → eqpModelInfo (/api/model/:key) 호출 생략 (EqpPage.tsx:319-323).
const EQP_INFO = {
  eqpKey: 1,
  eqpId: EQP_ID,
  commInterface: 'SECS' as const,
  commMode: 'ACTIVE',
  isDev: false,
  routePartition: 0,
  eqpIp: '127.0.0.1',
  eqpPort: 5000,
  modelVersionKey: 0,
  enabled: true,
  createdAt: '2026-05-27T00:00:00Z',
  updatedAt: '2026-05-27T00:00:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

interface ParamFixture {
  paramName: string
  paramValue: string
  description: string
}

const toEqpParam = (fixture: ParamFixture) => ({
  paramName: fixture.paramName,
  paramValue: fixture.paramValue,
  description: fixture.description,
  createdBy: 'admin',
})

/**
 * fixture: EDIT(branch) vs appliedVersion(parent) 사이에서 added 1 / changed 1 / deleted 1.
 * - ITEM_ADD: branch 에만 존재 → added
 * - ITEM_CHG: 양쪽 존재, paramValue 다름 (val_parent → val_branch) → changed
 * - ITEM_DEL: parent 에만 존재 → deleted
 * computeEqpParamDiffRows 정렬: status(added,changed,deleted) → paramName.
 *   row 0 = added ITEM_ADD / row 1 = changed ITEM_CHG / row 2 = deleted ITEM_DEL.
 */
const EDIT_PARAMS: ParamFixture[] = [
  { paramName: 'ITEM_ADD', paramValue: 'val_added', description: 'added desc' },
  { paramName: 'ITEM_CHG', paramValue: 'val_branch', description: 'changed desc' },
]

const APPLIED_PARAMS: ParamFixture[] = [
  { paramName: 'ITEM_CHG', paramValue: 'val_parent', description: 'changed desc' },
  { paramName: 'ITEM_DEL', paramValue: 'val_del', description: 'deleted desc' },
]

const setupMocks = async (page: Page) => {
  await page.route(
    (url) => {
      const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
      return pathname.startsWith('/api/')
    },
    async (route: Route, request) => {
      const url = new URL(request.url())
      const pathname = url.pathname
      const method = request.method()

      if (pathname === '/api/eqp' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({ items: [EQP_INFO], offset: 0, limit: 500, count: 1 }),
          ),
        })
        return
      }

      if (pathname === `/api/eqp/${EQP_ID}` && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(EQP_INFO)),
        })
        return
      }

      if (pathname === `/api/eqp/${EQP_ID}/param-versions` && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse([APPLIED_VERSION])),
        })
        return
      }

      if (pathname === `/api/eqp/${EQP_ID}/runtime-state` && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({ controlState: null, eqpState: null, connectionState: null }),
          ),
        })
        return
      }

      if (pathname === `/api/eqp/${EQP_ID}/checkout-status` && method === 'GET') {
        // checkedOutBy:null → 본인 체크아웃으로 간주 → 편집 모드 자동 복원.
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse({ checkedOut: true, checkedOutBy: null })),
        })
        return
      }

      if (pathname === `/api/eqp/${EQP_ID}/params` && method === 'GET') {
        const version = url.searchParams.get('version')
        const params =
          version === 'EDIT'
            ? EDIT_PARAMS
            : version === APPLIED_VERSION
              ? APPLIED_PARAMS
              : []
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(params.map(toEqpParam))),
        })
        return
      }

      if (pathname === `/api/eqp/${EQP_ID}/manage` && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({
              eqpId: EQP_ID,
              commInterface: 'SECS',
              commMode: 'ACTIVE',
              isDev: false,
              routePartition: 0,
              eqpIp: '127.0.0.1',
              eqpPort: 5000,
              enabled: true,
              runtimeState: null,
              logPolicy: null,
              jars: null,
              modelBinding: null,
              hsmsSettings: null,
              socketSettings: null,
              appliedParamVersion: APPLIED_VERSION,
              appliedParamDescription: null,
              paramVersions: [],
              portStatuses: [],
            }),
          ),
        })
        return
      }

      if (pathname === '/api/model' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({ items: [], offset: 0, limit: 500, count: 0 }),
          ),
        })
        return
      }

      // 기타 노드는 빈 성공 응답
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createApiResponse({ items: [] })),
      })
    },
  )

  await page.route('**/api/auth/csrf', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'set-cookie': 'XSRF-TOKEN=test-csrf-token; Path=/' },
      body: JSON.stringify(createNullSuccessResponse()),
    })
  })

  await page.route('**/api/auth/me', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        createApiResponse({ userPk: 1, userId: 'admin', permissionCodes: ['EQP_RW'] }),
      ),
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

const openCheckInModal = async (page: Page) => {
  await page.goto('/eqp')
  await page.waitForLoadState('networkidle')

  // 사이드바 Gateway → gateway_app1 순으로 펼친 뒤 EQP 노드(버튼 텍스트=eqpId) 클릭.
  await page.getByRole('button', { name: 'Gateway', exact: true }).click()
  await page.getByRole('button', { name: 'gateway_app1', exact: true }).click()
  await page.getByRole('button', { name: EQP_ID, exact: true }).click()

  // 편집 모드 진입 후 Check In 버튼 노출/활성 대기.
  const checkInButton = page.getByRole('button', { name: 'Check In' })
  await expect(checkInButton).toBeEnabled()
  await checkInButton.click()

  await expect(page.getByRole('heading', { name: 'Check In' })).toBeVisible()
  await expect(page.getByTestId('selectable-table-check-in-diff')).toBeVisible()
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

/**
 * AC-R5-CI-1: CheckInModal SelectableTable 의 2x2 영역 Ctrl+C → TSV.
 * row 0 (added) ~ row 1 (changed) × col 1 (Param Name) ~ col 2 (Param Value).
 * fixture 4 셀 = ['ITEM_ADD', 'val_added', 'ITEM_CHG', 'val_branch'].
 */
test('AC-R5-CI-1: CheckInModal 2x2 range copy → TSV (added / changed 행)', async ({ page }) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  await setupMocks(page)
  await openCheckInModal(page)

  const container = page.getByTestId('selectable-table-check-in-diff')
  // col 0 = 구분, col 1 = Param Name, col 2 = Param Value, col 3 = Description.
  const start = container.locator('[data-row-idx="0"][data-col-idx="1"]')
  const end = container.locator('[data-row-idx="1"][data-col-idx="2"]')
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
  expect(new Set(cells)).toEqual(new Set(['ITEM_ADD', 'val_added', 'ITEM_CHG', 'val_branch']))

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})

/**
 * AC-R5-CI-2: diff 색상 / strikethrough 보존.
 * nori-client-forked 자매품화(R5-eqp) 로 bespoke hex → 시맨틱 토큰 치환:
 * - added 행: bg-success/5
 * - changed 행: bg-warning/5 + 셀 내 parent 값 line-through + branch 값 success font-medium
 * - deleted 행: bg-danger/5 + paramName line-through
 */
test('AC-R5-CI-2: CheckInModal diff 색상 + strikethrough 보존', async ({ page }) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  await setupMocks(page)
  await openCheckInModal(page)

  const addedRow = page.getByTestId('check-in-diff-row-added-ITEM_ADD')
  const changedRow = page.getByTestId('check-in-diff-row-changed-ITEM_CHG')
  const deletedRow = page.getByTestId('check-in-diff-row-deleted-ITEM_DEL')

  await expect(addedRow).toHaveClass(/bg-success\/5/)
  await expect(changedRow).toHaveClass(/bg-warning\/5/)
  await expect(deletedRow).toHaveClass(/bg-danger\/5/)

  // changed 행의 parent 값 (val_parent) 은 line-through
  const previousValue = changedRow.locator('.line-through', { hasText: 'val_parent' })
  await expect(previousValue).toBeVisible()
  await expect(previousValue).toHaveCSS('text-decoration-line', 'line-through')

  // changed 행의 branch 값 (val_branch) 은 green font-medium
  const currentValue = changedRow.locator('.font-medium', { hasText: 'val_branch' })
  await expect(currentValue).toBeVisible()

  // deleted 행 Param Name 컬럼 (col 1) 은 line-through.
  const deletedNameSpan = deletedRow.locator('[data-col-idx="1"] span.line-through')
  await expect(deletedNameSpan).toBeVisible()
  await expect(deletedNameSpan).toHaveText('ITEM_DEL')
  await expect(deletedNameSpan).toHaveCSS('text-decoration-line', 'line-through')

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})
