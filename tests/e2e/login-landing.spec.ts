import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'

/**
 * SPEC .claude/specs/role-landing.md AC14 — 로그인 직후 진입 경로가 보유 권한으로 갈리는지를
 * 실제 브라우저에서 단언한다.
 *
 * 왜 이 스펙이 필요한가: `tests/unit/login-landing.test.ts` 는 순수 함수의 반환값과 훅 소스의
 * 배선만 본다. 그 문자열이 실제로 `navigate()` 를 타고 URL 이 되는지는 보지 않는다. 착수 전
 * 결함(`LIVE_MAP_READ` 미보유자가 로그인 직후 권한없음 화면)은 바로 그 지점에서 발생했다.
 *
 * 실계정이 필요하지 않다 — `/api/auth/me` 를 mock 해 `permissionCodes` 를 임의 주입하는 관례가
 * 스위트에 이미 있다(`group-page.spec.ts` / `dlq-page.spec.ts`). 라이브 3 그룹이 모두
 * `LIVE_MAP_READ` 를 갖고 있어 미보유 실계정은 존재하지 않으므로, 이 mock 이 그 조합을 만드는
 * 유일한 경로다.
 *
 * 이 파일은 `.gitignore` 추적 예외다 — 선례이자 동일 사유는 `deploy-error-surface.spec.ts`.
 * jsdom/RTL 이 없어 이 계약을 `tests/unit` 으로 옮길 수 없고, 로컬 전용으로 두면 유실되는
 * 순간 아무도 검증하지 않는 상태로 되돌아간다.
 */

const apiSuccess = <TData>(data: TData) => ({ success: true, data, errorCode: null, errorMsg: null })
const apiNullSuccess = () => ({ success: true, data: null, errorCode: null, errorMsg: null })

/** `LIVE_MAP_READ` 가 없는 사용자다 — 권한 0 인 사용자가 아니다(그러면 fallback 경로와 구분이 안 된다). */
const ME_WITHOUT_LIVE_MAP = {
  userPk: 300,
  userId: 'operator',
  permissionCodes: ['DLQ_READ', 'LINE_READ'],
}

/** 현행 계정과 같은 조건 — 랜딩이 `/live-map` 그대로여야 한다(무회귀 양성 대조). */
const ME_WITH_LIVE_MAP = {
  userPk: 100,
  userId: 'admin',
  permissionCodes: ['LIVE_MAP_READ', 'DLQ_READ', 'LINE_READ', 'LIVE_MAP_LAYOUT_READ'],
}

const LINES = [{ lineKey: 1, lineCode: 'A_LINE', lineName: 'A Line' }]

const emptyLayout = (lineKey: number) => ({
  layoutKey: null,
  lineKey,
  canvasJson: null,
  placements: [],
  objects: [],
})

/**
 * 로그인 → 랜딩 경로에 필요한 백엔드 응답을 전부 mock 합니다.
 *
 * 목적지가 둘(`/dlq/dashboard` / `/live-map`)이라 두 화면의 엔드포인트를 모두 채운다 —
 * 미mock 요청이 401 을 받으면 `api-client.ts` 인터셉터가 `/login` 으로 하드 이동시켜, 랜딩
 * 실패가 아니라 하네스 결함으로 URL 단언이 깨진다.
 *
 * @param page Playwright 페이지
 * @param me `/api/auth/me` 가 돌려줄 사용자 — 이 스펙의 유일한 변수다
 */
const setupMocks = async (page: Page, me: typeof ME_WITH_LIVE_MAP) => {
  await page.route('**/api/auth/csrf', async (route) => {
    // set-cookie 로 JS 가시 쿠키를 심어야 issueCsrfToken 의 readCsrfCookieToken 이 값을 읽는다
    // (Double Submit Cookie). 헤더가 없으면 로그인이 CSRF_TOKEN_MISSING 으로 죽는다.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'set-cookie': 'XSRF-TOKEN=test-csrf-token; Path=/' },
      body: JSON.stringify(apiNullSuccess()),
    })
  })

  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        apiSuccess({
          userPk: me.userPk,
          issuedAt: '2026-08-21T00:00:00Z',
          expiresAt: '2026-08-21T08:00:00Z',
        }),
      ),
    })
  })

  await page.route('**/api/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess(me)),
    })
  })

  await page.route('**/api/auth/logout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiNullSuccess()),
    })
  })

  // 공유 topbar 의 LineScopeSelector 가 호출한다 — **배열** 이어야 한다. 객체를 주면 `.map` 에서
  // 크래시해 빈 화면이 되고, 랜딩이 아니라 인증 문제로 오진하게 된다.
  await page.route(/.*\/api\/line(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess(LINES)),
    })
  })

  // 목적지 A — /live-map
  await page.route(/\/api\/live-map\/layout\/objects(\/\d+)?(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess([])),
    })
  })
  await page.route(/\/api\/live-map\/layout(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess(emptyLayout(1))),
    })
  })
  await page.route(/.*\/api\/live-map(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess({ equipmentItems: [] })),
    })
  })

  // 목적지 B — /dlq/dashboard (4 모드 집계)
  await page.route(/.*\/api\/dlq\/(gateway|business|quarantine|repair-task)(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess([])),
    })
  })

  await page.route(/.*\/api\/(eqp|model|comm-logs)(\/.*)?(\?.*)?$/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess({ items: [], offset: 0, limit: 500, count: 0 })),
    })
  })
}

/** console error / pageerror 를 수집합니다 — AND 조건으로 단언해 조용한 깨짐을 통과시키지 않는다. */
const collectPageErrors = (page: Page) => {
  const consoleErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('pageerror', (error: Error) => {
    pageErrors.push(error.message)
  })

  return { consoleErrors, pageErrors }
}

/** 로그인 폼을 제출합니다. 셀렉터는 locale 무관한 id / type 기반이다(`login-page.smoke.spec.ts` 관례). */
const submitLogin = async (page: Page) => {
  await page.goto('/login')
  await page.locator('#userId').fill('tester')
  // 스키마 최소 길이 8 (`useLogin.ts` 의 login.validation.pwMin) — 짧으면 제출 전에 막힌다.
  await page.locator('#password').fill('password1234')
  await page.locator('button[type="submit"]').click()
}

test('LIVE_MAP_READ 미보유 사용자는 로그인 직후 접근 가능한 첫 화면으로 진입한다', async ({
  page,
}) => {
  const { consoleErrors, pageErrors } = collectPageErrors(page)
  await setupMocks(page, ME_WITHOUT_LIVE_MAP)

  await submitLogin(page)

  // 착수 전에는 여기서 `/live-map` 으로 가 AccessDeniedNotice 가 첫 화면이 됐다.
  await expect(page).toHaveURL(/\/dlq\/dashboard$/)
  await expect(page.getByTestId('access-denied-notice')).toHaveCount(0)

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})

test('LIVE_MAP_READ 보유 사용자의 랜딩은 종전과 같은 /live-map 이다', async ({ page }) => {
  const { consoleErrors, pageErrors } = collectPageErrors(page)
  await setupMocks(page, ME_WITH_LIVE_MAP)

  await submitLogin(page)

  // 트리 첫 항목이 Live-Map 이라 현행 계정 전원의 랜딩은 바뀌지 않는다 — 이 단언이 그 성질을 고정한다.
  await expect(page).toHaveURL(/\/live-map$/)
  await expect(page.getByTestId('access-denied-notice')).toHaveCount(0)

  expect(consoleErrors).toEqual([])
  expect(pageErrors).toEqual([])
})
