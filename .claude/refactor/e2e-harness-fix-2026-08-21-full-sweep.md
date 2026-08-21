# e2e 전수 실패 원인 규명 + 하네스 fix (2026-08-21, 2 차)

`e2e-harness-permission-fix-2026-08-21.md` 의 후속. 1 차에서 "남은 24 건은 진입 경로 / DOM stale"
로 뭉뚱그렸던 것을 **전수로 원인 규명**했다. `tests/e2e/` 는 gitignore 라 fix 를 commit 할 수
없으므로 복구 가능한 형태로 diff 를 박아 둔다.

## 0. 먼저 — 측정 자체가 틀렸던 문제

`npx playwright test` (기본 워커 4) 로 전체를 돌리면 **Vite dev 서버가 28 번째 테스트 무렵 죽는다.**
그 뒤 166 건이 `net::ERR_CONNECTION_REFUSED` 로 도미노 실패한다(172 failed 중 166 건). 이 숫자를
실패 목록으로 읽으면 원인 규명이 통째로 헛수고가 된다.

**유효한 측정 절차**: dev 서버를 직접 띄워 두고(`npm run dev -- --host 127.0.0.1 --port 3000`)
`--workers=2` 로 돌린다. 이 조건에서 서버는 20 분 완주 동안 살아 있고 connection-refused 0 건이다.

| 실행 | 결과 |
|---|---|
| workers=4, Playwright 가 서버 관리 | 172 failed / 35 passed / 14 did not run — **무효**(166 건이 서버 사망 후 도미노) |
| workers=2, 서버 직접 기동 (**베이스라인**) | **31 failed / 183 passed / 7 did not run**, refused 0 |
| workers=2, 아래 fix 적용 후 | **218 passed / 1 failed / 1 did not run**, refused 0 (파괴적 1 건 제외) |

남은 1 failed 는 §8 의 환경 전제(`overlays-live-map.spec.ts:84`)이고, `1 did not run` 은 같은
serial 파일에서 그 뒤로 밀린 테스트다. 즉 **코드로 고칠 실패는 0 건**이다.

## 1. 판정 요약 — 프로덕션 결함 0 건

31 건 전부 **하네스 결함(29) 또는 환경 전제 불일치(2)** 였다. 프로덕션 코드는 한 줄도 바꾸지 않았다.

| # | 원인 | 대상 | 건수 |
|---|---|---|---|
| A | `/api/line` mock 부재 → unmocked 가 실 백엔드 401 → 전역 `/login` 리다이렉트 | user-page(9) · user-list(3) · group-list(3) | 15 |
| B | `/api/line` 이 catch-all 의 paginated 객체로 응답 → `.map` throw → ErrorBoundary | selectable-table 5 스펙 · socket-message-layout · deploy-monitor(2) | 3 (+ 사전 11) |
| C | `/api/eqp/gateway-shard-leases` mock 부재 → 위와 같은 401 → `/login` | eqp-line-select(2) · i18n-language-toggle(2) · plc-eqp-form(2) | 6 |
| D | 가짜/빈 권한 코드 → `AccessDeniedNotice` | gateway-group(2) · group-page(1) | 3 |
| E | 우클릭 대상이 `ContextMenuTrigger` 가 아닌 전역 LNB 링크 | overlays-eqp(1) · overlays-model-tree(1) · overlays-eqp-result(1) | 3 |
| F | 공용 프리미티브 전환 후 남은 native `<select>` locator | model-workflow(1) | 1 |
| G | `verifyOverlay` 의 `open()` 이 멱등하지 않음(persist 된 draft) | overlays-deploy(1) | 1 |
| H | 로딩 중 ESC 차단(의도된 동작)을 기다리지 않음 | overlays-model-detail(1) | 1 |
| I | **환경 전제** — TC_TEST_ENV 미적용 백엔드 | overlays-live-map(1) · overlays-eqp-result(1) | 2 |

## 2. A/B/C — `/api/line` 과 `/api/eqp/gateway-shard-leases`

