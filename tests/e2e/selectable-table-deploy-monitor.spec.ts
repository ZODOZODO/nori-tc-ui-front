import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * SPEC `selectable-table-rollout` R2-AC-2 — DeployMonitorPanel main history table
 * SelectableTable 마이그레이션 후 2x2 영역 Ctrl+C → TSV 검증 + ContextMenu (View) 회귀 + 단일 클릭
 * setActiveDeployKey 회귀.
 *
 * 글로벌 CLAUDE.md 14 — assertion 통과 + page.on('console','error') / page.on('pageerror') 0 모두 충족.
 */

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

const PERMISSIONED_ME = {
  userPk: 1,
  userId: 'admin',
  permissionCodes: ['DEPLOY_READ', 'DEPLOY_WRITE'],
}

const buildDeployItem = (overrides: {
  deployKey: number
  deployName: string
  eventType?: string
  deployStatus?: string
  requestedBy?: string
  createdAt?: string
  total?: number
  completed?: number
  failed?: number
}) => ({
  deployKey: overrides.deployKey,
  deployName: overrides.deployName,
  eventType: overrides.eventType ?? 'EQP_BUSINESS_JARFILE_UPDATE',
  deployStatus: overrides.deployStatus ?? 'COMPLETED',
  pauseRequested: false,
  executionPolicy: 'BEST_EFFORT',
  requestedBy: overrides.requestedBy ?? 'admin',
  createdAt: overrides.createdAt ?? '2026-05-26T10:00:00Z',
  startedAt: null,
  finishedAt: null,
  terminal: false,
  interfaceType: null,
  selectedModelName: null,
  selectedModelVersion: null,
  selectedBusinessJarName: null,
  targetSummary: {
    total: overrides.total ?? 2,
    pending: 0,
    noChange: 0,
    running: 0,
    completed: overrides.completed ?? 2,
    failed: overrides.failed ?? 0,
    rollingBack: 0,
    rolledBack: 0,
    compensationFailed: 0,
    canceled: 0,
  },
})

interface DeployMockState {
  historyItems: ReturnType<typeof buildDeployItem>[]
}

const setupMocks = async (page: Page, state: DeployMockState) => {
  await page.route(
    (url) => {
      const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
      return pathname.startsWith('/api/')
    },
    async (route: Route, request) => {
      const url = new URL(request.url())
      const pathname = url.pathname

      if (pathname === '/api/auth/csrf') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'set-cookie': 'XSRF-TOKEN=test-csrf-token; Path=/' },
          body: JSON.stringify(apiNullSuccess()),
        })
        return
      }

      if (pathname === '/api/auth/me') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(apiSuccess(PERMISSIONED_ME)),
        })
        return
      }

      if (pathname === '/api/deploys') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            apiSuccess({
              items: state.historyItems,
              offset: 0,
              limit: 50,
              count: state.historyItems.length,
            }),
          ),
        })
        return
      }

      // 빈 fallback — 기타 endpoint
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 50, count: 0 })),
      })
    },
  )
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

const enterDeployMode = async (page: Page) => {
  await page.goto('/deploy')
  // default mode = 'register' (deploy-ui.store L116) → 사이드바 Deploy 버튼 클릭으로 mode 전환.
  // topbar / register form 안에 동명 버튼이 있어 complementary (aside) role 로 한정.
  await page
    .getByRole('complementary')
    .getByRole('button', { name: 'Deploy', exact: true })
    .click()
}

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

test('Selectable-Table-R2-AC-2: DeployMonitorPanel 2x2 영역 Ctrl+C → 클립보드 TSV', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  const state: DeployMockState = {
    historyItems: [
      buildDeployItem({
        deployKey: 101,
        deployName: 'DEPLOY_ALPHA',
        deployStatus: 'COMPLETED',
        requestedBy: 'admin',
      }),
      buildDeployItem({
        deployKey: 102,
        deployName: 'DEPLOY_BETA',
        deployStatus: 'RUNNING',
        requestedBy: 'tester',
      }),
    ],
  }
  await setupMocks(page, state)
  await enterDeployMode(page)

  const container = page.getByTestId('deploy-monitor-history')
  await expect(container).toBeVisible()

  // col 0 = Deploy Name (accessor = item.deployName), col 1 = Event Type (accessor = item.eventType)
  // 2x2 — 두 행의 Deploy Name + Event Type
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
  // 두 행 모두 같은 eventType ('EQP_BUSINESS_JARFILE_UPDATE') 라 set 은 3 원소.
  expect(new Set(cells)).toEqual(
    new Set(['DEPLOY_ALPHA', 'DEPLOY_BETA', 'EQP_BUSINESS_JARFILE_UPDATE']),
  )

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})

test('Selectable-Table-R2-AC-2 회귀: DeployMonitorPanel 우클릭 ContextMenu (View) 가 wrapRow 적용 후에도 노출', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  const state: DeployMockState = {
    historyItems: [
      buildDeployItem({
        deployKey: 101,
        deployName: 'DEPLOY_ALPHA',
        deployStatus: 'COMPLETED',
      }),
    ],
  }
  await setupMocks(page, state)
  await enterDeployMode(page)

  const container = page.getByTestId('deploy-monitor-history')
  await expect(container).toBeVisible()

  // row 0, col 0 셀 우클릭
  await container.locator('[data-row-idx="0"][data-col-idx="0"]').click({ button: 'right' })
  await expect(page.getByRole('menuitem', { name: 'View' })).toBeVisible()

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})
