import { chromium } from '@playwright/test'

/**
 * 검증 전용: 2D 뷰어 진입 시 three-vendor 청크가 다운로드되지 않고, 3D 모드 클릭 시점에만
 * 다운로드되는지 네트워크 요청으로 확인한다. lazy 전환(LiveMapPage.tsx)의 효과 증명용.
 * prod preview(:4173) + MOCK(backend 무관) 대상.
 */
const baseUrl = process.env.BASE_URL ?? 'http://localhost:4173'
const MOCK_EQP = Number(process.env.MOCK_EQP ?? 54)

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1720, height: 1180 } })
const page = await context.newPage()

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

const threeVendorRequests = []
page.on('request', (req) => {
  const url = req.url()
  if (/three-vendor/.test(url)) threeVendorRequests.push(url.split('/').pop())
})

const result = {}
try {
  await page.goto(`${baseUrl}/eqp/live-map`)
  await page.waitForLoadState('networkidle')
  // 라인 스코프 선택(실설비 로드 → 뷰어 노드 렌더)
  const trigger = page.getByTestId('line-scope-trigger')
  if ((await trigger.count()) > 0) {
    await trigger.click({ timeout: 4000 })
    await page.locator('[data-testid^="line-scope-option-"]').first().click({ timeout: 4000 })
    await page.waitForLoadState('networkidle')
  }
  await page.locator('[data-testid^="live-map-node-"]').first().waitFor({ state: 'visible', timeout: 20000 })
  await page.waitForTimeout(800) // lazy preload 가 뒤늦게 끼어들 여지까지 흡수
  result.threeVendorAfterViewer = [...threeVendorRequests]

  // 3D 모드 클릭 → 이 시점에 three-vendor 가 비로소 요청돼야 함
  await page.getByTestId('live-map-mode-3d').click()
  await page.getByTestId('live-map-3d-scene').waitFor({ state: 'visible', timeout: 30000 })
  await page.waitForTimeout(800)
  result.threeVendorAfter3D = [...threeVendorRequests]
} catch (error) {
  result.fatal = String(error.message ?? error).slice(0, 300)
} finally {
  await browser.close()
}

console.log('=== three-vendor lazy 검증 ===')
console.log(`뷰어 진입 후 three-vendor 요청: ${result.threeVendorAfterViewer?.length ?? '?'} 건 ${JSON.stringify(result.threeVendorAfterViewer)}`)
console.log(`3D 클릭 후 three-vendor 요청: ${result.threeVendorAfter3D?.length ?? '?'} 건 ${JSON.stringify(result.threeVendorAfter3D)}`)
const pass = (result.threeVendorAfterViewer?.length ?? 1) === 0 && (result.threeVendorAfter3D?.length ?? 0) >= 1
console.log(`판정: ${pass ? 'PASS — 뷰어 진입엔 three 미로드, 3D 클릭 시 로드(lazy 정상)' : 'FAIL'}`)
if (result.fatal) console.log(`FATAL: ${result.fatal}`)
