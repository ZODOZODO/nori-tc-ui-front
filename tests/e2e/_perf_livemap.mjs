import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * live-map 전용 런타임 측정 — 2D 뷰어 / 3D 뷰어 / 구조물 편집(builder) 모드별 진입 시간 + 층 전환 시간 +
 * console.error / pageerror 결함 수집. 실 backend(:3000) 대상.
 *
 * _perf_measure.mjs 는 페이지 로드 + /api 시간만 잰다(3D 모드 진입/층 전환은 안 누름). 본 스크립트는 그 공백을 채운다.
 *
 * 측정 방법: performance.now() (브라우저 단조 시계) 로 클릭 직전~end 조건 사이 delta. end 조건은 testid 가시성.
 *   - 3D: mode-3d 클릭 → scene visible(ms) → 첫 설비 뱃지 visible(ms, 설비 WebGL+Html 마운트).
 *   - 층 전환: 버튼 클릭 → 2 rAF settle(ms).
 *   - builder: mode-builder 클릭 → object-editor visible(ms).
 *
 * env: BASE_URL(기본 http://127.0.0.1:3000) / TEST_USER / TEST_PASS / OUTPUT_PATH / HEADLESS / ROUNDS(기본 1)
 */

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const LOGIN_ID = process.env.TEST_USER ?? 'admin'
const LOGIN_PW = process.env.TEST_PASS ?? 'ChangeMe123!'
const OUTPUT_PATH = process.env.OUTPUT_PATH ?? ''
const HEADLESS = (process.env.HEADLESS ?? 'true') !== 'false'

const now = (page) => page.evaluate(() => performance.now())
const settle2Raf = (page) =>
  page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now())))))

const MOCK = (process.env.MOCK ?? 'false') === 'true'
const MOCK_EQP = Number(process.env.MOCK_EQP ?? 54)

const browser = await chromium.launch({ headless: HEADLESS })
const context = await browser.newContext({ viewport: { width: 1720, height: 1180 } })
const page = await context.newPage()

// MOCK 모드 — backend 없이 prod preview 측정용. 실설비 N대(공정 클러스터 순환)로 클라이언트 렌더 비용만 격리.
if (MOCK) {
  const ok = (data) => JSON.stringify({ success: true, data, errorCode: null, errorMsg: null })
  const CLUSTERS = ['photo', 'etch', 'cvd', 'cmp', 'diff', 'imp', 'wet', 'metal', 'metro', 'etc']
  const eqpItems = Array.from({ length: MOCK_EQP }, (_, i) => {
    const cluster = CLUSTERS[i % CLUSTERS.length]
    return {
      eqpKey: i + 1, eqpId: `EQP-${i + 1}`, eqpName: `${cluster}-${i + 1}`, lineValue: 'A_LINE', lineLabel: 'A Line',
      clusterId: cluster, clusterName: cluster.toUpperCase(), equipmentModeLabel: 'Auto',
      status: ['RUN', 'IDLE', 'ERROR', 'DOWN'][i % 4], statusLabel: 'St',
      portItems: [{ id: `p${i}a`, label: 'P1', status: 'RUN', statusLabel: 'Run' }, { id: `p${i}b`, label: 'P2', status: 'IDLE', statusLabel: 'Idle' }],
      tooltipMeta: '', tooltipStep: '', alertMessage: null,
    }
  })
  await page.route('**/api/auth/csrf', (r) => r.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify({ success: true, data: null, errorCode: null, errorMsg: null }) }))
  await page.route('**/api/auth/me', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: ok({ userPk: 1, userId: 'admin', permissionCodes: ['LIVE_MAP_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ', 'LIVE_MAP_LAYOUT_WRITE'] }) }))
  await page.route('**/api/line', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: ok([{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]) }))
  await page.route(/\/api\/live-map\/layout\/objects(\/\d+)?(\?.*)?$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: ok([]) }))
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: ok({ layoutKey: null, lineKey: 1, canvasJson: null, placements: [], objects: [] }) }))
  await page.route(/.*\/api\/live-map(\?.*)?$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: ok({ equipmentItems: eqpItems }) }))
  await page.route(/.*\/api\/(eqp|model)(\/.*)?(\?.*)?$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: ok({ items: [], offset: 0, limit: 500, count: 0 }) }))
  await page.route(/.*\/api\/comm-logs(\/.*)?(\?.*)?$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: ok([]) }))
}

