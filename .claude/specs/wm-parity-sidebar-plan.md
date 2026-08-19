# PLAN: wm-parity-sidebar — 구현 계획

> 입력: `.claude/specs/wm-parity-sidebar.md` (Specify 산출물, 2026-08-18 사용자 확정 메뉴 트리)
> 산출물 위치: `.claude/specs/wm-parity-sidebar-plan.md` (이 파일)
> 다음 단계 산출물: `.claude/specs/wm-parity-sidebar-dev-report.md`
> 전 수치는 **2026-08-19 이 세션에서 직접 실측**(Read/Grep/bash). wm 이식 대상 16파일은
> `c:\workspace_nori\nori-wm-ui-front` 원본을 전건 Read 해 대조했다. 코드 수정 0건.

---

## 0. Plan 세션 실측 요약 — SPEC 수치 검증

SPEC 본문의 실측 수치를 전건 재검증했다. **드리프트 없음.**

| 항목 | SPEC 표기 | 재실측 | 판정 |
|---|---|---|---|
| EqpSidebar 아코디언 헤더 raw button | :240(Business)/:275(Gateway) 2건 | `:240`/`:275` (라벨 span 은 `:248`/`:283`) | 일치 |
| EqpSidebar 잔존 raw button | :153,:186,:213,:258,:297 5건 | 5건 동일 라인 | 일치 |
| ModelSidebar raw button | 5건 중 헤더 외 전부 | `:173,:218,:271(헤더),:307,:332` — 헤더 1 + 잔존 4 | 일치 |
| `src/features` raw `<button` 총량 | foundation ≤18 → 0 목표 | **정확히 18건, 전부 5개 사이드바 내부** (Deploy 2 / Dlq 2 / UserMgmt 2 / Eqp 7 / Model 5) | 일치 |
| dlq 초기 mode | dlq-ui.store.ts:12 'dashboard' | `:12` | 일치 |
| deploy 초기 mode | deploy-ui.store.ts:117 'register' | `:117` | 일치 |
| Live-Map 권한 | permission.ts:5 `DASH_READ_PERMISSION='LIVE_MAP_READ'` | `:5` | 일치 |
| i18n ko dlq 라벨 | ko.json:102-106 | `:102-106` (장애 대시보드/Gateway DLQ/Business DLQ/격리 설비/Repair Task) | 일치 |
| i18n ko deploy 라벨 | ko.json:140-142 | `:140-142` (등록/배포/배포 이력) | 일치 |
| 구 topbar nav | app-navigation.ts:20-27 flat 6항목 / AppTopBar.tsx:158-186 raw button | 동일 | 일치 |
| `APP_TOP_BAR_OFFSET_CLASS` 참조 | — | 정의 AppTopBar.tsx:35 + 소비 AppPageShell.tsx:4,28 (2파일뿐) | — |
| tc rail 폭 | wm `SIDEBAR_RAIL_WIDTH='3.5rem'`(56px) | tc `SIDEBAR_COLLAPSED_WIDTH_PX = 56` (sidebar-layout.ts:1) — 동일 값 | 일치 |

### 0.1 SPEC 밖 신규 발견 (계획에 반영 — 번호로 아래 절에서 참조)

- **F1 (R12 범위 확대 — 중대)**: 제거 대상은 testId 참조만이 아니다. 도메인 사이드바의
  **아코디언/섹션 헤더를 `getByRole('button', { name: 'Gateway'|'Business'|'SECS'|'Socket'|'PLC', exact: true })`
  로 클릭하는 e2e 가 16파일** 실측됐다(§6.2 전수 목록). R9 헤더 제거 시 전부 깨진다.
- **F2**: `tests/unit/i18n-vi-parity.test.ts:20-24` 의 `TIER_A_LAYER1_KEYS` 가
  `dlq.sidebar.gateway/business/repairTask` 를 하드코딩. 키 제거 시 `assert.equal(undefined, undefined)`
  로 **조용히 무력화**된다(실패가 아니라 vacuous pass). 신 키로 치환 필수.
- **F3**: 로그인 성공 랜딩 = `LOGIN_ENTRY_ROUTE = '/eqp/live-map'` (useLogin.ts:38). Live-Map
  라우트 이동에 따라 `'/live-map'` 으로 갱신(리다이렉트 홉 제거).
- **F4**: LiveMapPage 에는 현재 **LIVE_MAP_READ 페이지 게이트가 없다** (RequireAuth 만, canEdit/canView
  는 LAYOUT_* 권한). R11 바인딩은 신규 차단이 생기는 **동작 변경**이다(SPEC 확정 표 의도).
  나머지 5페이지는 자체 `hasPermission → /login Navigate` 게이트 보유
  (DeployPage:59 / DlqPage:72 / UserManagementPage:63 / EqpPage:1371 / ModelPage:1294) — R11 로
  대체 시 "로그인 튕김 → AccessDeniedNotice" 로 동작이 바뀐다(SPEC 의도).
- **F5**: 6 라우트 페이지 전부 현재 헤딩 미렌더. `PageHeading*` 소비는 UserAdminPanel /
  GroupAdminPanel(각 `PageHeadingWithActions`, icon 미사용) / LayoutShellFixture 뿐 — **AC9 는
  6 페이지 헤딩 신설 작업**이다.
- **F6**: `lnbFlatNavClass` (shared/layout/lnb-sidebar.ts) 소비자 = 제거되는 3 사이드바뿐 →
  R9 후 고아. 함수만 제거(파일의 나머지 헬퍼는 Eqp/Model 사이드바가 계속 사용).
- **F7**: wm `SidebarContent` 가 쓰는 `.hover-scroll` CSS 가 tc index.css 에 없다. sidebar 토큰
  8종(`--sidebar*`)·`--shadow-soft-lg`·`--z-dropdown` 은 **이미 존재**(index.css:55-62,88,119-126,154,168,200-207).
- **F8**: 프로필 모달 상태가 5개 store 에 분산(`isProfileModalOpen`/`setProfileModalOpen` —
  deploy/dlq/user-management/eqp/model-ui.store). R7 AppShellPage(로컬 state) 수렴 시 전부 제거 대상.
  이로써 **dlq-ui.store / user-management-ui.store 는 파일째 고아**가 된다(잔여 필드가 mode 뿐인데
  mode 도 D2 로 URL 유도 전환).
- **F9**: URL assertion 4곳이 리다이렉트 신설로 직접 깨진다 — group-page.spec.ts:366(`/\/user$/`),
  user-page.spec.ts:347(동일), verify-ui/routes.spec.ts:68(라우트별 최종 URL), verify-ui/_shared.ts:232
  (`/\/eqp\/live-map$/`).
