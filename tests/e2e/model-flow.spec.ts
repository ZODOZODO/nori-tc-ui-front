import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * SPEC `model-flow-restructure` F6 — Model 페이지 Message Flow 재구성의 E2E 시나리오 묶음.
 *
 * 모든 백엔드 응답은 `page.route` 로 mock 합니다. 형제 spec
 * `socket-message-layout.spec.ts` / `group-page.spec.ts` 의 mock 패턴을 1:1 답습합니다.
 *
 * 시나리오 (SPEC line 152-159):
 *   1. /model 진입 → 좌측 사이드바의 Message Flows 트리 렌더.
 *   2. Flow 카드 클릭 → 4 섹션 (Identity / Trigger / Action / Collect) 모두 펼침 상태.
 *   3. [+ Add Flow] → 빈 FlowCard 추가, 4 섹션 빈 상태.
 *   4. Identity dropdown 변경 → save → reload 후 변경 유지.
 *   5. Trigger [편집...] → Workflow Filter 모달 열림.
 *   6. Action [편집...] → Action Data Index 모달 열림.
 *   7. Reference > Dcop Itemes 노드 → workflow_name=NULL fixture row 위에
 *      "── Unassigned ──" group divider 표시 (1차 릴리즈에서는 ModelDetailPanel 의
 *      `referenceUnassignedDcopItems` 가 빈 배열로 고정되어 사이드바 Unassigned 섹션은
 *      비표시 — Reference 노드의 client-side group divider 로 검증).
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
  modelName: 'FLOW_DEMO_MODEL',
  parentModel: null,
  modelVersion: '26.05.20.0000',
  commInterface: 'SECS' as const,
  status: 'OPERATE',
  description: 'root',
  maker: 'demo',
  createdAt: '2026-05-20T00:00:00Z',
  updatedAt: '2026-05-20T00:00:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

const EDIT_MODEL = {
  modelVersionKey: 101,
  modelKey: 11,
  modelName: 'FLOW_DEMO_MODEL_admin',
  parentModel: 'FLOW_DEMO_MODEL',
  modelVersion: 'EDIT',
  commInterface: 'SECS' as const,
  status: 'DEVELOP',
  description: 'edit',
  maker: 'demo',
  createdAt: '2026-05-20T00:10:00Z',
  updatedAt: '2026-05-20T00:10:00Z',
  createdBy: 'admin',
  updatedBy: 'admin',
}

interface FlowSummaryFixture {
  flowId: number
  workflowName: string
  messageName: string
  actionName: string
}

interface FlowDetailFixture {
  flowId: number
  workflowName: string
  messageName: string
  eventId: string | null
  transactionId: string | null
  workflowFilter: string | null
  actionName: string
  actionDataIndex: string | null
  dcopItems: Array<{
    dcopItemKey: number | null
    dcopItemName: string
    variableId: string
    collectionRule: string
    eventId: string | null
    workflowName: string | null
  }>
}

interface FlowMockState {
  summaries: FlowSummaryFixture[]
  details: Map<number, FlowDetailFixture>
  updateFlowCalls: Array<{ flowId: number; body: unknown }>
  createFlowCalls: Array<{ body: unknown }>
  nextFlowId: number
}

/**
 * 4 섹션이 모두 채워진 기준 Flow — Trigger / Action 모달 + Identity 변경 검증에 사용합니다.
 */
const buildInitialFlowDetail = (): FlowDetailFixture => ({
  flowId: 201,
  workflowName: 'handleLotStart',
  messageName: 'S6F11',
  eventId: 'EVT_LOT_START',
  transactionId: null,
  workflowFilter:
    '{"comparisonType":"EQUALS","leftSide":{"dataKey":"BODY.HEADER.LOT_ID"},"rightSide":{"literal":"LOT_A"}}',
  actionName: 'ACK_LOT_START',
  actionDataIndex:
    '{"mdfTemplateName":"MDF_LOT_ACK","fields":[{"path":"BODY.LOT_ID","value":"$LOT_ID"}]}',
  dcopItems: [
    {
      dcopItemKey: 301,
      dcopItemName: 'LOT_START_COUNTER',
      variableId: 'VAR_LOT_COUNT',
      collectionRule: 'LAST',
      eventId: 'EVT_LOT_START',
      workflowName: 'handleLotStart',
    },
  ],
})

