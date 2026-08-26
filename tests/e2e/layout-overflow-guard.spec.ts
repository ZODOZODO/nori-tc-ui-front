import { expect, test, type Page, type Route } from '@playwright/test'

/**
 * 정밀 분석 #2 — 무료 자동 레이아웃 회귀 가드 (Playwright 로컬 실행, Claude API 미사용).
 *
 * 메인 페이지 전수에 대해 "페이지 전체 가로 오버플로우 없음 + console.error/pageerror 0" 을
 * 결정론적으로 단언한다. LLM 이 스크린샷을 눈으로 보는 게 아니라 Playwright 가 직접 측정/판정하므로
 * 추가 토큰/추가금 없이 반복 실행 가능.
 *
 * 판정 invariant:
 *   - documentElement.scrollWidth <= clientWidth + 1 (페이지 자체가 가로로 안 깨진다.
 *     카드/테이블 내부 가로 스크롤은 정상이라 페이지 레벨만 본다).
 *   - console.error / pageerror 0 건 (페이지 크래시 = 백지 = 화면 깨짐).
 * 실패 시 스크린샷이 test-results 에 남는다 (screenshot: only-on-failure).
 *
 * 모달/팝업 내부 오버플로우는 별도 worst-case 스펙이 가드한다:
 *   - deploy-register-scenario-modal.spec.ts (시나리오 선택 모달)
 *   - deploy-monitor-view-modal.spec.ts (Deploy View 모달)
 *   - model-check-in-diff-overflow.spec.ts (체크인 diff 모달, 14컬럼 worst-case)
 */

const apiSuccess = <TData>(data: TData) => ({
  success: true,
  data,
  errorCode: null,
  errorMsg: null,
})
const apiNull = () => ({
  success: true,
  data: null,
  errorCode: null,
  errorMsg: null,
})

const ME = {
  userPk: 1,
  userId: 'admin',
  permissionCodes: [
    'MODEL_RW',
    'MODEL_READ',
    'MODEL_WRITE',
    'DEPLOY_READ',
    'DEPLOY_WRITE',
    'LINE_READ',
    'EQP_READ',
    'EQP_WRITE',
    'DLQ_READ',
    'DLQ_WRITE',
    'USER_READ',
    'USER_WRITE',
    'GROUP_READ',
    'GROUP_WRITE',
    'LIVE_MAP_READ',
    'LIVE_MAP_LAYOUT_READ',
    'ADMIN',
  ],
}

const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]

/**
 * 공용 mock — 페이지가 chrome(사이드바/탑바/헤더/빈상태) 까지 렌더되도록 최소 형태만 맞춘다.
 * /api/line 은 배열, 그 외 GET 은 paginated 빈 응답({items:[]}) 기본. 특정 페이지가 다른 형태를
 * 요구해 크래시하면 그 자체가 발견 항목이며, 여기 분기를 추가해 정확히 좁힌다.
 */
const setupMocks = async (page: Page) => {
  await page.route(
    (url) => {
      const pathname = typeof url === 'string' ? new URL(url).pathname : url.pathname
      return pathname.startsWith('/api/')
    },
    async (route: Route, request) => {
      const p = new URL(request.url()).pathname
      if (p === '/api/auth/csrf')
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: { 'set-cookie': 'XSRF-TOKEN=t; Path=/' },
          body: JSON.stringify(apiNull()),
        })
      if (p === '/api/auth/me')
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(apiSuccess(ME)),
        })
      if (p === '/api/line')
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(apiSuccess(LINES)),
        })
      // 배열을 직접 기대하는 흔한 엔드포인트(eqp 목록 등)는 빈 배열로.
      if (p === '/api/eqp' || p === '/api/eqp/groups' || p === '/api/group' || p === '/api/user') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(apiSuccess([])),
        })
      }
      // 그 외 GET 은 paginated 빈 응답 기본.
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 50, count: 0 })),
      })
    },
  )
}

const ROUTES: { path: string; label: string; authenticated?: boolean }[] = [
  { path: '/login', label: 'login', authenticated: false },
  { path: '/eqp', label: 'eqp' },
  { path: '/model/secs', label: 'model-secs' },
  { path: '/model/socket', label: 'model-socket' },
  { path: '/model/plc', label: 'model-plc' },
  { path: '/deploy', label: 'deploy' },
  { path: '/dlq', label: 'dlq' },
  { path: '/user', label: 'user-group' },
  { path: '/eqp/live-map', label: 'live-map' },
]

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'compact', width: 1280, height: 720 },
] as const

for (const route of ROUTES) {
  for (const viewport of VIEWPORTS) {
    test(`페이지 가로 오버플로우 가드 — ${route.label} (${route.path}, ${viewport.name})`, async ({ page }) => {
      test.setTimeout(60_000)
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      })
      const errors: string[] = []
      page.on('pageerror', (error) => {
        errors.push(`[pageerror] ${error.message}`)
        console.log(`[${route.label}][pageerror] ${error.message}`)
      })
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(`[console:error] ${message.text()}`)
          console.log(`[${route.label}][console:error] ${message.text()}`)
        }
      })

      await setupMocks(page)
      await page.addInitScript(() => window.localStorage.setItem('nori-tc-lang', 'ko'))
      await page.goto(route.path)
      if (route.authenticated === false) {
        await expect(page.locator('body')).toBeVisible()
      } else {
        // 탑바(공유 chrome)가 뜨면 페이지 셸 렌더 완료로 본다.
        await expect(page.getByRole('banner').or(page.locator('header')).first()).toBeVisible({ timeout: 30_000 })
      }
      await page.waitForTimeout(800)

      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyScrollWidth: document.body.scrollWidth,
      }))
      console.log(`[${route.label}:${viewport.name}] METRICS ${JSON.stringify(metrics)}`)

      await page.screenshot({
        path: `test-results/overflow-guard-${route.label}-${viewport.name}.png`,
        fullPage: false,
      })

      // 페이지 자체가 가로로 넘치지 않아야 한다.
      expect(metrics.scrollWidth, `${route.label} page horizontal overflow`).toBeLessThanOrEqual(
        metrics.clientWidth + 1,
      )
      // 페이지 크래시(콘솔 에러) 0.
      expect(errors, `${route.label} console errors:\n${errors.join('\n')}`).toEqual([])
    })
  }
}
