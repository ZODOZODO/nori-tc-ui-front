import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * 정밀 분석 (b) — group 피처 모달 시각 스윕 (Playwright 로컬 렌더, Claude API 미사용).
 *
 * 테이블 오버플로우 클래스는 별도 스펙이 가드한다. 여기서는 폼/리스트형 모달이 worst-case
 * 데이터(전 카테고리 + 긴 권한명/설명/코드, 긴 그룹명/설명, 멤버 다수)에서 비율/줄바꿈/뱃지
 * 정렬이 깨지지 않는지 **실제 렌더 스크린샷**으로 확인한다. 각 모달은:
 *   1) console.error / pageerror 0 (크래시 = 백지) — 결정론적 단언.
 *   2) test-results 에 스크린샷 저장 → 사람이 비율/시각 깨짐을 눈으로 판정.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNull = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = { userPk: 100, userId: 'admin', permissionCodes: ['USER_READ', 'USER_WRITE'] }

const GROUPS = [
  {
    groupId: 10,
    groupCode: 'PLATFORM_ADMINISTRATORS_FULL_ACCESS',
    groupName: '플랫폼 전체 관리자 — 설비/모델/배포/DLQ/사용자 통합 운영 그룹',
    description:
      '게이트웨이/비즈니스/UI 백엔드 전 영역에 대한 읽기·쓰기 권한을 보유한 최상위 운영 그룹입니다. 다운스트림 13개 레포에 영향을 주는 스키마 변경 승인 권한 포함.',
    isActive: true,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-05-01T00:00:00Z',
  },
  {
    groupId: 11,
    groupCode: 'OPS',
    groupName: '운영자',
    description: null,
    isActive: false,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-05-01T00:00:00Z',
  },
]

// worst-case: 8개 카테고리 전부 + 카테고리별 다수 + 긴 permName/permCode/description.
const longDesc = (label: string) =>
  `${label} 권한입니다. 이 권한은 다운스트림 게이트웨이 라우팅 파티션과 샤드 리스 조인을 통해 산출되는 설비 토폴로지에 대한 접근을 통제하며, 비활성 시 closed-by-default 정책에 따라 API 가 403 을 반환합니다.`