- **F10**: deploy store 의 `mode` **읽기 소비처는 DeployPage.tsx:31 단 1곳**. `setMode` 호출처는
  DeploySidebar(페이지 경유) + DeployRegisterPanel.tsx:325(moveToNextMode) +
  DeployMonitorPanel.tsx:733,761. store 내부 `set({mode})` 는 createServerDeployBridge /
  createLocalDeploy / redeployLocalHistoryItem 3곳 — **3곳 모두 컴포넌트 호출부가 setMode 를 중복
  호출**하고 있어(벨트+서스펜더) store 내부 전환 삭제의 파급이 봉쇄돼 있다.
- **F11**: model 의 `selectedInterfaceGroup` 은 store 가 아니라 **ModelPage 로컬 useState**
  (ModelPage.tsx:248). eqp 의 selection 은 eqp-ui.store(sessionStorage persist, 6치 유니온).
- **F12**: wm `PageHeadingWithActions` 는 tc 판과 **props 시그니처 동일**(icon/name/description/total/
  actions/className) — wm 판 교체 시 UserAdminPanel:45 / GroupAdminPanel:62 소비처 파급 0
  (둘 다 icon 미사용).
- **F13**: Ctrl/Cmd+B 전역 keydown 충돌 없음(기존 ctrlKey 사용은 live-map 마우스 이벤트 수식자뿐).
- **F14**: tc 에 `navigation.*` / `accessDenied.*` i18n 키 없음(신설). wm 은 3언어(ko/en/vi) 모두
  `accessDenied.*` 3키 보유 — 그대로 이식 가능.
- **F15**: e2e 61파일이 구 라우트(`/eqp`,`/model`,`/deploy`,`/dlq`,`/user`,`/eqp/live-map`)로
  `goto` 진입 — 리다이렉트 6종이 전부 흡수하므로 **goto 자체는 깨지지 않는다**(URL assertion F9 와
  헤더 클릭 F1 만 갱신).

---

## 1. wm 이식 원본 대조 — 파일별 조정 지점 (react-router import 포함)

wm 은 `react-router-dom` v7, tc 는 `react-router` v8 (package.json 실측 `react-router: ^8.3.0`,
`radix-ui: ^1.4.3`, `lucide-react: ^0.576.0` — 프리미티브 의존 전부 충족).

| # | wm 원본 (전건 Read 완료) | tc 대상 경로 | 라우터 조정 | 그 외 조정 |
|---|---|---|---|---|
| 1 | `components/ui/sidebar.tsx` (365L) | 동일 경로 신설 | **없음** (radix Dialog/Slot 만) | 없음 — 그대로 |
| 2 | `components/ui/sidebar-context.ts` (50L) | 동일 경로 신설 | 없음 | `SIDEBAR_COOKIE_NAME: 'wm_lnb_state'→'nori_tc_lnb_state'` (R1). rail 폭 주석의 `SIDEBAR_COLLAPSED_WIDTH_PX` 언급은 tc 도 56px 로 동일해 유효 |
| 3 | `shared/hooks/useIsMobile.ts` (24L) | 동일 경로 신설 | 없음 | 없음 |
| 4 | `shared/lib/app-navigation.ts` | 기존 파일 **전면 재작성** | 없음 | tc 확정 트리 6그룹/16항목으로 재작성. `requiresDualApproval`/`dualApprovalEnabled` 파라미터 **제거**(tc useMe 에 featureFlags 없음 — 실측). `APP_NAVIGATION_BASE_ROUTE_COUNT` 도 제거(소비처 없음) |
| 5 | `shared/lib/app-navigation-icons.ts` | 동일 경로 신설 | 없음 | tc 키로 재작성, 아이콘 선정 3원칙 주석 승계 (§2 D7) |
| 6 | `shared/components/AppLnbSidebar.tsx` (257L) | 동일 경로 신설 | **`react-router-dom`→`react-router`** (Link/useLocation/useNavigate) | `useMe` 의 featureFlags 인자 제거, 로고 `nori-wm-logo-2x.png`→tc `@/assets/brand/nori-tc-logo.png`(AppTopBar 에서 이동), prefetch 배선 추가 (§2 D6) |
| 7 | `shared/components/AppLnbFlyout.tsx` (142L) | 동일 경로 신설 | **`react-router-dom`→`react-router`** (Link) | 없음 |
| 8 | `shared/components/AppPageShell.tsx` (37L) | 기존 파일 **교체** | 없음 | `currentMenu` prop 소멸 |
| 9 | `shared/components/AppShellPage.tsx` (35L) | 동일 경로 신설 | 없음 | 로그아웃 체인 tc 화 (§2 D3) |
| 10 | `shared/components/AppTopBar.tsx` (113L) | 기존 파일 **개편**(교체 아님) | tc 이미 `react-router` | §2 D3/D6 — 중앙 nav 제거, breadcrumb 은 tc 기존 `PageLocation`(시그니처 동일 실측) 재사용 |
| 11 | `app/route-modules.ts` (58L) | `src/app/route-modules.ts` 신설 | 없음 (`import()` 만) | tc 7 lazy 페이지 + 16 라우트 + 구경로 매핑으로 재작성 |
| 12 | `app/guards/RequirePermission.tsx` (41L) | `src/app/RequirePermission.tsx` 신설 (tc 는 RequireAuth 가 `src/app/` 직하 — 형제 배치) | **`react-router-dom`→`react-router`** (Outlet) | wm 의 `meQuery.isPending` 로딩 분기 승계 |
| 13 | `shared/components/AccessDeniedNotice.tsx` (35L) | 동일 경로 신설 | 없음 | i18n `accessDenied.*` 3키 × 3언어 동반 이식 (wm ko/en/vi:1062-1064 실측) |
| 14 | `shared/layout/page-heading-styles.ts` (8L) | 동일 경로 신설 | 없음 | foundation R9 보류분 — 본 R10 이 이식 (SPEC 명시) |
| 15 | `shared/layout/PageHeading.tsx` / `PageHeadingWithActions.tsx` | 기존 2파일 **wm 판으로 교체** | 없음 | props 동일(F12) — 소비처 무수정. 시각만 변경(min-h-21 계약, 아이콘 틀 박스) |
| 16 | `shared/layout/AppPageHeading.tsx` (61L) | 동일 경로 신설 | **`react-router-dom`→`react-router`** (useLocation) | 없음 |
| 17 | `shared/layout/PageLayoutShell.tsx` (66L) | 기존 파일 **wm 판으로 교체** | 없음 | `bread` prop 제거·`heading.icon` 제거(자동 유도). 소비처 = LayoutShellFixture 뿐(라우트 페이지 소비 0 실측) → fixture 동반 갱신 |
| — | wm `index.css` 의 `.hover-scroll` 규칙 | tc `src/index.css` 에 **`.hover-scroll` 단일 클래스만** 추가 | — | wm 은 `.overflow-*` 유틸 전역에도 걸지만 tc 기존 스크롤바 스타일과의 충돌 회피를 위해 SidebarContent 가 쓰는 클래스만 최소 이식 (surgical) |

