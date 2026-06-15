import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC live-map-3d — 실행취소(Ctrl+Z / 되돌리기 버튼) + 현재 층 기준 카운트(구조물 종류별 · 설비 대수 · 미저장 변경) (admin).
 *
 * - "표시" 는 현재 보고 있는 층(전체/1/2층)에 렌더된 객체만 센다(층 전환 시 갱신).
 * - "변경" 은 미저장 변경 수(추가/삭제/이동/회전/층)이며 저장하면 0 으로 리셋된다.
 * - 되돌리기 버튼 + Ctrl+Z 가 단계별로 working 을 복원한다.
 * console.error / pageerror 0 도 단언.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

const ME = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ', 'LIVE_MAP_LAYOUT_WRITE'],
}
const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]
const EMPTY_LAYOUT = { layoutKey: null, lineKey: 1, canvasJson: null, placements: [], objects: [] }

const setupMocks = async (page: Page) => {
  await page.route('**/api/auth/csrf', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(apiNullSuccess()) }),
  )
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(ME)) }))
  await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiNullSuccess()) }))
  await page.route('**/api/line', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LINES)) }))
  await page.route(/\/api\/live-map\/layout\/objects(\/\d+)?(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess([])) }),
  )
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(apiSuccess(EMPTY_LAYOUT)) }),
  )
  await page.route(/.*\/api\/live-map(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ equipmentItems: [] })) }))
  await page.route(/.*\/api\/(eqp|model)(\/.*)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })) }))
  await page.route(/.*\/api\/comm-logs(\/.*)?(\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) }))
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

const enter3dEdit = async (page: Page) => {
  await page.goto('/eqp/live-map')
  await page.getByTestId('line-scope-trigger').click()
  await page.getByTestId('line-scope-option-A_LINE').click()
  await page.getByTestId('live-map-mode-3d').click()
  await expect(page.getByTestId('live-map-3d-scene')).toBeVisible()
  await page.getByTestId('live-map-3d-edit-toggle').click()
}

test('admin: 구조물 추가 → 종류별 표시/변경 카운트 증가, 되돌리기 버튼 + Ctrl+Z 단계 복원 (console/pageerror 0)', async ({
  page,
}) => {
  test.setTimeout(90_000)
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)
  await enter3dEdit(page)

  const changed = page.getByTestId('live-map-3d-changed-count')
  const placements = page.getByTestId('live-map-3d-placement-count')
  const chip = page.getByTestId('live-map-3d-count-chip')
  const undo = page.getByTestId('live-map-3d-undo')

  // 진입 직후 — 변경 0, 되돌리기 비활성.
  await expect(changed).toHaveText('0')
  await expect(placements).toHaveText('0')
  await expect(undo).toBeDisabled()

  // 벽(-1) 추가 → 변경 1, 종류별 표시에 "벽 1".
  await page.getByTestId('live-map-3d-add-select').selectOption('-1')
  await page.getByTestId('live-map-3d-add').click()
  await expect(changed).toHaveText('1')
  await expect(placements).toHaveText('1')
  await expect(chip).toContainText('벽 1')
  await expect(undo).toBeEnabled()

  // 기둥(-4) 추가 → 변경 2, "벽 1" + "기둥 1".
  await page.getByTestId('live-map-3d-add-select').selectOption('-4')
  await page.getByTestId('live-map-3d-add').click()
  await expect(changed).toHaveText('2')
  await expect(chip).toContainText('벽 1')
  await expect(chip).toContainText('기둥 1')

  // 되돌리기 버튼 → 한 단계 복원(기둥 제거): 변경 1.
  await undo.click()
  await expect(changed).toHaveText('1')
  await expect(placements).toHaveText('1')
  await expect(chip).toContainText('벽 1')
  await expect(chip).not.toContainText('기둥')

  // Ctrl+Z → 또 한 단계 복원(벽 제거): 변경 0, 되돌리기 비활성.
  await page.keyboard.press('Control+z')
  await expect(changed).toHaveText('0')
  await expect(placements).toHaveText('0')
  await expect(undo).toBeDisabled()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('admin: "표시" 카운트는 현재 보고 있는 층만 센다 (console/pageerror 0)', async ({ page }) => {
  test.setTimeout(90_000)
  await setupMocks(page)
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)
  await enter3dEdit(page)

  const visible = page.getByTestId('live-map-3d-visible-count')

  // 전체 보기(기본) — 새 추가는 1층으로 들어간다. 벽 추가 → 표시 1.
  await page.getByTestId('live-map-3d-add-select').selectOption('-1')
  await page.getByTestId('live-map-3d-add').click()
  await expect(visible).toHaveText('1')

  // 추가된 벽을 2층으로 이동(자동 선택 상태).
  await page.getByTestId('live-map-3d-set-floor-2').click()

  // 1층 보기 → 1층엔 아무것도 없으니 표시 0.
  await page.getByTestId('live-map-3d-floor-1').click()
  await expect(visible).toHaveText('0')

  // 2층 보기 → 그 벽 하나 → 표시 1.
  await page.getByTestId('live-map-3d-floor-2').click()
  await expect(visible).toHaveText('1')

  // 전체 보기 → 다시 1.
  await page.getByTestId('live-map-3d-floor-all').click()
  await expect(visible).toHaveText('1')

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
