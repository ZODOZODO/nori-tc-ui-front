import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * live-map 테마형 공정 플로우 뷰어 e2e.
 *
 * 기본 뷰(board)가 GET /live-map 실설비를 공정 카드 그리드로 배치하고, 설비 노드 선택 시
 * 우측 상세 패널(설비 ID / 포트 상태)을 연다. console.error / pageerror 0 도 단언.
 * (상세 패널이 /comm-logs/{eqpId} 를 호출하므로 배열로 mock — {items:[]} 객체면 [...logs] 에서 throw.)
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

// WRITE 없음 — 순수 뷰어 경로(토글 미노출) 검증.
const ME = {
  userPk: 200,
  userId: 'operator',
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ'],
}

const LINES = [
  { lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' },
  { lineKey: 2, lineCode: 'B_LINE', lineName: 'B Line' },
]

const port = (id: string, label: string, status: 'RUN' | 'IDLE' | 'DOWN') => ({
  id,
  label,
  status,
  statusLabel: status,
})

const LIVE_MAP = {
  equipmentItems: [
    {
      eqpKey: 1,
      eqpId: 'CMP_01',
      eqpName: 'CMP_01',
      lineValue: 'A_LINE',
      lineLabel: 'A Line',
      clusterId: 'cmp',
      clusterName: 'CMP',
      equipmentModeLabel: 'Single',
      status: 'RUN',
      statusLabel: 'RUN',
      portItems: [port('p1', 'Port 1', 'RUN'), port('p2', 'Port 2', 'IDLE')],
      tooltipMeta: 'CMP Stable',
      tooltipStep: 'Polish',
      alertMessage: null,
    },
    {
      eqpKey: 2,
      eqpId: 'CMP_02',
      eqpName: 'CMP_02',
      lineValue: 'A_LINE',
      lineLabel: 'A Line',
      clusterId: 'cmp',
      clusterName: 'CMP',
      equipmentModeLabel: 'Single',
      status: 'IDLE',
      statusLabel: 'IDLE',
      portItems: [port('p1', 'Port 1', 'IDLE')],
      tooltipMeta: 'CMP Standby',
      tooltipStep: 'Queue',
      alertMessage: null,
    },
  ],
}

const setupMocks = async (page: Page) => {
  await page.route('**/api/auth/csrf', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'set-cookie': 'XSRF-TOKEN=test-csrf-token; Path=/' },
      body: JSON.stringify(apiNullSuccess()),
    })
  })
  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ME)) })
  })
  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiNullSuccess()) })
  })
  await page.route('**/api/line', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LINES)) })
  })
  await page.route(/\/api\/live-map\/layout\/objects(\/\d+)?(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) })
  })
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess({ layoutKey: null, lineKey: 1, canvasJson: null, placements: [], objects: [] })),
    })
  })
  await page.route(/.*\/api\/live-map(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LIVE_MAP)) })
  })
  // 메뉴 prefetch 빈 응답.
  await page.route(/.*\/api\/(eqp|model)(\/.*)?(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })),
    })
  })
  // 상세 패널 통신로그 — CommLogEntry[] 배열 형태로 mock(마지막 등록 = 우선순위).
  await page.route(/.*\/api\/comm-logs(\/.*)?(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) })
  })
}

const attachConsoleGuards = (page: Page) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => {
    pageErrors.push(error.message)
  })
  return { consoleErrors, pageErrors }
}

test('뷰어가 실설비를 공정 카드에 배치하고 설비 선택 시 상세 패널을 연다 (console/pageerror 0)', async ({
  page,
}) => {
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')

  // 첫 라인(A_LINE) 자동 선택 → 테마형 뷰어 + CMP 공정 카드 + 실설비 노드 노출.
  const board = page.getByTestId('live-map-viewer-board')
  await expect(board).toBeVisible()
  await expect(board).toContainText('CMP')
  await expect(page.getByTestId('live-map-node-CMP_01')).toBeVisible()
  await expect(page.getByTestId('live-map-node-CMP_02')).toBeVisible()

  // 설비 노드 선택 → 우측 상세 패널이 해당 설비 ID + 포트 상태를 보여준다.
  await page.getByTestId('live-map-node-CMP_02').click()
  const detail = page.getByTestId('live-map-detail-panel')
  await expect(detail).toBeVisible()
  await expect(detail).toContainText('CMP_02')
  await expect(detail).toContainText('Port 1')

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
