import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * plc-gateway Phase 5: model tree 의 PLC 분류 + PLC 디테일 노드 렌더 e2e.
 *
 * - 좌측 사이드바에 PLC 섹션이 렌더되고 PLC 모델이 그 아래에 분류된다 (L1366 트리 렌더).
 * - PLC 모델은 SECS 섹션에는 나타나지 않는다 (오분류 음성 L1367).
 * - PLC 모델 상세 진입 시 plc-group / plc-register 디테일 노드 라벨이 렌더된다 (L1366 노드 렌더).
 *   (PoC 는 노드 내용 조회 백엔드가 없어 라벨만 — 클릭 시 신규 조회 호출 없음.)
 * - console error / pageerror 0 동반 단언.
 */

const createApiResponse = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const createNullSuccessResponse = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const PLC_MODEL = {
  modelVersionKey: 700,
  modelKey: 70,
  modelName: 'PLC_MODEL',
  parentModel: null,
  modelVersion: '1.0.0',
  commInterface: 'PLC' as const,
  status: 'OPERATE',
  description: 'plc root',
  maker: 'demo',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

const SECS_MODEL = {
  modelVersionKey: 100,
  modelKey: 10,
  modelName: 'SECS_MODEL',
  parentModel: null,
  modelVersion: '1.0.0',
  commInterface: 'SECS' as const,
  status: 'OPERATE',
  description: 'secs root',
  maker: 'demo',
  createdAt: '2026-06-01T00:00:00Z',
  updatedAt: '2026-06-01T00:00:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

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

      // 공유 topbar 의 LineScopeSelector 가 배열을 요구한다 — 객체로 응답 시 .map 크래시.
      if (pathname === '/api/line' && method === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(createApiResponse([])) })
        return
      }

      if (pathname === '/api/model' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({ items: [SECS_MODEL, PLC_MODEL], offset: 0, limit: 500, count: 2 }),
          ),
        })
        return
      }

      if (pathname === `/api/model/${PLC_MODEL.modelVersionKey}` && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(PLC_MODEL)),
        })
        return
      }

      if (pathname === `/api/model/${SECS_MODEL.modelVersionKey}` && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(SECS_MODEL)),
        })
        return
      }

      // 모든 상세 노드 조회 — 빈 응답 (plc-group/plc-register 는 가드로 호출되지 않지만
      // mdf/dcop-itemes 등 prefetch 노드가 호출될 수 있어 안전하게 빈 응답 처리).
      const detailsMatch = pathname.match(/^\/api\/model\/(\d+)\/details\/([\w-]+)$/)
      if (detailsMatch && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse({ columns: [], rows: [], mdfContents: [] })),
        })
        return
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(createApiResponse({ items: [], offset: 0, limit: 500, count: 0 })),
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

const attachConsoleGuards = (page: Page) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })
  return { consoleErrors, pageErrors }
}

test('PLC 모델은 PLC 섹션 아래에만 분류되고 SECS 섹션에는 나타나지 않는다 (오분류 음성)', async ({
  page,
}) => {
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/model')
  await page.waitForLoadState('networkidle')

  // PLC 섹션 헤더가 사이드바에 존재한다.
  await expect(page.getByRole('button', { name: 'PLC', exact: true })).toBeVisible()

  // SECS 섹션만 펼쳤을 때: SECS_MODEL 만 보이고 PLC_MODEL 은 보이지 않는다 (오분류 음성).
  await page.getByRole('button', { name: 'SECS', exact: true }).click()
  await expect(page.getByRole('button', { name: 'SECS_MODEL', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'PLC_MODEL', exact: true })).toHaveCount(0)

  // PLC 섹션을 펼치면 PLC_MODEL 이 그 아래에 나타난다.
  await page.getByRole('button', { name: 'PLC', exact: true }).click()
  await expect(page.getByRole('button', { name: 'PLC_MODEL', exact: true })).toBeVisible()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('PLC 모델 상세 진입 시 plc-group / plc-register 디테일 노드 라벨이 렌더된다', async ({ page }) => {
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/model')
  await page.waitForLoadState('networkidle')

  // PLC 섹션 → PLC_MODEL 선택 → ModelInfoTable 행 더블클릭으로 상세 탭 오픈.
  await page.getByRole('button', { name: 'PLC', exact: true }).click()
  await page.getByRole('button', { name: 'PLC_MODEL', exact: true }).click()
  const modelRow = page.getByRole('row', { name: /PLC_MODEL/ }).first()
  await modelRow.dblclick()

  // 상세 패널 좌측 노드 목록에 PLC 전용 노드 라벨이 렌더된다.
  await expect(page.getByRole('button', { name: 'PLC Group', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'PLC Register', exact: true })).toBeVisible()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