/**
 * dcop-itemes 노드 응답의 client-side group divider + 사이드바 Unassigned 섹션 검증용.
 *
 * 컬럼 순서는 백엔드 `ModelDetailResponseSupport.SECS_DCOP_ITEM_COLUMNS` 와 동일하게
 * `[Dcop Item Name, Workflow Name, EventId, VariableId, Collection Rule, Calculation Rule, Order Rule]`.
 *
 * row.id 는 `dcop:{key}` 형식 — ModelDetailPanel 의 dcop-itemes prefetch 가 id 에서 key 를
 * 파싱하여 사이드바 unassigned 행 React key 로 사용합니다 (백엔드 modelRowId 규약).
 */
const buildDcopItemesPayload = () => ({
  columns: [
    'Dcop Item Name',
    'Workflow Name',
    'EventId',
    'VariableId',
    'Collection Rule',
    'Calculation Rule',
    'Order Rule',
  ],
  rows: [
    {
      id: 'dcop:301',
      values: ['LOT_START_COUNTER', 'handleLotStart', 'EVT_LOT_START', 'VAR_LOT_COUNT', 'LAST', '', ''],
      previewValues: ['LOT_START_COUNTER', 'handleLotStart', 'EVT_LOT_START', 'VAR_LOT_COUNT', 'LAST', '', ''],
    },
    {
      id: 'dcop:302',
      // workflow_name=NULL — 사이드바 "Unassigned DCOPs" 섹션 + Reference > Dcop Itemes 노드의
      // client-side group divider "── Unassigned ──" 양쪽 모두 이 row 의 워크플로우 미할당 상태를 노출.
      values: ['ORPHAN_DCOP', '', 'EVT_ORPHAN', 'VAR_ORPHAN', 'FIRST', '', ''],
      previewValues: ['ORPHAN_DCOP', '', 'EVT_ORPHAN', 'VAR_ORPHAN', 'FIRST', '', ''],
    },
  ],
  mdfContents: [] as Array<{ name: string; xml: string }>,
})

const createDefaultMockState = (): FlowMockState => {
  const initial = buildInitialFlowDetail()
  return {
    summaries: [
      {
        flowId: initial.flowId,
        workflowName: initial.workflowName,
        messageName: initial.messageName,
        actionName: initial.actionName,
      },
    ],
    details: new Map<number, FlowDetailFixture>([[initial.flowId, initial]]),
    updateFlowCalls: [],
    createFlowCalls: [],
    nextFlowId: 202,
  }
}

const flowSummaryFromDetail = (detail: FlowDetailFixture): FlowSummaryFixture => ({
  flowId: detail.flowId,
  workflowName: detail.workflowName,
  messageName: detail.messageName,
  actionName: detail.actionName,
})

