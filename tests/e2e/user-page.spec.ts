import { expect, test, type Page, type Request } from '@playwright/test'

/**
 * `/user` 페이지 e2e 시나리오 묶음.
 *
 * 모든 백엔드 응답은 `route.fulfill` 로 mock 합니다. ui-backend R6 (`GET /api/user/{userPk}/group`)
 * 는 현재 미배포 가능성이 있으므로 본 spec 은 mock-only 통합을 검증합니다.
 */

interface MockUserGroupRow {
  userPk: number
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
  // user.api.ts:115 isUserListItem 은 groups: UserGroupSummary[] 를 필수로 검사한다.
  // 누락 시 normalizeUserPagePayload 가 행을 필터링해 목록이 비어 user-row-* 가 사라진다.
  groups: MockUserGroupRow[]
}

const PERMISSIONED_ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['USER_READ', 'USER_WRITE'],
}

const UNPERMISSIONED_ME = {
  userPk: 200,
  userId: 'viewer',
  permissionCodes: [] as string[],
}

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
  groups: overrides.groups ?? [],
})

interface UserApiMockState {
  meResponse: typeof PERMISSIONED_ME
  users: MockUserRow[]
  groupsByUserPk: Map<number, MockUserGroupRow[]>
  totalCount?: number
  createUserCalls: { body: unknown }[]
  updateUserCalls: { userPk: number; body: unknown }[]
  deleteUserCalls: number[]
  passwordResetCalls: { userPk: number; body: { newPassword?: string } }[]
  addGroupCalls: { userPk: number; groupId: number }[]
  removeGroupCalls: { userPk: number; groupId: number }[]
}