const PERMISSION_CATALOG = [
  { permId: 1, permCode: 'EQP_READ_MASTER_TOPOLOGY', permName: '설비 마스터 토폴로지 및 게이트웨이 동기화 상태 조회', resourceType: 'API', resource: '/api/eqp', httpMethod: 'GET', description: longDesc('설비 조회'), isActive: true },
  { permId: 2, permCode: 'EQP_WRITE', permName: '설비 변경', resourceType: 'API', resource: '/api/eqp', httpMethod: null, description: null, isActive: true },
  { permId: 3, permCode: 'COMM_LOG_VIEW', permName: '설비 통신 로그 뷰어', resourceType: 'API', resource: '/api/eqp/comm-log', httpMethod: 'GET', description: null, isActive: true },
  { permId: 4, permCode: 'MODEL_READ', permName: '모델 카탈로그 조회', resourceType: 'API', resource: '/api/model', httpMethod: 'GET', description: longDesc('모델 조회'), isActive: true },
  { permId: 5, permCode: 'MODEL_WRITE_CHECKIN_AND_PARENT_COMMIT', permName: '모델 체크인 및 Parent Model Commit 수행', resourceType: 'API', resource: '/api/model', httpMethod: 'POST', description: null, isActive: true },
  { permId: 6, permCode: 'DEPLOY_READ', permName: 'Deploy 조회', resourceType: 'API', resource: '/api/deploys', httpMethod: 'GET', description: null, isActive: true },
  { permId: 7, permCode: 'DEPLOY_WRITE', permName: 'Deploy 등록 및 모니터링', resourceType: 'API', resource: '/api/deploys', httpMethod: null, description: longDesc('배포'), isActive: true },
  { permId: 8, permCode: 'DLQ_READ', permName: 'DLQ 조회', resourceType: 'API', resource: '/api/dlq', httpMethod: 'GET', description: null, isActive: true },
  { permId: 9, permCode: 'DLQ_REPROCESS', permName: 'DLQ 재처리', resourceType: 'API', resource: '/api/dlq/reprocess', httpMethod: 'POST', description: null, isActive: true },
  { permId: 10, permCode: 'LIVE_MAP_VIEW', permName: '라이브맵 3D 뷰어 조회', resourceType: 'API', resource: '/api/live-map', httpMethod: 'GET', description: longDesc('라이브맵'), isActive: true },
  { permId: 11, permCode: 'DASH_OVERVIEW', permName: '대시보드 개요', resourceType: 'API', resource: '/api/dashboard', httpMethod: 'GET', description: null, isActive: true },
  { permId: 12, permCode: 'USER_READ', permName: '사용자 조회', resourceType: 'API', resource: '/api/user', httpMethod: 'GET', description: null, isActive: true },
  { permId: 13, permCode: 'GROUP_WRITE', permName: '그룹 및 권한 관리', resourceType: 'API', resource: '/api/group', httpMethod: null, description: longDesc('그룹 관리'), isActive: true },
  { permId: 14, permCode: 'PERMISSION_GRANT', permName: '권한 부여/회수', resourceType: 'API', resource: '/api/permission', httpMethod: 'POST', description: null, isActive: true },
  { permId: 15, permCode: 'AUTH_IMPERSONATE', permName: '인증 위임', resourceType: 'API', resource: '/api/auth/impersonate', httpMethod: 'POST', description: null, isActive: true },
  { permId: 16, permCode: 'LINE_SCOPE_SWITCH', permName: '라인 스코프 전환', resourceType: 'API', resource: '/api/line', httpMethod: 'GET', description: null, isActive: true },
  { permId: 17, permCode: 'XYZ_UNCATEGORIZED_LEGACY_FEATURE_TOGGLE', permName: '미분류 레거시 기능 토글 — 카테고리 매칭 안 되는 etc 버킷', resourceType: 'API', resource: '/api/legacy/feature', httpMethod: null, description: longDesc('기타'), isActive: true },
  { permId: 99, permCode: 'LEGACY_INACTIVE', permName: '비활성 권한(표시 안 됨)', resourceType: 'API', resource: '/api/legacy', httpMethod: 'GET', description: null, isActive: false },
]

const MANY_USERS = Array.from({ length: 12 }, (_, i) => {
  const pk = 40 + i
  return {
    userPk: pk,
    userId: `user_with_a_fairly_long_login_id_${pk}`,
    userIdNorm: `user_with_a_fairly_long_login_id_${pk}`,
    userName: `사용자 이름이 제법 긴 케이스 ${pk}`,
    company: '노리시스템',
    department: '플랫폼 엔지니어링 / 제어 통신 파트',
    email: `user${pk}@norisystem.co.kr`,
    status: 'ACTIVE',
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-05-01T00:00:00Z',
    createdBy: 'system',
    updatedBy: 'system',
    groups: [] as { groupId: number; groupCode: string; groupName: string }[],
  }
})

