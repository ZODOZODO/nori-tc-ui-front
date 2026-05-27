import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * SPEC `model-flow-restructure` F6 — Model 페이지 Message Flow 재구성의 E2E 시나리오 묶음.
 *
 * 모든 백엔드 응답은 `page.route` 로 mock 합니다. 형제 spec
 * `socket-message-layout.spec.ts` / `group-page.spec.ts` 의 mock 패턴을 1:1 답습합니다.
 *
 * 시나리오 (SPEC line 152-159):
 *   1. /model 진입 → 좌측 사이드바의 Message Flows 트리 렌더.
 *   2. Flow 카드 클릭 → 5 섹션 (Identity / Trigger / Filter / Action / Collect) 모두 펼침 상태.
 *      (F8.1 root cause fix — Filter 섹션 분리: Trigger 는 SECS only / Filter 는 모든 protocol.)
 *   3. [+ Add Flow] → 빈 FlowCard 추가, 5 섹션 빈 상태.
 *   4. Identity dropdown 변경 → save → reload 후 변경 유지.
 *   5. Filter [편집...] → Workflow Filter 모달 열림.
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
  }>
  dcopItemKeys: number[]
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
    },
  ],
  dcopItemKeys: [301],
})

/**
 * dcop-itemes 노드 응답 fixture (dcop-flow-binding v4).
 *
 * 컬럼 순서는 백엔드 `ModelDetailResponseSupport.SECS_DCOP_ITEM_COLUMNS` 와 동일하게
 * `[Dcop Item Name, EventId, VariableId, Collection Rule, Calculation Rule, Order Rule]`
 * 6 컬럼 (v4 에서 Workflow Name 컬럼 제거).
 *
 * row.id 는 `dcop:{key}` 형식 — ModelDetailPanel 의 dcop-itemes prefetch 가 id 에서
 * key 를 파싱해 picker 모달의 reference pool 으로 사용합니다 (백엔드 modelRowId 규약).
 */