const setupMocks = async (page: Page, state: FlowMockState) => {
  // Playwright 의 page.route 매칭은 *나중에 등록된* 라우트가 우선합니다. 더 일반적인
  // `/api/` predicate 를 먼저 등록해 fallback 으로 두고, /api/auth/csrf 와 /api/auth/me
  // 같은 특수 라우트를 나중에 덮어쓰기로 등록해야 합니다.

  // socket-message-layout.spec.ts 와 동일하게 pathname 이 `/api/` 로 시작하는 요청만
  // 가로챕니다. `**/api/model**` glob 은 vite dev server 의 `/src/features/model/...`
  // 모듈 URL 까지 매칭하여 JSON 으로 응답하므로 React 모듈 로드가 실패합니다.
  await page.route(
    (url) => {
      const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
      return pathname.startsWith('/api/')
    },
    async (route: Route, request) => {
    const url = new URL(request.url())
    const pathname = url.pathname
    const method = request.method()

    // 다른 라우트가 먼저 매칭되도록 가장 일반적인 패턴은 마지막에 검사합니다.
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

    // Message Flow API ----------------------------------------------------
    const flowsListMatch = pathname.match(/^\/api\/model\/(\d+)\/flows$/)
    if (flowsListMatch) {
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse({ items: state.summaries })),
        })
        return
      }
      if (method === 'POST') {
        const body =
          request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')
        state.createFlowCalls.push({ body })
        const created: FlowDetailFixture = {
          flowId: state.nextFlowId++,
          workflowName: String((body as Record<string, unknown>).workflowName ?? ''),
          messageName: String((body as Record<string, unknown>).messageName ?? ''),
          eventId: null,
          transactionId: null,
          workflowFilter: null,
          actionName: '',
          actionDataIndex: null,
          dcopItems: [],
        }
        state.details.set(created.flowId, created)
        state.summaries.push(flowSummaryFromDetail(created))
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse({ flowId: created.flowId })),
        })
        return
      }
    }

    const flowDetailMatch = pathname.match(/^\/api\/model\/(\d+)\/flows\/(\d+)$/)
    if (flowDetailMatch) {
      const flowId = Number(flowDetailMatch[2])
      if (method === 'GET') {
        const detail = state.details.get(flowId)
        await route.fulfill({
          status: detail ? 200 : 404,
          contentType: 'application/json',
          body: JSON.stringify(
            detail
              ? createApiResponse(detail)
              : { success: false, data: null, errorCode: 'NOT_FOUND', errorMsg: 'not found' },
          ),
        })
        return
      }
      if (method === 'PUT') {
        const body =
          request.postDataJSON?.() ?? JSON.parse(request.postData() ?? '{}')
        state.updateFlowCalls.push({ flowId, body })
        const previous = state.details.get(flowId)
        if (previous) {
          const next: FlowDetailFixture = {
            ...previous,
            workflowName: String(
              (body as Record<string, unknown>).workflowName ?? previous.workflowName,
            ),
            messageName: String(
              (body as Record<string, unknown>).messageName ?? previous.messageName,
            ),
            eventId: ((body as Record<string, unknown>).eventId as string | null | undefined) ?? null,
            transactionId:
              ((body as Record<string, unknown>).transactionId as string | null | undefined) ?? null,
            workflowFilter:
              ((body as Record<string, unknown>).workflowFilter as string | null | undefined) ?? null,
            actionName: String(
              (body as Record<string, unknown>).actionName ?? previous.actionName,
            ),
            actionDataIndex:
              ((body as Record<string, unknown>).actionDataIndex as string | null | undefined) ?? null,
          }
          state.details.set(flowId, next)
          const summaryIndex = state.summaries.findIndex((summary) => summary.flowId === flowId)
          if (summaryIndex >= 0) {
            state.summaries[summaryIndex] = flowSummaryFromDetail(next)
          }
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(createApiResponse(next)),
          })
          return
        }
      }
    }

    // Reference 노드 (Dcop Itemes 등) ------------------------------------
    const detailsMatch = pathname.match(/^\/api\/model\/(\d+)\/details\/([\w-]+)$/)
    if (detailsMatch && method === 'GET') {
      const node = detailsMatch[2]
      if (node === 'dcop-itemes') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(buildDcopItemesPayload())),
        })
        return
      }
      if (node === 'secs-message') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({
              columns: ['SECS Message Name', 'Description'],
              rows: [
                {
                  id: 'msg-1',
                  values: ['S6F11', 'LotStart trigger'],
                  previewValues: ['S6F11', 'LotStart trigger'],
                },
                {
                  id: 'msg-2',
                  values: ['S6F13', 'LotEnd trigger'],
                  previewValues: ['S6F13', 'LotEnd trigger'],
                },
              ],
              mdfContents: [],
            }),
          ),
        })
        return
      }
      if (node === 'mes-message') {
        // SPEC line 115-116: FlowCard Message dropdown 은 (SECS+MES) 또는 (Socket+MES) 통합.
        // 빈 mes-message 응답이어도 무방하지만 AC-4 dropdown 검증의 안정성을 위해 1 개 row 제공.
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({
              columns: ['MES Message Name', 'Description'],
              rows: [
                {
                  id: 'mes-1',
                  values: ['MES_LOT_ACK', 'MES side ack'],
                  previewValues: ['MES_LOT_ACK', 'MES side ack'],
                },
              ],
              mdfContents: [],
            }),
          ),
        })
        return
      }
      if (node === 'mdf') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({
              columns: [],
              rows: [],
              mdfContents: [{ name: 'MDF', xml: '<mdf></mdf>' }],
            }),
          ),
        })
        return
      }
      // 그 외 노드는 빈 응답.
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          createApiResponse({ columns: [], rows: [], mdfContents: [] }),
        ),
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

  // 특수 라우트 — 일반 fallback 뒤에 등록해야 매칭 우선 순위가 보장됩니다.
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