const setupMocks = async (page: Page, state: UserApiMockState) => {
  // 일부 테스트는 /eqp 출발점에서 topbar User 메뉴를 눌러 /user 로 진입한다.
  // /eqp 진입 시 EqpPage 가 호출하는 /api/eqp* / /api/model 이 mock 되지 않으면 unmocked
  // 요청이 401 을 받아 api-client interceptor 가 /login 으로 redirect → topbar 가 사라진다.
  // 출발점 /eqp 가 빈 목록으로 정상 렌더되도록 eqp / model 계열을 빈 응답으로 mock.
  await page.route(/.*\/api\/(eqp|model)(\/.*)?(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess({ items: [], missingEqpIds: [], offset: 0, limit: 500, count: 0 })),
    })
  })

  await page.route('**/api/auth/csrf', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: {
        'set-cookie': 'XSRF-TOKEN=test-csrf-token; Path=/',
      },
      body: JSON.stringify(apiNullSuccess()),
    })
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess(state.meResponse)),
    })
  })

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiNullSuccess()),
    })
  })

  await page.route(/.*\/api\/user(\?.*)?$/, async (route, request) => {
    const method = request.method()
    if (method === 'GET') {
      const url = new URL(request.url())
      const offset = Number(url.searchParams.get('offset') ?? '0')
      const limit = Number(url.searchParams.get('limit') ?? '20')
      const slice = state.users.slice(offset, offset + limit)
      const count = state.totalCount ?? state.users.length
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess({ items: slice, offset, limit, count })),
      })
      return
    }
    if (method === 'POST') {
      const body = request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')
      state.createUserCalls.push({ body })
      const created = buildUser({
        userPk: state.users.length + 1000,
        userId: String((body as Record<string, unknown>).userId ?? 'newuser'),
        userName: String((body as Record<string, unknown>).userName ?? '신규'),
        company: String((body as Record<string, unknown>).company ?? ''),
        department: String((body as Record<string, unknown>).department ?? ''),
        email: String((body as Record<string, unknown>).email ?? ''),
        status: String((body as Record<string, unknown>).status ?? 'ACTIVE'),
      })
      state.users.push(created)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess(created)),
      })
      return
    }
    await route.fallback()
  })

  await page.route(/.*\/api\/user\/(\d+)$/, async (route, request) => {
    const url = new URL(request.url())
    const match = url.pathname.match(/\/api\/user\/(\d+)$/)
    if (!match) {
      await route.fallback()
      return
    }
    const userPk = Number(match[1])
    const method = request.method()
    if (method === 'GET') {
      const found = state.users.find((user) => user.userPk === userPk)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(found ? apiSuccess(found) : apiSuccess(buildUser({ userPk }))),
      })
      return
    }
    if (method === 'PUT') {
      const body = request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')
      state.updateUserCalls.push({ userPk, body })
      const existingIndex = state.users.findIndex((user) => user.userPk === userPk)
      const updated = buildUser({
        userPk,
        userId: String((body as Record<string, unknown>).userId ?? `user${userPk}`),
        userName: String((body as Record<string, unknown>).userName ?? ''),
        company: String((body as Record<string, unknown>).company ?? ''),
        department: String((body as Record<string, unknown>).department ?? ''),
        email: String((body as Record<string, unknown>).email ?? ''),
        status: String((body as Record<string, unknown>).status ?? 'ACTIVE'),
      })
      if (existingIndex >= 0) {
        state.users[existingIndex] = updated
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess(updated)),
      })
      return
    }
    if (method === 'DELETE') {
      state.deleteUserCalls.push(userPk)
      state.users = state.users.filter((user) => user.userPk !== userPk)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiNullSuccess()),
      })
      return
    }
    await route.fallback()
  })

  await page.route(/.*\/api\/user\/(\d+)\/password\/reset$/, async (route, request) => {
    const url = new URL(request.url())
    const match = url.pathname.match(/\/api\/user\/(\d+)\/password\/reset$/)
    if (!match) {
      await route.fallback()
      return
    }
    const userPk = Number(match[1])
    const body = (request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')) as {
      newPassword?: string
    }
    state.passwordResetCalls.push({ userPk, body })
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiNullSuccess()),
    })
  })

  await page.route(/.*\/api\/user\/(\d+)\/group(\?.*)?$/, async (route, request) => {
    const url = new URL(request.url())
    const match = url.pathname.match(/\/api\/user\/(\d+)\/group$/)
    if (!match) {
      await route.fallback()
      return
    }
    const userPk = Number(match[1])
    if (request.method() === 'GET') {
      const offset = Number(url.searchParams.get('offset') ?? '0')
      const limit = Number(url.searchParams.get('limit') ?? '50')
      const items = state.groupsByUserPk.get(userPk) ?? []
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          apiSuccess({
            items,
            offset,
            limit,
            count: items.length,
          }),
        ),
      })
      return
    }
    await route.fallback()
  })

  await page.route(/.*\/api\/user\/(\d+)\/group\/(\d+)$/, async (route, request) => {
    const url = new URL(request.url())
    const match = url.pathname.match(/\/api\/user\/(\d+)\/group\/(\d+)$/)
    if (!match) {
      await route.fallback()
      return
    }
    const userPk = Number(match[1])
    const groupId = Number(match[2])
    if (request.method() === 'POST') {
      state.addGroupCalls.push({ userPk, groupId })
      const existing = state.groupsByUserPk.get(userPk) ?? []
      state.groupsByUserPk.set(userPk, [
        ...existing,
        { userPk, groupId, groupCode: `GRP${groupId}`, groupName: `그룹${groupId}` },
      ])
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiNullSuccess()),
      })
      return
    }
    if (request.method() === 'DELETE') {
      state.removeGroupCalls.push({ userPk, groupId })
      const existing = state.groupsByUserPk.get(userPk) ?? []
      state.groupsByUserPk.set(
        userPk,
        existing.filter((row) => row.groupId !== groupId),
      )
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiNullSuccess()),
      })
      return
    }
    await route.fallback()
  })
}

const createDefaultMockState = (): UserApiMockState => ({
  meResponse: { ...PERMISSIONED_ME },
  users: [
    buildUser({ userPk: 1, userId: 'alice', userName: 'Alice', company: '노리', department: 'PE' }),
    buildUser({ userPk: 2, userId: 'bob', userName: 'Bob', company: '노리', department: 'BE' }),
  ],
  groupsByUserPk: new Map<number, MockUserGroupRow[]>([
    [
      1,
      [
        { userPk: 1, groupId: 10, groupCode: 'ADMINS', groupName: '관리자' },
        { userPk: 1, groupId: 11, groupCode: 'OPS', groupName: '운영자' },
      ],
    ],
  ]),
  createUserCalls: [],
  updateUserCalls: [],
  deleteUserCalls: [],
  passwordResetCalls: [],
  addGroupCalls: [],
  removeGroupCalls: [],
})

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

