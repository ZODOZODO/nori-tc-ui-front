import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * SPEC `selectable-table-rollout` R3.2 — ModelCheckInDiffModal SelectableTable
 * 마이그레이션 e2e.
 *
 * 진입 흐름:
 *   /model → 사이드바 branch 모델 버튼 클릭 → ModelInfoTable EDIT 행 더블클릭 →
 *   EDIT 탭 활성 + lockOwner === currentUserId 자동 복원으로 isEditMode=true →
 *   Check In 버튼 클릭 → 이전 버전 (같은 modelKey 의 non-EDIT 최신) 탐색 +
 *   현재/이전 detail 동시 fetch → computeNodeDiff → diff 모달 자동 open.
 *
 * 검증 대상 (SPEC L113 AC-R3.2-1):
 *   1) added/changed/deleted 행 background 보존 (#F0FFF7 / #FFFDF0 / #FFF7F7)
 *   2) changed 셀 내부 strikethrough+green diff 양값 보존
 *   3) deleted 행 identity strikethrough
 *   4) 2x2 영역 Ctrl+C → 클립보드 TSV 4 셀 fixture 정합
 *   5) console.error / pageerror 0건 (글로벌 CLAUDE.md 14번)
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

const ROOT_MODEL = {
  modelVersionKey: 200,
  modelKey: 20,
  modelName: 'CHECKIN_DIFF_MODEL',
  parentModel: null,
  modelVersion: '26.05.26.0000',
  commInterface: 'SECS' as const,
  status: 'OPERATE',
  description: 'root',
  maker: 'demo',
  createdAt: '2026-05-26T00:00:00Z',
  updatedAt: '2026-05-26T00:00:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

const BRANCH_PREV = {
  modelVersionKey: 210,
  modelKey: 21,
  modelName: 'CHECKIN_DIFF_MODEL_admin',
  parentModel: 'CHECKIN_DIFF_MODEL',
  modelVersion: '26.05.26.0100',
  commInterface: 'SECS' as const,
  status: 'DEVELOP',
  description: 'branch prev',
  maker: 'demo',
  createdAt: '2026-05-26T00:05:00Z',
  updatedAt: '2026-05-26T00:05:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

const BRANCH_EDIT = {
  modelVersionKey: 211,
  modelKey: 21,
  modelName: 'CHECKIN_DIFF_MODEL_admin',
  parentModel: 'CHECKIN_DIFF_MODEL',
  modelVersion: 'EDIT',
  commInterface: 'SECS' as const,
  status: 'DEVELOP',
  description: 'branch edit',
  maker: 'demo',
  createdAt: '2026-05-26T00:10:00Z',
  updatedAt: '2026-05-26T00:10:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

interface RowFixture {
  id: string
  values: string[]
}

interface NodeResponse {
  columns: string[]
  rows: RowFixture[]
}

interface DetailMockState {
  detailByModelAndNode: Record<number, Record<string, NodeResponse>>
}

/**
 * fixture: model-parameter 노드 한 개에서 added 1 / changed 1 / deleted 1.
 * identity 는 row.values[0]. 식별자 / Parameter Name 첫 값이 같지만 col 2~3
 * drag 영역 (Parameter Name → Parameter Value) 에서는 4 셀이 distinct 가 되도록
 * Parameter Value 를 의도적으로 다른 문자열로 둠.
 */
const buildDefaultState = (): DetailMockState => ({
  detailByModelAndNode: {
    [BRANCH_EDIT.modelVersionKey]: {
      'model-parameter': {
        columns: ['Parameter Name', 'Parameter Value', 'Description'],
        rows: [
          { id: 'r-add', values: ['ITEM_ADD', 'val_added', 'added desc'] },
          { id: 'r-chg', values: ['ITEM_CHG', 'val_branch', 'changed desc'] },
        ],
      },
    },
    [BRANCH_PREV.modelVersionKey]: {
      'model-parameter': {
        columns: ['Parameter Name', 'Parameter Value', 'Description'],
        rows: [
          { id: 'r-chg', values: ['ITEM_CHG', 'val_parent', 'changed desc'] },
          { id: 'r-del', values: ['ITEM_DEL', 'val_del', 'deleted desc'] },
        ],
      },
    },
  },
})

const setupMocks = async (page: Page, state: DetailMockState) => {
  await page.route(
    (url) => {
      const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
      return pathname.startsWith('/api/')
    },
    async (route: Route, request) => {
      const url = new URL(request.url())
      const pathname = url.pathname
      const method = request.method()

      if (pathname === '/api/model' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({
              items: [ROOT_MODEL, BRANCH_PREV, BRANCH_EDIT],
              offset: 0,
              limit: 500,
              count: 3,
            }),
          ),
        })
        return
      }

      if (pathname === `/api/model/${BRANCH_EDIT.modelVersionKey}` && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(BRANCH_EDIT)),
        })
        return
      }

      if (pathname === `/api/model/${BRANCH_PREV.modelVersionKey}` && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(BRANCH_PREV)),
        })
        return
      }

      if (pathname === `/api/model/${ROOT_MODEL.modelVersionKey}` && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(ROOT_MODEL)),
        })
        return
      }

      const detailsGetMatch =
        method === 'GET' ? pathname.match(/^\/api\/model\/(\d+)\/details\/([\w-]+)$/) : null
      if (detailsGetMatch) {
        const modelVersionKey = Number(detailsGetMatch[1])
        const node = detailsGetMatch[2]
        const fixture = state.detailByModelAndNode[modelVersionKey]?.[node]
        if (fixture) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(
              createApiResponse({
                columns: fixture.columns,
                rows: fixture.rows.map((row) => ({
                  id: row.id,
                  values: row.values,
                  previewValues: row.values,
                })),
                mdfContents: [],
              }),
            ),
          })
          return
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({ columns: [], rows: [], mdfContents: [] }),
          ),
        })
        return
      }

      // flows / 기타 노드는 빈 응답
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
        createApiResponse({ userPk: 1, userId: 'admin', permissionCodes: ['MODEL_RW'] }),
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