Sidebar 프리미티브가 쓰는 시각 토큰(`--sidebar*` 8종, `--shadow-soft-lg`, `--z-dropdown`)은 tc
index.css 에 **이미 존재**(F7) — CSS 추가는 `.hover-scroll` 뿐.

---

## 2. 설계 결정 (Implement 는 이 결정을 엄수)

### D1. Router 구조 — wm 동형 Outlet 중첩으로 전환

- tc `RequireAuth` 를 children 형 → **Outlet 형**으로 전환하고, 그 하위에 권한 그룹별
  `<Route element={<RequirePermission permissionCode={…} />}>` 를 wm Router.tsx:159-231 과 동형으로 중첩.
- 16 라우트는 **정적 나열 + element prop 전달** (wm `MasterCrudPage resourceKey` 동형):
  `<Route path="/dlq/gateway" element={<DlqPage mode="gateway" />} />`. param 라우트(`/:mode`)를
  쓰지 않는다 — 미존재 세그먼트가 자동으로 `*`→`/login` 에 떨어져 유효성 분기가 불필요.
- 세그먼트↔값 매핑(전 항목 명시 — user 만 1:1 이 아님):
  - dlq: `dashboard|gateway|business|quarantine|repair-task` = DlqMode 값 그대로
  - deploy: `register|deploy|history` = DeployMode 값 그대로 (SPEC 확정)
  - user: `/user/users`→`'user'`, `/user/groups`→`'group'` (UserManagementMode)
  - eqp: `/eqp/business`→`'business'`, `/eqp/gateway`→`'gateway'` (신규 `EqpScope` 타입)
  - model: `/model/secs`→`'SECS'`, `/model/socket`→`'SOCKET'`, `/model/plc`→`'PLC'` (ProtocolType)
- 리다이렉트 8종: `/`→`/login`(불변), `*`→`/login`(불변), `/dlq`→`/dlq/dashboard`,
  `/deploy`→`/deploy/register`, `/user`→`/user/users`, `/eqp`→`/eqp/gateway`, `/model`→`/model/secs`,
  `/eqp/live-map`→`/live-map`. 전부 `<Navigate replace>`.
- 라우트별 권한(확정 표 값 문자열의 기존 상수 바인딩): live-map=`DASH_READ_PERMISSION`(값
  'LIVE_MAP_READ'), dlq 5=`DLQ_READ_PERMISSION`, eqp 2=`EQP_READ_PERMISSION`,
  model 3=`MODEL_READ_PERMISSION`, deploy 3=`DEPLOY_READ_PERMISSION`, user 2=`USER_READ_PERMISSION`.
- ErrorBoundary(key=pathname) / Suspense 래핑은 현행 유지.

### D2. mode↔URL 동기화 — store 별 확정 (실측 근거 포함)

**공통 원칙: URL 이 단일 진실 원천. mode 는 라우트 prop 으로 내려가고, 전환은 전부 navigate.**

| store | 실측 | 결정 |
|---|---|---|
| dlq-ui.store | mode + isProfileModalOpen 뿐. setMode 소비처 = DlqPage(사이드바 경유) 단독 | **파일 제거**. DlqPage 가 `mode: DlqMode` prop 수신, `renderPanel(mode)` 유지. 프로필 모달은 AppShellPage 흡수(F8) |
| user-management-ui.store | 동일 구조, 소비처 UserManagementPage 단독 | **파일 제거**. 동일 방식 |
| deploy-ui.store | F10 — mode 읽기 1곳, 내부 set 3곳은 호출부 setMode 와 중복 | **mode 필드/setMode 제거**(persist partialize 에서 자동 소멸). DeployPage 가 mode prop 수신. DeployRegisterPanel.moveToNextMode(:325)·DeployMonitorPanel(:733,:761) 의 `setMode(x)` → `navigate('/deploy/'+x)` 치환. createServerDeployBridge 의 `activateMode` 파라미터와 내부 mode 산출(`terminal?'history':'deploy'`)은 **삭제하고 호출부 navigate 로 책임 이동** — 3 호출부 모두 이미 후속 setMode 를 직접 호출하고 있어 동작 등가. `historyListOffset` 등 잔여 로직은 불변 |
| eqp-ui.store | selection 6치 유니온(sessionStorage persist), 전환 진입점은 R9 후 사라지는 헤더 클릭(onSelectBusinessAll/onSelectGatewayAll)과 트리 노드 | **selection 유지 + URL→store 단방향 보정**. EqpPage 가 `scope: 'business'|'gateway'` prop 수신. 진입/스코프 변경 시: scope='business' 인데 selection 이 gateway 계열(gateway_all/gateway_group/eqp)이거나 none 이면 `selectBusinessAll()`, scope='gateway' 인데 business 계열/none 이면 `selectGatewayAll()` 로 보정. **store→URL 역방향은 만들지 않는다** — 스코프 전환 수단이 LNB(navigate)뿐이라 불필요. `selection.type==='none'` 분기는 사실상 진입 불가가 되지만 **코드 보존**(dead path 제거는 사용자 결정 — 글로벌 룰) |
| model (로컬 state) | ModelPage.tsx:248 useState + 사이드바 섹션 헤더 클릭이 유일 setter | **useState 제거**, `scope: ProtocolType` prop 으로 치환. `handleSelectInterfaceGroup` 은 헤더 소멸과 함께 제거 |

새로고침/딥링크 복원: 전부 라우트 prop 이므로 별도 복원 로직 없음(URL 자체가 상태).
deploy 의 sessionStorage 복원분(선택 설비 등)은 mode 와 무관하게 현행 유지.

### D3. 로그아웃 체인 재배선 (순서·정리 항목 보존)

