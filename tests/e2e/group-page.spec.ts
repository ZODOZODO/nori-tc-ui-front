import { expect, test, type Page } from '@playwright/test'

/**
 * `/user` 페이지의 좌측 사이드바 Group 모드 e2e 시나리오 묶음.
 *
 * 모든 백엔드 응답은 `route.fulfill` 로 mock 합니다. user-page.spec.ts 의 mock 패턴과
 * 1:1 대칭으로 작성됩니다.
 */

const navigateToGroupPanel = async (page: Page) => {
  await page.goto('/user')
  await page.getByTestId('user-management-sidebar-group').click()
  // 패널 제목이 i18n(t('group.title'))로 배선돼 locale 따라 텍스트가 바뀌므로,
  // locale 무관한 group-list-table testId 로 Group 패널 활성을 확인한다 (단언 의미 동일).
  await expect(page.getByTestId('group-list-table')).toBeVisible()
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

const buildGroup = (overrides: Partial<MockGroupRow>): MockGroupRow => ({
  groupId: overrides.groupId ?? 1,
  groupCode: overrides.groupCode ?? 'GRP01',
  groupName: overrides.groupName ?? '관리자',
  description: overrides.description ?? '관리자 그룹',
  isActive: overrides.isActive ?? true,
  createdAt: overrides.createdAt ?? '2025-01-01T00:00:00Z',
  updatedAt: overrides.updatedAt ?? '2025-05-01T00:00:00Z',
})

// user.api.ts isUserListItem 이 요구하는 전체 필드 (누락 시 normalizeUserPagePayload 가 행을 필터링).
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
  groups: { groupId: number; groupCode: string; groupName: string }[]
}

const buildUser = (overrides: Partial<MockUserRow> & { userPk: number; userId: string }): MockUserRow => ({
  userIdNorm: overrides.userId.toLowerCase(),
  userName: overrides.userName ?? overrides.userId,
  company: overrides.company ?? '노리',
  department: overrides.department ?? 'PE',
  email: overrides.email ?? `${overrides.userId}@nori.co.kr`,
  status: overrides.status ?? 'ACTIVE',
  createdAt: overrides.createdAt ?? '2025-01-01T00:00:00Z',
  updatedAt: overrides.updatedAt ?? '2025-05-01T00:00:00Z',
  createdBy: overrides.createdBy ?? 'system',
  updatedBy: overrides.updatedBy ?? 'system',
  groups: overrides.groups ?? [],
  ...overrides,
})

interface GroupApiMockState {
  meResponse: typeof PERMISSIONED_ME
  groups: MockGroupRow[]
  // GroupAddMembersModal 의 useAllUsers 가 받는 전체 사용자 (멤버 추가 후보).
  allUsers: MockUserRow[]
  // 그룹별 기존 멤버 (모달의 useGroupMembers + 멤버 제거 대상).
  membersByGroup: Record<number, MockUserRow[]>
  totalCount?: number
  createGroupCalls: { body: unknown }[]
  updateGroupCalls: { groupId: number; body: unknown }[]
  deleteGroupCalls: number[]
  addMemberCalls: { userPk: number; groupId: number }[]
  removeMemberCalls: { userPk: number; groupId: number }[]
}