### 무엇이 문제였나

공유 topbar 의 `LineScopeSelector` 는 **라우트와 무관하게 항상** `GET /api/line` 을 호출한다
(wm-parity 개편으로 추가 — 대부분의 스펙보다 나중). `EqpPage` 는 `GET /api/eqp/gateway-shard-leases`
를 호출한다(`EqpPage.tsx:154`).

스펙이 이 두 요청을 다루지 않으면 두 갈래로 깨진다.

1. **catch-all 이 없는 스펙** — unmocked 요청이 vite proxy 를 타고 실 백엔드(`localhost:8080`)로
   나가 미인증 401 을 받는다. `apiClient` 인터셉터가 **페이지 전체를 `/login` 으로 보낸다**
   (`src/shared/lib/api-client.ts:23`). 화면이 로그인 폼이라 그 뒤 모든 단언이 무의미하게 실패한다.
   `user-page.spec.ts` 자신의 주석(91-94 행)이 이 경로를 이미 예고하고 있었다.
2. **catch-all 이 있는 스펙** — 기본 응답이 paginated 객체(`{items:[]}`)라 배열이 아니다.
   `LineScopeSelector.tsx:55` 의 `.map` 이 던지고 ErrorBoundary 가 라우트 전체를 삼킨다.

> **백엔드 계약은 배열이다** — `nori-tc-ui-backend` `LineController.java:39` 가
> `ResponseEntity<ApiResponse<List<LineResponse>>>` 를 반환한다. 즉 `.map` 은 계약대로이고
> **프로덕션 결함이 아니다**. `/eqp/gateway-shard-leases` 도 배열이며, `eqp.api.ts:155` 는
> `Array.isArray` 가 아니면 `ApiError` 를 던진다.

### fix diff — catch-all 이 있는 스펙 (분기 삽입)

`selectable-table-model-info` / `-model-parameter` / `-model-workflow` / `-model-check-in-diff` /
`-parent-model-commit` 는 `const method = request.method()` 직후, `socket-message-layout` 은
`const pathname = new URL(route.request().url()).pathname` 직후에 삽입:

```ts
      // 공유 topbar 의 LineScopeSelector 는 라우트와 무관하게 항상 GET /api/line 을 호출한다.
      // 백엔드 계약은 ApiResponse<List<LineResponse>> 라 data 가 배열이다
      // (nori-tc-ui-backend LineController.java:39). catch-all 의 paginated 객체({items:[]})가
      // 내려가면 LineScopeSelector.tsx:55 의 .map 이 던지고 ErrorBoundary 가 라우트 전체를
      // 삼켜, 이 스펙이 보려는 화면이 아예 렌더되지 않는다.
      if (pathname === '/api/line') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(
            createApiResponse([{ lineKey: 1, lineCode: 'LINE_A', lineName: 'Line A' }]),
          ),
        })
        return
      }
```

`selectable-table-deploy-monitor.spec.ts` 는 같은 내용을 `/api/auth/me` 분기 뒤에 넣되 헬퍼명이
`apiSuccess` 다.

### fix diff — catch-all 이 없는 스펙 (route 등록)

`user-page.spec.ts` 는 `setupMocks` 끝에, `selectable-table-user-list` / `-group-list` 는 마지막
`route.fallback()` 블록 뒤에:

```ts
  // 공유 topbar 의 LineScopeSelector 가 라우트와 무관하게 GET /api/line 을 호출한다(wm-parity
  // 개편으로 추가됨 — 이 스펙보다 나중). catch-all 이 없어 unmocked 로 빠지면 vite proxy 가
  // 실제 백엔드(localhost:8080)로 넘기고, 미인증 401 을 받은 api-client 인터셉터가 페이지
  // 전체를 /login 으로 보낸다(src/shared/lib/api-client.ts:23).
  // 응답은 배열이어야 한다(백엔드 계약 ApiResponse<List<LineResponse>>).
  await page.route('**/api/line', async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiSuccess([{ lineKey: 1, lineCode: 'LINE_A', lineName: 'Line A' }])),
    })
  })
```