const openCheckInDiffModal = async (page: Page) => {
  await page.goto('/model')
  await page.waitForLoadState('networkidle')

  // 사이드바 LNB 3단 아코디언(기본 접힘): SECS → CHECKIN_DIFF_MODEL(root) → branch 펼침.
  await page.getByRole('button', { name: 'SECS', exact: true }).click()
  await page.getByRole('button', { name: 'CHECKIN_DIFF_MODEL', exact: true }).click()
  await page.getByRole('button', { name: BRANCH_EDIT.modelName }).click()
  const editRow = page.getByRole('row', { name: new RegExp(`${BRANCH_EDIT.modelName} EDIT`, 'i') })
  await editRow.dblclick()
  await expect(page.getByRole('heading', { name: 'Model Parameter' })).toBeVisible()

  await page.getByRole('button', { name: 'Check In' }).click()

  await expect(page.getByRole('heading', { name: 'Preview Changes' })).toBeVisible()
  await expect(page.getByTestId('selectable-table-check-in-diff-model-parameter')).toBeVisible()
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

/**
 * AC-R3.2-1: ModelCheckInDiffModal SelectableTable 의 2x2 영역 Ctrl+C → TSV.
 * row 0 (added) ~ row 1 (changed) × col 2 (Parameter Name) ~ col 3 (Parameter Value).
 * fixture 4 셀 = ['ITEM_ADD', 'val_added', 'ITEM_CHG', 'val_branch'].
 */
test('AC-R3.2-1: ModelCheckInDiffModal 2x2 range copy → TSV (added / changed 행)', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  const state = buildDefaultState()
  await setupMocks(page, state)
  await openCheckInDiffModal(page)

  const container = page.getByTestId('selectable-table-check-in-diff-model-parameter')
  // row 0 = added (ITEM_ADD), row 1 = changed (ITEM_CHG) — normalizeSectionRows 순서.
  // col 2 = Parameter Name, col 3 = Parameter Value (col 0='구분', col 1='식별자').
  const start = container.locator('[data-row-idx="0"][data-col-idx="2"]')
  const end = container.locator('[data-row-idx="1"][data-col-idx="3"]')
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
 * AC-R3.2-1: diff 색상 / strikethrough 보존.
 * - added 행: bg-success/10 (R5-model coral/neutral 토큰화 — diff semantic success 보존)
 * - changed 행: bg-warning/10 + 셀 내 previous 값 line-through
 * - deleted 행: bg-danger/5 + identity line-through
 */
test('AC-R3.2-1: ModelCheckInDiffModal diff 색상 + strikethrough 보존', async ({ page }) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  const state = buildDefaultState()
  await setupMocks(page, state)
  await openCheckInDiffModal(page)

  const addedRow = page.getByTestId('check-in-diff-row-added-ITEM_ADD')
  const changedRow = page.getByTestId('check-in-diff-row-changed-ITEM_CHG')
  const deletedRow = page.getByTestId('check-in-diff-row-deleted-ITEM_DEL')

  await expect(addedRow).toHaveClass(/bg-success\/10/)
  await expect(changedRow).toHaveClass(/bg-warning\/10/)
  await expect(deletedRow).toHaveClass(/bg-danger\/5/)

  // changed 행의 previous 값 (val_parent) 은 line-through div 안에 위치
  const previousLine = changedRow.locator('.line-through', { hasText: 'val_parent' })
  await expect(previousLine).toBeVisible()
  await expect(previousLine).toHaveCSS('text-decoration-line', 'line-through')

  // changed 행의 current 값 (val_branch) 은 green font-medium
  const currentLine = changedRow.locator('div.font-medium', { hasText: 'val_branch' })
  await expect(currentLine).toBeVisible()

  // deleted 행 identity 컬럼 (col 1) 은 strikethrough. Parameter Name 컬럼의
  // 'ITEM_DEL' 도 line-through 라 col 1 셀에 한정해서 매치.
  const deletedIdentitySpan = deletedRow.locator('[data-col-idx="1"] span.line-through')
  await expect(deletedIdentitySpan).toBeVisible()
  await expect(deletedIdentitySpan).toHaveText('ITEM_DEL')
  await expect(deletedIdentitySpan).toHaveCSS('text-decoration-line', 'line-through')

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})