const setupMocks = async (page: Page, state: GroupApiMockState) => {
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

  // 공유 topbar 의 LineScopeSelector 가 호출하는 GET /api/line — 배열 응답 필수.
  // 미mock 시 401 → api-client interceptor 가 /login 으로 redirect → 모든 /user 진입 테스트 실패.
  await page.route(/.*\/api\/line(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        apiSuccess([
          { lineKey: 1, lineCode: 'LINE1', lineName: 'Line 1' },
          { lineKey: 2, lineCode: 'LINE2', lineName: 'Line 2' },
        ]),
      ),
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

  // /api/user GET — GroupAddMembersModal 의 useAllUsers(getUserList) 가 호출. 멤버 추가 후보 목록.
  await page.route(/.*\/api\/user(\?.*)?$/, async (route, request) => {
    if (request.method() === 'GET') {
      const url = new URL(request.url())
      const offset = Number(url.searchParams.get('offset') ?? '0')
      const limit = Number(url.searchParams.get('limit') ?? '500')
      const slice = state.allUsers.slice(offset, offset + limit)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess({ items: slice, offset, limit, count: state.allUsers.length })),
      })
      return
    }
    await route.fallback()
  })

  // /api/group/{groupId}/user GET — GroupAddMembersModal 의 useGroupMembers (기존 멤버).
  await page.route(/.*\/api\/group\/(\d+)\/user(\?.*)?$/, async (route, request) => {
    const url = new URL(request.url())
    const match = url.pathname.match(/\/api\/group\/(\d+)\/user$/)
    if (!match || request.method() !== 'GET') {
      await route.fallback()
      return
    }
    const groupId = Number(match[1])
    const members = state.membersByGroup[groupId] ?? []
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        apiSuccess({ items: members, offset: 0, limit: 500, count: members.length }),
      ),
    })
  })

  await page.route(/.*\/api\/group(\?.*)?$/, async (route, request) => {
    const method = request.method()
    if (method === 'GET') {
      const url = new URL(request.url())
      const offset = Number(url.searchParams.get('offset') ?? '0')
      const limit = Number(url.searchParams.get('limit') ?? '20')
      const slice = state.groups.slice(offset, offset + limit)
      const count = state.totalCount ?? state.groups.length
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess({ items: slice, offset, limit, count })),
      })
      return
    }
    if (method === 'POST') {
      const body = request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')
      state.createGroupCalls.push({ body })
      const created = buildGroup({
        groupId: state.groups.length + 1000,
        groupCode: String((body as Record<string, unknown>).groupCode ?? 'NEWGRP'),
        groupName: String((body as Record<string, unknown>).groupName ?? '신규 그룹'),
        description:
          typeof (body as Record<string, unknown>).description === 'string'
            ? String((body as Record<string, unknown>).description)
            : null,
        isActive:
          typeof (body as Record<string, unknown>).isActive === 'boolean'
            ? Boolean((body as Record<string, unknown>).isActive)
            : true,
      })
      state.groups.push(created)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess(created)),
      })
      return
    }
    await route.fallback()
  })

  await page.route(/.*\/api\/group\/(\d+)$/, async (route, request) => {
    const url = new URL(request.url())
    const match = url.pathname.match(/\/api\/group\/(\d+)$/)
    if (!match) {
      await route.fallback()
      return
    }
    const groupId = Number(match[1])
    const method = request.method()
    if (method === 'GET') {
      const found = state.groups.find((group) => group.groupId === groupId)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(found ? apiSuccess(found) : apiSuccess(buildGroup({ groupId }))),
      })
      return
    }
    if (method === 'PUT') {
      const body = request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')
      state.updateGroupCalls.push({ groupId, body })
      const existingIndex = state.groups.findIndex((group) => group.groupId === groupId)
      const updated = buildGroup({
        groupId,
        groupCode: String((body as Record<string, unknown>).groupCode ?? `GRP${groupId}`),
        groupName: String((body as Record<string, unknown>).groupName ?? ''),
        description:
          typeof (body as Record<string, unknown>).description === 'string'
            ? String((body as Record<string, unknown>).description)
            : null,
        isActive:
          typeof (body as Record<string, unknown>).isActive === 'boolean'
            ? Boolean((body as Record<string, unknown>).isActive)
            : true,
      })
      if (existingIndex >= 0) {
        state.groups[existingIndex] = updated
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess(updated)),
      })
      return
    }
    if (method === 'DELETE') {
      state.deleteGroupCalls.push(groupId)
      state.groups = state.groups.filter((group) => group.groupId !== groupId)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiNullSuccess()),
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
      state.addMemberCalls.push({ userPk, groupId })
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiNullSuccess()),
      })
      return
    }
    if (request.method() === 'DELETE') {
      state.removeMemberCalls.push({ userPk, groupId })
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

const ADMINS_GROUP_SUMMARY = { groupId: 10, groupCode: 'ADMINS', groupName: '관리자' }

const createDefaultMockState = (): GroupApiMockState => ({
  meResponse: { ...PERMISSIONED_ME },
  groups: [
    buildGroup({ groupId: 10, groupCode: 'ADMINS', groupName: '관리자' }),
    buildGroup({ groupId: 11, groupCode: 'OPS', groupName: '운영자', isActive: false }),
  ],
  allUsers: [
    // userPk 50 은 ADMINS(10) 기존 멤버 (제거 대상), 42 는 미가입 (추가 대상).
    buildUser({ userPk: 50, userId: 'member', userName: 'Member', department: 'OP', groups: [ADMINS_GROUP_SUMMARY] }),
    buildUser({ userPk: 42, userId: 'newbie', userName: 'Newbie', department: 'QA' }),
  ],
  membersByGroup: {
    10: [buildUser({ userPk: 50, userId: 'member', userName: 'Member', department: 'OP', groups: [ADMINS_GROUP_SUMMARY] })],
  },
  createGroupCalls: [],
  updateGroupCalls: [],
  deleteGroupCalls: [],
  addMemberCalls: [],
  removeMemberCalls: [],
})

// [Group-AC-1] /user 진입 후 좌측 사이드바의 Group 항목 클릭으로 그룹 패널이 활성화된다.
test('Group-AC-1 / Group-AC-2: /user 사이드바 Group 클릭 시 그룹 패널 활성화', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)

  await page.goto('/eqp')
  const userMenu = page.locator('header button:has-text("User")')
  await expect(userMenu).toBeVisible()
  await userMenu.click()

  await expect(page).toHaveURL(/\/user$/)
  await page.getByTestId('user-management-sidebar-group').click()
  // 패널 제목이 i18n(t('group.title'))로 배선돼 locale 따라 텍스트가 바뀌므로,
  // locale 무관한 group-list-table testId 로 Group 패널 활성을 확인한다 (단언 의미 동일).
  await expect(page.getByTestId('group-list-table')).toBeVisible()
})