const buildDcopItemesPayload = () => ({
  columns: [
    'Dcop Item Name',
    'EventId',
    'VariableId',
    'Collection Rule',
    'Calculation Rule',
    'Order Rule',
  ],
  rows: [
    {
      id: 'dcop:301',
      values: ['LOT_START_COUNTER', 'EVT_LOT_START', 'VAR_LOT_COUNT', 'LAST', '', ''],
      previewValues: ['LOT_START_COUNTER', 'EVT_LOT_START', 'VAR_LOT_COUNT', 'LAST', '', ''],
    },
    {
      id: 'dcop:302',
      // dcop_item 본체는 Flow 와 독립 — Flow 와 binding 되지 않은 dcop_item 도 자연 상태로 pool 에 존재.
      values: ['ORPHAN_DCOP', 'EVT_ORPHAN', 'VAR_ORPHAN', 'FIRST', '', ''],
      previewValues: ['ORPHAN_DCOP', 'EVT_ORPHAN', 'VAR_ORPHAN', 'FIRST', '', ''],
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
          dcopItemKeys: [],
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
          // dcopItemKeys 는 null (Collect 미갱신) / 배열 (binding 재정의) 모두 허용.
          const requestedDcopItemKeys = (body as Record<string, unknown>).dcopItemKeys
          const nextDcopItemKeys =
            Array.isArray(requestedDcopItemKeys)
              ? requestedDcopItemKeys.map((key) => Number(key))
              : previous.dcopItemKeys
          // dcopItems 본체도 nextDcopItemKeys 에 맞춰 trimming — picker 가 우측에 표시할
          // currentFlowDcopItems 가 nextDcopItemKeys 와 같아야 round-trip 시각 일관성 확보.
          const nextDcopItems =
            nextDcopItemKeys === previous.dcopItemKeys
              ? previous.dcopItems
              : previous.dcopItems.filter((item) =>
                  item.dcopItemKey !== null && nextDcopItemKeys.includes(item.dcopItemKey),
                )
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
            dcopItems: nextDcopItems,
            dcopItemKeys: nextDcopItemKeys,
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
test('Model-Flow-AC-2: Flow 카드 클릭 시 5 섹션이 모두 펼친 상태로 표시된다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  // F8 fix #1: workflowName 그룹 default 닫힘 → 펼친 후 messageName 행 클릭.
  await page.getByRole('button', { name: /handleLotStart/ }).click()
  await page.getByRole('button', { name: 'S6F11' }).click()

  // F8.1 root cause fix: FlowCard 의 5 섹션 헤딩 — Filter 섹션이 Trigger 와 분리.
  await expect(page.getByRole('heading', { name: 'Identity' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Trigger' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Filter' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Action' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Collect' })).toBeVisible()
})

// 시나리오 3 ----------------------------------------------------------------
test('Model-Flow-AC-3: [+ Add Flow] 클릭 시 빈 FlowCard 가 추가된다', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  await page.getByRole('button', { name: /Add Flow/i }).click()

  // 빈 draft card → flow / message 모두 미지정 헤더.
  await expect(page.getByRole('heading', { name: /\(flow 미지정\)/ })).toBeVisible()
  await expect(page.getByText('Flow ID #신규')).toBeVisible()
  // F8.1 root cause fix: 5 섹션 모두 펼쳐져 있다 — Filter 가 Trigger 와 분리.
  await expect(page.getByRole('heading', { name: 'Identity' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Trigger' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Filter' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Action' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Collect' })).toBeVisible()
  // Collect 빈 상태 안내 텍스트.
  await expect(page.getByText('수집 항목이 없습니다.')).toBeVisible()
})

// 시나리오 3b (model-flow-draft-and-rename U1, AC-P1) ---------------------------
// draft 카드의 Flow Name Input 이 editable 이고, 저장 시 POST body 의
// workflowName 에 입력값이 반영되는지 검증.
test('Model-Flow-AC-3b: draft Flow Name 이 editable 이고 저장 시 POST body workflowName 에 반영된다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  await page.getByRole('button', { name: /Add Flow/i }).click()

  // draft 카드의 Flow Name Input — placeholder 로 locate (label/input association 없음).
  const flowNameInput = page.getByPlaceholder('신규 Flow 이름을 입력하세요')
  await expect(flowNameInput).toBeVisible()
  // U1: draft 모드에서는 readOnly 가 풀려 있어야 함.
  await expect(flowNameInput).toHaveJSProperty('readOnly', false)

  await flowNameInput.fill('NEW_FLOW_NAME')

  // 통합된 우상단 Save 버튼 — FlowCard 컨텍스트에서 aria-label='Flow 저장' 으로 노출.
  // FlowCard 하단의 별도 "저장" 버튼은 제거되어 우상단 한 곳에서만 트리거합니다.
  await page.getByRole('button', { name: 'Flow 저장' }).click()
  await expect.poll(() => state.createFlowCalls.length).toBeGreaterThan(0)
  const body = state.createFlowCalls[0].body as Record<string, unknown>
  expect(body.workflowName).toBe('NEW_FLOW_NAME')
})

// 시나리오 3c (model-flow-draft-and-rename U2, AC-P2) ---------------------------
// draft 카드의 "+ DCOP 추가" 버튼이 disabled 이고 hover/focus 시 tooltip 이
// 표시되는지 검증 (옵션 (i): 백엔드 POST DTO 가 dcopItemKeys 미수용).
test('Model-Flow-AC-3c: draft 카드의 DCOP 추가 버튼이 disabled + tooltip 으로 안내된다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  await page.getByRole('button', { name: /Add Flow/i }).click()
  await expect(page.getByRole('heading', { name: 'Collect' })).toBeVisible()

  const dcopAddButton = page.getByRole('button', { name: /DCOP 추가/ })
  await expect(dcopAddButton).toBeDisabled()
  await expect(dcopAddButton).toHaveAttribute('aria-disabled', 'true')
  await expect(dcopAddButton).toHaveAttribute('title', 'Flow 저장 후 DCOP 추가 가능')
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
  // 화면 안 SelectTrigger 가 여러 개 (Trigger Event Id 등) 이므로 Identity 섹션 컨테이너로 좁힌
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
  // 통합된 우상단 Save (Flow 컨텍스트일 때 aria-label='Flow 저장').
  await page.getByRole('button', { name: 'Flow 저장' }).click()
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
// F8.1 root cause fix: Trigger 안 [편집...] 이 아니라 분리된 Filter 섹션의 [편집...] 검증.
// workflow_filter 는 protocol 무관 모든 Flow 에서 편집 필요.
test('Model-Flow-AC-5: Filter [편집...] 클릭 시 Flow Filter 모달이 열린다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  // F8 fix #1: workflowName 그룹 default 닫힘 → 펼친 후 messageName 행 클릭.
  await page.getByRole('button', { name: /handleLotStart/ }).click()
  await page.getByRole('button', { name: 'S6F11' }).click()
  await expect(page.getByRole('heading', { name: 'Filter' })).toBeVisible()

  // F8.1: Filter 섹션 안 "편집..." 버튼 (Flow Filter summary 옆).
  // summary testid 의 직전 형제 button 으로 좁혀 Filter inner 카드 안의 [편집] 버튼만 선택.
  const filterCard = page.locator(
    'div:has(> [data-testid="flow-card-workflow-filter-summary"])',
  )
  await filterCard.getByRole('button', { name: /편집/ }).click()

  // 모달 DialogTitle "Flow Filter".
  await expect(page.getByRole('dialog')).toBeVisible()
  await expect(
    page.getByRole('dialog').getByText('Flow Filter', { exact: true }),
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

// 시나리오 5.1 (F8.1) -------------------------------------------------------
// 사용자 환경 (Socket model + 자유 messageName, 예: EQP_CONDITION_CHECK / 1000_TOOLCHECK)
// 의 Flow 에서도 Filter 섹션이 표시되는지 검증. Trigger 섹션은 SOCKET 이므로 미렌더.
test('Model-Flow-AC-5.1: SOCKET model 의 자유 messageName Flow 도 Filter 섹션을 표시한다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  // SOCKET 모델 + 자유 messageName Flow 로 fixture 치환 (F8.1 사용자 시나리오).
  const SOCKET_ROOT = { ...ROOT_MODEL, commInterface: 'SOCKET' as const }
  const SOCKET_EDIT = { ...EDIT_MODEL, commInterface: 'SOCKET' as const }
  const socketFlow: FlowDetailFixture = {
    flowId: 401,
    workflowName: 'EQP_CONDITION_CHECK',
    messageName: '1000_TOOLCHECK',
    eventId: null,
    transactionId: null,
    workflowFilter:
      '{"comparisonType":"EQUALS","leftSide":{"dataKey":"BODY.STATUS"},"rightSide":{"literal":"OK"}}',
    actionName: 'EQP_REPLY',
    actionDataIndex: null,
    dcopItems: [],
    dcopItemKeys: [],
  }
  state.summaries = [
    {
      flowId: socketFlow.flowId,
      workflowName: socketFlow.workflowName,
      messageName: socketFlow.messageName,
      actionName: socketFlow.actionName,
    },
  ]
  state.details = new Map<number, FlowDetailFixture>([[socketFlow.flowId, socketFlow]])

  // setupMocks 의 ROOT_MODEL / EDIT_MODEL 응답을 SOCKET 으로 덮어쓰려면 page.route 를
  // setupMocks 전에 먼저 등록해야 합니다 (Playwright route 매칭은 *나중에 등록된* 라우트 우선).
  // 따라서 setupMocks 이후에 특수 라우트로 /api/model* 의 commInterface 만 SOCKET 으로 응답.
  await setupMocks(page, state)
  await page.route('**/api/model', async (route, request) => {
    if (request.method() !== 'GET') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        createApiResponse({
          items: [SOCKET_ROOT, SOCKET_EDIT],
          offset: 0,
          limit: 500,
          count: 2,
        }),
      ),
    })
  })
  await page.route(`**/api/model/${EDIT_MODEL.modelVersionKey}`, async (route, request) => {
    if (request.method() !== 'GET') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createApiResponse(SOCKET_EDIT)),
    })
  })
  await page.route(`**/api/model/${ROOT_MODEL.modelVersionKey}`, async (route, request) => {
    if (request.method() !== 'GET') {
      await route.fallback()
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(createApiResponse(SOCKET_ROOT)),
    })
  })

  await openEditModelTab(page)

  // workflowName 그룹 펼친 후 자유 messageName 행 클릭.
  await page.getByRole('button', { name: /EQP_CONDITION_CHECK/ }).click()
  await page.getByRole('button', { name: '1000_TOOLCHECK' }).click()

  // F8.1 root cause: Filter 섹션은 SOCKET 도 표시.
  await expect(page.getByRole('heading', { name: 'Filter' })).toBeVisible()
  // SOCKET 모델은 Trigger 섹션 미렌더 (EventId / TransactionId 영역 없음).
  await expect(page.getByRole('heading', { name: 'Trigger' })).toHaveCount(0)
  // Filter summary 가 workflow_filter 의 BODY.STATUS path 를 포함해야 함.
  await expect(page.getByTestId('flow-card-workflow-filter-summary')).toContainText('STATUS')
})

