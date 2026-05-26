import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * SPEC `selectable-table-rollout` R4 — UserListTable SelectableTable 마이그레이션 후
 * 2x2 영역 Ctrl+C → TSV 검증 + 기존 액션 버튼 회귀 + 더블클릭 → openEditModal 신규 동작.
 *
 * Plan: `.claude/progress/selectable-table-rollout-r4.md` (W-UL1=A 더블클릭 openEditModal).
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

interface MockUserGroupSummary {
  groupId: number
  groupCode: string
  groupName: string
}

interface MockUserRow {
  userPk: number
  userId: string
  userIdNorm: string
  userName: string
  company: string
  department: string
  email: string
  status: string
  createdAt: string
  updatedAt: string
  createdBy: string
  updatedBy: string
  groups: MockUserGroupSummary[]
}

const buildUser = (overrides: Partial<MockUserRow>): MockUserRow => ({
  userPk: overrides.userPk ?? 1,
  userId: overrides.userId ?? 'user01',
  userIdNorm: (overrides.userId ?? 'user01').toLowerCase(),
  userName: overrides.userName ?? '홍길동',
  company: overrides.company ?? '노리시스템',
  department: overrides.department ?? 'PE팀',
  email: overrides.email ?? 'user01@nori.co.kr',
  status: overrides.status ?? 'ACTIVE',
  createdAt: overrides.createdAt ?? '2025-01-01T00:00:00Z',
  updatedAt: overrides.updatedAt ?? '2025-05-01T00:00:00Z',
  createdBy: overrides.createdBy ?? 'system',
  updatedBy: overrides.updatedBy ?? 'system',
  // user.api.ts:115-130 isUserListItem 필터링 통과를 위해 groups 필드 명시 — user-page.spec.ts 사전 fail 의 원인과 동일하나 본 e2e 는 별 fixture 로 회피.
  groups: overrides.groups ?? [],
})

interface UserApiMockState {
  users: MockUserRow[]
}

const setupMocks = async (page: Page, state: UserApiMockState) => {
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

  await page.route(/.*\/api\/user(\?.*)?$/, async (route: Route, request) => {
    if (request.method() === 'GET') {
      const url = new URL(request.url())
      const offset = Number(url.searchParams.get('offset') ?? '0')
      const limit = Number(url.searchParams.get('limit') ?? '20')
      const slice = state.users.slice(offset, offset + limit)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          apiSuccess({ items: slice, offset, limit, count: state.users.length }),
        ),
      })
      return
    }
    await route.fallback()
  })

  await page.route(/.*\/api\/user\/(\d+)$/, async (route: Route, request) => {
    const url = new URL(request.url())
    const match = url.pathname.match(/\/api\/user\/(\d+)$/)
    if (!match) {
      await route.fallback()
      return
    }
    const userPk = Number(match[1])
    if (request.method() === 'GET') {
      const found = state.users.find((user) => user.userPk === userPk) ?? buildUser({ userPk })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess(found)),
      })
      return
    }
    await route.fallback()
  })

  await page.route(/.*\/api\/user\/(\d+)\/group(\?.*)?$/, async (route: Route, request) => {
    if (request.method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          apiSuccess({ items: [], offset: 0, limit: 50, count: 0 }),
        ),
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

const ALICE = buildUser({
  userPk: 1,
  userId: 'alice',
  userName: 'Alice',
  company: '노리',
  department: 'PE',
})
const BOB = buildUser({
  userPk: 2,
  userId: 'bob',
  userName: 'Bob',
  company: '노리',
  department: 'BE',
})

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

test('Selectable-Table-R4-AC-2a: UserListTable 2x2 영역 Ctrl+C → 클립보드 TSV', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  await setupMocks(page, { users: [ALICE, BOB] })
  await page.goto('/user')

  const container = page.getByTestId('selectable-table-user-list')
  await expect(container).toBeVisible()

  // col 0 = userId, col 1 = userName.
  // row 0 = ALICE, row 1 = BOB (API 응답 순서 보존).
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
    new Set([ALICE.userId, ALICE.userName, BOB.userId, BOB.userName]),
  )

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})

test('Selectable-Table-R4-AC-2b: UserListTable 기존 Pencil 액션 버튼 클릭 시 UserUpsertModal 노출 (회귀)', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  await setupMocks(page, { users: [ALICE, BOB] })
  await page.goto('/user')

  await expect(page.getByTestId('user-row-1')).toBeVisible()
  await page.getByTestId('user-row-edit-1').click()

  // UserUpsertModal 의 user-id 인풋이 ALICE 의 userId 로 채워져 있는지 확인 — edit 모드 진입 확정.
  await expect(page.locator('#user-upsert-user-id')).toHaveValue(ALICE.userId)

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})

test('Selectable-Table-R4-AC-2c: UserListTable 행 더블클릭 시 UserUpsertModal 노출 (신규 W-UL1=A)', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  await setupMocks(page, { users: [ALICE, BOB] })
  await page.goto('/user')

  const container = page.getByTestId('selectable-table-user-list')
  await expect(container).toBeVisible()

  // row 0 = ALICE 셀 더블클릭 → wrapRow onDoubleClick → openEditModal(ALICE.userPk) → UserUpsertModal open.
  await container.locator('[data-row-idx="0"][data-col-idx="0"]').dblclick()

  // 기존 Pencil 액션과 동일하게 user-upsert-user-id 가 ALICE 의 userId 로 채워짐.
  await expect(page.locator('#user-upsert-user-id')).toHaveValue(ALICE.userId)

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})
