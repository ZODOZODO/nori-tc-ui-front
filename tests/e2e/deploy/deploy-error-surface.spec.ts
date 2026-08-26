import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * 실패가 **화면에 문구로 나타나는지** 를 검증한다.
 *
 * 레포 전체에 `status: 4xx` / `success: false` mock 이 2 곳뿐이었고(둘 다 다른 것을 보는
 * 테스트), 에러 문구가 실제로 렌더되는지 단언하는 e2e 는 0 건이었다. 공용
 * `resolveErrorMessage` 로 수렴한 뒤에도 이 계약을 e2e 가 덮지 않으면, 화면에서 사유가
 * 사라지는 회귀를 단위 테스트만으로는 잡을 수 없다 — 단위 테스트는 함수의 반환값만 보고
 * 그 문구가 DOM 에 닿는지는 보지 않는다.
 *
 * 검증하는 두 갈래:
 *  1. 백엔드가 표준 실패 봉투를 주면 **서버 errorMsg 를 그대로** 보여준다.
 *  2. 백엔드가 표준 봉투가 아닌 것을 주면(빈 body / 프록시 HTML) **fallback 문구**를 보여준다.
 *     이때도 화면이 조용해지면 안 된다.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = { userPk: 1, userId: 'admin', permissionCodes: ['DEPLOY_READ', 'DEPLOY_WRITE', 'LINE_READ', 'USER_READ'] }
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]

/** READY 상태여야 우클릭 메뉴에 'Deploy'(=start) 항목이 나온다(DeployMonitorPanel.tsx:946). */
const HISTORY = {
  deployKey: 59,
  deployName: '모델 변경',
  eventType: 'EQP_REGISTER_DEPLOY',
  deployStatus: 'READY',
  pauseRequested: false,
  executionPolicy: 'BEST_EFFORT',
  requestedBy: 'demo',
  createdAt: '2026-06-12T04:12:00Z',
  startedAt: null,
  finishedAt: null,
  terminal: false,
  interfaceType: 'PLC',
  selectedModelName: 'PLC_MAKER_MODEL_TEST_demo',
  selectedModelVersion: '26.06.12.0001',
  selectedBusinessJarName: null,
  targetSummary: { total: 1, pending: 1, noChange: 0, running: 0, completed: 0, failed: 0, rollingBack: 0, rolledBack: 0, compensationFailed: 0, canceled: 0 },
}

interface FailureOverrides {
  /** `POST /api/deploys/59/start` 응답을 갈아친다. */
  start?: { status: number; body: unknown }
  /** `GET /api/user` 응답을 갈아친다(사용자 목록 조회). */
  userList?: { status: number; body: unknown }
}

const setupMocks = async (page: Page, overrides: FailureOverrides) => {
  await page.route(
    (url) => {
      const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
      return pathname.startsWith('/api/')
    },
    async (route: Route, request) => {
      const p = new URL(request.url()).pathname
      const json = (status: number, body: unknown) =>
        route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })

      if (p === '/api/auth/csrf') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' },
          body: JSON.stringify(apiNullSuccess()),
        })
      }
      if (p === '/api/auth/me') return json(200, apiSuccess(ME))
      if (p === '/api/line') return json(200, apiSuccess(LINES))
      if (p === '/api/deploys/59/start' && overrides.start) {
        return json(overrides.start.status, overrides.start.body)
      }
      if (p === '/api/user' && overrides.userList) {
        return json(overrides.userList.status, overrides.userList.body)
      }
      if (p === '/api/user') return json(200, apiSuccess({ items: [], offset: 0, limit: 500, count: 0 }))
      if (p === '/api/deploys/scenarios') {
        return json(200, apiSuccess({ catalogVersion: 1, catalogChecksum: 'x', loadedAt: '2026-06-12T00:00:00Z', loadedBy: 'sys', reloadReason: 'init', scenarioCount: 0, scenarios: [] }))
      }
      if (p === '/api/deploys') return json(200, apiSuccess({ items: [HISTORY], offset: 0, limit: 50, count: 1 }))
      return json(200, apiSuccess({ items: [], offset: 0, limit: 50, count: 0 }))
    },
  )
}