// 시나리오 F1 ---------------------------------------------------------------
// dcop-flow-binding v4 AC F1: ModelFlowSidebar 의 Add Flow 버튼이 80 x 28 px 이하 (사용자
// 요구 "너무 커" 정정).
test('Model-Flow-AC-F1: Add Flow 버튼 bounding-box 가 80x28 이하다', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  const addFlowButton = page.locator('[data-testid="add-flow-button"]')
  await expect(addFlowButton).toBeVisible()
  const box = await addFlowButton.boundingBox()
  if (box === null) {
    throw new Error('add-flow-button bounding box 를 측정할 수 없습니다.')
  }
  expect(box.width).toBeLessThanOrEqual(80)
  expect(box.height).toBeLessThanOrEqual(28)
})

// 시나리오 F2 ---------------------------------------------------------------
// dcop-flow-binding v4 AC F2 (model-flow-save-unify 갱신):
// Flow 카드의 "+ DCOP 추가" 클릭 → DcopItemPickerModal open → 좌측 1 체크 → → → 우측 1 행
// → picker Save (모달 닫힘 + draft 반영만) → 우상단 "Flow 저장" → PUT body 에
// dcopItemKeys: [301, 302] 포함.
test('Model-Flow-AC-F2: DcopItemPickerModal N:M binding 라운드트립', async ({ page }) => {
  const state = createDefaultMockState()
  // dcop:302 (ORPHAN_DCOP) 을 매핑 시도. Reference pool 에 들어 있고 현재 Flow #201 에는
  // 아직 binding 되지 않은 상태 — picker 좌측에서 체크 가능.
  await setupMocks(page, state)
  await openEditModelTab(page)

  await page.getByRole('button', { name: /handleLotStart/ }).click()
  await page.getByRole('button', { name: 'S6F11' }).click()
  await expect(page.getByRole('heading', { name: 'Collect' })).toBeVisible()

  // Collect 섹션 헤더 우측의 "DCOP 추가" 클릭 → picker open.
  await page.getByRole('button', { name: /DCOP 추가/ }).click()
  const pickerDialog = page.getByRole('dialog')
  await expect(pickerDialog).toBeVisible()
  await expect(pickerDialog.getByText('DCOP Item 선택')).toBeVisible()

  // 좌측에서 ORPHAN_DCOP 체크 (LOT_START_COUNTER 는 이미 매핑됨 — disabled).
  await pickerDialog.getByLabel('ORPHAN_DCOP 선택').check()

  // → 클릭 — 우측에 누적.
  await pickerDialog.locator('[data-testid="dcop-picker-move-button"]').click()
  // 우측 영역에 ORPHAN_DCOP 행 표시.
  await expect(pickerDialog.locator('[data-testid="dcop-picker-right"]').getByText('ORPHAN_DCOP')).toBeVisible()

  // picker Save — 즉시 PUT 안 됨. draft 반영 + 모달 닫힘만.
  const baselinePutCount = state.updateFlowCalls.length
  await pickerDialog.locator('[data-testid="dcop-picker-save-button"]').click()
  await expect(pickerDialog).toBeHidden()
  expect(state.updateFlowCalls.length).toBe(baselinePutCount)

  // 우상단 통합 "Flow 저장" 누르면 그때 PUT 발사 — 5 섹션 + Collect 가 한 번에 송신.
  await page.getByRole('button', { name: 'Flow 저장' }).click()
  await expect.poll(() => state.updateFlowCalls.length).toBeGreaterThan(baselinePutCount)
  const lastCall = state.updateFlowCalls[state.updateFlowCalls.length - 1]
  expect(lastCall.flowId).toBe(201)
  const body = lastCall.body as Record<string, unknown>
  expect(Array.isArray(body.dcopItemKeys)).toBe(true)
  const sentKeys = (body.dcopItemKeys as number[]).map((key) => Number(key)).sort((a, b) => a - b)
  expect(sentKeys).toEqual([301, 302])
})