### fix diff — shard lease (`eqp-line-select` / `i18n-language-toggle` / `plc-eqp-form`)

`/api/eqp/options` route 바로 앞에 삽입. 기존 `/.*\/api\/eqp(\?.*)?$/` 패턴에는 걸리지 않는다.

```ts
  // EqpPage 가 gateway 그룹 분류용으로 호출한다(EqpPage.tsx:154). 아래 `/api/eqp$` 패턴에는
  // 걸리지 않아 unmocked 로 빠지면 vite proxy 가 실제 백엔드(localhost:8080)로 넘기고, 미인증
  // 401 을 받은 api-client 인터셉터가 페이지 전체를 /login 으로 보낸다(api-client.ts:23).
  // 응답은 배열이어야 한다 — eqp.api.ts:155 가 Array.isArray 아니면 ApiError 를 던진다.
  await page.route(/.*\/api\/eqp\/gateway-shard-leases(\?.*)?$/, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(apiSuccess([])) })
  })
```

## 3. D — 권한 코드

1 차에서 고친 `MODEL_RW` / `EQP_RW` 와 별개로 두 곳이 더 있었다. 둘 다 `RequirePermission` 이식
전에는 라우트가 권한을 보지 않아 통과했던 것이다.

### `selectable-table-gateway-group.spec.ts`

`PERMISSIONED_ME.permissionCodes` 가 **빈 배열**이었다(이름과 정반대). `/eqp/gateway` 는
`EQP_READ` 를 요구한다(`Router.tsx:97`) → 화면이 `No access permission / Required permission EQP_READ`.

```ts
// 이 스펙은 /eqp/gateway 만 방문한다 — 그 라우트가 요구하는 EQP_READ 만 준다(Router.tsx:97).
// 원래 빈 배열이었는데, RequirePermission 이식(wm-parity-sidebar R11) 전에는 라우트가 권한을
// 보지 않아 통과했다. 지금은 AccessDeniedNotice 가 렌더돼 사이드바 트리가 아예 없다.
const PERMISSIONED_ME = {
  userPk: 1,
  userId: 'admin',
  permissionCodes: ['EQP_READ'],
}
```

### `group-page.spec.ts` — `UNPERMISSIONED_ME`

`Group-AC-8a` 는 "User 메뉴가 없다" 를 보면서 **양성 대조로 `lnb-item-eqpGateway` 가 보인다**를
같이 단언한다. 그런데 권한이 빈 배열이면 LNB 는 항목별 `requiredPermission` 으로 필터하므로
(`src/shared/lib/app-navigation.ts:214`) 항목이 **전부** 사라져 양성 대조가 성립할 수 없다.
`user-page.spec.ts` 의 동명 상수는 처음부터 `EQP_READ` 를 준다.

```ts
// "USER_READ 가 없는" 사용자다 — 권한이 0 개인 사용자가 아니다. LNB 는 항목별
// requiredPermission 으로 필터하므로(app-navigation.ts:214) 빈 배열이면 항목이 전부 사라져
// Group-AC-8a 의 양성 대조(eqpGateway 항목은 보인다)가 성립할 수 없다. user-page.spec.ts 의
// 같은 이름 상수도 EQP_READ 를 준다.
const UNPERMISSIONED_ME = {
  userPk: 200,
  userId: 'viewer',
  permissionCodes: ['EQP_READ'] as string[],
}
```

## 4. E — 우클릭 대상이 틀렸다 (`관측된 항목: []`)

`컨텍스트 메뉴 항목을 열지 못했습니다: X (마지막으로 관측된 항목: [])` 3 건은 모두 **전역 LNB
링크를 우클릭**하고 있었다. `ContextMenuTrigger` 는 각 화면 사이드바의 **트리 컨테이너**에 붙어 있다.

