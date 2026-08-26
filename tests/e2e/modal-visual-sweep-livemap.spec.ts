import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * 정밀 분석 (b) — live-map 모달 시각 스윕 (Playwright 로컬 렌더, Claude API 미사용).
 *
 * LiveMapDemoModal(max-w-340=1360px, flex-col, 3D 데모 씬)을 "데모 시작" 버튼으로 열어
 * 풀스크린 가까운 와이드 모달의 비율/3D 씬/헤더·푸터 정렬이 깨지지 않는지 스크린샷으로 확인.
 * console.error/pageerror 0 단언 동반(3D 씬 로딩 크래시 회귀 차단).
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNull = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = { userPk: 200, userId: 'operator', permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ'] }
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]

const port = (id: string, label: string, status: 'RUN' | 'IDLE' | 'DOWN') => ({ id, label, status, statusLabel: status })
const LIVE_MAP = {
  equipmentItems: [
    { eqpKey: 1, eqpId: 'CMP_01', eqpName: 'CMP_01', lineValue: 'A_LINE', lineLabel: 'A Line', clusterId: 'cmp', clusterName: 'CMP', equipmentModeLabel: 'Single', status: 'RUN', statusLabel: 'RUN', portItems: [port('p1', 'Port 1', 'RUN')], tooltipMeta: 'CMP Stable', tooltipStep: 'Polish', alertMessage: null },
  ],
}

// worst-case: 긴 시나리오명 + commInterface/supportedModes(신규 Run 경로 카탈로그 형상).
const DEMO_RUN_SCENARIOS = [
  { scenarioId: 'normal-flow', version: 3, name: 'CMP 폴리싱 → 세정 → 계측 풀 E2E 통합 시나리오 (장시간)', commInterface: 'SOCKET', supportedModes: ['ALL', 'EQUIPMENT_ONLY', 'UPSTREAM_ONLY'] },
  { scenarioId: 'modbus-tcp-normal-flow', version: 1, name: 'Modbus TCP PLC 노멀 플로우', commInterface: 'PLC', supportedModes: ['ALL', 'EQUIPMENT_ONLY', 'UPSTREAM_ONLY'] },
]

const setupMocks = async (page: Page) => {
  await page.route(
    (url) => {
      const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
      return pathname.startsWith('/api/')
    },
    async (route: Route, request) => {
      const p = new URL(request.url()).pathname
      if (p === '/api/auth/csrf') return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(apiNull()) })
      if (p === '/api/auth/me') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ME)) })
      if (p === '/api/line') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LINES)) })
      if (/\/api\/live-map\/layout\/objects/.test(p)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) })
      if (/\/api\/live-map\/layout/.test(p)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ layoutKey: null, lineKey: 1, canvasJson: null, placements: [], objects: [] })) })
      // DemoModal Run 경로: 시나리오 카탈로그는 배열 형태 필수(객체면 scenarioOptions.some 크래시). /scenarios 를
      // 일반 /demo-runs 보다 먼저 매칭한다. getRun(/demo-runs/{id})은 run 시작 전엔 호출되지 않으나 안전망으로 둔다.
      if (/\/api\/live-map\/demo-runs\/scenarios/.test(p)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(DEMO_RUN_SCENARIOS)) })
      if (p === '/api/live-map/demo-runs' && request.method() === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) })
      if (/\/api\/live-map\/demo-runs/.test(p)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ runId: 'run-test', mode: 'ALL', state: 'RUNNING', targets: [], createdAt: '2026-08-26T00:00:00Z', scenarioId: 'normal-flow' })) })
      if (/\/api\/live-map/.test(p)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LIVE_MAP)) })
      if (/\/api\/comm-logs/.test(p)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) })
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })) })
    },
  )
}

test('LiveMapDemoModal — 와이드 3D 데모 모달 시각', async ({ page }) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (error) => { errors.push(`[pageerror] ${error.message}`); console.log(`[livemap-demo][pageerror] ${error.message}`) })
  page.on('console', (message) => { if (message.type() === 'error') { errors.push(`[console:error] ${message.text()}`); console.log(`[livemap-demo][console:error] ${message.text()}`) } })

  await setupMocks(page)
  await page.addInitScript(() => window.localStorage.setItem('nori-tc-lang', 'ko'))
  await page.goto('/eqp/live-map')
  await expect(page.getByTestId('live-map-viewer-board')).toBeVisible()

  await page.getByRole('button', { name: '데모 시작' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  // 3D 씬 로딩 안정화 대기.
  await page.waitForTimeout(1500)

  const box = await page.getByRole('dialog').boundingBox()
  const viewport = page.viewportSize()

  console.log('LIVEMAP_DEMO_DIALOG', JSON.stringify({ w: Math.round(box?.width ?? 0), h: Math.round(box?.height ?? 0), vw: viewport?.width }))

  await page.screenshot({ path: 'test-results/visual-livemap-demo.png' })
  expect(errors, errors.join('\n')).toEqual([])
})
