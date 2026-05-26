import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * SPEC `selectable-table-rollout` R3.2 — ParentModelCommitModal SelectableTable
 * 마이그레이션 e2e.
 *
 * 진입 흐름:
 *   /model → 사이드바 branch 모델 버튼 우클릭 → ContextMenu → "Parent Model Commit"
 *   → handleOpenParentCommit → previewParentCommit POST 호출 → 모달 open + diff 표시.
 *
 * 검증 대상 (SPEC L114 AC-R3.2-2):
 *   1) added/changed/deleted 각 mode 별 Table row background 보존 (#F0FFF7 / #FFFDF0 / #FFF7F7)
 *   2) changed Table 의 parent column 셀 strikethrough (#97A39C line-through)
 *   3) changed Table 의 branch column 셀 green (#1C7F59 font-medium)
 *   4) deleted Table 의 셀 strikethrough
 *   5) changed Table 2x2 영역 Ctrl+C → TSV 4 셀 fixture 정합 (parent / branch 양값)
 *   6) console.error / pageerror 0건 (글로벌 CLAUDE.md 14번)
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
  modelVersionKey: 300,
  modelKey: 30,
  modelName: 'PARENT_COMMIT_MODEL',
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

const BRANCH_MODEL = {
  modelVersionKey: 310,
  modelKey: 31,
  modelName: 'PARENT_COMMIT_MODEL_admin',
  parentModel: 'PARENT_COMMIT_MODEL',
  modelVersion: '26.05.26.0100',
  commInterface: 'SECS' as const,
  status: 'DEVELOP',
  description: 'branch',
  maker: 'demo',
  createdAt: '2026-05-26T00:05:00Z',
  updatedAt: '2026-05-26T00:05:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

/**
 * Plan §단계 6 fixture: changed 2 행 보장 (2x2 자연 영역) + added 1 + deleted 1.
 * section.columns = ['Parameter Name', 'Parameter Value'] — diffValueColumnCount = 2.
 *
 * changed Table 의 tableColumns = ['항목', 'Parent Parameter Name', 'Parent Parameter Value',
 *                                  'Branch Parameter Name', 'Branch Parameter Value']
 * tableRows row 0 = ['P_ITEM1', 'p1_old', 'v1_old', 'p1_new', 'v1_new']
 *           row 1 = ['P_ITEM2', 'p2_old', 'v2_old', 'p2_new', 'v2_new']
 * 2x2 drag (row 0~1, col 2~3) → ['v1_old', 'p1_new', 'v2_old', 'p2_new'] distinct.
 */
const buildPreviewResult = () => ({
  committed: false,
  branchModelKey: BRANCH_MODEL.modelKey,
  parentModelKey: ROOT_MODEL.modelKey,
  branchModelName: BRANCH_MODEL.modelName,
  parentModelName: ROOT_MODEL.modelName,
  branchLatestVersion: BRANCH_MODEL.modelVersion,
  parentLatestVersion: ROOT_MODEL.modelVersion,
  newParentVersion: null,
  committedParentModelVersionKey: null,
  sections: [
    {
      detailNode: 'model-parameter',
      columns: ['Parameter Name', 'Parameter Value'],
      added: [
        {
          identity: 'P_ADD1',
          branchValues: ['p_add', 'v_add'],
          parentValues: [],
        },
      ],
      changed: [
        {
          identity: 'P_ITEM1',
          branchValues: ['p1_new', 'v1_new'],
          parentValues: ['p1_old', 'v1_old'],
        },
        {
          identity: 'P_ITEM2',
          branchValues: ['p2_new', 'v2_new'],
          parentValues: ['p2_old', 'v2_old'],
        },
      ],
      deleted: [
        {
          identity: 'P_DEL1',
          branchValues: [],
          parentValues: ['p_del', 'v_del'],
        },
      ],
    },
  ],
})

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

      if (pathname === '/api/model' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({
              items: [ROOT_MODEL, BRANCH_MODEL],
              offset: 0,
              limit: 500,
              count: 2,
            }),
          ),
        })
        return
      }

      if (pathname === `/api/model/${BRANCH_MODEL.modelKey}/commit-parent` && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(buildPreviewResult())),
        })
        return
      }

      // 기본 빈 응답
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