/**
 * /model 진입 후 EDIT 모델을 더블 클릭으로 열어 ModelDetailPanel 을 mount 합니다.
 *
 * ModelPage 라우팅:
 *   - 모델명 더블 클릭 시 ModelInfoTable row 가 펼쳐지지 않고 곧장 탭이 열립니다.
 *   - 모델명 단일 클릭은 좌측 ModelSidebar 의 모델명 아이템에서 행이 펼쳐지는 동작.
 *   - 따라서 사이드바의 모델명 클릭 → row 펼침 → row 더블클릭 흐름이 필요합니다.
 */
const openEditModelTab = async (page: Page) => {
  page.on('pageerror', (error) => {
    console.log(`[pageerror] ${error.message}`)
  })
  page.on('console', (message) => {
    if (message.type() === 'error') {
      console.log(`[console:error] ${message.text()}`)
    }
  })
  await page.goto('/model')
  // 모델 목록이 도착하기 전 사이드바 모델명 버튼은 보이지 않습니다 — networkidle 대기.
  await page.waitForLoadState('networkidle')
  // 좌측 사이드바에서 모델명을 클릭해 행을 펼친 다음 EDIT 행을 더블 클릭합니다.
  await page.getByRole('button', { name: 'FLOW_DEMO_MODEL_admin' }).click()
  const editRow = page.getByRole('row', { name: /FLOW_DEMO_MODEL_admin EDIT/i })
  await editRow.dblclick()
  // ModelDetailPanel 이 lazy-loaded 이므로 Message Flows 텍스트가 보일 때까지 기다립니다.
  await expect(page.getByText('Message Flows')).toBeVisible()
}

// 시나리오 1 ----------------------------------------------------------------
test('Model-Flow-AC-1: /model 진입 후 좌측 사이드바에 Flow 트리가 렌더된다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  // Message Flows 헤더 + workflowName 그룹.
  await expect(page.getByText('Message Flows')).toBeVisible()
  await expect(page.getByRole('button', { name: /handleLotStart/ })).toBeVisible()
  // F8 fix #1: 트리 default 닫힘으로 변경 — workflowName 그룹 클릭 시 펼침.
  await page.getByRole('button', { name: /handleLotStart/ }).click()
  await expect(page.getByRole('button', { name: 'S6F11' })).toBeVisible()
})

