import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * 공정 흐름(board) 그룹 저작 e2e — Phase 1(그룹 CRUD + 20px 점 격자 스냅 배치 저장) + Phase 2(설비
 * 드래그&드롭 배정) + Phase 3(개별 화살표 객체 CRUD + 스타일).
 *
 * 첫 진입(저장 flow 없음)은 미배정 그룹 1개에 전체 설비가 들어간다. admin 이 배치 편집 모드에서
 * 그룹을 추가/이름·색 변경하고 설비를 카드 간 드래그&드롭으로 배정하고 화살표를 생성/편집/삭제하면
 * PUT /live-map/layout 의 canvas_json.flow(groups/assignments/arrows) 로 영속된다
 * (placements 는 서버 값 passthrough). 미배정 그룹으로의 드롭 = 배정 해제(assignments 항목 제거).
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
      portItems: [],
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
      portItems: [],
      tooltipMeta: 'CMP Stable',
      tooltipStep: 'Polish',
      alertMessage: null,
    },
  ],
}

interface FlowGroupJson {
  id: string
  title: string
  subtitle: string
  color: string | null
  x: number
  y: number
  width: number
  height: number
}

interface FlowArrowJson {
  id: string
  fromGroupId: string
  toGroupId: string
  color: string | null
  strokeWidth: number
  dash: string
}

interface LayoutPutBody {
  canvasJson: {
    v: number
    flow?: {
      groups: FlowGroupJson[]
      assignments: Record<string, string>
      arrows: FlowArrowJson[]
    }
  }
  placements: unknown[]
}

const setupMocks = async (page: Page, onLayoutPut: (body: LayoutPutBody) => void) => {
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
    if (route.request().method() === 'PUT') {
      const body = route.request().postDataJSON() as LayoutPutBody
      onLayoutPut(body)
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          apiSuccess({ layoutKey: 10, lineKey: 1, canvasJson: body.canvasJson, placements: [], objects: [] }),
        ),
      })
      return
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess({ layoutKey: null, lineKey: 1, canvasJson: null, placements: [], objects: [] })),
    })
  })
  await page.route(/.*\/api\/live-map(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess(LIVE_MAP)) })
  })
  await page.route(/.*\/api\/(eqp|model)(\/.*)?(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })),
    })
  })
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