// 시나리오 F3 (model-flow-draft-and-rename U3/A1, AC-P3) ----------------------
// Reference DCOP "모두 선택" 토글이 검색이 적용된 항목 중 매핑되지 않은 것만 체크하고,
// 다시 토글 시 해제하는지 검증. 이미 매핑된 항목 (disabled) 은 unchecked 유지.
test('Model-Flow-AC-F3: DcopItemPickerModal 모두 선택 토글이 unbound 항목만 tri-state 로 처리한다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  await page.getByRole('button', { name: /handleLotStart/ }).click()
  await page.getByRole('button', { name: 'S6F11' }).click()
  await expect(page.getByRole('heading', { name: 'Collect' })).toBeVisible()

  await page.getByRole('button', { name: /DCOP 추가/ }).click()
  const pickerDialog = page.getByRole('dialog')
  await expect(pickerDialog).toBeVisible()

  // ORPHAN_DCOP 는 unbound, LOT_START_COUNTER 는 이미 bound (disabled).
  const orphanCheckbox = pickerDialog.getByLabel('ORPHAN_DCOP 선택')
  const boundCheckbox = pickerDialog.getByLabel('LOT_START_COUNTER 선택')
  await expect(orphanCheckbox).not.toBeChecked()
  await expect(boundCheckbox).toBeDisabled()

  // 모두 선택 토글 클릭 → unbound 항목만 체크.
  const toggleButton = pickerDialog.locator('[data-testid="dcop-picker-toggle-select-all"]')
  await toggleButton.click()
  await expect(orphanCheckbox).toBeChecked()
  await expect(boundCheckbox).not.toBeChecked() // bound 항목은 unchecked 유지.

  // 다시 클릭 → 전체 해제.
  await toggleButton.click()
  await expect(orphanCheckbox).not.toBeChecked()
})