// 시나리오 2 ----------------------------------------------------------------
test('Model-Flow-AC-2: Flow 카드 클릭 시 4 섹션이 모두 펼친 상태로 표시된다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  // F8 fix #1: workflowName 그룹 default 닫힘 → 펼친 후 messageName 행 클릭.
  await page.getByRole('button', { name: /handleLotStart/ }).click()
  await page.getByRole('button', { name: 'S6F11' }).click()

  // FlowCard 의 4 섹션 헤딩 — 1차 릴리즈에서는 모두 default 펼침 상태.
  await expect(page.getByRole('heading', { name: 'Identity' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Trigger' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Action' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Collect' })).toBeVisible()
})

// 시나리오 3 ----------------------------------------------------------------
test('Model-Flow-AC-3: [+ Add Flow] 클릭 시 빈 FlowCard 가 추가된다', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  await page.getByRole('button', { name: /Add Flow/i }).click()

  // 빈 draft card → workflow / message 모두 미지정 헤더.
  await expect(page.getByRole('heading', { name: /\(workflow 미지정\)/ })).toBeVisible()
  await expect(page.getByText('Flow ID #신규')).toBeVisible()
  // 4 섹션 모두 펼쳐져 있다.
  await expect(page.getByRole('heading', { name: 'Identity' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Trigger' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Action' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Collect' })).toBeVisible()
  // Collect 빈 상태 안내 텍스트.
  await expect(page.getByText('수집 항목이 없습니다.')).toBeVisible()
})

// 시나리오 4 ----------------------------------------------------------------
// SPEC line 156: "Identity dropdown 변경 → save → reload 후 변경 유지."
// F6.5 에서 ModelDetailPanel 이 FlowCard 에 SECS / MES 메시지 목록을 실제로 주입하므로
// Identity 의 Message Name dropdown 으로 직접 새 메시지를 선택할 수 있습니다.
test('Model-Flow-AC-4: Identity Message Name dropdown 변경 → save → reload 후 유지', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  // F8 fix #1: workflowName 그룹 default 닫힘 → 펼친 후 messageName 행 클릭.
  await page.getByRole('button', { name: /handleLotStart/ }).click()
  await page.getByRole('button', { name: 'S6F11' }).click()
  await expect(page.getByRole('heading', { name: 'Identity' })).toBeVisible()

  // Identity 의 Message Name dropdown — shadcn Radix Select 트리거는 role="combobox".
  // 화면 안 SelectTrigger 가 여러 개 (MDF Template 등) 이므로 Identity 섹션 컨테이너로 좁힌
  // 첫 combobox 를 사용합니다. 초기값은 'S6F11'.
  const identitySection = page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: 'Identity' }) })
  const messageDropdown = identitySection.getByRole('combobox').first()
  await expect(messageDropdown).toContainText('S6F11')
  await messageDropdown.click()
  // dropdown 옵션 — 초기 fixture 가 S6F11 / S6F13 / MES_LOT_ACK 3 개를 제공. S6F13 으로 변경.
  await page.getByRole('option', { name: 'S6F13' }).click()
  await expect(messageDropdown).toContainText('S6F13')

  // 저장 → mock state 의 PUT call 기록을 검사하여 messageName 갱신을 확인합니다.
  await page.getByRole('button', { name: '저장' }).click()
  await expect.poll(() => state.updateFlowCalls.length).toBeGreaterThan(0)
  const updatedBody = state.updateFlowCalls[0].body as Record<string, unknown>
  expect(updatedBody.messageName).toBe('S6F13')
  expect(state.updateFlowCalls[0].flowId).toBe(201)

  // mock state 의 detail / summary 가 새 messageName 으로 갱신되었음을 직접 검증합니다 —
  // 즉 PUT 요청이 백엔드에 보내져 다음 GET 부터는 갱신된 messageName 이 응답되는 상태.
  expect(state.details.get(201)?.messageName).toBe('S6F13')
  expect(state.summaries[0]?.messageName).toBe('S6F13')

  // reload — `page.reload()` 로 SPA JS state 와 React Query cache 를 완전 reset 한 뒤,
  // mock 의 갱신된 응답으로 변경값이 유지되는지 확인합니다. 사이드바의 messageName 라벨
  // (= ModelFlowSummary 응답의 messageName) 이 갱신값을 직접 노출하므로 reload 후 fresh
  // GET /flows 응답에서 'S6F13' 으로 변경된 항목이 보이는 것을 검증합니다 — 이전 'S6F11'
  // 항목은 더 이상 사이드바에 존재하지 않아야 합니다.
  await page.reload()
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'FLOW_DEMO_MODEL_admin' }).click()
  const reloadedEditRow = page.getByRole('row', { name: /FLOW_DEMO_MODEL_admin EDIT/i })
  await reloadedEditRow.dblclick()
  await expect(page.getByText('Message Flows')).toBeVisible()
  // F8 fix #1: 트리 default 닫힘 — workflowName 그룹 클릭 후 `S6F13` 행 확인.
  await page.getByRole('button', { name: /handleLotStart/ }).click()
  await expect(page.getByRole('button', { name: 'S6F13' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'S6F11', exact: true })).toHaveCount(0)
})

