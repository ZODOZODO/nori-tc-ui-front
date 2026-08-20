/**
 * 첫 로딩/진입 체감 시간 분해 스크립트 — ui-front-perf SKILL 의 Step 1-4 도구.
 *
 * 한 라우트의 cold(빈 캐시 첫 진입) + warm(재진입) 을 **백엔드(/api) vs 프론트 모듈(script)**
 * 로 분해한다. dev(:3000, Vite 워터폴) 와 prod-preview(:4173, 번들) 를 같은 스크립트로 재서
 * "dev 전용 비용 vs 실제 프로덕션 문제" 를 판별한다(SKILL.md Step 1-4 해석 기준).
 *
 * 실행 (레포 루트 기준):
 *   OUTPUT_PATH=".claude/perf/measurements/loadtrace-dev-<TS>.json" \
 *     BASE_URL=http://localhost:3000 ROUTE_KEY=LiveMapPage node tests/e2e/_load_trace.mjs
 *
 * 환경변수:
 *   ROUTE_KEY   필수. EqpPage | ModelPage | DeployPage | DlqPage | LiveMapPage
 *   BASE_URL    기본 http://127.0.0.1:3000 (prod-preview 는 http://localhost:4173 —
 *               vite preview 의 /api 프록시는 server.proxy 를 상속한다)
 *   TEST_USER / TEST_PASS  로그인 자격 오버라이드(선택). 미지정 시
 *               tests/e2e/perf-login.local.json 에서 읽는다 — 형식 {"userId":"...","password":"..."}.
 *               git 미추적(/tests/e2e/* 규칙, tc-db.local.properties 와 같은 로컬 시크릿 관례).
 *   OUTPUT_PATH 기본 .claude/perf/measurements/loadtrace-<ISO>.json
 *   HEADLESS    '0' 또는 'false' 면 headed
 *   SETTLE_MS   진입 후 네트워크 수집 창(ms). 기본 8000
 *
 * 로그인은 UI 폼이 아니라 **요청(API) 기반** — GET /api/auth/csrf 로 XSRF-TOKEN 쿠키를 받아
 * POST /api/auth/login 에 X-XSRF-TOKEN 헤더로 되돌린다(auth.api.ts:129-141 과 동일 계약).
 * preview(:4173) 의 CSRF origin 편차로 UI 폼 로그인이 403 날 수 있어서다(SKILL.md Step 1-4).
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

// wm-parity-sidebar 확정 메뉴 트리의 기본 진입 라우트 (src/app/Router.tsx 실측).
// _perf_measure.mjs 의 PAGE_ROUTES 와 동일해야 한다 — 변경 시 두 파일 함께 수정.
const PAGE_ROUTES = {
  EqpPage: '/eqp/gateway',
  ModelPage: '/model/secs',
  DeployPage: '/deploy/register',
  DlqPage: '/dlq/dashboard',
  LiveMapPage: '/live-map',
}

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000'

// 자격 우선순위: env 오버라이드 → 로컬 파일(git 미추적). _perf_measure.mjs 와 동일 규칙.
const CREDENTIALS_URL = new URL('./perf-login.local.json', import.meta.url)
const loadCredentials = () => {
  let fileCredentials = null
  try {
    fileCredentials = JSON.parse(fs.readFileSync(CREDENTIALS_URL, 'utf8'))
  } catch {
    // 파일 없음/파싱 실패 — env 로만 충족되면 무방하고, 아니면 아래에서 명확히 실패한다.
  }
  const userId = process.env.TEST_USER ?? fileCredentials?.userId
  const password = process.env.TEST_PASS ?? fileCredentials?.password
  if (!userId || !password) {
    console.error(
      '[error] 로그인 자격 없음 — tests/e2e/perf-login.local.json 을 생성하세요 (git 미추적):\n' +
        '  {"userId":"admin","password":"<비밀번호>"}\n' +
        '  또는 TEST_USER/TEST_PASS 환경변수로 주입.',
    )
    process.exit(1)
  }
  return { userId, password }
}
const { userId: TEST_USER, password: TEST_PASS } = loadCredentials()
const SETTLE_MS = Number(process.env.SETTLE_MS ?? 8000)
const HEADLESS = !['0', 'false'].includes((process.env.HEADLESS ?? '').toLowerCase())
const ROUTE_KEY = process.env.ROUTE_KEY
const OUTPUT_PATH =
  process.env.OUTPUT_PATH ??
  `.claude/perf/measurements/loadtrace-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}.json`

if (!ROUTE_KEY || !(ROUTE_KEY in PAGE_ROUTES)) {
  console.error(
    `[error] ROUTE_KEY 필수 — 사용 가능: ${Object.keys(PAGE_ROUTES).join(' | ')} (받은 값: ${ROUTE_KEY ?? '없음'})`,
  )
  process.exit(1)
}
const ROUTE = PAGE_ROUTES[ROUTE_KEY]

/** 진입 1회를 수집한다 — wallClock(load 이벤트까지) + script/api 분해 + 콘솔·페이지 에러. */
const traceEntry = async (page, url) => {
  const inflightStart = new Map()
  const finished = []
  const consoleErrors = []
  const pageErrors = []

  const onRequest = (request) => inflightStart.set(request, Date.now())
  const onFinished = async (request) => {
    const startedAt = inflightStart.get(request)
    if (startedAt === undefined) return
    inflightStart.delete(request)
    const response = await request.response().catch(() => null)
    finished.push({
      method: request.method(),
      path: new URL(request.url()).pathname,
      status: response ? response.status() : 0,
      ms: Date.now() - startedAt,
      resourceType: request.resourceType(),
    })
  }
  const onConsole = (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text())
  }
  const onPageError = (error) => pageErrors.push(String(error))

  page.on('request', onRequest)
  page.on('requestfinished', onFinished)
  page.on('console', onConsole)
  page.on('pageerror', onPageError)

  const t0 = Date.now()
  let wallClockToLoadMs
  try {
    await page.goto(url, { waitUntil: 'load' })
    wallClockToLoadMs = Date.now() - t0
    await page.waitForTimeout(SETTLE_MS)
  } finally {
    page.off('request', onRequest)
    page.off('requestfinished', onFinished)
    page.off('console', onConsole)
    page.off('pageerror', onPageError)
  }

  const apiSamples = finished.filter((sample) => sample.path.startsWith('/api/'))
  const moduleSamples = finished.filter((sample) => sample.resourceType === 'script')
  const top5 = (samples) =>
    [...samples]
      .sort((a, b) => b.ms - a.ms)
      .slice(0, 5)
      .map(({ method, path: samplePath, status, ms }) => ({ method, path: samplePath, status, ms }))

  return {
    wallClockToLoadMs,
    moduleRequestCount: moduleSamples.length,
    moduleTotalMs: moduleSamples.reduce((sum, s) => sum + s.ms, 0),
    moduleTop5: top5(moduleSamples),
    apiRequestCount: apiSamples.length,
    apiTotalMs: apiSamples.reduce((sum, s) => sum + s.ms, 0),
    apiSlowestMs: apiSamples.length > 0 ? Math.max(...apiSamples.map((s) => s.ms)) : 0,
    apiTop5: top5(apiSamples),
    consoleErrors,
    pageErrors,
  }
}

