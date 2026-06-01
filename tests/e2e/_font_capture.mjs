// [TEMP] 폰트(Inter)+중립 사이드바 확인. node tests/e2e/_font_capture.mjs <tag>
import { chromium } from '@playwright/test'
const tag = process.argv[2] ?? 'fonts'
const base = 'http://127.0.0.1:3001'
const ok = (data) => ({ success: true, data, errorCode: null, errorMsg: null })
const EQP = Array.from({ length: 8 }, (_, i) => ({
  eqpId: `A-EQ${String(i + 1).padStart(2, '0')}`, eqpName: `A-EQ${String(i + 1).padStart(2, '0')}`,
  commInterface: i % 2 === 0 ? 'SOCKET' : 'REST', commMode: 'ACTIVE', routePartition: i, eqpIp: `10.0.0.${i + 1}`, eqpPort: 5000 + i,
}))
const browser = await chromium.launch()
async function cap(theme) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await ctx.addInitScript((t) => { try { localStorage.setItem('nori-tc-theme', t) } catch {} }, theme)
  const errors = []
  await ctx.route('**/api/**', async (route) => {
    const rt = route.request().resourceType()
    if (rt !== 'fetch' && rt !== 'xhr') return route.continue()
    const url = route.request().url()
    if (url.includes('/api/auth/csrf')) return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' }, body: JSON.stringify(ok(null)) })
    if (url.includes('/api/auth/me')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok({ userPk: 1, userId: 'admin', permissionCodes: ['EQP_READ', 'DASH_READ'] })) })
    if (/\/eqp(\?|$)/.test(url)) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok(EQP)) })
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ok([])) })
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(base + '/eqp', { waitUntil: 'networkidle' }).catch(() => {})
  await page.waitForTimeout(800)
  const out = `.claude/specs/screenshots/uplift/${tag}/eqp-${theme}.png`
  await page.screenshot({ path: out, fullPage: false })
  console.log(`captured ${out} | errors=${errors.length}`)
  await ctx.close()
}
await cap('light')
await cap('dark')
await browser.close()