| 스펙 | 잘못된 대상 | 실제 트리거 |
|---|---|---|
| `overlays-eqp.spec.ts:50` | `lnb-item-eqpGateway` | `eqp-sidebar-gateway-tree` (`EqpSidebar.tsx:260-263`) |
| `overlays-eqp-result.spec.ts:93` | `lnb-item-eqpGateway` | 같음 |
| `overlays-model-tree.spec.ts:50` | `lnb-item-modelSocket` | `model-sidebar-tree` (`ModelSidebar.tsx:322-326`) |

컨텍스트 메뉴 항목은 **권한 게이팅이 없다** — 무조건 렌더된다. 즉 권한 문제가 아니었다.
정상 동작하는 선례: `eqp-line-select.spec.ts:126` / `plc-eqp-form.spec.ts:127` /
`modal-visual-sweep-eqp.spec.ts:75` 가 모두 `eqp-sidebar-gateway-tree` 를 쓴다.

### `overlays-model-tree.spec.ts` — 추가로 2 건

첫 테스트가 살아나자 serial 모드로 밀려 있던("did not run") 2 건이 처음 실행되며 별개 결함 2 개가 드러났다.

**(a) 이동 직후 대기 없음** — `goto('/model/socket')` 직후 화면은 라우트 로딩 fallback
(`화면을 불러오는 중입니다.`)이라 버튼이 0 개다. `treeNodes()` 가 그 시점에 읽어 빈 배열이 나오고
`"Socket 섹션에 root 모델이 있어야 한다"` 로 오진된다.

```ts
  await page.goto('/model/socket')
  // 이동 직후 화면은 라우트 로딩 fallback('화면을 불러오는 중입니다.') 이라 버튼이 0 개다 —
  // treeNodes() 가 그 시점에 읽으면 빈 배열이 나와 "root 모델이 있어야 한다" 로 오진된다.
  // 트리 컨테이너가 실제 대상이므로 그것이 뜰 때까지 기다린다.
  await expect(page.getByTestId('model-sidebar-tree')).toBeVisible({ timeout: 30_000 })
```

**(b) `treeNodes()` 가 페이지 전체 버튼을 읽었다** — 필터 목록이 구 topbar 라벨
(`['Dash','Eqp','Model','Deploy','Dlq','User','A Line','한국어','로그아웃']`)이라 wm-parity LNB
링크를 하나도 못 걸러낸다. `roots[0]` 이 LNB 항목이 되어 우클릭이 먹지 않았다.

```ts
const SECTIONS = ['SECS', 'Socket', 'PLC']

/**
 * 현재 사이드바에 그려진 트리 노드 이름 목록.
 *
 * <p>반드시 트리 컨테이너로 좁혀서 읽는다 — 페이지 전체 버튼을 읽으면 전역 LNB 링크(Home /
 * Equipment / Model / SECS …)가 섞여 들어와 roots[0] 이 LNB 항목이 되고, 거기에 우클릭해도
 * ContextMenuTrigger 가 없어 메뉴가 안 열린다. 예전엔 구 topbar 라벨 목록으로 걸러냈지만
 * wm-parity 로 LNB 가 들어온 뒤엔 그 목록이 아무것도 못 걸러낸다.</p>
 *
 * <p>컨테이너 안에는 root 버튼만 보인다(branch 는 root 를 펼쳤을 때만 — ModelSidebar.tsx:254).</p>
 */
async function treeNodes(page: import('@playwright/test').Page): Promise<string[]> {
  const names = await page
    .getByTestId('model-sidebar-tree')
    .getByRole('button')
    .evaluateAll((elements) => elements.map((element) => (element.textContent ?? '').trim()))
  return names.filter((name) => name)
}
```

(삭제: `CHROME_BUTTONS` 상수 — 스코프를 좁힌 뒤엔 걸러낼 대상이 없다.)

## 5. F — native `<select>` locator (공용 프리미티브 전환 잔재)