현행 tc AppTopBar.handleLogout(:127-148): `authApi.logout()`(try, 실패해도 진행) → `onAfterLogout?.()`
→ `queryClient.clear()` → `clearPersistedQueryCache()` → `clearDeployUiSessionState()` →
`clearCsrfCookie()` → `navigate('/login')`.

wm 구조 이식 후:
- **AppShellPage** 의 onAfterLogout 합성 = 페이지별 정리(prop) → `authApi.logout()`(try/catch 로
  실패 무시 — 현행 동작 보존).
- **AppTopBar** handleLogout = `onAfterLogout?.()` → finally { `queryClient.clear()` →
  `clearPersistedQueryCache()` → `clearDeployUiSessionState()` → `clearCsrfCookie()` → navigate }.
- 페이지별 정리(EqpPage 의 resetSelectionTransientStates 등, ModelPage 의 resetUiState 등)는 각
  페이지가 AppShellPage 의 `onAfterLogout` prop 으로 전달 — 현행 값 그대로 이동.

### D4. 프로필 모달 수렴 (F8)

AppShellPage 가 `useState(profileOpen)` + `UserProfileModal` 배선을 소유(wm 동형). 6 페이지의
`UserProfileModal` import/렌더와 5 store 의 `isProfileModalOpen`/`setProfileModalOpen` 필드 제거.
model-ui.store 의 `reset()` 내 해당 필드도 제거.

### D5. 헤딩 계열 (R10) — 배선 지점 확정

- PageHeading/PageHeadingWithActions 를 wm 판으로 교체(F12 — 소비처 무수정), page-heading-styles.ts
  이식, AppPageHeading 신설, PageLayoutShell wm 판 교체(bread 제거 — breadcrumb 은 topbar 소관).
- **6 라우트 페이지 배선(AC9 grep 대상 파일에 문자열이 실재해야 함)** — 전 페이지가 분할/캔버스
  레이아웃이므로 wm 관행의 "분할 레이아웃 = AppPageHeading 직접" 을 적용한다:
  - DlqPage / UserManagementPage / DeployPage: 콘텐츠 `<section>` 상단에 `AppPageHeading` 직접
    렌더(name = 현 LNB 항목 라벨 `t(navigationLocation.item.labelKey)` — `resolveAppNavigationLocation`
    유도로 페이지가 라벨을 중복 소유하지 않게).
  - EqpPage / ModelPage: 우측 콘텐츠 영역 상단에 동일 방식.
  - LiveMapPage: 캔버스 위 헤더 영역에 `AppPageHeading` 직접(3D 풀블리드 훼손 없게 컴팩트 배치).
  - UserAdminPanel/GroupAdminPanel 의 기존 `PageHeadingWithActions` 는 **유지**(in-page 섹션 헤딩,
    wm 관행과 합치) — UserManagementPage 레벨 AppPageHeading 과 중복되면 Implement 에서 panel 쪽
    헤딩의 name 표시를 실화면으로 확인해 이중 타이틀이면 panel 쪽을 actions-only 로 축소하고
    dev-report 에 기록.
- LayoutShellFixture: `bread` prop 소비 2곳(:97 등)을 wm 판 시그니처로 갱신.

### D6. prefetch 2계열 (R8) — 항목별 매핑

(b) `route-modules.ts`: 7 lazy 페이지 loader + `ROUTE_MODULE_LOADERS` 는 16 신 라우트 + `/login` +
`/` + 구경로 6종(리다이렉트 목적지와 동일 loader — 딥링크 preload 도 히트하게). Router 의
`lazy()` 가 같은 loader 를 공유, 모듈 상단 `preloadRouteModule(window.location.pathname)` 승계.
LNB 항목 `onPointerEnter/onFocus/onTouchStart` 에서 `preloadRouteModule`, rail 버튼 `onFocus` 는
그룹 항목 전체 preload(wm 동형), 전환은 `startTransition(() => navigate(route))`.

(a) query hover-prefetch — 현행 AppTopBar.tsx:43-98 의 switch 를 **항목 key 단위**로 이전
(AppLnbSidebar 의 항목 hover/focus 에서 호출). queryKey/staleTime 은 각 hook 정의와 일치 유지:

| 항목 | prefetch |
|---|---|
| liveMap | `['live-map']` getLiveMap, staleTime 5_000 (현행 dash 승계) |
| dlqGateway | `['dlq','gateway']` fetchGatewayDlq, 30_000 |
| dlqBusiness | `['dlq','business']` fetchBusinessDlq, 30_000 |
| dlqQuarantine | `['dlq','quarantine']` fetchQuarantine, 30_000 |
| dlqRepairTask | `['dlq','repair-task']` fetchRepairTasks, 30_000 |
| dlqDashboard | DashboardPanel 은 useQuery 직접 보유 0(자식/훅 경유) — **Implement 에서 첫 mount 쿼리를 실측**해 배선하거나, 실측 결과 4종 집계면 위 4 prefetch 재사용. 결정을 dev-report 에 기록 |
| eqpBusiness / eqpGateway | 둘 다 `eqpQueryKeys.list()` getEqpList(0,500), 60_000 (현행 eqp 승계) |
| modelSecs / modelSocket / modelPlc | 셋 다 `modelQueryKeys.list()` getModelList(0,500), 60_000 |
| userUsers | `userQueryKeys.list(0, USER_PAGE_SIZE)`, 30_000 (현행 승계 — listOffset 0 가정 주석 승계) |
| userGroups | 현행 topbar 는 group 미prefetch — GroupAdminPanel 첫 쿼리(groupQueryKeys 계열)를 **Implement 실측** 후 동일 원칙으로 배선(불명확하면 미배선 + 사유 주석) |
| deployRegister / deployDeploy / deployHistory | **prefetch 제외** — 현행 제외 사유 주석("mode/filter 분기로 정적 query 가 없어 제외") 그대로 승계 |

AC12 는 AppLnbSidebar/AppLnbFlyout 내 `prefetchQuery|preloadRouteModule` 1건 이상 — (b) 만으로도
충족되지만 (a) 도 위 표대로 배선한다.

### D7. 아이콘 (R3) — 후보 표 (3원칙: 직역 / 형태 비중복 / 16px 판독성)

`Record<AppNavigationGroupKey, LucideIcon>` + `Record<AppNavigationItemKey, LucideIcon>` 강제.
Implement 는 아래 후보로 시작하되 3원칙 위반 발견 시 대체하고 주석에 근거 기록:

- 그룹: monitoring=MonitorDot / dlq=TriangleAlert / equipment=Factory / model=Workflow /
  deploy=Rocket / system=Settings