// 시나리오 F4 (model-flow-draft-and-rename A2, AC-P4 → model-flow-save-unify 갱신) --
// 우측 DCOP pool 의 "모두 제거" 버튼 클릭 후 picker Save (draft 반영) → 우상단
// "Flow 저장" → PUT body 의 dcopItemKeys 가 빈 배열로 송신되는지 검증.
test('Model-Flow-AC-F4: 모두 제거 클릭 후 picker 저장 시 dcopItemKeys 가 빈 배열로 송신된다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  await page.getByRole('button', { name: /handleLotStart/ }).click()
  await page.getByRole('button', { name: 'S6F11' }).click()
  await page.getByRole('button', { name: /DCOP 추가/ }).click()
  const pickerDialog = page.getByRole('dialog')
  await expect(pickerDialog).toBeVisible()

  // 초기 우측에 LOT_START_COUNTER (key=301) 1 행이 있어야 함.
  const rightSection = pickerDialog.locator('[data-testid="dcop-picker-right"]')
  await expect(rightSection.getByText('LOT_START_COUNTER')).toBeVisible()

  // 모두 제거 클릭 → 우측 비고.
  await pickerDialog.locator('[data-testid="dcop-picker-clear-right"]').click()
  await expect(rightSection.getByText('LOT_START_COUNTER')).toHaveCount(0)

  // picker Save — draft 반영 + 모달 닫힘만 (즉시 PUT 안 됨).
  const baselinePutCount = state.updateFlowCalls.length
  await pickerDialog.locator('[data-testid="dcop-picker-save-button"]').click()
  await expect(pickerDialog).toBeHidden()
  expect(state.updateFlowCalls.length).toBe(baselinePutCount)

  // 우상단 "Flow 저장" → PUT body 의 dcopItemKeys 가 빈 배열.
  await page.getByRole('button', { name: 'Flow 저장' }).click()
  await expect.poll(() => state.updateFlowCalls.length).toBeGreaterThan(baselinePutCount)
  const lastCall = state.updateFlowCalls[state.updateFlowCalls.length - 1]
  const body = lastCall.body as Record<string, unknown>
  expect(Array.isArray(body.dcopItemKeys)).toBe(true)
  expect((body.dcopItemKeys as number[]).length).toBe(0)
})

