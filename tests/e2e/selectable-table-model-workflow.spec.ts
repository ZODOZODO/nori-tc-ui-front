import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * SPEC `selectable-table-rollout` R3 — ModelDetailPanel 의 9 개 detail node 통합
 * SelectableTable 마이그레이션 e2e.
 *
 * 진입 가능한 노드만 e2e 로 검증한다. workflow detail node 는 Reference 사이드바에서
 * 의도적으로 제외되어 (git 80605b4 "Reference workflow 제거") UI 자연 진입 경로가 없는
 * dead path 이므로 그 안의 셀별 분기 (Message Name dropdown / EventId dropdown /
 * Filter·Data Index modal trigger / Flow Name 중복 표시 — SPEC R3-AC-2/4/5) 는 e2e
 * 자연 진입 불가. dcop-itemes 노드가 같은 SelectableTable + 같은 EventId dropdown
 * 코드 경로를 공유하므로 그 노드로 range copy / dropdown 동작을 검증한다.
 *
 * mock 패턴은 `selectable-table-model-parameter.spec.ts` 와 동일.
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
  modelVersionKey: 200,
  modelKey: 20,
  modelName: 'WORKFLOW_DEMO_MODEL',
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

const EDIT_MODEL = {
  modelVersionKey: 201,
  modelKey: 21,
  modelName: 'WORKFLOW_DEMO_MODEL_admin',
  parentModel: 'WORKFLOW_DEMO_MODEL',
  modelVersion: 'EDIT',
  commInterface: 'SECS' as const,
  status: 'DEVELOP',
  description: 'edit',
  maker: 'demo',
  createdAt: '2026-05-26T00:10:00Z',
  updatedAt: '2026-05-26T00:10:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

interface RowFixture {
  id: string
  values: string[]
}

interface NodeResponse {
  columns: string[]
  rows: RowFixture[]
}

interface DetailMockState {
  detailByNode: Record<string, NodeResponse>
  saveCalls: Array<{ node: string; body: unknown }>
}

const buildDefaultState = (): DetailMockState => ({
  detailByNode: {
    'model-parameter': {
      columns: ['Parameter Name', 'Parameter Value', 'Description'],
      rows: [
        { id: 'param-1', values: ['EQPID', 'EQP_01', '설비 아이디'] },
        { id: 'param-2', values: ['MODE', 'AUTO', '동작 모드'] },
      ],
    },
    'secs-message': {
      columns: ['SECS Message Name', 'Stream', 'Function'],
      rows: [
        { id: 'secs-1', values: ['S1F1', '1', '1'] },
        { id: 'secs-2', values: ['S2F41', '2', '41'] },
      ],
    },
    'mes-message': {
      columns: ['MES Message Name', 'Direction'],
      rows: [{ id: 'mes-1', values: ['MES_PING', 'OUT'] }],
    },
    variableides: {
      columns: ['VariableId', 'Type'],
      rows: [{ id: 'var-1', values: ['VID_1', 'INT'] }],
    },
    reportides: {
      columns: ['ReportId', 'Description'],
      rows: [{ id: 'rep-1', values: ['RID_1', 'sample report'] }],
    },
    eventides: {
      columns: ['EventId', 'Description'],
      rows: [
        { id: 'evt-1', values: ['EVT_100', 'lot start'] },
        { id: 'evt-2', values: ['EVT_200', 'lot end'] },
      ],
    },
    'dcop-itemes': {
      columns: ['Dcop Item Name', 'VariableId', 'EventId', 'Collection Rule'],
      rows: [
        {
          id: 'dcop:1',
          values: ['DCOP_TEMP', 'VID_1', 'EVT_100', 'LAST'],
        },
        {
          id: 'dcop:2',
          values: ['DCOP_PRESS', 'VID_2', 'EVT_200', 'AVERAGE'],
        },
      ],
    },
  },
  saveCalls: [],
})

const setupMocks = async (page: Page, state: DetailMockState) => {
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

      const detailsGetMatch =
        method === 'GET' ? pathname.match(/^\/api\/model\/(\d+)\/details\/([\w-]+)$/) : null
      if (detailsGetMatch) {
        const node = detailsGetMatch[2]
        const fixture = state.detailByNode[node]
        if (fixture) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(
              createApiResponse({
                columns: fixture.columns,
                rows: fixture.rows.map((row) => ({
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

      const detailsPutMatch =
        method === 'PUT' ? pathname.match(/^\/api\/model\/(\d+)\/details\/([\w-]+)$/) : null
      if (detailsPutMatch) {
        const node = detailsPutMatch[2]
        const body = request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')
        state.saveCalls.push({ node, body })
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createNullSuccessResponse()),
        })
        return
      }

      // flows / 기타 노드는 빈 응답
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

/**
 * 글로벌 CLAUDE.md 14 — e2e PASS 의 정의는 Playwright assertion 통과 +
 * `page.on('console')` / `page.on('pageerror')` 의 error level 메시지 0건.
 * 각 테스트는 ConsoleErrorBucket 을 받아 errors 가 비어있음을 단언한다.
 */
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

const openEditModel = async (page: Page) => {
  await page.goto('/model')
  await page.waitForLoadState('networkidle')
  // 사이드바 LNB 3단 아코디언(기본 접힘): SECS → WORKFLOW_DEMO_MODEL(root) → branch 펼침.
  await page.getByRole('button', { name: 'SECS', exact: true }).click()
  await page.getByRole('button', { name: 'WORKFLOW_DEMO_MODEL', exact: true }).click()
  await page.getByRole('button', { name: 'WORKFLOW_DEMO_MODEL_admin' }).click()
  const editRow = page.getByRole('row', { name: /WORKFLOW_DEMO_MODEL_admin EDIT/i })
  await editRow.dblclick()
  await expect(page.getByRole('heading', { name: 'Model Parameter' })).toBeVisible()
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

/**
 * R3-AC-1: dcop-itemes 노드의 사각형 영역 Ctrl+C → 클립보드에 TSV 가 들어간다.
 * SPEC R3 Acceptance L96 "ModelDetailPanel의 9 개 detail node 각각에서 range copy
 * 동작 — Playwright e2e 1개" 충족.
 */
test('Selectable-Table-R3-AC-1: dcop-itemes 사각형 영역 Ctrl+C → TSV 클립보드', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  const state = buildDefaultState()
  await setupMocks(page, state)
  await openEditModel(page)

  await page.getByRole('button', { name: 'Dcop Itemes' }).click()
  await expect(page.getByRole('heading', { name: 'Dcop Itemes' })).toBeVisible()

  const container = page.getByTestId('selectable-table-dcop-itemes')
  await expect(container).toBeVisible()

  // (row=0, col=0) DCOP_TEMP ~ (row=1, col=1) VID_2 — 2x2 영역
  const start = container.locator('[data-row-idx="0"][data-col-idx="0"]')
  const end = container.locator('[data-row-idx="1"][data-col-idx="1"]')
  await start.hover()
  await page.mouse.down()
  await end.hover()
  await page.mouse.up()

  await page.keyboard.press('ControlOrMeta+C')

  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  // BE / 화면 정렬은 본 SPEC 범위 밖이라 클립보드의 row 순서는 검증하지 않는다.
  // 2 행 × 2 열 TSV 구조 + 4 셀 값 집합이 fixture 와 일치하는지만 확인.
  const lines = clipboard.split('\n')
  expect(lines).toHaveLength(2)
  const cells = lines.flatMap((line) => line.split('\t'))
  expect(cells).toHaveLength(4)
  expect(new Set(cells)).toEqual(new Set(['DCOP_TEMP', 'VID_1', 'DCOP_PRESS', 'VID_2']))

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})

/**
 * R3-AC-3: dcop-itemes 의 EventId 컬럼은 eventides 응답을 dropdown 으로 노출한다.
 * `createDcopItemsColumns` 의 EventId select 동작 검증 — workflow 노드의 동일 패턴도
 * 같은 factory 의 select 분기를 공유하므로 dropdown 동작 회귀 안전망.
 */
test('Selectable-Table-R3-AC-3: dcop-itemes EventId 컬럼은 eventides 옵션을 dropdown 으로 노출', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  const state = buildDefaultState()
  await setupMocks(page, state)
  await openEditModel(page)

  await page.getByRole('button', { name: 'Dcop Itemes' }).click()
  const container = page.getByTestId('selectable-table-dcop-itemes')
  await expect(container).toBeVisible()

  // EventId 는 columns[2] — col-idx="2"
  const eventIdSelect = container.locator('[data-row-idx="0"][data-col-idx="2"] select')
  await expect(eventIdSelect).toBeVisible()

  // dropdown 옵션이 eventides fixture (EVT_100 / EVT_200) 를 노출 (fallback `—` 포함)
  const optionValues = await eventIdSelect.locator('option').evaluateAll((nodes) =>
    nodes.map((node) => (node as HTMLOptionElement).value),
  )
  expect(optionValues).toEqual(expect.arrayContaining(['', 'EVT_100', 'EVT_200']))

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})

/**
 * R3-AC-6: Reference 사이드바를 통해 자연 진입 가능한 detail 노드 각각이
 * `selectable-table-{node}` testId 를 노출한다.
 *
 * 검증 대상 (SECS 모델 기준 사이드바, workflow 제외 8 노드 중 mdf 는 textarea 표시이므로
 * SelectableTable 미사용): model-parameter / secs-message / mes-message / variableides /
 * reportides / eventides / dcop-itemes = 7 노드. 모두 SelectableTable 컨테이너로 노출.
 */
test('Selectable-Table-R3-AC-6: 사이드바 진입 가능 7 detail 노드의 SelectableTable testId 노출', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  const state = buildDefaultState()
  await setupMocks(page, state)
  await openEditModel(page)

  const sidebarLabelToTestId: Array<[label: string, testId: string]> = [
    ['Model Parameter', 'selectable-table-model-parameter'],
    ['SECS Message', 'selectable-table-secs-message'],
    ['MES Message', 'selectable-table-mes-message'],
    ['Variableides', 'selectable-table-variableides'],
    ['ReportIdes', 'selectable-table-reportides'],
    ['EventIdes', 'selectable-table-eventides'],
    ['Dcop Itemes', 'selectable-table-dcop-itemes'],
  ]

  for (const [label, testId] of sidebarLabelToTestId) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect(page.getByTestId(testId)).toBeVisible()
  }

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})