`selectable-table-model-workflow.spec.ts` 의 `Selectable-Table-R3-AC-3` 이
`[data-row-idx="0"][data-col-idx="2"] select` 를 찾고 있었다. commit **`5a9d497`**
"refactor(ui): model 계열 raw control 을 공용 프리미티브로 수렴" 에서 native `<select>` 가 공용
Radix `Select` 로 교체됐다 — trigger 는 `role=combobox` 이고 옵션은 portal 로 body 에 렌더된다.

`grep -rn "locator('select'|selectOption(" tests/e2e/` 결과 이 1 곳이 스위트 전체의 유일한 잔재였다.

```ts
  // EventId 는 columns[2] — col-idx="2". native <select> 가 아니다: 5a9d497
  // "model 계열 raw control 을 공용 프리미티브로 수렴" 에서 공용 Select(Radix)로 교체됐고
  // trigger 는 role=combobox, 옵션은 portal 로 body 에 렌더되므로 container 가 아니라 page
  // 에서 찾는다(다른 스펙과 동일한 방식 — eqp-line-select.spec.ts:134).
  const eventIdTrigger = container
    .locator('[data-row-idx="0"][data-col-idx="2"]')
    .getByRole('combobox')
  await expect(eventIdTrigger).toBeVisible()
  await eventIdTrigger.click()

  // dropdown 옵션이 eventides fixture (EVT_100 / EVT_200) 를 노출 (fallback `—` 포함)
  await expect(page.getByRole('option', { name: '—', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'EVT_100', exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: 'EVT_200', exact: true })).toBeVisible()
```

**무력한 테스트가 아님을 증명함**: `ModelDetailPanel.tsx:1049` 의 `eventIdOptions:
flowEventIdOptions` 를 `eventIdOptions: []` 로 바꾸면 정확히 `EVT_100` 옵션 단언에서 1 failed.
원복하면 통과.

## 6. G — `verifyOverlay` 의 `open()` 은 멱등해야 한다

`overlays-deploy.spec.ts` 의 "변경 있음 분기" 가 `신규 Model 선택` placeholder 를 못 찾아 240s
타임아웃. `verifyOverlay` 는 `open()` 을 **두 번** 부르는데, 1 회차에서 고른 모델이 2 회차에도
남아 placeholder 가 0 개가 된다.

**실측**:
```
COMBOS[pass1-before]      = [..., "신규 Model 선택", "신규 Model Version 선택", ...]
COMBOS[pass1-after-select]= [..., "DEMO_MAKER_MODEL", "26.04.06.0000 / OPERATE", ...]
COMBOS[pass2-before]      = [..., "DEMO_MAKER_MODEL", "26.04.06.0000 / OPERATE", ...]
PLACEHOLDER_COUNT_pass2   = 0
```

등록 draft 는 zustand `persist` + **sessionStorage** 로 저장된다
(`deploy-ui.store.ts:523-524`) — 전체 페이지 이동에도 살아남는 **의도된 동작**이다. 따라서 제품이
아니라 하네스를 고친다. 패널 자신의 초기화 버튼(`handleClearRegister` →
`clearRegisterState` + draft 3 종 리셋, `DeployRegisterPanel.tsx:818`)으로 되돌린다.

```ts
  // verifyOverlay 는 open() 을 두 번 부르므로 이 함수가 멱등해야 한다. 등록 draft 는 zustand
  // persist(sessionStorage — deploy-ui.store.ts:523-524)로 페이지 이동에도 살아남는 의도된
  // 동작이라, 1 회차에서 고른 "신규 Model" 이 2 회차에도 남아 placeholder 로 찾는 로케이터가
  // 0 건이 된다(실측: pass2 에서 '신규 Model 선택' 0 개). 패널 자신의 초기화 버튼으로 되돌린다
  // — clearRegisterState + draft 3 종을 EMPTY_SELECT_VALUE 로 돌린다(DeployRegisterPanel.tsx:818).
  // '초기화' 는 화면에 2 개다(검색 필터용 handleClearSearch:1117 / 등록 draft 용
  // handleClearRegister:1253) — 후자는 배포 버튼과 같은 footer 에 있으므로 그것으로 지목한다.
  await page
    .getByTestId('deploy-register-submit')
    .locator('..')
    .getByRole('button', { name: '초기화' })
    .click()
```