test('topbar User 클릭 시 /user 로 라우팅', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)

  await page.goto('/eqp')
  const userMenu = page.locator('header button:has-text("User")')
  await expect(userMenu).toBeVisible()
  await userMenu.click()

  await expect(page).toHaveURL(/\/user$/)
  await expect(page.getByRole('heading', { name: '사용자 관리' })).toBeVisible()
})

test('사용자 목록 표시', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await page.goto('/user')

  await expect(page.getByTestId('user-list-table')).toBeVisible()
  await expect(page.getByTestId('user-row-1')).toBeVisible()
  await expect(page.getByTestId('user-row-2')).toBeVisible()
  await expect(page.getByTestId('user-row-1')).toContainText('alice')
  await expect(page.getByTestId('user-row-2')).toContainText('bob')
})

test('사용자 등록 성공', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await page.goto('/user')

  await expect(page.getByTestId('user-list-table')).toBeVisible()
  await page.getByTestId('user-create-button').click()
  await page.locator('#user-upsert-company').fill('NoriCo')
  await page.locator('#user-upsert-department').fill('QA')
  await page.locator('#user-upsert-user-name').fill('Charlie')
  await page.locator('#user-upsert-user-id').fill('charlie')
  await page.locator('#user-upsert-email').fill('charlie@nori.co.kr')
  await page.locator('#user-upsert-password').fill('Init12!@xyzZ')
  await page.getByTestId('user-upsert-submit').click()

  await expect.poll(() => state.createUserCalls.length).toBeGreaterThan(0)
  const submittedBody = state.createUserCalls[0].body as Record<string, unknown>
  expect(submittedBody.userId).toBe('charlie')
  expect(submittedBody.password).toBe('Init12!@xyzZ')

  // 새 사용자 행이 테이블에 등장 (cell 텍스트 strict matching 회피를 위해 testid 사용)
  await expect(page.getByTestId('user-list-table').getByText('charlie', { exact: true })).toBeVisible()
})

test('사용자 수정 성공', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await page.goto('/user')

  await expect(page.getByTestId('user-row-1')).toBeVisible()
  await page.getByTestId('user-row-edit-1').click()
  await page.locator('#user-upsert-user-name').fill('Alice-Updated')
  await page.getByTestId('user-upsert-submit').click()

  await expect.poll(() => state.updateUserCalls.length).toBeGreaterThan(0)
  expect(state.updateUserCalls[0].userPk).toBe(1)
  const updatedBody = state.updateUserCalls[0].body as Record<string, unknown>
  expect(updatedBody.userName).toBe('Alice-Updated')
  expect(updatedBody.password).toBeNull()

  await expect(page.getByTestId('user-row-1')).toContainText('Alice-Updated')
})

test('사용자 삭제 성공', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await page.goto('/user')

  await expect(page.getByTestId('user-row-2')).toBeVisible()
  await page.getByTestId('user-row-delete-2').click()
  await page.getByRole('button', { name: '삭제' }).click()

  await expect.poll(() => state.deleteUserCalls.length).toBeGreaterThan(0)
  expect(state.deleteUserCalls[0]).toBe(2)
  await expect(page.getByTestId('user-row-2')).toHaveCount(0)
})