- 항목: liveMap=MonitorDot / dlqDashboard=LayoutDashboard / dlqGateway=Router(수신 관문) /
  dlqBusiness=Briefcase / dlqQuarantine=ShieldAlert / dlqRepairTask=Wrench /
  eqpBusiness=Briefcase / eqpGateway=Router / modelSecs=FileCode / modelSocket=Cable /
  modelPlc=Cpu / deployRegister=ClipboardList / deployDeploy=Rocket / deployHistory=History /
  userUsers=Users / userGroups=UsersRound
- 형태 중복 허용 예외(wm 동형 근거): 그룹 아이콘과 그 그룹 대표 항목의 동일 사용(monitoring↔liveMap,
  deploy↔deployDeploy)은 "펼침은 항목만, rail 은 그룹만" 이라 한 화면 중복이 없다(wm 주석 승계).
  dlqGateway↔eqpGateway, dlqBusiness↔eqpBusiness 는 다른 그룹이므로 시각 문맥이 분리 — 허용.

### D8. 영속 채널 분리 (Constraints)

LNB 접힘 = 쿠키 `nori_tc_lnb_state`(7일, samesite=lax — wm 동형). 도메인 in-page 패널 폭 =
기존 zustand persist(`shared-sidebar-layout` localStorage) 불변. 두 채널을 섞지 않는다.
Ctrl/Cmd+B 단축키 충돌 없음(F13).

### D9. 로그인 랜딩 (F3)

`LOGIN_ENTRY_ROUTE` `'/eqp/live-map'` → `'/live-map'` (useLogin.ts:38). 구경로 리다이렉트가 있어
미변경도 동작하지만, 로그인마다 리다이렉트 홉 + e2e URL assertion 혼선을 만들므로 신 경로로 변경.

### D10. R9 사이드바 재편 상세

- **파일 제거 3**: DeploySidebar.tsx / DlqSidebar.tsx / UserManagementSidebar.tsx (AC8).
- **EqpSidebar**: props 에 `scope: 'business'|'gateway'` 추가. Business(:240-269)/Gateway(:272-329)
  아코디언 헤더 button 2건과 businessOpen/gatewayOpen state 제거 → scope 에 맞는 하위 트리만 렌더
  (business: businessGroups 링크 목록 / gateway: gateway_app 그룹+eqp 노드+우클릭 CRUD).
  Gateway 헤더에 걸려 있던 **SECS/Socket/PLC Eqp Create ContextMenu(:322-328)는 진입점을 잃는다**
  — gateway 스코프 트리 컨테이너(nav 영역)의 ContextMenuTrigger 로 이설해 기능 보존(콘텐츠 기능
  불변 제약). 잔존 raw button 5건(:153 트리 노드, :186/:213 접기/펼치기, :258 business 하위 링크,
  :297 gateway 그룹 토글) 전량 `<Button variant="ghost">` 수렴 — 기존 lnb* 클래스는 className 으로
  유지해 시각 불변.
- **ModelSidebar**: props 의 `selectedInterfaceGroup` → `scope: ProtocolType`,
  `onSelectInterfaceGroup` 제거. renderSection 의 그룹 헤더 button(:271)과 secsOpen/socketOpen/
  plcOpen state 제거 → scope 의 roots 만 렌더. 섹션 헤더의 **`{title} Model Create`
  ContextMenu(:290-296)도 트리 컨테이너로 이설**(현 scope 의 인터페이스 타입으로 생성). 잔존 raw
  button 4건(:173 branch, :218 root, :307/:332 접기/펼치기) `<Button>` 수렴.
- **shared-layout.store**: store 는 유지(EqpPage/ModelPage in-page 패널이 계속 소비). 제거는
  **DeployPage(:35-38)/DlqPage(:47-50)/UserManagementPage(:38-41) 의 useSharedLayoutStore 소비 4구독
  ×3페이지 + handleSidebarDrag** (SPEC 명시).
- **lnb-sidebar.ts**: `lnbFlatNavClass` 만 제거(F6), lnbGroupClass 등 잔여 헬퍼는 유지.

### D11. i18n (신설/이관/정리)

- 신설(ko/en/vi 3언어): `navigation.group.*` 6키, `navigation.item.*` 16키,
  wm 부속 5키(`navigation.main/expand/collapse/openMenu/groupMenu`), `accessDenied.*` 3키(wm 이식).
- ko 값은 확정 표 그대로. 항목 en/vi: dlq 5항목·deploy 3항목은 **기존 `dlq.sidebar.*`/
  `deploy.sidebar.*` 의 en/vi 값을 이관**(라벨 재사용 — SPEC 명시). TC 고유명
  (Live-Map/SECS/Socket/PLC/Business/Gateway/Repair Task + Gateway DLQ/Business DLQ)은 전 언어 영어.
  그룹 en/vi 신규 번역(모니터링/처리실패/설비/모델/적용/시스템)은 jargon 정책 준수하에 Implement 확정.
- 정리(고아): `deploy.sidebar.*` 6키, `userMgmt.sidebar.*` 3키, `dlq.sidebar.*` 8키 — 3언어 전부.
  `eqp.sidebar.*`/`model.sidebar.*` 는 사이드바 타이틀 바·검색·접기가 **유지되므로 존치**.
- **F2 대응**: i18n-vi-parity.test.ts 의 `TIER_A_LAYER1_KEYS` 중 `dlq.sidebar.gateway/business/
  repairTask` → `navigation.item.dlqGateway/dlqBusiness/dlqRepairTask` 로 치환(`dlq.panel.*` 3키는
  패널 존치라 불변).

### D12. AC11 baseline 판정 (foundation AC16 [~] 승계 — SPEC 요구)

- **Implement 첫 단계(코드 수정 전, 커밋 아님)**: clean 선행 HEAD 에서 `npm run test:e2e`(워커
  기본 4) 실행 → PASS spec 목록을 dev-report 에 baseline 으로 기록. foundation Validate 실측
  기준 90 PASS 안팎이며 **`live-map-3d-eqp-*` WebGL 스펙은 워커 4 에서 비결정**(87~88/90, 매 실행
  실패 집합이 바뀜, 실패 형태는 assertion 이 아니라 타임아웃+`ContextResult::kTransientFailure`,
  `--workers=1` 격리 실행에서 전건 통과) — 이 비결정성을 baseline 기록에 명시한다.
