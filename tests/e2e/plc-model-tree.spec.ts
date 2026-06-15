import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * plc-gateway Phase 5: model tree 의 PLC 분류 + PLC 디테일 노드 렌더 e2e.
 *
 * - 좌측 사이드바에 PLC 섹션이 렌더되고 PLC 모델이 그 아래에 분류된다 (L1366 트리 렌더).
 * - PLC 모델은 SECS 섹션에는 나타나지 않는다 (오분류 음성 L1367).
 * - PLC 모델 상세 진입 시 plc-group / plc-register 디테일 노드 라벨이 렌더된다 (L1366 노드 렌더).
 * - plc-group 노드 선택 시 조회 백엔드 응답의 컬럼/행이 실제 테이블로 렌더된다(placeholder 제거 검증).
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

      // 상세 노드 조회. plc-group 은 7 컬럼 카탈로그 + 샘플 1 행을 반환해 노드가 placeholder 가
      // 아닌 실제 편집 테이블로 렌더됨을 검증한다. 그 외 노드는 빈 응답(prefetch mdf/dcop-itemes 등).
      const detailsMatch = pathname.match(/^\/api\/model\/(\d+)\/details\/([\w-]+)$/)
      if (detailsMatch && method === 'GET') {
        const node = detailsMatch[2]
        const payload =
          node === 'plc-group'
            ? {
                columns: [
                  'Message Name', 'Area', 'Start Address', 'Read Count',
                  'Poll Period (ms)', 'Address Qualifier', 'Description',
                ],
                rows: [
                  {
                    id: 'plcgroup:7',
                    values: ['STATUS_REPORT', 'HOLDING_REGISTER', '0', '10', '1000', '', 'status block'],
                    previewValues: ['STATUS_REPORT', 'HOLDING_REGISTER', '0', '10', '1000', '', 'status block'],
                  },
                ],
                mdfContents: [],
              }
            : { columns: [], rows: [], mdfContents: [] }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(payload)),
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

  // 상세 패널 좌측 노드 목록에 PLC 전용 노드 + 공통 노드(파라미터/MES/MDF/DCOP) 라벨이 렌더된다.
  await expect(page.getByRole('button', { name: 'PLC Group', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'PLC Register', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Model Parameter', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'MES Message', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'MDF', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Dcop Itemes', exact: true })).toBeVisible()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('PLC 모델 plc-group 노드 선택 시 카탈로그 컬럼/행이 실제 테이블로 렌더된다 (placeholder 제거)', async ({
  page,
}) => {
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/model')
  await page.waitForLoadState('networkidle')

  await page.getByRole('button', { name: 'PLC', exact: true }).click()
  await page.getByRole('button', { name: 'PLC_MODEL', exact: true }).click()
  const modelRow = page.getByRole('row', { name: /PLC_MODEL/ }).first()
  await modelRow.dblclick()

  // plc-group 노드 선택 → 조회 응답의 컬럼 헤더와 샘플 행이 테이블로 렌더된다(빈 placeholder 아님).
  await page.getByRole('button', { name: 'PLC Group', exact: true }).click()

  await expect(page.getByText('Message Name', { exact: true })).toBeVisible()
  await expect(page.getByText('Read Count', { exact: true })).toBeVisible()
  await expect(page.getByText('Poll Period (ms)', { exact: true })).toBeVisible()
  await expect(page.getByText('STATUS_REPORT', { exact: true })).toBeVisible()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
