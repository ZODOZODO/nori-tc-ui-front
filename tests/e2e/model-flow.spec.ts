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
 * dcop-itemes 노드 응답의 client-side group divider 검증용 — workflow_name 빈 row 1 개를 포함합니다.
 */
const buildDcopItemesPayload = () => ({
  columns: [
    'Dcop Item Name',
    'Variable Id',
    'Collection Rule',
    'EventId',
    'Workflow Name',
  ],
  rows: [
    {
      id: 'dcop-1',
      values: ['LOT_START_COUNTER', 'VAR_LOT_COUNT', 'LAST', 'EVT_LOT_START', 'handleLotStart'],
      previewValues: ['LOT_START_COUNTER', 'VAR_LOT_COUNT', 'LAST', 'EVT_LOT_START', 'handleLotStart'],
    },
    {
      id: 'dcop-2',
      // workflow_name=NULL — client-side group divider "── Unassigned ──" 가 이 row 위에 표시.
      values: ['ORPHAN_DCOP', 'VAR_ORPHAN', 'FIRST', 'EVT_ORPHAN', ''],
      previewValues: ['ORPHAN_DCOP', 'VAR_ORPHAN', 'FIRST', 'EVT_ORPHAN', ''],
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

  // Message Flows 헤더 + workflowName 그룹 + messageName 행.
  await expect(page.getByText('Message Flows')).toBeVisible()
  await expect(page.getByRole('button', { name: /handleLotStart/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'S6F11' })).toBeVisible()
})

// 시나리오 2 ----------------------------------------------------------------
test('Model-Flow-AC-2: Flow 카드 클릭 시 4 섹션이 모두 펼친 상태로 표시된다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

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
// SPEC line 156 의 원문은 "Identity dropdown 변경" 이나 1차 릴리즈 구현에서는
// ModelDetailPanel 이 FlowCard 에 `messageOptions={[]}` 로 빈 옵션을 주입하므로
// dropdown 자체로는 새 메시지를 선택할 수 없습니다. AC-4 의 본질 "FlowCard 편집 →
// save → reload 후 유지" 를 보존하기 위해 자유 입력 가능한 Action Name 변경으로
// 검증합니다 (dev-report 에 SPEC validation issue 로 기록).
test('Model-Flow-AC-4: FlowCard 편집 → save 호출 → reload 후 변경값 유지', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  await page.getByRole('button', { name: 'S6F11' }).click()
  await expect(page.getByRole('heading', { name: 'Identity' })).toBeVisible()

  // Action Name 입력을 변경합니다.
  // Action Name input — htmlFor/aria-label 이 없어 accessible name 대신
   // placeholder 텍스트 (`예: TOOL_CONDITION_REPLY`) 로 찾습니다.
  const actionNameInput = page.getByPlaceholder('예: TOOL_CONDITION_REPLY')
  await actionNameInput.fill('ACK_LOT_START_V2')
  await expect(actionNameInput).toHaveValue('ACK_LOT_START_V2')

  // 저장 버튼 클릭.
  await page.getByRole('button', { name: '저장' }).click()
  await expect.poll(() => state.updateFlowCalls.length).toBeGreaterThan(0)
  const updatedBody = state.updateFlowCalls[0].body as Record<string, unknown>
  expect(updatedBody.actionName).toBe('ACK_LOT_START_V2')
  expect(state.updateFlowCalls[0].flowId).toBe(201)

  // reload 후에도 변경값이 유지되는지 — mock state 의 detail 응답이 갱신되므로
  // 같은 Flow 를 다시 열면 새 actionName 으로 detail GET 응답이 돌아옵니다.
  await openEditModelTab(page)
  await page.getByRole('button', { name: 'S6F11' }).click()
  await expect(page.getByPlaceholder('예: TOOL_CONDITION_REPLY')).toHaveValue(
    'ACK_LOT_START_V2',
  )
})

// 시나리오 5 ----------------------------------------------------------------
test('Model-Flow-AC-5: Trigger [편집...] 클릭 시 Workflow Filter 모달이 열린다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

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
test('Model-Flow-AC-7: Reference > Dcop Itemes 노드에 Unassigned group divider 가 표시된다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  // Reference 영역의 Dcop Itemes 버튼 클릭 — workflow_name=NULL fixture row 위에
  // client-side group divider "── Unassigned ──" 가 표시되어야 한다.
  await page.getByRole('button', { name: 'Dcop Itemes' }).click()
  await expect(page.getByText('── Unassigned ──')).toBeVisible()
  // Unassigned row 자체는 좁은 viewport 에서 가려질 수 있어 cell role 로만 검증합니다.
  await expect(page.getByRole('cell', { name: 'ORPHAN_DCOP', exact: true })).toBeAttached()
})