const openParentCommitModal = async (page: Page) => {
  await page.goto('/model')
  await page.waitForLoadState('networkidle')

  // 사이드바 branch 모델 버튼 우클릭 → ContextMenu 노출
  await page.getByRole('button', { name: BRANCH_MODEL.modelName, exact: true }).click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Parent Model Commit' }).click()

  await expect(page.getByRole('heading', { name: 'Parent Model Commit' })).toBeVisible()
  // diff preview load 까지 대기
  await expect(page.getByTestId('parent-commit-diff-table-changed')).toBeVisible()
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

/**
 * AC-R3.2-2: ParentModelCommitModal changed DiffTable 2x2 range copy → TSV.
 * row 0~1 × col 2~3 = (parent value col, branch name col) 인접 2 컬럼.
 * fixture 4 셀 = ['v1_old', 'p1_new', 'v2_old', 'p2_new'].
 */
test('AC-R3.2-2: ParentModelCommitModal changed DiffTable 2x2 range copy → TSV', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  await setupMocks(page)
  await openParentCommitModal(page)

  const container = page.getByTestId('parent-commit-diff-table-changed')
  // col 0='항목', col 1='Parent Parameter Name', col 2='Parent Parameter Value',
  //  col 3='Branch Parameter Name', col 4='Branch Parameter Value'
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
  expect(new Set(cells)).toEqual(new Set(['v1_old', 'p1_new', 'v2_old', 'p2_new']))

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})

/**
 * AC-R3.2-2: 3 mode (added/changed/deleted) Table 행 background + changed parent/branch
 * 컬럼 색상 + deleted strikethrough 보존.
 */
test('AC-R3.2-2: ParentModelCommitModal 3 mode 색상 + strikethrough 보존', async ({ page }) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  await setupMocks(page)
  await openParentCommitModal(page)

  // added Table — 1 행 (idx 0)
  const addedRow = page.getByTestId('parent-commit-diff-row-added-0')
  await expect(addedRow).toHaveClass(/bg-\[#F0FFF7\]/)

  // changed Table — 2 행 (idx 0, 1)
  const changedRow0 = page.getByTestId('parent-commit-diff-row-changed-0')
  const changedRow1 = page.getByTestId('parent-commit-diff-row-changed-1')
  await expect(changedRow0).toHaveClass(/bg-\[#FFFDF0\]/)
  await expect(changedRow1).toHaveClass(/bg-\[#FFFDF0\]/)

  // changed row 0 의 parent column (col 2 = Parent Parameter Value) 셀은 line-through + #97A39C
  const changedRow0ParentCell = changedRow0.locator('[data-col-idx="2"] span')
  await expect(changedRow0ParentCell).toHaveClass(/line-through/)
  await expect(changedRow0ParentCell).toHaveClass(/text-\[#97A39C\]/)
  await expect(changedRow0ParentCell).toHaveCSS('text-decoration-line', 'line-through')

  // changed row 0 의 branch column (col 3 = Branch Parameter Name) 셀은 font-medium + #1C7F59
  const changedRow0BranchCell = changedRow0.locator('[data-col-idx="3"] span')
  await expect(changedRow0BranchCell).toHaveClass(/font-medium/)
  await expect(changedRow0BranchCell).toHaveClass(/text-\[#1C7F59\]/)

  // deleted Table — 1 행 (idx 0)
  const deletedRow = page.getByTestId('parent-commit-diff-row-deleted-0')
  await expect(deletedRow).toHaveClass(/bg-\[#FFF7F7\]/)

  // deleted row 의 value 셀 (col 1 = Parameter Name) 은 line-through
  const deletedValueCell = deletedRow.locator('[data-col-idx="1"] span')
  await expect(deletedValueCell).toHaveClass(/line-through/)
  await expect(deletedValueCell).toHaveCSS('text-decoration-line', 'line-through')

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})
