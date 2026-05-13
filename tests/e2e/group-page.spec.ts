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
  await expect(page.getByRole('heading', { name: '그룹 관리' })).toBeVisible()
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

interface GroupApiMockState {
  meResponse: typeof PERMISSIONED_ME
  groups: MockGroupRow[]
  totalCount?: number
  createGroupCalls: { body: unknown }[]
  updateGroupCalls: { groupId: number; body: unknown }[]
  deleteGroupCalls: number[]
  addMemberCalls: { userPk: number; groupId: number }[]
  removeMemberCalls: { userPk: number; groupId: number }[]
}

const setupMocks = async (page: Page, state: GroupApiMockState) => {
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

  // /api/user GET — Group 페이지에서는 /api/user 호출이 발생하지 않지만 안전 차원에서 빈 응답.
  await page.route(/.*\/api\/user(\?.*)?$/, async (route, request) => {
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

const createDefaultMockState = (): GroupApiMockState => ({
  meResponse: { ...PERMISSIONED_ME },
  groups: [
    buildGroup({ groupId: 10, groupCode: 'ADMINS', groupName: '관리자' }),
    buildGroup({ groupId: 11, groupCode: 'OPS', groupName: '운영자', isActive: false }),
  ],
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
  await expect(page.getByRole('heading', { name: '그룹 관리' })).toBeVisible()
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
  await page.getByRole('button', { name: '삭제' }).click()

  await expect.poll(() => state.deleteGroupCalls.length).toBeGreaterThan(0)
  expect(state.deleteGroupCalls[0]).toBe(11)
  await expect(page.getByTestId('group-row-11')).toHaveCount(0)
})

// [Group-AC-7] 멤버 추가 → POST /api/user/{userPk}/group/{groupId}, 제거 → DELETE
test('Group-AC-7: 그룹 멤버 추가/제거', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await navigateToGroupPanel(page)

  await expect(page.getByTestId('group-row-10')).toBeVisible()
  await page.getByTestId('group-row-10').click()

  await expect(page.getByTestId('group-member-panel')).toBeVisible()
  await page.getByTestId('group-member-add-input').fill('42')
  await page.getByTestId('group-member-add-submit').click()

  await expect.poll(() => state.addMemberCalls.length).toBeGreaterThan(0)
  expect(state.addMemberCalls[0]).toEqual({ userPk: 42, groupId: 10 })
  await expect(page.getByTestId('group-member-chip-42')).toBeVisible()

  await page.getByTestId('group-member-chip-remove-42').click()
  await expect.poll(() => state.removeMemberCalls.length).toBeGreaterThan(0)
  expect(state.removeMemberCalls[0]).toEqual({ userPk: 42, groupId: 10 })
  await expect(page.getByTestId('group-member-chip-42')).toHaveCount(0)
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