test('비밀번호 초기화 모달', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await page.goto('/user')

  await expect(page.getByTestId('user-row-1')).toBeVisible()
  await page.getByTestId('user-row-reset-1').click()

  const passwordInput = page.getByTestId('user-password-reset-value')
  await expect(passwordInput).toBeVisible()
  await expect.poll(() => passwordInput.inputValue()).toMatch(/^.{12}$/)
  const passwordValue = await passwordInput.inputValue()
  expect(passwordValue).toHaveLength(12)
  expect(passwordValue).toMatch(/[A-Z]/)
  expect(passwordValue).toMatch(/[a-z]/)
  expect(passwordValue).toMatch(/[0-9]/)
  expect(passwordValue).toMatch(/[!@#$%^&*]/)

  await expect.poll(() => state.passwordResetCalls.length).toBeGreaterThan(0)
  expect(state.passwordResetCalls[0].userPk).toBe(1)
  expect(state.passwordResetCalls[0].body.newPassword).toBe(passwordValue)

  await page.getByTestId('user-password-reset-copy').click()
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toBe(passwordValue)
})

test('페이지네이션 prev/next', async ({ page }) => {
  const state = createDefaultMockState()
  state.users = Array.from({ length: 45 }, (_, index) =>
    buildUser({
      userPk: index + 1,
      userId: `user${(index + 1).toString().padStart(2, '0')}`,
      userName: `User ${index + 1}`,
    }),
  )
  state.totalCount = 45
  await setupMocks(page, state)
  const userListRequests: Request[] = []
  page.on('request', (request) => {
    if (request.url().match(/\/api\/user(\?|$)/) && request.method() === 'GET') {
      userListRequests.push(request)
    }
  })
  await page.goto('/user')

  await expect(page.getByTestId('user-list-pagination-summary')).toContainText('45')
  await expect(page.getByTestId('user-list-pagination-summary')).toContainText('1 / 3')

  await page.getByTestId('user-list-next').click()
  await expect
    .poll(() => userListRequests.some((req) => req.url().includes('offset=20')))
    .toBe(true)
  await expect(page.getByTestId('user-list-pagination-summary')).toContainText('2 / 3')

  await page.getByTestId('user-list-prev').click()
  await expect
    .poll(() => userListRequests.filter((req) => req.url().includes('offset=0')).length)
    .toBeGreaterThan(0)
  await expect(page.getByTestId('user-list-pagination-summary')).toContainText('1 / 3')
})

test('권한 없는 사용자는 User 메뉴 미표시', async ({ page }) => {
  const state = createDefaultMockState()
  state.meResponse = { ...UNPERMISSIONED_ME }
  await setupMocks(page, state)

  await page.goto('/eqp')
  // 헤더에 다른 메뉴(Eqp/Model 등) 가 보일 때까지 기다린 뒤 User 메뉴 부재를 검증
  await expect(page.locator('header button:has-text("Eqp")')).toBeVisible()
  expect(await page.locator('header button:has-text("User")').count()).toBe(0)
})

test('/user 직접 접근 차단', async ({ page }) => {
  const state = createDefaultMockState()
  state.meResponse = { ...UNPERMISSIONED_ME }
  await setupMocks(page, state)

  await page.goto('/user')
  await expect(page).toHaveURL(/\/(login|forbidden|eqp)/)
})

// 사용자 행에 소속 그룹을 chip(Badge) 으로 인라인 표시한다.
// (그룹 add/remove 는 Group 페이지 모달에서 관리 — UserListTable 은 표시 전용. Group-AC-7 가 제거를 검증.)
test('사용자 그룹 매핑 표시', async ({ page }) => {
  const state = createDefaultMockState()
  // 기본 fixture 의 alice(userPk 1) 에 소속 그룹 부여.
  state.users[0].groups = [
    { userPk: 1, groupId: 10, groupCode: 'ADMINS', groupName: '관리자' },
    { userPk: 1, groupId: 11, groupCode: 'OPS', groupName: '운영자' },
  ]
  await setupMocks(page, state)
  await page.goto('/user')

  await expect(page.getByTestId('user-row-1')).toBeVisible()

  // 그룹 chip 은 행에 인라인 렌더 (클릭 불필요).
  await expect(page.getByTestId('user-row-group-1-10')).toBeVisible()
  await expect(page.getByTestId('user-row-group-1-11')).toBeVisible()
  await expect(page.getByTestId('user-row-group-1-10')).toContainText('ADMINS')
  await expect(page.getByTestId('user-row-group-1-11')).toContainText('OPS')
})
