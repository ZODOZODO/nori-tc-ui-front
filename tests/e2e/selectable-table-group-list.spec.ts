import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * SPEC `selectable-table-rollout` R4 — GroupListTable SelectableTable 마이그레이션 후
 * 2x2 영역 Ctrl+C → TSV 검증 + 기존 액션 버튼 회귀 + 더블클릭 → openEditModal 신규 동작.
 *
 * Plan: `.claude/progress/selectable-table-rollout-r4.md` (W-GL1=A 더블클릭 openEditModal).
 *
 * 글로벌 CLAUDE.md 14 — assertion 통과 + page.on('console','error') / page.on('pageerror') 0 모두 충족.
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

const PERMISSIONED_ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['USER_READ', 'USER_WRITE'],
}

interface MockGroupRow {
  groupId: number
  groupCode: string
  groupName: string
  description: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const buildGroup = (overrides: Partial<MockGroupRow>): MockGroupRow => ({
  groupId: overrides.groupId ?? 1,
  groupCode: overrides.groupCode ?? 'GRP01',
  groupName: overrides.groupName ?? '관리자',
  description: overrides.description ?? '관리자 그룹',
  isActive: overrides.isActive ?? true,
  createdAt: overrides.createdAt ?? '2025-01-01T00:00:00Z',
  updatedAt: overrides.updatedAt ?? '2025-05-01T00:00:00Z',
})

interface GroupApiMockState {
  groups: MockGroupRow[]
}

const setupMocks = async (page: Page, state: GroupApiMockState) => {
  await page.route('**/api/auth/csrf', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'set-cookie': 'XSRF-TOKEN=test-csrf-token; Path=/' },
      body: JSON.stringify(apiNullSuccess()),
    })
  })

  await page.route('**/api/auth/me', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess(PERMISSIONED_ME)),
    })
  })

  // /api/user GET — Group 페이지 진입은 /user 라우트라 user list 호출이 발생할 수 있음. 빈 응답.
  await page.route(/.*\/api\/user(\?.*)?$/, async (route: Route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 20, count: 0 })),
      })
      return
    }
    await route.fallback()
  })

  await page.route(/.*\/api\/group(\?.*)?$/, async (route: Route, request) => {
    if (request.method() === 'GET') {
      const url = new URL(request.url())
      const offset = Number(url.searchParams.get('offset') ?? '0')
      const limit = Number(url.searchParams.get('limit') ?? '20')
      const slice = state.groups.slice(offset, offset + limit)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          apiSuccess({ items: slice, offset, limit, count: state.groups.length }),
        ),
      })
      return
    }
    await route.fallback()
  })

  await page.route(/.*\/api\/group\/(\d+)$/, async (route: Route, request) => {
    const url = new URL(request.url())
    const match = url.pathname.match(/\/api\/group\/(\d+)$/)
    if (!match) {
      await route.fallback()
      return
    }
    const groupId = Number(match[1])
    if (request.method() === 'GET') {
      const found = state.groups.find((group) => group.groupId === groupId)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(found ? apiSuccess(found) : apiSuccess(buildGroup({ groupId }))),
      })
      return
    }
    await route.fallback()
  })

  await page.route(/.*\/api\/group\/(\d+)\/user(\?.*)?$/, async (route: Route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 50, count: 0 })),
      })
      return
    }
    await route.fallback()
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

const ADMINS_GROUP = buildGroup({
  groupId: 10,
  groupCode: 'ADMINS',
  groupName: '관리자',
})
const OPS_GROUP = buildGroup({
  groupId: 11,
  groupCode: 'OPS',
  groupName: '운영자',
  isActive: false,
})

const navigateToGroupPanel = async (page: Page) => {
  await page.goto('/user')
  await page.getByTestId('user-management-sidebar-group').click()
  await expect(page.getByRole('heading', { name: '그룹 관리' })).toBeVisible()
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

test('Selectable-Table-R4-AC-3a: GroupListTable 2x2 영역 Ctrl+C → 클립보드 TSV', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  await setupMocks(page, { groups: [ADMINS_GROUP, OPS_GROUP] })
  await navigateToGroupPanel(page)

  const container = page.getByTestId('selectable-table-group-list')
  await expect(container).toBeVisible()

  // col 0 = groupCode, col 1 = groupName.
  // row 0 = ADMINS, row 1 = OPS (API 응답 순서 보존).
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
  expect(new Set(cells)).toEqual(
    new Set([
      ADMINS_GROUP.groupCode,
      ADMINS_GROUP.groupName,
      OPS_GROUP.groupCode,
      OPS_GROUP.groupName,
    ]),
  )

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})

test('Selectable-Table-R4-AC-3b: GroupListTable 기존 Pencil 액션 버튼 클릭 시 GroupUpsertModal 노출 (회귀)', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  await setupMocks(page, { groups: [ADMINS_GROUP, OPS_GROUP] })
  await navigateToGroupPanel(page)

  await expect(page.getByTestId('group-row-10')).toBeVisible()
  await page.getByTestId('group-row-edit-10').click()

  // GroupUpsertModal 의 group-code 인풋이 ADMINS 의 groupCode 로 채워져 있는지 확인 — edit 모드 진입 확정.
  await expect(page.locator('#group-upsert-code')).toHaveValue(ADMINS_GROUP.groupCode)

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})

test('Selectable-Table-R4-AC-3c: GroupListTable 행 더블클릭 시 GroupUpsertModal 노출 (신규 W-GL1=A)', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  await setupMocks(page, { groups: [ADMINS_GROUP, OPS_GROUP] })
  await navigateToGroupPanel(page)

  const container = page.getByTestId('selectable-table-group-list')
  await expect(container).toBeVisible()

  // row 0 = ADMINS 셀 더블클릭 → wrapRow onDoubleClick → openEditModal(ADMINS.groupId) → GroupUpsertModal open.
  await container.locator('[data-row-idx="0"][data-col-idx="0"]').dblclick()

  await expect(page.locator('#group-upsert-code')).toHaveValue(ADMINS_GROUP.groupCode)

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})
