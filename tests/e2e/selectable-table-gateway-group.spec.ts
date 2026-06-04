import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * SPEC `selectable-table-rollout` R2-AC-3 — GatewayGroupTable SelectableTable 마이그레이션 후
 * 2x2 영역 Ctrl+C → TSV 검증 + wrapRow ContextMenu (Eqp Start/End/Restart) 회귀.
 *
 * SPEC AC L101 의 EQP 대표는 W-EI1 결정 (Plan 2026-05-26) 으로 EqpInfoTable → GatewayGroupTable
 * 으로 변경됨. EqpInfoTable 은 단일행 (1 EQP / 12 컬럼) 이라 2x2 자연 검증 불가.
 * EQP 4 종 마이그레이션 자체는 모두 진행됨 — 본 e2e 는 대표 1 종 검증.
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
  permissionCodes: [],
}

interface MockEqp {
  eqpId: string
  routePartition: number
  commInterface: 'SECS' | 'SOCKET'
  commMode: string
  eqpIp: string
  eqpPort: number
}

const buildEqp = (overrides: Partial<MockEqp> & { eqpId: string }): MockEqp => ({
  eqpId: overrides.eqpId,
  routePartition: overrides.routePartition ?? 0,
  commInterface: overrides.commInterface ?? 'SECS',
  commMode: overrides.commMode ?? 'PASSIVE',
  eqpIp: overrides.eqpIp ?? '127.0.0.1',
  eqpPort: overrides.eqpPort ?? 50001,
})

const buildEqpManageDetail = (eqpId: string) => ({
  eqpId,
  socketSettings: { socketProtocolType: 'HSMS' },
  modelBinding: { modelName: 'MODEL_A', modelVersion: '1.0.0', modelVersionKey: 1 },
  jars: { gatewayJarFileName: 'gateway.jar', businessJarFileName: 'business.jar' },
  runtimeState: null,
})

interface EqpMockState {
  eqpItems: MockEqp[]
}

const setupMocks = async (page: Page, state: EqpMockState) => {
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

      if (pathname === '/api/eqp') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            apiSuccess({
              items: state.eqpItems,
              offset: 0,
              limit: 500,
              count: state.eqpItems.length,
            }),
          ),
        })
        return
      }

      if (pathname === '/api/eqp/manage-batch') {
        const eqpIdsParam = url.searchParams.get('eqpIds') ?? ''
        const requestedIds = eqpIdsParam.split(',').filter(Boolean)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            apiSuccess({
              items: requestedIds.map((eqpId) => buildEqpManageDetail(eqpId)),
              missingEqpIds: [],
            }),
          ),
        })
        return
      }

      if (pathname === '/api/eqp/options') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            apiSuccess({ protocolTypes: [], socketProtocolTypes: [], runtimeStates: [] }),
          ),
        })
        return
      }

      // 빈 fallback
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess({ items: [] })),
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

test.beforeEach(async ({ context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
})

test('Selectable-Table-R2-AC-3: GatewayGroupTable 2x2 영역 Ctrl+C → 클립보드 TSV', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  // partition 0,1 → gateway_app1 그룹 (Math.floor(partition / 2) + 1)
  const state: EqpMockState = {
    eqpItems: [
      buildEqp({ eqpId: 'EQ001', routePartition: 0, eqpIp: '10.0.0.1' }),
      buildEqp({ eqpId: 'EQ002', routePartition: 1, eqpIp: '10.0.0.2' }),
    ],
  }
  await setupMocks(page, state)

  await page.goto('/eqp')
  await page.waitForLoadState('networkidle')

  // 사이드바 Gateway 그룹 헤더 클릭 → 아코디언 펼침 후 gateway_app1 클릭
  await page.getByRole('button', { name: 'Gateway', exact: true }).click()
  await page.getByRole('button', { name: 'gateway_app1', exact: true }).click()

  const container = page.getByTestId('selectable-table-gateway-group')
  await expect(container).toBeVisible()

  // col 0 = EQPID, col 1 = Business App. 두 행 모두 fixture 의 partition 이 같은 gateway app
  // 이므로 routePartition 기반 business app name 도 동일. EQPID 만 다름.
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
  // EQ001 / EQ002 정확히 노출
  const cellsSet = new Set(cells)
  expect(cellsSet.has('EQ001')).toBe(true)
  expect(cellsSet.has('EQ002')).toBe(true)

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})

test('Selectable-Table-R2-AC-3 회귀: GatewayGroupTable 우클릭 ContextMenu Label 가 wrapRow 적용 후에도 노출', async ({
  page,
}) => {
  const consoleBucket = attachConsoleErrorListeners(page)
  const state: EqpMockState = {
    eqpItems: [buildEqp({ eqpId: 'EQ001', routePartition: 0 })],
  }
  await setupMocks(page, state)

  await page.goto('/eqp')
  await page.waitForLoadState('networkidle')
  await page.getByRole('button', { name: 'Gateway', exact: true }).click()
  await page.getByRole('button', { name: 'gateway_app1', exact: true }).click()

  const container = page.getByTestId('selectable-table-gateway-group')
  await expect(container).toBeVisible()

  // row 0, col 0 셀 우클릭 → ContextMenu 의 EQPID label 노출
  await container.locator('[data-row-idx="0"][data-col-idx="0"]').click({ button: 'right' })
  // ContextMenuLabel 는 menuitem 이 아닌 label role — text 로 검증.
  await expect(page.locator('[role="menu"]').getByText('EQ001').first()).toBeVisible()

  expect(consoleBucket.errors, consoleBucket.errors.join('\n')).toEqual([])
})