// [Group-AC-3] /api/group?offset=0&limit=20 mock 으로 목록 표시
test('Group-AC-3: 그룹 목록 표시', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await navigateToGroupPanel(page)

  await expect(page.getByTestId('group-list-table')).toBeVisible()
  await expect(page.getByTestId('group-row-10')).toBeVisible()
  await expect(page.getByTestId('group-row-11')).toBeVisible()
  await expect(page.getByTestId('group-row-10')).toContainText('ADMINS')
  await expect(page.getByTestId('group-row-11')).toContainText('OPS')
})

// [Group-AC-4] 그룹 등록 → POST /api/group → 목록에 추가
test('Group-AC-4: 그룹 등록 성공', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await navigateToGroupPanel(page)

  await expect(page.getByTestId('group-list-table')).toBeVisible()
  await page.getByTestId('group-create-button').click()
  await page.locator('#group-upsert-code').fill('QATEST')
  await page.locator('#group-upsert-name').fill('QA 테스트 그룹')
  await page.locator('#group-upsert-description').fill('QA 전용')
  await page.getByTestId('group-upsert-submit').click()

  await expect.poll(() => state.createGroupCalls.length).toBeGreaterThan(0)
  const submittedBody = state.createGroupCalls[0].body as Record<string, unknown>
  expect(submittedBody.groupCode).toBe('QATEST')
  expect(submittedBody.groupName).toBe('QA 테스트 그룹')
  expect(submittedBody.isActive).toBe(true)

  // 새 그룹 행이 테이블에 등장
  await expect(page.getByTestId('group-list-table').getByText('QATEST', { exact: true })).toBeVisible()
})

// [Group-AC-5] 그룹 수정 → PUT /api/group/{groupId} → 행 갱신
test('Group-AC-5: 그룹 수정 성공', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await navigateToGroupPanel(page)

  await expect(page.getByTestId('group-row-10')).toBeVisible()
  await page.getByTestId('group-row-edit-10').click()
  await page.locator('#group-upsert-name').fill('관리자-수정')
  await page.getByTestId('group-upsert-submit').click()

  await expect.poll(() => state.updateGroupCalls.length).toBeGreaterThan(0)
  expect(state.updateGroupCalls[0].groupId).toBe(10)
  const updatedBody = state.updateGroupCalls[0].body as Record<string, unknown>
  expect(updatedBody.groupName).toBe('관리자-수정')

  await expect(page.getByTestId('group-row-10')).toContainText('관리자-수정')
})

// [Group-AC-6] 그룹 삭제 → DELETE /api/group/{groupId} → 행 제거
test('Group-AC-6: 그룹 삭제 성공', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await navigateToGroupPanel(page)

  await expect(page.getByTestId('group-row-11')).toBeVisible()
  await page.getByTestId('group-row-delete-11').click()
  // e2e 는 EN 모드 — P6 i18n 적용으로 ConfirmDialog 확인 버튼이 common.delete('Delete') 로 전환됨.
  await page.getByRole('button', { name: 'Delete' }).click()

  await expect.poll(() => state.deleteGroupCalls.length).toBeGreaterThan(0)
  expect(state.deleteGroupCalls[0]).toBe(11)
  await expect(page.getByTestId('group-row-11')).toHaveCount(0)
})

