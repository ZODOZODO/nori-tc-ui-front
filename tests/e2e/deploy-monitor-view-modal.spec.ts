import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * deploy 배포(monitor) 탭의 "Deploy View" 모달 — "대상별 진행 현황" 테이블이 모달 폭 안에 들어오는지 검증.
 *
 * 사용자 환경 그대로: 한국어 UI(nori-tc-lang=ko) + 실제 worst-case 데이터(긴 오류 메시지 / 8개 컬럼).
 * server-backed 인식은 /api/deploys 응답의 deployKey 집합(serverHistoryKeySet)으로 결정되므로,
 * history mock 에 deployKey:59 가 있으면 View → /api/deploys/59/targets 가 조회된다.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = { userPk: 1, userId: 'admin', permissionCodes: ['DEPLOY_READ', 'DEPLOY_WRITE', 'LINE_READ'] }
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]

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
  targetSummary: { total: 2, pending: 1, noChange: 0, running: 0, completed: 0, failed: 1, rollingBack: 0, rolledBack: 0, compensationFailed: 0, canceled: 0 },
}

// worst-case: 긴 오류 메시지 + 모든 컬럼 채운 FAILED target.
const TARGETS = [
  {
    deployTargetKey: 1,
    eqpId: 'PLC_MBT_001',
    modelName: 'PLC_MAKER_MODEL_TEST_demo',
    targetStatus: 'FAILED',
    currentStepOrder: 3,
    currentStepCode: 'APPLY_MODEL_VERSION',
    currentStepStatus: 'FAILED',
    rollbackRequired: true,
    lastErrorCode: 'DEPLOY_TIMEOUT',
    lastErrorMessage: '설비 PLC_MBT_001 의 모델 적용 응답이 30초 내에 도착하지 않아 단계 3(APPLY_MODEL_VERSION)에서 타임아웃으로 실패했습니다. 재시도가 필요합니다.',
    updatedAt: '2026-06-12T04:12:00Z',
  },
  {
    deployTargetKey: 2,
    eqpId: 'PLC_MBT_101',
    modelName: 'PLC_MAKER_MODEL_TEST_demo',
    targetStatus: 'PENDING',
    currentStepOrder: null,
    currentStepCode: null,
    currentStepStatus: null,
    rollbackRequired: false,
    lastErrorCode: null,
    lastErrorMessage: null,
    updatedAt: '2026-06-12T04:12:00Z',
  },
]

const SUMMARY = {
  deployKey: 59,
  deployName: '모델 변경',
  eventType: 'EQP_REGISTER_DEPLOY',
  deployStatus: 'READY',
  resultCode: 'DEPLOY_ACCEPTED',
  resolvedScenarioCode: 'REGISTER_MODEL_ONLY',
  resultMessage: { title: '작업이 접수되었습니다.', message: '설비 2대에 대한 작업이 준비 중입니다.', severity: 'INFO' },
}

const setupMocks = async (page: Page) => {
  await page.route(
    (url) => {
      const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
      return pathname.startsWith('/api/')
    },
    async (route: Route, request) => {
      const p = new URL(request.url()).pathname
      if (p === '/api/auth/csrf') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(apiNullSuccess()) })
      if (p === '/api/auth/me') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ME)) })
      if (p === '/api/line') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LINES)) })
      if (p === '/api/deploys/59/targets') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ deployKey: 59, page: 0, size: 50, totalElements: 2, totalPages: 1, targets: TARGETS })) })
      if (p === '/api/deploys/59') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(SUMMARY)) })
      if (p === '/api/deploys/scenarios') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ catalogVersion: 1, catalogChecksum: 'x', loadedAt: '2026-06-12T00:00:00Z', loadedBy: 'sys', reloadReason: 'init', scenarioCount: 0, scenarios: [] })) })
      if (p === '/api/deploys') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [HISTORY], offset: 0, limit: 50, count: 1 })) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 50, count: 0 })) })
    },
  )
}

test('Deploy View 모달 — 대상별 진행 현황 테이블이 모달 폭 안에 들어온다 (가로 overflow 없음)', async ({ page }) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(`[pageerror] ${error.message}`))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`[console:error] ${message.text()}`)
  })

  await setupMocks(page)
  await page.addInitScript(() => window.localStorage.setItem('nori-tc-lang', 'ko'))
  await page.goto('/deploy')

  // 사이드바 '배포'(monitor) 진입
  await page.getByRole('complementary').getByRole('button', { name: '배포', exact: true }).click()

  const history = page.getByTestId('deploy-monitor-history')
  await expect(history).toBeVisible()

  // history row 우클릭 → ContextMenu 'View'(하드코딩 영문)
  await history.locator('[data-row-idx="0"][data-col-idx="0"]').click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'View' }).click()

  const table = page.getByTestId('deploy-monitor-target-progress-table')
  await expect(table).toBeVisible()

  const dialog = page.getByRole('dialog')
  const dialogBox = await dialog.boundingBox()
  const tableBox = await table.boundingBox()
  const tableMetrics = await table.evaluate((el) => ({ scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }))
  // eslint-disable-next-line no-console
  console.log('DIALOG', JSON.stringify({ x: Math.round(dialogBox?.x ?? 0), w: Math.round(dialogBox?.width ?? 0) }))
  // eslint-disable-next-line no-console
  console.log('TABLE_BOX', JSON.stringify({ x: Math.round(tableBox?.x ?? 0), w: Math.round(tableBox?.width ?? 0) }))
  // eslint-disable-next-line no-console
  console.log('TABLE_SCROLL', JSON.stringify(tableMetrics))

  await page.screenshot({ path: 'test-results/deploy-view-modal.png' })

  expect(tableMetrics.scrollWidth).toBeLessThanOrEqual(tableMetrics.clientWidth + 2)
  expect((tableBox?.x ?? 0) + (tableBox?.width ?? 0)).toBeLessThanOrEqual((dialogBox?.x ?? 0) + (dialogBox?.width ?? 0) + 1)
  expect(errors, errors.join('\n')).toEqual([])
})