test('admin: 그룹 추가/이름·색 변경 후 저장하면 canvas_json.flow 로 PUT 된다 (console/pageerror 0)', async ({
  page,
}) => {
  const layoutPuts: LayoutPutBody[] = []
  await setupMocks(page, (body) => layoutPuts.push(body))
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')

  // 첫 진입 — 저장 flow 없음 → 미배정 그룹 1개에 전체 설비.
  await expect(page.getByTestId('live-map-viewer-board')).toBeVisible()
  const unassignedCard = page.getByTestId('live-map-flow-group-unassigned')
  await expect(unassignedCard).toBeVisible()
  // e2e 기본 locale = en — 번역 라벨은 en 값으로 단언.
  await expect(unassignedCard).toContainText('Unassigned')
  await expect(page.getByTestId('live-map-node-CMP_01')).toBeVisible()

  // 배치 편집 모드 진입 → 그룹 추가.
  await page.getByRole('button', { name: 'Edit layout' }).click()
  await page.getByTestId('live-map-flow-add-group').click()
  await expect(page.getByTestId('live-map-viewer-board')).toContainText('New Group')

  // 새 그룹 이름/색 편집.
  await page.locator('[data-testid^="live-map-flow-group-edit-"]').first().click()
  await page.getByTestId('live-map-flow-group-title').fill('증착')
  await page.getByRole('button', { name: '#22c55e' }).click()
  await page.getByTestId('live-map-flow-group-submit').click()
  await expect(page.getByTestId('live-map-viewer-board')).toContainText('증착')

  // 미배정 그룹 리사이즈 — 우하단 핸들 드래그(+40,+40 화면px). 보드 fit 스케일이 환경마다
  // 달라 결과 px 은 고정 단언 불가 → "기본(336x560)보다 커졌고 20px 격자 배수" 만 단언.
  const resizeHandle = page.getByTestId('live-map-flow-group-resize-unassigned')
  const handleBox = await resizeHandle.boundingBox()
  if (!handleBox) {
    throw new Error('unassigned resize handle is not visible')
  }
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2)
  await page.mouse.down()
  await page.mouse.move(handleBox.x + handleBox.width / 2 + 40, handleBox.y + handleBox.height / 2 + 40, { steps: 4 })
  await page.mouse.up()

  // 저장 → PUT canvas_json.flow 검증(미배정 + 새 그룹, placements passthrough = []).
  await page.getByTestId('live-map-flow-save').click()
  await expect.poll(() => layoutPuts.length).toBe(1)
  const putBody = layoutPuts[0]
  expect(Number.isInteger(putBody.canvasJson.v)).toBe(true)
  const flow = putBody.canvasJson.flow
  expect(flow).toBeTruthy()
  const titles = flow ? flow.groups.map((group) => group.title) : []
  expect(titles).toContain('증착')
  expect(flow?.groups.some((group) => group.id === 'unassigned')).toBe(true)
  const created = flow?.groups.find((group) => group.title === '증착')
  expect(created?.color).toBe('#22c55e')
  expect(created ? created.x % 20 : -1).toBe(0)
  expect(created ? created.y % 20 : -1).toBe(0)
  const unassigned = flow?.groups.find((group) => group.id === 'unassigned')
  expect(unassigned ? unassigned.width : -1).toBeGreaterThan(336)
  expect(unassigned ? unassigned.height : -1).toBeGreaterThan(560)
  expect(unassigned ? unassigned.width % 20 : -1).toBe(0)
  expect(unassigned ? unassigned.height % 20 : -1).toBe(0)
  expect(putBody.placements).toEqual([])

  // 저장 후 dirty 해제 — 저장 버튼 비활성.
  await expect(page.getByTestId('live-map-flow-save')).toBeDisabled()

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('admin: 설비 드래그&드롭 배정/해제가 canvas_json.flow.assignments 로 PUT 된다 (console/pageerror 0)', async ({
  page,
}) => {
  const layoutPuts: LayoutPutBody[] = []
  await setupMocks(page, (body) => layoutPuts.push(body))
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  const unassignedCard = page.getByTestId('live-map-flow-group-unassigned')
  await expect(unassignedCard).toBeVisible()

  // 편집 모드 + 그룹 추가. (카드 testid 는 div — edit/delete 버튼 testid 와 구분)
  await page.getByRole('button', { name: 'Edit layout' }).click()
  await page.getByTestId('live-map-flow-add-group').click()
  const newCard = page
    .locator('div[data-testid^="live-map-flow-group-"]')
    .filter({ hasText: 'New Group' })
  await expect(newCard).toBeVisible()

  // CMP_01 을 새 그룹으로 드래그&드롭 → 카드 간 이동.
  await page.getByTestId('live-map-node-CMP_01').dragTo(newCard)
  await expect(newCard.getByTestId('live-map-node-CMP_01')).toBeVisible()
  await expect(unassignedCard.getByTestId('live-map-node-CMP_01')).toHaveCount(0)

  // 저장 → assignments = { '1'(eqpKey): 새 그룹 id }.
  await page.getByTestId('live-map-flow-save').click()
  await expect.poll(() => layoutPuts.length).toBe(1)
  const firstFlow = layoutPuts[0].canvasJson.flow
  const createdId = firstFlow?.groups.find((group) => group.title === 'New Group')?.id
  expect(createdId).toBeTruthy()
  expect(firstFlow?.assignments).toEqual({ '1': createdId })

  // 미배정 그룹으로 되돌리는 드롭 = 배정 해제 → 저장 시 assignments 비움.
  await newCard.getByTestId('live-map-node-CMP_01').dragTo(unassignedCard)
  await expect(unassignedCard.getByTestId('live-map-node-CMP_01')).toBeVisible()
  await page.getByTestId('live-map-flow-save').click()
  await expect.poll(() => layoutPuts.length).toBe(2)
  expect(layoutPuts[1].canvasJson.flow?.assignments).toEqual({})

  // Ctrl+클릭 다중 선택 → 드래그 1번으로 두 설비를 새 그룹에 일괄 배정.
  // 마지막 설비는 클릭을 끝내지 않고 Ctrl 을 누른 채 곧바로 끌기 시작하는 실사용 제스처
  // (click 미발생 → 선택 집합 미등재) — 끌린 노드가 기존 선택과 합쳐져 함께 이동해야 한다.
  await page.getByTestId('live-map-node-CMP_01').click({ modifiers: ['Control'] })
  await expect(page.locator('[data-multi-selected]')).toHaveCount(1)
  const sourceBox = await page.getByTestId('live-map-node-CMP_02').boundingBox()
  const targetBox = await newCard.boundingBox()
  if (!sourceBox || !targetBox) {
    throw new Error('multi-drag source/target is not visible')
  }
  await page.keyboard.down('Control')
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2)
  await page.mouse.down()
  // dragstart 발화까지 Ctrl 유지 후 해제 — 드롭 시점 modifier 와 무관하게 이동이어야 한다.
  await page.mouse.move(sourceBox.x + sourceBox.width / 2 + 12, sourceBox.y + sourceBox.height / 2 + 12, {
    steps: 3,
  })
  await page.keyboard.up('Control')
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + 60, { steps: 8 })
  await page.mouse.up()
  await expect(newCard.getByTestId('live-map-node-CMP_01')).toBeVisible()
  await expect(newCard.getByTestId('live-map-node-CMP_02')).toBeVisible()
  // 드롭으로 다중 선택은 소비(해제)된다.
  await expect(page.locator('[data-multi-selected]')).toHaveCount(0)
  await page.getByTestId('live-map-flow-save').click()
  await expect.poll(() => layoutPuts.length).toBe(3)
  expect(layoutPuts[2].canvasJson.flow?.assignments).toEqual({ '1': createdId, '2': createdId })

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('admin: Ctrl 다중 선택 완료 후 (Ctrl 없이) 드래그하면 선택 전체가 일괄 이동한다 (console/pageerror 0)', async ({
  page,
}) => {
  const layoutPuts: LayoutPutBody[] = []
  await setupMocks(page, (body) => layoutPuts.push(body))
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await expect(page.getByTestId('live-map-flow-group-unassigned')).toBeVisible()

  await page.getByRole('button', { name: 'Edit layout' }).click()
  await page.getByTestId('live-map-flow-add-group').click()
  const newCard = page
    .locator('div[data-testid^="live-map-flow-group-"]')
    .filter({ hasText: 'New Group' })
  await expect(newCard).toBeVisible()

  // Ctrl+클릭으로 두 설비 모두 선택을 '완료'(클릭 release까지) → Ctrl 떼고 드래그.
  await page.getByTestId('live-map-node-CMP_01').click({ modifiers: ['Control'] })
  await page.getByTestId('live-map-node-CMP_02').click({ modifiers: ['Control'] })
  await expect(page.locator('[data-multi-selected]')).toHaveCount(2)

  // 선택된 노드 Ctrl+클릭(드래그 미발생) = 해제 토글 — 다시 선택해 2개로 복귀.
  await page.getByTestId('live-map-node-CMP_02').click({ modifiers: ['Control'] })
  await expect(page.locator('[data-multi-selected]')).toHaveCount(1)
  await page.getByTestId('live-map-node-CMP_02').click({ modifiers: ['Control'] })
  await expect(page.locator('[data-multi-selected]')).toHaveCount(2)

  // 실사용 간격 재현 — live-map 폴링(refetchInterval 5s) 1회가 선택과 드래그 사이에 지나간다.
  await page.waitForTimeout(6_000)
  await expect(page.locator('[data-multi-selected]')).toHaveCount(2)

  // Ctrl 없이 '마지막으로 선택한' 노드를 드래그 — 선택 전체가 함께 이동해야 한다.
  await page.getByTestId('live-map-node-CMP_02').dragTo(newCard)
  await expect(newCard.getByTestId('live-map-node-CMP_01')).toBeVisible()
  await expect(newCard.getByTestId('live-map-node-CMP_02')).toBeVisible()

  await page.getByTestId('live-map-flow-save').click()
  await expect.poll(() => layoutPuts.length).toBe(1)
  const flow = layoutPuts[0].canvasJson.flow
  const createdId = flow?.groups.find((group) => group.title === 'New Group')?.id
  expect(createdId).toBeTruthy()
  expect(flow?.assignments).toEqual({ '1': createdId, '2': createdId })

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})

test('admin: 화살표 생성(스타일 지정)/삭제가 canvas_json.flow.arrows 로 PUT 된다 (console/pageerror 0)', async ({
  page,
}) => {
  const layoutPuts: LayoutPutBody[] = []
  await setupMocks(page, (body) => layoutPuts.push(body))
  const { consoleErrors, pageErrors } = attachConsoleGuards(page)

  await page.goto('/eqp/live-map')
  await expect(page.getByTestId('live-map-flow-group-unassigned')).toBeVisible()

  // 편집 모드 — 그룹이 미배정 1개뿐이면 화살표 추가 비활성(끝점 2개 필요).
  await page.getByRole('button', { name: 'Edit layout' }).click()
  await expect(page.getByTestId('live-map-flow-add-arrow')).toBeDisabled()
  await page.getByTestId('live-map-flow-add-group').click()
  await expect(page.getByTestId('live-map-flow-add-arrow')).toBeEnabled()

  // 화살표 생성 — 미배정 → 새 그룹, 색 #ef4444 / 굵기 4 / 파선.
  await page.getByTestId('live-map-flow-add-arrow').click()
  await page.getByTestId('live-map-flow-arrow-from').click()
  // 끝점 후보는 생성 순서가 아니라 그룹명 순으로 정렬된다: New Group < Unassigned.
  await expect(page.getByRole('option')).toHaveText(['New Group', 'Unassigned'])
  await page.getByRole('option', { name: 'Unassigned' }).click()
  await page.getByTestId('live-map-flow-arrow-to').click()
  await page.getByRole('option', { name: 'New Group' }).click()
  await page.getByRole('button', { name: '#ef4444' }).click()
  await page.getByTestId('live-map-flow-arrow-width-4').click()
  await page.getByTestId('live-map-flow-arrow-dash-dashed').click()
  await page.getByTestId('live-map-flow-arrow-submit').click()
  await expect(page.locator('[data-testid^="live-map-flow-arrow-"]').first()).toBeVisible()
  // 파선/점선 화살표는 dash 진행 애니메이션 클래스를 가진다(실선은 없음).
  await expect(page.locator('svg line.live-map-flow-arrow-dash')).toHaveCount(1)

  // 저장 → PUT flow.arrows 검증.
  await page.getByTestId('live-map-flow-save').click()
  await expect.poll(() => layoutPuts.length).toBe(1)
  const firstFlow = layoutPuts[0].canvasJson.flow
  const createdGroupId = firstFlow?.groups.find((group) => group.title === 'New Group')?.id
  expect(createdGroupId).toBeTruthy()
  expect(firstFlow?.arrows).toHaveLength(1)
  const savedArrow = firstFlow?.arrows[0]
  expect(savedArrow?.fromGroupId).toBe('unassigned')
  expect(savedArrow?.toGroupId).toBe(createdGroupId)
  expect(savedArrow?.color).toBe('#ef4444')
  expect(savedArrow?.strokeWidth).toBe(4)
  expect(savedArrow?.dash).toBe('dashed')

  // 화살표 클릭 → 편집 다이얼로그에서 삭제 → 저장 시 arrows 비움.
  await page.getByTestId(`live-map-flow-arrow-${savedArrow?.id}`).click()
  await page.getByTestId('live-map-flow-arrow-delete').click()
  await expect(page.locator(`[data-testid="live-map-flow-arrow-${savedArrow?.id}"]`)).toHaveCount(0)
  await page.getByTestId('live-map-flow-save').click()
  await expect.poll(() => layoutPuts.length).toBe(2)
  expect(layoutPuts[1].canvasJson.flow?.arrows).toEqual([])

  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toEqual([])
  expect(pageErrors, `page errors: ${pageErrors.join('\n')}`).toEqual([])
})