// [Group-AC-7] 그룹 행의 멤버 버튼 → GroupAddMembersModal:
//   - 미가입 사용자 체크 + 추가 → POST /api/user/{userPk}/group/{groupId}
//   - 기존 멤버 "멤버 제거" → DELETE /api/user/{userPk}/group/{groupId}
// (멤버십 add/remove 는 Group 페이지 모달에서 관리 — UserListTable 은 표시만.)
test('Group-AC-7: 그룹 멤버 추가/제거', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await navigateToGroupPanel(page)

  await expect(page.getByTestId('group-row-10')).toBeVisible()
  // 행의 멤버 관리 버튼 → 모달 오픈.
  await page.getByTestId('group-row-members-10').click()
  await expect(page.getByTestId('group-add-members-list')).toBeVisible()

  // 추가: 미가입 사용자 42 체크 → 추가.
  await page.getByTestId('group-add-members-checkbox-42').check()
  await page.getByTestId('group-add-members-submit').click()

  await expect.poll(() => state.addMemberCalls.length).toBeGreaterThan(0)
  expect(state.addMemberCalls[0]).toEqual({ userPk: 42, groupId: 10 })
  // EN 모드 — group.members.resultSummary = 'Added {{added}} / failed {{failed}}'.
  await expect(page.getByTestId('group-add-members-result')).toContainText('Added 1')

  // 제거: 기존 멤버 50 의 "멤버 제거" → DELETE.
  await page.getByTestId('group-member-remove-50').click()
  await expect.poll(() => state.removeMemberCalls.length).toBeGreaterThan(0)
  expect(state.removeMemberCalls[0]).toEqual({ userPk: 50, groupId: 10 })
})

// [Group-AC-8] USER_READ 없는 사용자에게 User 메뉴 미표시 + /user 직접 접근 차단
// 단일 topbar User 메뉴로 통합된 이후 Group 단독 메뉴는 존재하지 않으므로 User 메뉴 부재만 검증한다.
test('Group-AC-8a: 권한 없는 사용자는 User 메뉴 미표시 (Group 사이드바 자체에 도달 불가)', async ({ page }) => {
  const state = createDefaultMockState()
  state.meResponse = { ...UNPERMISSIONED_ME }
  await setupMocks(page, state)

  await page.goto('/eqp')
  await expect(page.locator('header button:has-text("Eqp")')).toBeVisible()
  expect(await page.locator('header button:has-text("User")').count()).toBe(0)
})

test('Group-AC-8b: 권한 없는 사용자가 /user 직접 접근 시 차단', async ({ page }) => {
  const state = createDefaultMockState()
  state.meResponse = { ...UNPERMISSIONED_ME }
  await setupMocks(page, state)

  await page.goto('/user')
  await expect(page).toHaveURL(/\/(login|forbidden|eqp)/)
})

// [Group-AC-9/10] 그룹 행의 권한 버튼 → GroupPermissionsModal:
//   - GET /api/permission 카탈로그를 카테고리 그룹핑 + 활성 권한만 표시 (비활성 제외)
//   - GET /api/group/{groupId}/permission 의 permId 로 체크 상태 결정
//   - 체크는 로컬 draft, 저장 시 일괄 POST/DELETE, 취소 시 폐기
const PERMISSION_CATALOG = [
  { permId: 1, permCode: 'EQP_READ', permName: '설비 조회', resourceType: 'API', resource: '/api/eqp', httpMethod: 'GET', description: null, isActive: true },
  { permId: 2, permCode: 'EQP_WRITE', permName: '설비 변경', resourceType: 'API', resource: '/api/eqp', httpMethod: null, description: null, isActive: true },
  { permId: 3, permCode: 'DEPLOY_READ', permName: 'Deploy 조회', resourceType: 'API', resource: '/api/deploys', httpMethod: 'GET', description: null, isActive: true },
  { permId: 9, permCode: 'LEGACY_INACTIVE', permName: '비활성 권한', resourceType: 'API', resource: '/api/legacy', httpMethod: 'GET', description: null, isActive: false },
] as const