const main = async () => {
  const browser = await chromium.launch({ headless: HEADLESS })
  // cold 보장: 새 컨텍스트 = 빈 HTTP 캐시/스토리지. (dev 라면 Vite 변환 캐시는 서버 측이라
  // 완전 cold 를 원하면 dev 서버 재기동 후 실행 — SKILL.md Step 1-4 cold 정의 참조.)
  const context = await browser.newContext({ baseURL: BASE_URL })

  // API 로그인 — context.request 는 브라우저 컨텍스트와 쿠키를 공유한다.
  const csrfResponse = await context.request.get('/api/auth/csrf')
  const xsrfCookie = (await context.cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')
  if (!csrfResponse.ok() || !xsrfCookie) {
    console.error(
      `[error] CSRF 발급 실패 (GET /api/auth/csrf → ${csrfResponse.status()}, 쿠키 ${xsrfCookie ? '있음' : '없음'}) — backend(:8080)/프록시 상태 확인.`,
    )
    await browser.close()
    process.exit(1)
  }
  const loginResponse = await context.request.post('/api/auth/login', {
    data: { userId: TEST_USER, password: TEST_PASS },
    headers: { 'X-XSRF-TOKEN': xsrfCookie.value },
  })
  const loginBody = await loginResponse.json().catch(() => null)
  if (!loginResponse.ok() || loginBody?.success !== true) {
    console.error(
      `[error] 로그인 실패 (POST /api/auth/login → ${loginResponse.status()}, success=${loginBody?.success}) — 계정(${TEST_USER}) 확인.`,
    )
    await browser.close()
    process.exit(1)
  }
  console.log(`[login] ok (api, userId=${TEST_USER})`)

  const page = await context.newPage()
  const url = `${BASE_URL}${ROUTE}`

  const cold = await traceEntry(page, url)
  const warm = await traceEntry(page, url)
  await browser.close()

  const output = {
    meta: {
      measuredAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      routeKey: ROUTE_KEY,
      route: ROUTE,
      settleMs: SETTLE_MS,
    },
    cold,
    warm,
  }
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))

  for (const [phase, entry] of [
    ['cold', cold],
    ['warm', warm],
  ]) {
    console.log(
      `[${phase}] wallClockToLoad=${entry.wallClockToLoadMs}ms | module n=${entry.moduleRequestCount} total=${entry.moduleTotalMs}ms | api n=${entry.apiRequestCount} total=${entry.apiTotalMs}ms slowest=${entry.apiSlowestMs}ms | consoleErr=${entry.consoleErrors.length} pageErr=${entry.pageErrors.length}`,
    )
  }
  console.log(`[saved] ${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error('[error]', error)
  process.exit(1)
})