- **판정 방식**: 구현 후 동일 명령으로 baseline PASS 목록 전건 대조(R12 갱신 스펙은 갱신본 기준).
  - 미통과가 **`live-map-3d-eqp-*` 3D 경합 타임아웃에 한정**되고 `--workers=1` 재실행에서 통과하면
    → foundation AC16 과 동일하게 **[~] 부분**으로 마킹(고정 수치가 아니라 "미통과가 3D 경합
    한정" 으로 판정 — foundation 소견 원문 승계).
  - 그 외 스펙이 1건이라도 baseline 대비 미통과면 → **FAIL**(회귀).
  - console.error 0건 AND pageerror 0건 게이트는 3D 예외 없이 전건 적용.

### D13. e2e 갱신 방침 (R12 — §6 전수 목록의 공통 규칙)

- 제거 testId 클릭(모드 전환) → **신 라우트 딥링크 `page.goto`** 로 치환(LNB 클릭 대신 goto 를
  기본으로 — 스펙의 관심사는 패널 동작이지 내비가 아님. 내비 자체 검증은 신설 spec 이 담당).
- 도메인 사이드바 헤더 클릭(F1: Gateway/Business/SECS/Socket/PLC role-button) → 해당 스코프
  라우트 goto (`/eqp/gateway`, `/model/secs` 등) 치환. 헤더 클릭의 "전체 선택" 의미
  (gateway_all 등)는 D2 의 진입 보정이 재현한다.
- URL assertion(F9): 신 최종 URL 로 갱신 (`/\/user$/`→`/\/user\/users$/`,
  `/\/eqp\/live-map$/`→`/\/live-map$/`, routes.spec 은 라우트 표 자체 갱신).
- 신설 `tests/e2e/wm-parity-sidebar.spec.ts`: 16 라우트 렌더 + 리다이렉트 8종 최종 URL + 권한
  미보유 mock 세션(`/auth/me` permissionCodes 축소 fulfill)에서 확정 표 권한 라우트 1곳
  AccessDeniedNotice 렌더 + console.error/pageerror 0 게이트 (AC4 문안 그대로).

### D14. 확정 메뉴 트리 — 변경 필요 발견 여부

실측 결과 **표 그대로 구현 가능. 변경 필요 없음.** (라우트 충돌/권한 상수/라벨 원천 전부 확인.)
따라서 사용자 재승인 요청 사항 없음.

---

## 3. 커밋 슬라이스 — 실행 순서 / 완료 AC / 검증 게이트

선행 관계 실측 근거: AppLnbSidebar 는 route-modules(preload)·sidebar 프리미티브·내비 정의·아이콘을
import(wm :5-30) → C1·C2 가 C3 선행. RequirePermission 은 AppShellPage 를 import(wm :5) →
C4b 에 동반. R9 는 라우트 prop(scope/mode)이 있어야 헤더를 제거할 수 있다 → C4 선행. R10 의
AppPageHeading 은 `resolveAppNavigationLocation` 의존 → C2 선행. R12 는 전 기능 완료 후.

**컨텍스트 60% 중단 대비**: 각 커밋은 독립 빌드/린트/유닛 green 상태로 main 에 남는다. 중단 시
다음 세션은 dev-report(진행분 기록)와 이 표의 다음 행부터 재개.

| # | 커밋 (conventional) | 내용 | 완료 판정 AC | 게이트 |
|---|---|---|---|---|
| C0 | (커밋 없음) | **AC11 baseline**: clean HEAD `npm run test:e2e` PASS 목록 + 3D 비결정성 기록 (D12) | AC11 전제 | — |
| C1 | `feat(ui): LNB 사이드바 프리미티브 이식 (R1)` | sidebar.tsx / sidebar-context.ts / useIsMobile.ts 신설 + index.css `.hover-scroll` | R1 | build+lint (소비자는 C3 — 커밋 노트에 명시) |
| C2 | `feat(navigation): 2단 내비 정의·아이콘·i18n (R2/R3)` | app-navigation.ts 재작성(구 `APP_TOP_NAVIGATION_ITEMS` 는 **잔존** — AppTopBar 가 아직 소비, C4b 에서 제거) + app-navigation-icons.ts + i18n 신설분(D11 신설, 정리는 C5) + `resolveVisibleAppNavigationGroups` 권한 필터 단위 테스트 신설 | R2/R3, AC3 의 신규 테스트 | build+lint+`test:unit` |
| C3 | `feat(navigation): AppLnbSidebar/Flyout + route-modules (R4/R8)` | AppLnbSidebar.tsx / AppLnbFlyout.tsx / route-modules.ts 신설 (D6 prefetch 포함, 셸 배선은 C4b) | R4, R8 부품 | build+lint |
| C4a | `feat(routing): 16 라우트 + 리다이렉트 + URL 단일 진실 원천 (R5)` | Router.tsx 재편(D1) + RequireAuth Outlet 전환 + 페이지 5개 mode/scope prop 화(D2 — deploy/dlq/user store 수술, eqp 보정, model useState 제거) + **구 사이드바 onChangeMode→navigate 치환**(구 topbar/구 사이드바는 유지 — 화면 동작 보존) + LOGIN_ENTRY_ROUTE(D9) + dlq/user-management store 파일 제거 | R5 | build+lint+unit. 수동 스모크: /dlq/gateway 딥링크 → GatewayDlqPanel 렌더 |
| C4b | `feat(shell): LNB 셸 전환 — topbar 개편 + RequirePermission (R6/R7/R11)` | AppTopBar 개편(중앙 nav 제거, PageLocation breadcrumb, 모바일 토글) + AppPageShell wm 판 + AppShellPage 신설 + 6 페이지 AppShellPage 전환 + D3 로그아웃 체인 + D4 프로필 모달 수렴 + RequirePermission/AccessDeniedNotice 이식·Router 배선 + 구 app-navigation 정의·`APP_TOP_BAR_OFFSET_CLASS`·구 prefetch switch 제거 | R6/R7/R11, **AC5/AC6/AC10/AC12** | build+lint+unit + AC5/6/10/12 grep 실행 |
| C5 | `refactor(sidebar): 도메인 사이드바 재편 (R9)` | 3 사이드바 파일 제거 + EqpSidebar/ModelSidebar 재편(D10) + 3 페이지 useSharedLayoutStore 소비 제거 + lnbFlatNavClass 제거 + i18n 고아 정리·이관(D11) + i18n-vi-parity 테스트 키 치환(F2) | R9, **AC7/AC8** | build+lint+unit + AC7/8 grep |
| C6 | `feat(layout): AppPageHeading + PageLayoutShell wm 판 (R10)` | page-heading-styles.ts / AppPageHeading.tsx 신설 + PageHeading/PageHeadingWithActions/PageLayoutShell 교체 + 6 페이지 헤딩 배선(D5) + LayoutShellFixture 갱신 | R10, **AC9** | build+lint + AC9 grep |
| C7 | `test(e2e): wm-parity-sidebar 스펙 신설 + 기존 갱신 (R12)` | 신설 spec(D13) + §6 갱신 대상 전수 반영 | R12, **AC4/AC11** | `npx playwright test tests/e2e/wm-parity-sidebar.spec.ts` + `npm run test:e2e` baseline 대조(D12) + **최종 AC1/AC2/AC3 전체 재실행·출력 인용** |

각 커밋은 main 직접 커밋(워크스페이스 룰 — 빌드/테스트 선통과 필수).

---

## 4. 영향 파일 전수

### 신설 (13)
`src/components/ui/sidebar.tsx`, `src/components/ui/sidebar-context.ts`,
`src/shared/hooks/useIsMobile.ts`, `src/shared/lib/app-navigation-icons.ts`,
`src/shared/components/AppLnbSidebar.tsx`, `src/shared/components/AppLnbFlyout.tsx`,
`src/shared/components/AppShellPage.tsx`, `src/shared/components/AccessDeniedNotice.tsx`,
`src/app/route-modules.ts`, `src/app/RequirePermission.tsx`,
`src/shared/layout/page-heading-styles.ts`, `src/shared/layout/AppPageHeading.tsx`,
`tests/e2e/wm-parity-sidebar.spec.ts`

### 재작성/교체 (7)
`src/shared/lib/app-navigation.ts`(C2 신정의 추가 → C4b 구정의 제거),
`src/app/Router.tsx`, `src/shared/components/AppTopBar.tsx`, `src/shared/components/AppPageShell.tsx`,
`src/shared/layout/PageHeading.tsx`, `src/shared/layout/PageHeadingWithActions.tsx`,
`src/shared/layout/PageLayoutShell.tsx`

### 수정 (16 내외)
`src/app/RequireAuth.tsx`(Outlet 전환), `src/index.css`(.hover-scroll),
`src/features/deploy/components/DeployPage.tsx`, `DeployRegisterPanel.tsx`(:325 navigate),
`DeployMonitorPanel.tsx`(:733,:761 navigate), `src/features/deploy/stores/deploy-ui.store.ts`(mode 제거),
`src/features/dlq/components/DlqPage.tsx`, `src/features/user-management/components/UserManagementPage.tsx`,
`src/features/eqp/components/EqpPage.tsx`(scope prop+보정+헤딩),
`src/features/eqp/components/EqpSidebar.tsx`(D10), `src/features/eqp/stores/eqp-ui.store.ts`(프로필 필드 제거),
`src/features/model/components/ModelPage.tsx`(scope prop+헤딩),
`src/features/model/components/ModelSidebar.tsx`(D10), `src/features/model/stores/model-ui.store.ts`(프로필 필드),
`src/features/live-map/components/LiveMapPage.tsx`(AppShellPage+헤딩),
`src/features/auth/hooks/useLogin.ts`(:38), `src/shared/layout/lnb-sidebar.ts`(lnbFlatNavClass 제거),
`src/dev/LayoutShellFixture.tsx`, `src/i18n/locales/{ko,en,vi}.json`,
`tests/unit/i18n-vi-parity.test.ts`(F2), `tests/unit/` 신규 내비 필터 테스트

### 삭제 (5)
`src/features/deploy/components/DeploySidebar.tsx`, `src/features/dlq/components/DlqSidebar.tsx`,
`src/features/user-management/components/UserManagementSidebar.tsx`,
`src/features/dlq/stores/dlq-ui.store.ts`, `src/features/user-management/stores/user-management-ui.store.ts`

---

## 5. R5 리다이렉트·권한 매트릭스 (Implement 체크리스트)

| 경로 | 처리 | 권한 게이트 |
|---|---|---|
| `/live-map` | LiveMapPage | LIVE_MAP_READ (**신규 차단 발생 — F4 동작 변경**) |
| `/dlq/dashboard` … `/dlq/repair-task` (5) | DlqPage mode=세그먼트 | DLQ_READ |
| `/eqp/business`, `/eqp/gateway` | EqpPage scope=세그먼트 | EQP_READ |
| `/model/secs`, `/model/socket`, `/model/plc` | ModelPage scope=대문자 변환 | MODEL_READ |
| `/deploy/register`, `/deploy/deploy`, `/deploy/history` | DeployPage mode=세그먼트 | DEPLOY_READ |
| `/user/users`, `/user/groups` | UserManagementPage mode='user'/'group' | USER_READ |
| `/dlq` `/deploy` `/user` `/eqp` `/model` `/eqp/live-map` | Navigate replace (SPEC 확정 목적지) | — |
| `/` `*` | `/login` (불변) | — |
| `/__fixtures/*` 2종 | DEV 전용 현행 유지 | — |

---

## 6. R12 e2e/단위 테스트 갱신 대상 전수 (실측)

### 6.1 제거 testId 참조 — 7파일 18건
| 파일 | 라인 | 참조 |
|---|---|---|
| tests/e2e/dlq-page.spec.ts | 241-244, 261, 266, 271, 276 | dlq-sidebar-{gateway,business,quarantine,repair-task} |
| tests/e2e/group-page.spec.ts | 12, 367 | user-management-sidebar-group |
| tests/e2e/modal/modal-visual-sweep-group.spec.ts | 154 | user-management-sidebar-group |
| tests/e2e/selectable-table/selectable-table-dlq-business.spec.ts | 186, 225 | dlq-sidebar-business |
| tests/e2e/selectable-table/selectable-table-group-list.spec.ts | 171 | user-management-sidebar-group |
| tests/e2e/verify-ui/overlays-deploy.spec.ts | 40, 100 | deploy-sidebar-{register,history} |
| tests/e2e/verify-ui/overlays-user-group.spec.ts | 31, 59 | user-management-sidebar-{user,group} |

### 6.2 도메인 사이드바 헤더 role-button 클릭 (F1) — 16파일
modal/modal-overflow-guard-extra(:115 Gateway, :191 SECS) · model/model-check-in-diff-overflow(:205) ·
model/model-flow(:735 + 헬퍼 openEditModelTab:486) · plc/plc-model-tree(:175 PLC visible, :178,
:183, :198, :224) · selectable-table/{check-in:285, gateway-group:214,258,
model-check-in-diff:267, model-info:213, model-parameter:208, model-workflow:279,
parent-model-commit:230} · socket-message-layout(:207 Socket) ·
verify-ui/{overlays-eqp-result:44,95, overlays-eqp:52,63,96, overlays-model-detail:39,
overlays-model-tree:43}
→ D13 규칙(스코프 라우트 goto 치환)으로 갱신.

### 6.3 URL assertion (F9) — 4곳
group-page.spec.ts:366 · user-page.spec.ts:347 · verify-ui/routes.spec.ts:68(+ AUTHENTICATED_ROUTES
표 자체) · verify-ui/_shared.ts:232

### 6.4 단위 테스트 (F2) — 1파일
tests/unit/i18n-vi-parity.test.ts:20-24 (dlq.sidebar.* 3키 → navigation.item.* 치환)

### 6.5 참고 — 갱신 불필요 근거
구 라우트 goto 61파일(F15)은 리다이렉트가 흡수. `eqp.sidebar.*`/`model.sidebar.*` 라벨 참조 스펙은
타이틀 바 존치로 무영향. Implement 는 C7 에서 baseline 대조로 잔여 파급을 최종 확인한다.

---

## 7. 위험과 완화

| # | 위험 | 완화 |
|---|---|---|
| L1 | **C4 가 최대 수술**(라우팅+셸 동시) — 중간 상태 파손 | C4a/C4b 분할: C4a 는 구 topbar/구 사이드바를 유지한 채 라우팅만 전환(사이드바 클릭=navigate 로 동작 보존), C4b 에서 셸 교체. 각각 독립 green |
| L2 | deploy store mode 제거의 미실측 파급 | F10 실측으로 읽기 1곳·중복 호출 3곳 확인 완료. Implement 는 수술 직후 `grep -rn "state.mode\|setMode" src/features/deploy` 0건(스토어 밖) 재확인 |
| L3 | R9 헤더 제거로 Eqp/Model 의 **Create ContextMenu 진입점 소실** | D10 — 트리 컨테이너로 이설(기능 불변 제약 준수). e2e 로 우클릭 Create 플로우 회귀 확인 |
| L4 | LiveMapPage LIVE_MAP_READ 신규 차단(F4) | 의도된 SPEC 동작 변경 — dev-report 에 명시, 신설 spec 의 AccessDeniedNotice assertion 으로 고정 |
| L5 | 3D e2e 비결정으로 AC11 오판 | D12 판정 규칙(3D 경합 한정 + workers=1 재확인)으로 봉인 |
| L6 | 프로필 모달 수렴(D4) 시 5 store 필드 제거 파급 | 제거 전 `grep -rn "isProfileModalOpen\|setProfileModalOpen" src` 전수 실측 후 소비처(각 Page 뿐임을 확인)와 함께 일괄 제거 |
| L7 | i18n 키 정리가 잔존 소비처를 깨뜨림 | 키 제거 전 `grep -rn "<키>" src tests` 0건 확인을 커밋 게이트로 |
| L8 | 쿠키 영속과 e2e 격리 — LNB 접힘 상태가 스펙 간 누출 | Playwright 기본 컨텍스트 격리로 쿠키 초기화됨(전제) — 신설 spec 에서 접힘 토글 후 상태 의존 assertion 금지 |
| L9 | AppPageHeading 배선(D5)이 분할 레이아웃 페이지의 스크롤/폭 회귀 유발 | 레이아웃 엣지(데이터 多/overflow) 스크린샷 확인 — 메모리 룰(빈 상태만 보고 통과 단정 금지) 준수 |
| L10 | user/group 세그먼트↔mode 불일치(users→user) 매핑 오류 | D1 매핑 표를 route element prop 에 정적 기입(변환 함수 없음 — 오타는 tsc 가 못 잡으므로 신설 e2e 의 16 라우트 렌더 assertion 이 게이트) |

## 8. 롤백 방법

- 커밋 단위 `git revert` — 역순(C7→C1) 원칙. C4a/C4b 는 연쇄(C4b 가 C4a 의 라우트를 전제) —
  둘을 함께 revert.
- C5(사이드바 제거)는 파일 삭제 revert 로 복원 가능하나 i18n 이관(D11)과 얽힘 — C5 단독 revert 시
  i18n 정리분도 같은 커밋에 있으므로 원자적으로 복원된다(커밋 경계가 롤백 경계).
- 최악 시나리오(운영 파손): 선행 HEAD(`21822ad` 이후의 이 트랙 시작 커밋 직전)로
  `git revert <range>` — force-push 금지 룰 준수.
- 데이터/백엔드 변경 0 — 프론트 단독 트랙이라 DB/API 롤백 불요.

## 9. Constraints 준수 확인

- 확정 메뉴 트리: **변경 없이 구현 가능**(D14) — 재승인 불요
- 권한: 상수명이 아니라 값 문자열 기준, Live-Map=DASH_READ_PERMISSION(값 'LIVE_MAP_READ') 바인딩
- i18n: navigation.group./item. 신설, ko/en/vi, TC 고유명 전 언어 영어(D11)
- radix-ui 모노패키지만(이식 프리미티브가 radix `Dialog`/`Slot` 사용 — 신규 패키지 0)
- 페이지 콘텐츠 기능 불변: 내비 구조만 변경, Create ContextMenu 이설로 기능 보존(L3)
- URL 단일 진실 원천: D2 전 store 확정
- testId: 유지 요소 보존, 제거 요소 참조는 §6 전수 갱신
- 시각 토큰: ui-front coral/neutral(index.css 기존 sidebar 토큰 재사용 — F7)

---

## SDD 진행 상태 연동

이 Plan 승인 후 SPEC `.claude/specs/wm-parity-sidebar.md` 의 SDD 진행 상태 **Plan** 항목을 [x] 로
갱신하는 것은 Implement 진입 세션이 아니라 이 Plan 커밋에서 수행한다(산출물 실재 기준).

**Implement 진입 프롬프트** (SPEC 의 표준 템플릿 그대로):

```
@.claude/specs/wm-parity-sidebar.md @.claude/specs/wm-parity-sidebar-plan.md 둘 다 읽고 구현.
SPEC 의 Acceptance Criteria 모두 만족하도록 각 AC 당 실패 테스트 먼저.
Plan 의 결정 (D1~D14, 커밋 슬라이스 C0~C7) 엄수.
산출물: .claude/specs/wm-parity-sidebar-dev-report.md 에 변경 파일 / 테스트 결과 / 결정 기록.
```