// setupMocks 이후 등록 → 권한 라우트가 우선 매칭된다. AC-9/AC-10 공유.
const setupGroupPermissionMocks = async (
  page: Page,
  grantedPermIds: Set<number>,
  grantCalls: number[],
  revokeCalls: number[],
) => {
  await page.route(/.*\/api\/permission(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        apiSuccess({ items: PERMISSION_CATALOG, offset: 0, limit: 500, count: PERMISSION_CATALOG.length }),
      ),
    })
  })

  await page.route(/.*\/api\/group\/(\d+)\/permission(\/(\d+))?(\?.*)?$/, async (route, request) => {
    const url = new URL(request.url())
    const match = url.pathname.match(/\/api\/group\/(\d+)\/permission(?:\/(\d+))?$/)
    if (!match) {
      await route.fallback()
      return
    }
    const groupId = Number(match[1])
    const permId = match[2] ? Number(match[2]) : null
    const method = request.method()

    if (method === 'GET' && permId === null) {
      const items = Array.from(grantedPermIds).map((id) => ({
        ugpKey: id * 100,
        groupId,
        permId: id,
        grantedAt: '2025-05-01T00:00:00Z',
        grantedBy: 'SEED',
      }))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess({ items, offset: 0, limit: 500, count: items.length })),
      })
      return
    }
    if (method === 'POST' && permId !== null) {
      grantCalls.push(permId)
      grantedPermIds.add(permId)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess({ ugpKey: permId * 100, groupId, permId, grantedAt: '2025-05-01T00:00:00Z', grantedBy: 'admin' })),
      })
      return
    }
    if (method === 'DELETE' && permId !== null) {
      revokeCalls.push(permId)
      grantedPermIds.delete(permId)
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

test('Group-AC-9: 권한 편집 스테이징 후 저장 시 일괄 적용', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)

  const grantedPermIds = new Set<number>([1]) // EQP_READ 초기 보유
  const grantCalls: number[] = []
  const revokeCalls: number[] = []
  await setupGroupPermissionMocks(page, grantedPermIds, grantCalls, revokeCalls)

  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text())
    }
  })
  page.on('pageerror', (error) => {
    consoleErrors.push(error.message)
  })

  await navigateToGroupPanel(page)
  await expect(page.getByTestId('group-row-10')).toBeVisible()

  // 행의 권한 관리 버튼 → 모달 오픈.
  await page.getByTestId('group-row-permissions-10').click()
  await expect(page.getByTestId('group-permissions-list')).toBeVisible()

  // 활성 권한 3개 표시, 비활성(permId 9) 미표시.
  await expect(page.getByTestId('group-permissions-row-1')).toBeVisible()
  await expect(page.getByTestId('group-permissions-row-2')).toBeVisible()
  await expect(page.getByTestId('group-permissions-row-3')).toBeVisible()
  await expect(page.getByTestId('group-permissions-row-9')).toHaveCount(0)

  // 요약: 활성 3개 중 1개 보유.
  await expect(page.getByTestId('group-permissions-summary')).toContainText('1 / 3')

  // 초기 체크 상태: EQP_READ(1) 보유, EQP_WRITE(2) 미보유.
  await expect(page.getByTestId('group-permissions-checkbox-1')).toBeChecked()
  await expect(page.getByTestId('group-permissions-checkbox-2')).not.toBeChecked()

  // 스테이징: 토글은 로컬 draft 만 변경 — 저장 전 API 호출 없음.
  await page.getByTestId('group-permissions-checkbox-2').click() // grant 2
  await page.getByTestId('group-permissions-checkbox-1').click() // revoke 1
  await expect(page.getByTestId('group-permissions-checkbox-2')).toBeChecked()
  await expect(page.getByTestId('group-permissions-checkbox-1')).not.toBeChecked()
  expect(grantCalls).toEqual([])
  expect(revokeCalls).toEqual([])

  // 저장 → 변경분 일괄 적용(POST 2, DELETE 1) 후 모달 닫힘.
  await page.getByTestId('group-permissions-save').click()
  await expect.poll(() => grantCalls).toContain(2)
  await expect.poll(() => revokeCalls).toContain(1)
  await expect(page.getByTestId('group-permissions-list')).toHaveCount(0)

  expect(consoleErrors).toEqual([])
})

test('Group-AC-10: 권한 편집 취소 시 변경 폐기 (API 호출 없음)', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)

  const grantedPermIds = new Set<number>([1])
  const grantCalls: number[] = []
  const revokeCalls: number[] = []
  await setupGroupPermissionMocks(page, grantedPermIds, grantCalls, revokeCalls)

  await navigateToGroupPanel(page)
  await page.getByTestId('group-row-permissions-10').click()
  await expect(page.getByTestId('group-permissions-list')).toBeVisible()

  // 토글(로컬) → 취소 → 변경 폐기 + 모달 닫힘, API 호출 0.
  await page.getByTestId('group-permissions-checkbox-2').click()
  await page.getByTestId('group-permissions-checkbox-1').click()
  await page.getByTestId('group-permissions-cancel').click()
  await expect(page.getByTestId('group-permissions-list')).toHaveCount(0)
  expect(grantCalls).toEqual([])
  expect(revokeCalls).toEqual([])
})