// 시나리오 5 ----------------------------------------------------------------
test('Model-Flow-AC-5: Trigger [편집...] 클릭 시 Workflow Filter 모달이 열린다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  // F8 fix #1: workflowName 그룹 default 닫힘 → 펼친 후 messageName 행 클릭.
  await page.getByRole('button', { name: /handleLotStart/ }).click()
  await page.getByRole('button', { name: 'S6F11' }).click()
  await expect(page.getByRole('heading', { name: 'Trigger' })).toBeVisible()

  // Trigger 섹션의 "편집..." 버튼 (Workflow Filter 옆).
  // FlowCard 가 통째로 'Workflow Filter' 텍스트를 포함하므로 outer section 으로 좁히면
  // Action 의 [편집] 버튼이 함께 잡힙니다. summary testid 의 직전 형제 button 으로 좁혀
  // Trigger inner 카드 안의 [편집] 버튼만 선택합니다.
  const triggerCard = page.locator(
    'div:has(> [data-testid="flow-card-workflow-filter-summary"])',
  )
  await triggerCard.getByRole('button', { name: /편집/ }).click()

  // 모달 DialogTitle "Workflow Filter".
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page.getByRole('dialog').getByText('Workflow Filter', { exact: true }),
  ).toBeVisible()
})

// 시나리오 6 ----------------------------------------------------------------
test('Model-Flow-AC-6: Action [편집...] 클릭 시 Action Data Index 모달이 열린다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  // F8 fix #1: workflowName 그룹 default 닫힘 → 펼친 후 messageName 행 클릭.
  await page.getByRole('button', { name: /handleLotStart/ }).click()
  await page.getByRole('button', { name: 'S6F11' }).click()
  await expect(page.getByRole('heading', { name: 'Action' })).toBeVisible()

  const actionCard = page.locator(
    'div:has(> [data-testid="flow-card-action-data-index-summary"])',
  )
  await actionCard.getByRole('button', { name: /편집/ }).click()

  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page.getByRole('dialog').getByText('Action Data Index', { exact: true }),
  ).toBeVisible()
})

// 시나리오 7 ----------------------------------------------------------------
// SPEC line 159: "Reference 탭 → 'Unassigned DCOPs' 섹션 존재 확인 (workflow_name=NULL fixture)."
// F6.5 에서 ModelDetailPanel 이 dcop-itemes 노드를 prefetch 하여 ModelFlowSidebar 의
// `unassignedDcopItems` props 에 workflow_name=NULL row 들을 주입합니다 — 사이드바 안의
// "Unassigned DCOPs" 섹션이 직접 표시되며 별도 Reference 노드 클릭 불필요.
test('Model-Flow-AC-7: 사이드바에 Unassigned DCOPs 섹션이 표시된다', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  // 사이드바 헤더 — extractUnassignedDcopItems 가 workflow_name=null row 만 추출.
  await expect(page.getByText('Unassigned DCOPs')).toBeVisible()
  // workflow_name=NULL fixture row 의 dcopItemName ('ORPHAN_DCOP') 이 항목으로 노출.
  // 사이드바는 dcopItemName 만 노출하므로 정확한 텍스트 매칭으로 검증.
  await expect(page.getByText('ORPHAN_DCOP', { exact: true })).toBeVisible()
})
