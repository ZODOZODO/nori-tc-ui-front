/**
 * 페이지별 런타임 성능 측정 스크립트 — ui-front-perf / ui-front-refactor SKILL 의 Step 1-2 / Step 5 도구.
 *
 * 5 페이지를 cold(첫 진입) + warm(재진입) 으로 방문해 `/api/*` 응답 시간과 DOM `tbody tr`
 * row 수를 수집하고, EqpPage / ModelPage 는 in-page 트리 첫 클릭 후 추가 측정한다.
 * 산출 JSON 스키마는 과거 산출물(.claude/perf/measurements/refactor-after-2026-05-27T0445.json)과
 * 호환: meta{measuredAt,baseUrl,pages} + perPage{<name>:{cold,warm[,afterFirstSelect]}}.
 *
 * 실행 (레포 루트 기준):
 *   OUTPUT_PATH=".claude/perf/measurements/baseline-<TS>.json" node tests/e2e/_perf_measure.mjs
 *
 * 환경변수:
 *   BASE_URL    기본 http://127.0.0.1:3000 (vite dev — /api 는 vite.config.ts server.proxy → :8080)
 *   TEST_USER / TEST_PASS  로그인 자격 오버라이드(선택). 미지정 시
 *               tests/e2e/perf-login.local.json 에서 읽는다 — 형식 {"userId":"...","password":"..."}.
 *               이 파일은 .gitignore 의 /tests/e2e/* 규칙으로 git 미추적이다(tc-db.local.properties
 *               와 같은 로컬 시크릿 관례). 평문 비밀번호를 코드/문서/git 에 두지 않는다(S10 E-2).
 *   OUTPUT_PATH 기본 .claude/perf/measurements/perf-<ISO>.json
 *   PAGES       콤마 구분 필터. 예: PAGES=EqpPage,DeployPage (기본: 5 페이지 전체)
 *   HEADLESS    '0' 또는 'false' 면 headed
 *   SETTLE_MS   방문당 네트워크 수집 창(ms). 기본 8000 — 폴링(refetchInterval) 페이지에서도
 *               확정 종료되도록 고정 창을 쓴다(networkidle 은 폴링 때문에 도달 불가).
 */
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

// wm-parity-sidebar 확정 메뉴 트리의 기본 진입 라우트 (src/app/Router.tsx 실측).
// _load_trace.mjs 의 PAGE_ROUTES 와 동일해야 한다 — 변경 시 두 파일 함께 수정.
const PAGE_ROUTES = {
  EqpPage: '/eqp',
  ModelPage: '/model/secs',
  DeployPage: '/deploy',
  DlqPage: '/dlq',
  LiveMapPage: '/live-map',
}

// "사이드바 첫 클릭 후 추가 측정" 대상 — in-page 트리 컨테이너 testid 는
// EqpSidebar.tsx:263 / ModelSidebar.tsx:326 실측. 트리 노드는 공용 <Button> 이라 button 태그.
const FIRST_SELECT_TARGETS = {
  EqpPage: '[data-testid="eqp-sidebar-gateway-tree"] button',
  ModelPage: '[data-testid="model-sidebar-tree"] button',
}

const BASE_URL = process.env.BASE_URL ?? 'http://127.0.0.1:3000'

// 자격 우선순위: env 오버라이드 → 로컬 파일(git 미추적). _load_trace.mjs 와 동일 규칙.
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
const OUTPUT_PATH =
  process.env.OUTPUT_PATH ??
  `.claude/perf/measurements/perf-${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}.json`

const requestedPages = (process.env.PAGES ?? Object.keys(PAGE_ROUTES).join(','))
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean)

const unknownPages = requestedPages.filter((name) => !(name in PAGE_ROUTES))
if (unknownPages.length > 0) {
  console.error(
    `[error] 알 수 없는 PAGES 값: ${unknownPages.join(', ')} — 사용 가능: ${Object.keys(PAGE_ROUTES).join(', ')}`,
  )
  process.exit(1)
}

/**
 * settleMs 동안 완료된 네트워크 요청을 수집해 /api/* 만 집계한다.
 * 요청 시간은 request 발생 → requestfinished 사이 벽시계(ms) — Playwright timing() 은
 * vite dev 에서 -1 을 자주 반환해 자체 측정한다.
 */
