import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * SPEC `selectable-table-rollout` R1 — `SelectableTable` 제네릭 컴포넌트 추출 + PoC
 * 마이그레이션 e2e. model-parameter 노드에서 사각형 영역 선택 / Ctrl+C TSV / Excel TSV
 * Ctrl+V paste 의 정상 동작을 검증합니다.
 *
 * mock 패턴은 `model-flow.spec.ts` 와 동일 — `/api/` prefix predicate 로 fallback 등록
 * 후 `/api/auth/*` 특수 라우트를 덮어쓰기로 등록.
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
  modelVersionKey: 100,
  modelKey: 10,
  modelName: 'PARAM_DEMO_MODEL',
  parentModel: null,
  modelVersion: '26.05.23.0000',
  commInterface: 'SECS' as const,
  status: 'OPERATE',
  description: 'root',
  maker: 'demo',
  createdAt: '2026-05-23T00:00:00Z',
  updatedAt: '2026-05-23T00:00:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

const EDIT_MODEL = {
  modelVersionKey: 101,
  modelKey: 11,
  modelName: 'PARAM_DEMO_MODEL_admin',
  parentModel: 'PARAM_DEMO_MODEL',
  modelVersion: 'EDIT',
  commInterface: 'SECS' as const,
  status: 'DEVELOP',
  description: 'edit',
  maker: 'demo',
  createdAt: '2026-05-23T00:10:00Z',
  updatedAt: '2026-05-23T00:10:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

interface ParamRow {
  id: string
  values: [string, string, string]
}

interface ParamMockState {
  rows: ParamRow[]
  saveCalls: Array<{ body: unknown }>
}

const buildInitialRows = (): ParamRow[] => [
  { id: 'param-1', values: ['EQPID', 'EQP_01', '설비 아이디'] },
  { id: 'param-2', values: ['MODE', 'AUTO', '동작 모드'] },
]

const createDefaultMockState = (): ParamMockState => ({
  rows: buildInitialRows(),
  saveCalls: [],
})

const setupMocks = async (page: Page, state: ParamMockState) => {
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
              items: [ROOT_MODEL, EDIT_MODEL],
              offset: 0,
              limit: 500,
              count: 2,
            }),
          ),
        })
        return
      }

      if (pathname === `/api/model/${EDIT_MODEL.modelVersionKey}` && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(EDIT_MODEL)),
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

      const detailsMatch = pathname.match(/^\/api\/model\/(\d+)\/details\/([\w-]+)$/)
      if (detailsMatch && method === 'GET') {
        const node = detailsMatch[2]
        if (node === 'model-parameter') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(
              createApiResponse({
                columns: ['Parameter Name', 'Parameter Value', 'Description'],
                rows: state.rows.map((row) => ({
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

      // detail save (PUT /api/model/{key}/details/{node})
      const detailsSaveMatch = pathname.match(/^\/api\/model\/(\d+)\/details\/([\w-]+)$/)
      if (detailsSaveMatch && method === 'PUT') {
        const body = request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')
        state.saveCalls.push({ body })
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createNullSuccessResponse()),
        })
        return
      }

      // flows / messages 등 모든 기타 노드는 빈 응답
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

const openEditModelParameterNode = async (page: Page) => {
  page.on('pageerror', (error) => {
    console.log(`[pageerror] ${error.message}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.log(`[console:error] ${message.text()}`)
    }
  })
  await page.goto('/model')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'PARAM_DEMO_MODEL_admin' }).click()
  const editRow = page.getByRole('row', { name: /PARAM_DEMO_MODEL_admin EDIT/i })
  await editRow.dblclick()
  // EDIT model 은 자동 isEditMode = true. Model Parameter 가 첫 detail 노드.
  await expect(page.getByRole('heading', { name: 'Model Parameter' })).toBeVisible()
  await expect(page.getByTestId('selectable-table-model-parameter')).toBeVisible()
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

test('Selectable-Table-R1-AC-1: 단일 셀 Ctrl+C → 클립보드에 셀 값 1개가 들어간다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelParameterNode(page)

  const container = page.getByTestId('selectable-table-model-parameter')
  const cell = container.locator('[data-row-idx="0"][data-col-idx="1"]')
  await cell.click()
  await page.keyboard.press('ControlOrMeta+C')

  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toBe('EQP_01')
})

test('Selectable-Table-R1-AC-2: 드래그 영역 Ctrl+C → 클립보드에 TSV(행=\\n, 셀=\\t) 가 들어간다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelParameterNode(page)

  const container = page.getByTestId('selectable-table-model-parameter')
  const start = container.locator('[data-row-idx="0"][data-col-idx="1"]')
  const end = container.locator('[data-row-idx="1"][data-col-idx="2"]')

  await start.hover()
  await page.mouse.down()
  await end.hover()
  await page.mouse.up()

  await page.keyboard.press('ControlOrMeta+C')

  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toBe(['EQP_01\t설비 아이디', 'AUTO\t동작 모드'].join('\n'))
})

test('Selectable-Table-R1-AC-3: Excel TSV Ctrl+V paste → 셀 값들이 onChangeDetailValue 로 반영된다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelParameterNode(page)

  const container = page.getByTestId('selectable-table-model-parameter')
  const anchorCell = container.locator('[data-row-idx="0"][data-col-idx="1"]')
  await anchorCell.click()

  // 2 행 x 2 열 TSV — anchor (row=0, col=1) 부터 (row=1, col=2) 까지 채움
  const tsv = ['NEW_EQP_VALUE\tnew description', 'NEW_MODE_VALUE\tmode desc'].join('\n')
  await page.evaluate(async (text) => {
    await navigator.clipboard.writeText(text)
  }, tsv)

  await page.keyboard.press('ControlOrMeta+V')

  // SelectableTable 의 read view 는 span — paste 후 onChangeDetailValue 가 ModelPage state 를
  // 갱신하면 cell 의 text content 가 갱신된 값으로 표시된다.
  await expect(
    container.locator('[data-row-idx="0"][data-col-idx="1"]'),
  ).toContainText('NEW_EQP_VALUE')
  await expect(
    container.locator('[data-row-idx="0"][data-col-idx="2"]'),
  ).toContainText('new description')
  await expect(
    container.locator('[data-row-idx="1"][data-col-idx="1"]'),
  ).toContainText('NEW_MODE_VALUE')
  await expect(
    container.locator('[data-row-idx="1"][data-col-idx="2"]'),
  ).toContainText('mode desc')
})