const consoleErrors = []
const pageErrors = []
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 300))
})
page.on('pageerror', (err) => pageErrors.push(String(err.message ?? err).slice(0, 300)))

const result = { meta: { measuredAt: new Date().toISOString(), baseUrl }, steps: {}, equipmentCount: null, consoleErrors, pageErrors }

const mark = async (label, action, endCondition) => {
  const t0 = await now(page)
  await action()
  await endCondition()
  const t1 = await now(page)
  const ms = Math.round(t1 - t0)
  result.steps[label] = ms
  console.log(`[perf] ${label}: ${ms} ms`)
  return ms
}

try {
  // 로그인 (MOCK 모드는 auth 가 mock 되어 생략)
  if (!MOCK) {
    await page.goto(`${baseUrl}/login`)
    await page.waitForLoadState('networkidle')
    await page.getByLabel('아이디', { exact: true }).fill(LOGIN_ID)
    await page.getByLabel('비밀번호', { exact: true }).fill(LOGIN_PW)
    await page.getByRole('button', { name: '로그인', exact: true }).click()
    await page.waitForURL(/\/eqp$/, { timeout: 15000 })
    await page.waitForLoadState('networkidle')
  }

  // live-map 페이지 진입(cold)
  await mark(
    'nav_to_livemap',
    async () => page.goto(`${baseUrl}/eqp/live-map`),
    async () => page.waitForLoadState('networkidle'),
  )

  // 라인 스코프 선택(첫 라인) — 실설비 로드. 이미 선택돼 있으면 트리거가 없을 수 있어 best-effort.
  try {
    const trigger = page.getByTestId('line-scope-trigger')
    if ((await trigger.count()) > 0) {
      await trigger.click({ timeout: 4000 })
      const firstOption = page.locator('[data-testid^="line-scope-option-"]').first()
      await firstOption.click({ timeout: 4000 })
      await page.waitForLoadState('networkidle')
    }
  } catch (error) {
    result.steps.lineScopeNote = `line select skipped: ${String(error.message ?? error).slice(0, 80)}`
  }

  // 2D 뷰어(기본 모드) — 라인 스코프 선택 후 첫 설비 노드 가시 + 노드 수. viewer 는 LiveMapBoard DOM 그리드.
  try {
    const t0viewer = await now(page)
    await page.locator('[data-testid^="live-map-node-"]').first().waitFor({ state: 'visible', timeout: 20000 })
    result.steps.viewer_firstNodeVisible = Math.round((await now(page)) - t0viewer)
    console.log(`[perf] viewer_firstNodeVisible: ${result.steps.viewer_firstNodeVisible} ms`)
  } catch {
    result.steps.viewer_firstNodeVisible = 'no-node (timeout 20s)'
  }
  result.viewerNodeCount = await page.locator('[data-testid^="live-map-node-"]').count()
  console.log(`[perf] viewerNodeCount: ${result.viewerNodeCount}`)

  // 3D 모드 진입 — click → scene visible → 메인스레드 idle(뱃지 유무와 무관한 마운트 정착 신호).
  const t0enter = await now(page)
  await page.getByTestId('live-map-mode-3d').click()
  await page.getByTestId('live-map-3d-scene').waitFor({ state: 'visible', timeout: 30000 })
  result.steps.click3D_to_sceneVisible = Math.round((await now(page)) - t0enter)
  console.log(`[perf] click3D_to_sceneVisible: ${result.steps.click3D_to_sceneVisible} ms`)
  // requestIdleCallback — 마운트/렌더로 점유된 메인스레드가 한가해진 시점(54대 마운트 정착).
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(null), { timeout: 30000 })
        else setTimeout(() => resolve(null), 0)
      }),
  )
  result.steps.click3D_to_idle = Math.round((await now(page)) - t0enter)
  console.log(`[perf] click3D_to_idle: ${result.steps.click3D_to_idle} ms`)

  // scene visible → 첫 설비 뱃지 visible (설비 렌더 완료 proxy). 설비 0/뱃지없음이면 timeout → 기록.
  const t0badge = await now(page)
  try {
    await page.locator('[data-testid^="live-map-3d-badge-"]').first().waitFor({ state: 'visible', timeout: 20000 })
    result.steps.sceneVisible_to_firstBadge = Math.round((await now(page)) - t0badge)
    console.log(`[perf] sceneVisible_to_firstBadge: ${result.steps.sceneVisible_to_firstBadge} ms`)
  } catch {
    result.steps.sceneVisible_to_firstBadge = 'no-equipment-badge (timeout 20s)'
  }

  // 설비 표시 수
  try {
    result.equipmentCount = (await page.getByTestId('live-map-3d-visible-count').textContent())?.trim() ?? null
  } catch {
    result.equipmentCount = null
  }

  // 층 전환 settle (click → 2 rAF). 전체 → 1F → 2F → 3F → 전체
  const floors = [
    ['floor_all', 'live-map-3d-floor-all'],
    ['floor_1', 'live-map-3d-floor-1'],
    ['floor_2', 'live-map-3d-floor-2'],
    ['floor_3', 'live-map-3d-floor-3'],
    ['floor_all_2', 'live-map-3d-floor-all'],
  ]
  for (const [label, testid] of floors) {
    const btn = page.getByTestId(testid)
    if ((await btn.count()) === 0) {
      result.steps[label] = 'button-not-found'
      continue
    }
    const t0 = await now(page)
    await btn.click()
    const t1 = await settle2Raf(page)
    result.steps[label] = Math.round(t1 - t0)
    console.log(`[perf] ${label}: ${result.steps[label]} ms`)
  }

  // 구조물 편집(builder) 진입
  await mark(
    'clickBuilder_to_editorVisible',
    async () => page.getByTestId('live-map-mode-builder').click(),
    async () => page.getByTestId('live-map-object-editor').waitFor({ state: 'visible', timeout: 30000 }),
  )

  // 3D/builder 거친 뒤 2D 뷰어 복귀 — 클린한 "N개 노드 재렌더" 비용(스케일 신호). canEdit 일 때만 토글 존재.
  const viewerBtn = page.getByTestId('live-map-mode-viewer')
  if ((await viewerBtn.count()) > 0) {
    const t0back = await now(page)
    await viewerBtn.click()
    await page.locator('[data-testid^="live-map-node-"]').first().waitFor({ state: 'visible', timeout: 30000 })
    await settle2Raf(page)
    result.steps.back_to_viewer = Math.round((await now(page)) - t0back)
    console.log(`[perf] back_to_viewer: ${result.steps.back_to_viewer} ms`)
  } else {
    result.steps.back_to_viewer = 'viewer-toggle-not-found'
  }
} catch (error) {
  result.fatal = String(error.message ?? error).slice(0, 400)
  console.log(`[perf] FATAL: ${result.fatal}`)
} finally {
  await browser.close()
}

const json = JSON.stringify(result, null, 2)
if (OUTPUT_PATH) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, json)
  console.log(`[perf] saved -> ${OUTPUT_PATH}`)
}
console.log('=== SUMMARY ===')
console.log(JSON.stringify({ steps: result.steps, equipmentCount: result.equipmentCount, consoleErrors: consoleErrors.length, pageErrors: pageErrors.length }, null, 2))