### `overlays-deploy` — 추가 1 건 (조회 기간)

첫 2 건이 살아나자 밀려 있던 `DeployMonitorPanel — 상세 보기 / 삭제 확인` 이 처음 실행되며
"배포 이력 행" 부재로 실패. 조회 기간 기본값이 최근 7 일이라(`defaultMonitorFilters`) 그 창에
완료 배포가 없으면 0 건이다. **실측: 기본 창 0 건 / 시작일 확장 시 50 건**(최근 것이 2026-07-31).

```ts
  // 조회 기간 기본값은 최근 7 일이라(DeployMonitorPanel.tsx:483 defaultMonitorFilters) 그 안에
  // 완료된 배포가 없으면 이력이 0 건이다 — 실측: 기본 창 0 건, 시작일을 넓히면 50 건.
  // 이 테스트가 검증하는 것은 이력 행의 오버레이이지 최근 배포 여부가 아니므로 기간을 넓힌다.
  await page.getByLabel('시작 기간').fill('2025-01-01')
  await page.getByRole('button', { name: '조회' }).click()
```

## 7. H — 로딩 중 ESC 차단은 의도된 동작이다

`overlays-model-detail.spec.ts:118` 의 `ModelCheckInDiffModal ESC 닫힘` 실패. `onOpenChange` 는
`isPending` 이면 **조기 반환**해 닫힘을 막는다(`ModelCheckInDiffModal.tsx:230-235`,
`isPending = isCheckInDiffLoading` — `ModelPage.tsx:1321`). 요청 진행 중 dismiss 를 막는 의도된
가드이므로 제품 결함이 아니다. 테스트가 로딩 완료를 기다려야 한다.

```ts
  await verifyOverlay(page, 'ModelCheckInDiffModal', async () => {
    await page.getByRole('button', { name: 'Check In' }).click()
    // diff 로딩이 끝나기 전에는 ESC / 바깥 클릭이 의도적으로 막힌다 — onOpenChange 가
    // isPending 이면 조기 반환한다(ModelCheckInDiffModal.tsx:230-235, isPending =
    // isCheckInDiffLoading — ModelPage.tsx:1321). 로딩 중에 ESC 를 누르면 "ESC 닫힘" 이
    // 제품 결함처럼 실패한다. 로딩 문구가 사라질 때까지 기다린다.
    await expect(page.getByText('이전 버전 데이터를 불러오는 중입니다.')).toHaveCount(0, {
      timeout: 30_000,
    })
  })
```

## 8. I — 환경 전제: `verify-ui` 는 TC_TEST_ENV 백엔드를 요구한다 (⚠ 중요)

남은 2 건은 코드 결함이 아니다. **`verify-ui/*` 는 mock 없이 실제 백엔드에 로그인하는 통합
스펙이고, `TC_TEST_ENV` 로 기동된 백엔드를 전제한다.**

`nori-tc-exec/config/tc-redis.test.properties` 의 헤더 주석이 근거다 — 로딩 조건이 `TC_TEST_ENV`
이고, `spring.data.redis.database=1` 로 논리 DB 를 분리하며 **"운영은 인덱스 0(미지정 기본값)을
쓴다"** 고 명시한다. `tc-db.test.properties` 는 같은 조건에서 DB 를 `nori_tc_test` 로 바꾼다.

**현재 로컬에서 도는 백엔드(8080)는 그 프로필이 없다** — 실측:

