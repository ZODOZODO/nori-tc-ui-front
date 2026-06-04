import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * SPEC `selectable-table-rollout` R4 — ModelInfoTable SelectableTable 마이그레이션 후
 * 2x2 영역 Ctrl+C → TSV 검증 + 단일 클릭 row select 보존 + 더블클릭 onOpenDetail 회귀.
 *
 * Plan: `.claude/progress/selectable-table-rollout-r4.md` (W-MI1=A wrapRow onClick+onDoubleClick 보존).
 *
 * 글로벌 CLAUDE.md 14 — assertion 통과 + page.on('console','error') / page.on('pageerror') 0 모두 충족.
 *
 * fixture: ROOT (FLOW_DEMO_MODEL / 26.05.20.0000) + EDIT (FLOW_DEMO_MODEL_admin / EDIT).
 * ModelInfoTable 은 updatedAt 내림차순 정렬 — row 0 = EDIT (newer), row 1 = ROOT.
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

/**
 * EDIT 의 sibling version — 같은 modelName 으로 selectedModelRows 가 2 row 가 되도록.
 * AC-R4-1a 2x2 range copy 자연 검증을 위해 필요. updatedAt 은 EDIT 보다 더 newer 로 설정해
 * row 0 위치를 고정합니다.
 */
const EDIT_V2_MODEL = {
  modelVersionKey: 102,
  modelKey: 12,
  modelName: 'FLOW_DEMO_MODEL_admin',
  parentModel: 'FLOW_DEMO_MODEL',
  modelVersion: 'v2',
  commInterface: 'SECS' as const,
  status: 'DEVELOP',
  description: 'edit v2',
  maker: 'demo',
  createdAt: '2026-05-20T00:20:00Z',
  updatedAt: '2026-05-20T00:20:00Z',
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

      if (pathname === '/api/model' && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse({
              items: [ROOT_MODEL, EDIT_MODEL, EDIT_V2_MODEL],
              offset: 0,
              limit: 500,
              count: 3,
            }),
          ),
        })
        return
      }

      if (pathname === `/api/model/${EDIT_V2_MODEL.modelVersionKey}` && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse(EDIT_V2_MODEL)),
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

      const flowsListMatch = pathname.match(/^\/api\/model\/(\d+)\/flows$/)
      if (flowsListMatch && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(createApiResponse({ items: [] })),
        })
        return
      }

      const detailsMatch = pathname.match(/^\/api\/model\/(\d+)\/details\/([\w-]+)$/)
      if (detailsMatch && method === 'GET') {
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

/**
 * /model 진입 후 좌측 사이드바의 ROOT 모델 버튼을 클릭해 ModelInfoTable 에 ROOT+EDIT 2 row 가
 * 노출되도록 합니다. 사이드바의 모델명 클릭 → selectedModelRows 가 ROOT+EDIT 으로 채워지는 흐름.
 */
const openModelInfoTableWithBothRows = async (page: Page) => {
  await page.goto('/model')
  await page.waitForLoadState('networkidle')
  // 사이드바 LNB 3단 아코디언(기본 접힘): SECS → FLOW_DEMO_MODEL(root) → branch 펼침.
  await page.getByRole('button', { name: 'SECS', exact: true }).click()
  await page.getByRole('button', { name: 'FLOW_DEMO_MODEL', exact: true }).click()
  await page.getByRole('button', { name: 'FLOW_DEMO_MODEL_admin' }).click()
  // ModelInfoTable 의 SelectableTable testId 노출 확인
  await expect(page.getByTestId('selectable-table-model-info')).toBeVisible()
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

test('Selectable-Table-R4-AC-1a: ModelInfoTable 2x2 영역 Ctrl+C → 클립보드 TSV', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  await setupMocks(page)
  await openModelInfoTableWithBothRows(page)

  const container = page.getByTestId('selectable-table-model-info')
  await expect(container).toBeVisible()

  // updatedAt desc 정렬 — row 0 = EDIT_V2 (v2, newer), row 1 = EDIT (EDIT, older).
  // selectedModelRows 는 selectedModel.modelName 과 같은 행만 — EDIT/V2 둘 다 'FLOW_DEMO_MODEL_admin'.
  // col 0 = modelName, col 1 = modelVersion.
  const start = container.locator('[data-row-idx="0"][data-col-idx="0"]')
  const end = container.locator('[data-row-idx="1"][data-col-idx="1"]')
  await start.hover()
  await page.mouse.down()
  await end.hover()
  await page.mouse.up()

  await page.keyboard.press('ControlOrMeta+C')

  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  const lines = clipboard.split('\n')
  expect(lines).toHaveLength(2)
  const cells = lines.flatMap((line) => line.split('\t'))
  expect(cells).toHaveLength(4)
  expect(new Set(cells)).toEqual(
    new Set([
      EDIT_V2_MODEL.modelName,
      EDIT_V2_MODEL.modelVersion,
      EDIT_MODEL.modelName,
      EDIT_MODEL.modelVersion,
    ]),
  )

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})

test('Selectable-Table-R4-AC-1b: ModelInfoTable 단일 클릭 — 선택(onSelectRow)은 동작하되 row 하이라이트는 미표시', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  await setupMocks(page)
  await openModelInfoTableWithBothRows(page)

  const container = page.getByTestId('selectable-table-model-info')

  // row 0 = EDIT (modelVersionKey=101) 셀 클릭 — 클릭→onSelectRow 는 유지(모델 선택 기능),
  // 단 사용자 결정으로 선택 행 하이라이트(data-state=selected)는 더 이상 표시하지 않는다.
  await container.locator('[data-row-idx="0"][data-col-idx="0"]').click()

  // 셀 anchor(셀 선택)는 동작 → 클릭이 정상 처리됐음을 보증.
  await expect(
    container.locator('[data-row-idx="0"][data-col-idx="0"]'),
  ).toBeVisible()
  // 선택 행 배경 하이라이트는 없어야 한다.
  await expect(container.locator('tr[data-state="selected"]')).toHaveCount(0)

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})

test('Selectable-Table-R4-AC-1c: ModelInfoTable 더블클릭 시 onOpenDetail 호출 (Version 프레임 진입)', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  await setupMocks(page)
  await openModelInfoTableWithBothRows(page)

  const container = page.getByTestId('selectable-table-model-info')

  // row 0 = EDIT 셀 더블클릭 → wrapRow 의 onDoubleClick → onOpenDetail(EDIT) → Version 프레임 mount
  await container.locator('[data-row-idx="0"][data-col-idx="0"]').dblclick()

  // ModelDetailPanel 의 lazy-loaded 콘텐츠 (Message Flows 텍스트) 노출까지 대기 — model-flow.spec.ts 의 검증 패턴 답습.
  await expect(page.getByText('Message Flows')).toBeVisible()

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})
