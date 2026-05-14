import { chromium } from '@playwright/test'
import fs from 'fs'
import path from 'path'

/**
 * nori-tc-ui-front 런타임 성능 측정 도구.
 *
 * 사용 시나리오:
 *   - /ui-front-perf skill 의 baseline / after 측정
 *   - /ui-front-refactor skill 의 변경 전후 regression 측정
 *   - 운영 측정 시 BASE_URL 환경변수 override
 *
 * 절차:
 *  1. 로그인 (admin / ChangeMe123!  또는  TEST_USER / TEST_PASS env)
 *  2. 페이지 순회 (기본 5 페이지). cold (첫 진입) + warm (reload) 분리.
 *  3. EqpPage / ModelPage 는 사이드바 첫 항목 클릭 후 자식 테이블 row 측정.
 *  4. 각 페이지마다 /api/* XHR 응답 시간 + DOM `tbody tr` 카운트 캡처.
 *  5. JSON 결과를 OUTPUT_PATH 에 저장 (옵션) + stdout.
 *
 * 환경변수:
 *   BASE_URL      (기본 http://127.0.0.1:3000)
 *   TEST_USER     (기본 admin)
 *   TEST_PASS     (기본 ChangeMe123!)
 *   OUTPUT_PATH   결과 JSON 저장 경로. 미지정 시 stdout 만.
 *   PAGES         쉼표구분 페이지 key 목록 (기본 모두). 예: PAGES=EqpPage,LiveMapPage
 *   HEADLESS      'false' 면 브라우저 띄움 (디버깅용, 기본 true)
 *
 * 측정 정확도: page.on('request' / 'response') Date.now() diff —
 * Chrome DevTools Network 와 동일한 Resource Timing API 기반.
 */

const baseUrl = process.env.BASE_URL ?? 'http://127.0.0.1:3000'
const LOGIN_ID = process.env.TEST_USER ?? 'admin'
const LOGIN_PW = process.env.TEST_PASS ?? 'ChangeMe123!'
const OUTPUT_PATH = process.env.OUTPUT_PATH ?? ''
const HEADLESS = (process.env.HEADLESS ?? 'true') !== 'false'

const ALL_PAGES = [
  { key: 'EqpPage', url: '/eqp', waitMs: 4000, sidebarClickEnabled: true },
  { key: 'ModelPage', url: '/model', waitMs: 4000, sidebarClickEnabled: true },
  { key: 'DeployPage', url: '/deploy', waitMs: 4000, sidebarClickEnabled: false },
  { key: 'DlqPage', url: '/dlq', waitMs: 4000, sidebarClickEnabled: false },
  { key: 'LiveMapPage', url: '/eqp/live-map', waitMs: 4000, sidebarClickEnabled: false },
]

const TARGET_PAGES = (() => {
  const filter = process.env.PAGES
  if (!filter) return ALL_PAGES
  const keys = new Set(filter.split(',').map((s) => s.trim()).filter(Boolean))
  return ALL_PAGES.filter((p) => keys.has(p.key))
})()

const browser = await chromium.launch({ headless: HEADLESS })
const context = await browser.newContext({ viewport: { width: 1720, height: 1180 } })
const page = await context.newPage()

let xhrRequestStart = new Map()
let apiSamples = []

page.on('request', (request) => {
  if (request.url().includes('/api/')) {
    xhrRequestStart.set(request, Date.now())
  }
})

page.on('response', (response) => {
  const request = response.request()
  if (request.url().includes('/api/')) {
    const startMs = xhrRequestStart.get(request)
    if (startMs !== undefined) {
      const elapsedMs = Date.now() - startMs
      const url = new URL(request.url())
      apiSamples.push({
        method: request.method(),
        path: url.pathname + (url.search ? '?(...)' : ''),
        status: response.status(),
        ms: elapsedMs,
      })
      xhrRequestStart.delete(request)
    }
  }
})

const resetSamples = () => {
  xhrRequestStart = new Map()
  apiSamples = []
}

const captureRoundResult = async () => {
  const rowCounts = await page.evaluate(() => {
    const tables = Array.from(document.querySelectorAll('table'))
    return tables.map((table, index) => {
      const tbody = table.querySelector('tbody')
      const rows = tbody ? tbody.querySelectorAll('tr').length : 0
      const headerCells = Array.from(table.querySelectorAll('thead th')).map((th) =>
        (th.textContent ?? '').trim().slice(0, 30),
      )
      return {
        tableIndex: index,
        headerSample: headerCells.slice(0, 5),
        rowCount: rows,
      }
    })
  })
  const top5Slowest = [...apiSamples].sort((a, b) => b.ms - a.ms).slice(0, 5)
  const apiOnly = apiSamples.filter((s) => s.path.startsWith('/api/'))
  const apiSlowestMs = apiOnly.length === 0 ? 0 : Math.max(...apiOnly.map((s) => s.ms))
  return {
    apiTotalCount: apiSamples.length,
    apiSlowestMs,
    top5Slowest,
    rowCounts,
  }
}

const results = {
  meta: {
    measuredAt: new Date().toISOString(),
    baseUrl,
    pages: TARGET_PAGES.map((p) => p.key),
  },
  perPage: {},
}

try {
  await page.goto(`${baseUrl}/login`)
  await page.waitForLoadState('networkidle')
  await page.getByLabel('ID').fill(LOGIN_ID)
  await page.getByLabel('Password').fill(LOGIN_PW)
  await page.getByRole('button', { name: 'Log In' }).click()
  await page.waitForURL(/\/eqp$/, { timeout: 15000 })
  await page.waitForLoadState('networkidle')

  for (const target of TARGET_PAGES) {
    const pageResult = {}

    resetSamples()
    const currentUrl = page.url()
    if (currentUrl.endsWith(target.url)) {
      await page.goto(`${baseUrl}/login`, { waitUntil: 'domcontentloaded' })
      await page.goto(`${baseUrl}${target.url}`)
    } else {
      await page.goto(`${baseUrl}${target.url}`)
    }
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(target.waitMs)
    pageResult.cold = await captureRoundResult()

    resetSamples()
    await page.reload()
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(target.waitMs)
    pageResult.warm = await captureRoundResult()

    if (target.sidebarClickEnabled) {
      resetSamples()
      try {
        const firstSidebarItem = page.locator('aside button:has(span.size-1\\.5)').first()
        const itemCount = await firstSidebarItem.count()
        if (itemCount > 0) {
          await firstSidebarItem.click({ timeout: 5000 })
          await page.waitForLoadState('networkidle')
          await page.waitForTimeout(target.waitMs)
          pageResult.afterSidebarClick = await captureRoundResult()
        } else {
          pageResult.afterSidebarClick = { error: 'no sidebar item found' }
        }
      } catch (error) {
        pageResult.afterSidebarClick = { error: String(error.message ?? error).slice(0, 120) }
      }
    }

    results.perPage[target.key] = pageResult
  }
} finally {
  await browser.close()
}

const json = JSON.stringify(results, null, 2)

if (OUTPUT_PATH) {
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, json)
  console.log(`[perf] measurement saved -> ${OUTPUT_PATH}`)
}

console.log(json)