const collectVisit = async (page, action) => {
  const inflightStart = new Map()
  const finished = []

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
    })
  }

  page.on('request', onRequest)
  page.on('requestfinished', onFinished)
  try {
    await action()
    await page.waitForTimeout(SETTLE_MS)
  } finally {
    page.off('request', onRequest)
    page.off('requestfinished', onFinished)
  }

  const apiSamples = finished.filter((sample) => sample.path.startsWith('/api/'))
  const top5Slowest = [...apiSamples].sort((a, b) => b.ms - a.ms).slice(0, 5)

  const rowCounts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('table')).map((table, tableIndex) => ({
      tableIndex,
      headerSample: Array.from(table.querySelectorAll('thead th'))
        .slice(0, 5)
        .map((th) => (th.textContent ?? '').trim()),
      rowCount: table.querySelectorAll('tbody tr').length,
    })),
  )

  return {
    apiTotalCount: apiSamples.length,
    apiSlowestMs: apiSamples.length > 0 ? Math.max(...apiSamples.map((s) => s.ms)) : 0,
    top5Slowest,
    rowCounts,
  }
}

const main = async () => {
  const browser = await chromium.launch({ headless: HEADLESS })
  const context = await browser.newContext()
  const page = await context.newPage()

  // UI 폼 로그인 — 셀렉터는 LoginPage.tsx 실측(#userId :193 / #password :219, submit :279).
  //
  // 진입 경로는 고정 상수가 아니라 보유 권한이 정한다(`resolveLoginLandingRoute`,
  // app-navigation.ts). 아래 `/live-map` 대기는 **TEST_USER 가 LIVE_MAP_READ 를 보유한다는
  // 전제**에 의존한다 — 그 권한이 회수되면 랜딩은 접근 가능한 다음 화면으로 가고, 여기서는
  // 측정 실패가 아니라 타임아웃으로 보인다. 아래 catch 문구가 그 진단을 안내한다.
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'load' })
  await page.fill('#userId', TEST_USER)
  await page.fill('#password', TEST_PASS)
  await page.click('button[type="submit"]')
  try {
    await page.waitForURL('**/live-map', { timeout: 30_000 })
  } catch {
    console.error(
      `[error] 로그인 후 /live-map 미도달 — 계정(${TEST_USER}) 의 LIVE_MAP_READ 권한 또는 backend(:8080) 상태를 확인하세요.`,
    )
    await browser.close()
    process.exit(1)
  }
  console.log(`[login] ok (userId=${TEST_USER})`)

  const perPage = {}
  for (const pageName of requestedPages) {
    const url = `${BASE_URL}${PAGE_ROUTES[pageName]}`
    const entry = {}

    entry.cold = await collectVisit(page, () => page.goto(url, { waitUntil: 'load' }))

    // cold 상태를 이어받아 트리 첫 노드 클릭 → 상세 로드 API 를 추가 측정한다.
    const firstSelectSelector = FIRST_SELECT_TARGETS[pageName]
    if (firstSelectSelector) {
      const nodeCount = await page.locator(firstSelectSelector).count()
      if (nodeCount > 0) {
        entry.afterFirstSelect = await collectVisit(page, () =>
          page.locator(firstSelectSelector).first().click(),
        )
      } else {
        console.log(`[${pageName}] afterFirstSelect 생략 — 트리 노드 0건 (데이터 없는 환경)`)
      }
    }

    entry.warm = await collectVisit(page, () => page.goto(url, { waitUntil: 'load' }))

    perPage[pageName] = entry
    const summary = [
      `cold api=${entry.cold.apiTotalCount} slowest=${entry.cold.apiSlowestMs}ms`,
      entry.afterFirstSelect
        ? `select api=${entry.afterFirstSelect.apiTotalCount} slowest=${entry.afterFirstSelect.apiSlowestMs}ms`
        : null,
      `warm api=${entry.warm.apiTotalCount} slowest=${entry.warm.apiSlowestMs}ms`,
      `rows=[${entry.cold.rowCounts.map((r) => r.rowCount).join(',')}]`,
    ]
      .filter(Boolean)
      .join(' | ')
    console.log(`[${pageName}] ${summary}`)
  }

  await browser.close()

  const output = {
    meta: {
      measuredAt: new Date().toISOString(),
      baseUrl: BASE_URL,
      pages: requestedPages,
      settleMs: SETTLE_MS,
    },
    perPage,
  }
  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true })
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2))
  console.log(`[saved] ${OUTPUT_PATH}`)
}

main().catch((error) => {
  console.error('[error]', error)
  process.exit(1)
})
