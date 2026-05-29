// Phase 0/R5 보조 — 7 라우트 + layout-shell fixture 의 구조 스크린샷 캡처.
// auth(/api/auth/me) + 데이터 API empty-fallback mock 으로 authed chrome/레이아웃 구조를 캡처.
// 실데이터가 아닌 empty-state 구조 참조용. dir 인자로 before/after 선택.
// 사용: node tests/e2e/_capture_screens.mjs before
import { chromium } from '@playwright/test'

const dir = process.argv[2] ?? 'before'
const base = 'http://127.0.0.1:3000'
const PERMS = [
  'EQP_RW', 'MODEL_RW', 'DEPLOY_READ', 'DEPLOY_WRITE',
  'DLQ_READ', 'USER_READ', 'USER_WRITE', 'LIVE_MAP_READ',
]
const ok = (data) => ({ success: true, data, errorCode: null, errorMsg: null })

const routes = [
  ['login', '/login'],
  ['eqp', '/eqp'],
  ['model', '/model'],
  ['deploy', '/deploy'],
  ['dlq', '/dlq'],
  ['user', '/user'],
  ['live-map', '/eqp/live-map'],
  ['fixture-layout-shell', '/__fixtures/layout-shell'],
]

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })

// 데이터 API fallback — 배열/객체 어느 쪽이든 빈값으로 안전 응답.
await ctx.route('**/api/**', async (route) => {
  const url = route.request().url()
  if (url.includes('/api/auth/csrf')) {
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'set-cookie': 'XSRF-TOKEN=test-csrf-token; Path=/' },
      body: JSON.stringify(ok(null)),
    })
  }
  if (url.includes('/api/auth/me')) {
    return route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify(ok({ userPk: 1, userId: 'admin', permissionCodes: PERMS })),
    })
  }
  return route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify(ok([])),
  })
})

const page = await ctx.newPage()
for (const [name, path] of routes) {
  await page.goto(base + path, { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(1000)
  const out = `.claude/specs/screenshots/${dir}/${name}.png`
  await page.screenshot({ path: out, fullPage: false })
  console.log(`captured ${out} @ ${page.url()}`)
}
await browser.close()