const openMonitor = async (page: Page) => {
  await page.addInitScript(() => window.localStorage.setItem('nori-tc-lang', 'ko'))
  // 등록 / 배포 / 이력이 한 라우트로 합쳐져 단계 전환은 페이지 안 카드가 한다(기본 단계는 등록).
  await page.goto('/deploy')
  await page.getByTestId('deploy-mode-deploy').click()
  const history = page.getByTestId('deploy-monitor-history')
  await expect(history).toBeVisible()
  return history
}

/** 우클릭 → 'Deploy' 로 start 를 부른다(메뉴 라벨은 하드코딩 영문). */
const triggerStart = async (page: Page, history: ReturnType<Page['getByTestId']>) => {
  await history.locator('[data-row-idx="0"][data-col-idx="0"]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Deploy' }).click()
}

test('start 실패 — 백엔드가 준 errorMsg 를 화면에 그대로 보여준다', async ({ page }) => {
  test.setTimeout(60_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(`[pageerror] ${error.message}`))

  const SERVER_MESSAGE =
    '설비 PLC_MBT_001 이 다른 Deploy(58) 에 점유되어 있어 실행할 수 없습니다. 해당 Deploy 종료 후 다시 시도해 주세요.'

  await setupMocks(page, {
    start: {
      status: 409,
      body: { success: false, data: null, errorCode: 'DEPLOY_TARGET_BUSY', errorMsg: SERVER_MESSAGE },
    },
  })

  const history = await openMonitor(page)
  await triggerStart(page, history)

  // 서버 문구가 그대로 떠야 한다 — fallback('Deploy 실행에 실패했습니다.') 으로 대체되면 실패다.
  await expect(page.getByText(SERVER_MESSAGE)).toBeVisible()
  await expect(page.getByText('Deploy 실행에 실패했습니다.')).toHaveCount(0)

  expect(pageErrors, pageErrors.join('\n')).toEqual([])
})

test('start 실패 — 표준 봉투가 아니면 fallback 문구로라도 실패를 알린다', async ({ page }) => {
  test.setTimeout(60_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(`[pageerror] ${error.message}`))

  // 프록시/게이트웨이가 봉투 없이 502 를 주는 상황. 화면이 조용해지면 사용자는 눌렀는지조차 모른다.
  await setupMocks(page, { start: { status: 502, body: {} } })

  const history = await openMonitor(page)
  await triggerStart(page, history)

  await expect(page.getByText('Deploy 실행에 실패했습니다.')).toBeVisible()

  expect(pageErrors, pageErrors.join('\n')).toEqual([])
})

test('사용자 목록 조회 실패 — 조회 실패 사유가 화면에 남는다', async ({ page }) => {
  test.setTimeout(60_000)
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(`[pageerror] ${error.message}`))

  // userListErrorMessage 경로.
  //
  // 이 테스트는 그 지점의 `instanceof Error ? ... : null` 제거에 대한 회귀 테스트가 **아니다** —
  // api 레이어가 언제나 ApiError 를 던지므로(user.api.ts:127) 그 분기는 애초에 도달 불가였고,
  // 되돌려도 여기는 통과한다. 이 테스트가 못 박는 것은 그보다 앞선 계약이다: 조회가 실패하면
  // 사유가 화면에 남아야 하고, 누가 이 문구를 지우거나 조건을 좁히면 잡힌다.
  await setupMocks(page, { userList: { status: 500, body: {} } })

  const history = await openMonitor(page)
  await expect(history).toBeVisible()

  await expect(page.getByText('사용자 목록을 조회하지 못했습니다.')).toBeVisible()

  expect(pageErrors, pageErrors.join('\n')).toEqual([])
})