const setupMocks = async (page: Page) => {
  await page.route(
    (url) => {
      const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
      return pathname.startsWith('/api/')
    },
    async (route: Route, request) => {
      const url = new URL(request.url())
      const p = url.pathname
      const method = request.method()

      if (p === '/api/auth/csrf') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(apiNull()) })
      if (p === '/api/auth/me') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ME)) })
      if (p === '/api/line') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }])) })
      if (p === '/api/permission') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: PERMISSION_CATALOG, offset: 0, limit: 500, count: PERMISSION_CATALOG.length })) })

      const groupPermMatch = p.match(/^\/api\/group\/(\d+)\/permission$/)
      if (groupPermMatch && method === 'GET') {
        // 일부만 보유 — granted/non-granted 혼합 체크 상태 렌더.
        const items = [1, 4, 6, 10].map((id) => ({ ugpKey: id * 100, groupId: Number(groupPermMatch[1]), permId: id, grantedAt: '2025-05-01T00:00:00Z', grantedBy: 'SEED' }))
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items, offset: 0, limit: 500, count: items.length })) })
      }

      const groupMembersMatch = p.match(/^\/api\/group\/(\d+)\/user$/)
      if (groupMembersMatch && method === 'GET') {
        // 기존 멤버 2명.
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: MANY_USERS.slice(0, 2), offset: 0, limit: 500, count: 2 })) })
      }

      if (p === '/api/user' && method === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: MANY_USERS, offset: 0, limit: 500, count: MANY_USERS.length })) })
      }

      if (p === '/api/group' && method === 'GET') {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: GROUPS, offset: 0, limit: 20, count: GROUPS.length })) })
      }

      // GroupUpsertModal 편집 모드는 useGroupDetail 로 /api/group/{id} 를 fetch 한다 (목록 행 재사용 아님).
      const groupDetailMatch = p.match(/^\/api\/group\/(\d+)$/)
      if (groupDetailMatch && method === 'GET') {
        const found = GROUPS.find((g) => g.groupId === Number(groupDetailMatch[1])) ?? GROUPS[0]
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(found)) })
      }

      // eqp/model 등 출발점 잡음 방지.
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 50, count: 0 })) })
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

const gotoGroupPanel = async (page: Page) => {
  await page.addInitScript(() => window.localStorage.setItem('nori-tc-lang', 'ko'))
  await page.goto('/user')
  await page.getByTestId('user-management-sidebar-group').click()
  await expect(page.getByTestId('group-list-table')).toBeVisible()
}

test('GroupPermissionsModal — 전 카테고리 + 긴 권한명/설명 worst-case 시각', async ({ page }) => {
  test.setTimeout(60_000)
  const errors = attachErrorSink(page, 'group-permissions')
  await setupMocks(page)
  await gotoGroupPanel(page)

  await page.getByTestId('group-row-permissions-10').click()
  await expect(page.getByTestId('group-permissions-list')).toBeVisible()
  await expect(page.getByTestId('group-permissions-row-1')).toBeVisible()
  await page.waitForTimeout(400)

  await page.screenshot({ path: 'test-results/visual-group-permissions.png' })
  const dialog = page.getByRole('dialog')
  const box = await dialog.boundingBox()

  console.log('GROUP_PERM_DIALOG', JSON.stringify({ w: Math.round(box?.width ?? 0), h: Math.round(box?.height ?? 0) }))

  expect(errors, errors.join('\n')).toEqual([])
})

test('GroupUpsertModal — 긴 그룹명/설명 편집 폼 시각', async ({ page }) => {
  test.setTimeout(60_000)
  const errors = attachErrorSink(page, 'group-upsert')
  await setupMocks(page)
  await gotoGroupPanel(page)

  await page.getByTestId('group-row-edit-10').click()
  await expect(page.locator('#group-upsert-name')).toBeVisible()
  await page.waitForTimeout(300)

  await page.screenshot({ path: 'test-results/visual-group-upsert.png' })
  expect(errors, errors.join('\n')).toEqual([])
})

test('GroupAddMembersModal — 멤버 다수 + 긴 사용자명/부서 시각', async ({ page }) => {
  test.setTimeout(60_000)
  const errors = attachErrorSink(page, 'group-add-members')
  await setupMocks(page)
  await gotoGroupPanel(page)

  await page.getByTestId('group-row-members-10').click()
  await expect(page.getByTestId('group-add-members-list')).toBeVisible()
  await page.waitForTimeout(400)

  await page.screenshot({ path: 'test-results/visual-group-add-members.png' })
  expect(errors, errors.join('\n')).toEqual([])
})