```
CONFIG host=192.168.0.110 port=6379 database=(unset -> 0) hasPassword=true
db=0 commLogKeysSeenInFirstScan=234   ← 백엔드가 읽는 곳(= 운영)
db=1 commLogKeysSeenInFirstScan=132   ← 스펙이 시드를 넣는 곳(= 테스트)
```
`spring.data.redis.database` 는 import 되는 config 어디에도 없다(유일한 출현은 주석 처리된
`# spring.data.redis.database=0`). datasource 는 `config/tc-db.properties` 의
`jdbc:postgresql://192.168.0.150:16432/nori_tc` — `tc-db.local.properties` 에 override 없음.

| 스펙 | 결과 | 사유 |
|---|---|---|
| `overlays-live-map.spec.ts:84` | 1 failed | `seedCommLog` 이 Redis **db 1** 에 넣는데 백엔드는 **db 0** 을 읽는다 → 통신 로그 행 0 건 |
| `overlays-eqp-result.spec.ts:82` | **실행하지 않음** | 설비를 실제로 생성·삭제한다. 지금 백엔드로는 그 대상이 **운영 `nori_tc`** 다 |

**이 2 건은 코드로 고칠 것이 아니다.** 고칠 곳은 실행 환경이다 — 백엔드를 `TC_TEST_ENV` 로 띄우면
`nori_tc_test` + Redis db 1 을 보게 되고 두 스펙의 전제가 충족된다. 시드를 db 0 으로 돌리는 것은
**운영 Redis 에 쓰는 것**이므로 정반대 방향의 수정이다.

> ⚠ **`TC_TEST_ENV` 없이 `verify-ui` 전체를 돌리면 파괴적 스펙이 운영 DB 를 가리킨다.**
> `overlays-eqp-result` 의 설비 생성/삭제가 그 예다. 이번에는 `--grep-invert "전용 설비 생성 후 삭제"`
> 로 제외했다.

## 9. 검증

```
=== BUILD ===
✓ built in 40.01s
=== LINT ===
> eslint .
=== UNIT ===
# tests 265
# pass 265
# fail 0
```

빌드 경고는 `three-vendor` 906 kB 가 Vite 의 500 kB 권고치를 넘는 것 1 건뿐 — 3D 뷰어용 lazy
청크로 **의도적으로 분리한** 결과이므로 결함이 아니다.

`Array.isArray` 경계 검증은 12 개 api 모듈 중 5 개만 쓰는 선택적 패턴이라(`deploy` 9 / `group` 6 /
`model` 8 / `eqp` 3 / `user` 3 회, 나머지 7 모듈 0 회) `line.api.ts` 의 미검증은 컨벤션 위반
outlier 가 아니다 → 프로덕션 코드 변경 없음.

## 10. 다음에 e2e 실패를 만나면

1. **워커 4 로 전체를 돌린 결과는 믿지 않는다.** dev 서버를 직접 띄우고 `--workers=2`.
   `grep -c ERR_CONNECTION_REFUSED` 가 0 인지 먼저 본다.
2. **실패 스크린샷을 연다**(`test-results/<test>/test-failed-1.png`).
   - 로그인 폼 → unmocked 요청의 401 → 전역 리다이렉트(§2). 어떤 엔드포인트가 빠졌는지 찾는다.
   - `No access permission` → 권한 mock(§3).
   - `화면을 불러오는 중입니다.` → 이동 후 대기 누락(§4a).
   - 정상 화면인데 locator 실패 → 대상/구조 stale(§4b, §5).
3. `관측된 항목: []` 는 **우클릭 대상이 트리거가 아니라는 뜻**이다. 권한을 의심하기 전에
   `ContextMenuTrigger` 가 붙은 `data-testid` 를 소스에서 확인한다(§4).
4. `verifyOverlay` 를 쓰는 테스트가 2 회차에서 깨지면 `open()` 의 멱등성을 본다 — persist 된
   store 가 1 회차 상태를 남긴다(§6).
5. 닫힘 단언이 실패하면 컴포넌트가 `isPending` 등으로 닫힘을 **의도적으로 막는지** 먼저 본다(§7).
6. `verify-ui/*` 는 `TC_TEST_ENV` 백엔드를 전제한다. 아니면 운영 DB 를 건드린다(§8).