// 시나리오 F5 ---------------------------------------------------------------
// dcop-flow-binding v4 AC F5: Reference > Dcop Itemes 노드 평면 테이블에 Workflow Name 컬럼 부재.
test('Model-Flow-AC-F5: dcop-itemes 노드 테이블에 Workflow Name 컬럼이 없다', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  await page.getByRole('button', { name: 'Dcop Itemes' }).click()
  await expect(page.getByRole('heading', { name: 'Dcop Itemes' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Workflow Name' })).toHaveCount(0)
})

// 시나리오 F8 ---------------------------------------------------------------
// dcop-flow-binding v4 AC F8: socket-message / mes-message / secs-message 3 노드 평면
// 테이블에 Data Index / Data Indexes 컬럼 헤더 0 건 (Phase C 의 BE 컬럼 제거 반영).
test('Model-Flow-AC-F8: 3 message 노드 평면 테이블에 Data Index 컬럼이 없다', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  // SECS Message
  await page.getByRole('button', { name: 'SECS Message' }).click()
  await expect(page.getByRole('heading', { name: 'SECS Message' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /data index(es)?/i })).toHaveCount(0)

  // MES Message
  await page.getByRole('button', { name: 'MES Message' }).click()
  await expect(page.getByRole('heading', { name: 'MES Message' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: /data index(es)?/i })).toHaveCount(0)
})

// 시나리오 Save-1 (model-flow-save-unify) ----------------------------------
// 우상단 통합 Save 버튼이 Flow 영역에서는 'Flow 저장', Reference 영역에서는
// 'Reference 저장' aria-label 로 컨텍스트를 구분한다. 동일 버튼 위치를 유지하면서
// 호출 mutation 만 분기 — Flow 작업 중 우상단 버튼이 Flow 와 무관한 PUT 을
// 보내던 사전 결함의 회귀 방지.
test('Model-Flow-AC-Save-1: 우상단 Save 의 aria-label 이 컨텍스트(Flow / Reference) 별로 다르다', async ({
  page,
}) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  // 초기 진입은 Reference (model-parameter 등 기본 노드) — aria-label 'Reference 저장'.
  await expect(page.getByRole('button', { name: 'Reference 저장' })).toBeVisible()

  // Flow 선택 → aria-label 이 'Flow 저장' 으로 전환.
  await page.getByRole('button', { name: /handleLotStart/ }).click()
  await page.getByRole('button', { name: 'S6F11' }).click()
  await expect(page.getByRole('heading', { name: 'Identity' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Flow 저장' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Reference 저장' })).toHaveCount(0)
})

// 시나리오 Save-2 (model-flow-save-unify) ----------------------------------
// FlowCard 카드 본문 안에 별도 "저장" 버튼이 더 이상 렌더되지 않는다 — 우상단
// 통합 Save 만 사용. footer 영역에는 draft 모드의 "취소" 버튼만 남는다.
test('Model-Flow-AC-Save-2: FlowCard 본문에 별도 저장 버튼이 없다', async ({ page }) => {
  const state = createDefaultMockState()
  await setupMocks(page, state)
  await openEditModelTab(page)

  await page.getByRole('button', { name: /handleLotStart/ }).click()
  await page.getByRole('button', { name: 'S6F11' }).click()
  await expect(page.getByRole('heading', { name: 'Identity' })).toBeVisible()

  // 카드 내부에 한글 '저장' 텍스트의 버튼은 0 개 (exact 매칭 — 'Flow 저장' 은 별개).
  await expect(page.getByRole('button', { name: '저장', exact: true })).toHaveCount(0)

  // 우상단 'Flow 저장' 만 존재.
  await expect(page.getByRole('button', { name: 'Flow 저장' })).toHaveCount(1)
})
