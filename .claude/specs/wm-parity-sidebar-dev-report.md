# DEV REPORT: wm-parity-sidebar — 구현 기록

> 입력: `.claude/specs/wm-parity-sidebar.md` (SPEC) + `.claude/specs/wm-parity-sidebar-plan.md` (Plan)
> 선행 HEAD: `cf7e079` (clean 확인 후 착수)
> 이 파일은 **커밋 슬라이스마다 즉시 갱신**한다 — 세션이 중단되면 다음 세션이 이 파일과
> Plan §3 표의 다음 행부터 이어받는다.

---

## 진행 현황

| # | 커밋 | 상태 | SHA |
|---|---|---|---|
| C0 | (커밋 없음) AC11 baseline | 완료 | — |
| C1 | `feat(ui): LNB 사이드바 프리미티브 이식 (R1)` | 완료 | `484a2c1` |
| C2 | `feat(navigation): 2단 내비 정의·아이콘·i18n (R2/R3)` | 완료 | `c5b8928` |
| C3 | `feat(navigation): AppLnbSidebar/Flyout + route-modules (R4/R8)` | 완료 | `b7d6223` |
| C4a | `feat(routing): 16 라우트 + 리다이렉트 + URL 단일 진실 원천 (R5)` | 완료 | (이 커밋) |
| C4b | `feat(shell): LNB 셸 전환 — topbar 개편 + RequirePermission (R6/R7/R11)` | 대기 | — |
| C5 | `refactor(sidebar): 도메인 사이드바 재편 (R9)` | 대기 | — |
| C6 | `feat(layout): AppPageHeading + PageLayoutShell wm 판 (R10)` | 대기 | — |
| C7 | `test(e2e): wm-parity-sidebar 스펙 신설 + 기존 갱신 (R12)` | 대기 | — |

---

## C0 — AC11 baseline (clean HEAD `cf7e079`, 코드 수정 0건)

명령: `npx playwright test --reporter=line,json` (playwright.config.ts 기본 로컬 워커 4)

```
  14 did not run
  87 passed (17.0m)
```

전수 집계 (JSON 리포터 파싱):

| 판정 | 건수 |
|---|---|
| expected (PASS) | **87** |
| unexpected (FAIL) | 81 |
| skipped / did not run | 14 |
| 합계 | 182 |

### baseline PASS 87건 — spec 파일별 분포 (AC11 대조 기준)

```
   1  demo-matrix.harness.spec.ts                        1  live-map/live-map-3d-seed.spec.ts
   1  deploy/deploy-monitor-view-modal.spec.ts           1  live-map/live-map-3d-status.spec.ts
   1  deploy/deploy-register-bulk-guard.spec.ts          1  live-map/live-map-3d-structure.spec.ts
   1  deploy/deploy-register-scenario-modal.spec.ts      2  live-map/live-map-3d-undo-counts.spec.ts
   7  dlq-page.spec.ts                                   1  live-map/live-map-3d-viewer.spec.ts
   1  eqp-line-select.spec.ts                            1  live-map/live-map-demo-run-reattach.spec.ts
   8  group-page.spec.ts                                 4  live-map/live-map-flow-groups.spec.ts
   1  i18n/i18n-flat-key-render.spec.ts                  1  live-map/live-map-line-scope.spec.ts
   6  layout-overflow-guard.spec.ts                      3  live-map/live-map-object-editor.spec.ts
   1  live-map/live-map-3d-auto.spec.ts                  2  live-map/live-map-readonly.spec.ts
   1  live-map/live-map-3d-bays.spec.ts                  3  live-map/live-map-scenario-upload.spec.ts
   2  live-map/live-map-3d-edit-advanced.spec.ts         1  live-map/live-map-structure-overlay.spec.ts
   1  live-map/live-map-3d-editing.spec.ts               1  live-map/live-map-viewer.spec.ts
   1  live-map/live-map-3d-eqp-autoplace.spec.ts         1  login-page.smoke.spec.ts
   1  live-map/live-map-3d-floors.spec.ts                2  modal/modal-visual-sweep-eqp.spec.ts
   3  modal/modal-visual-sweep-group.spec.ts             1  modal/modal-visual-sweep-livemap.spec.ts
   1  model/model-check-in-diff-overflow.spec.ts         2  plc/plc-eqp-polling-group.spec.ts
   2  selectable-table/selectable-table-dlq-business.spec.ts
   1  selectable-table/selectable-table-resize.spec.ts   1  selectable-table/selectable-table-sort.spec.ts
   2  selectable-table/selectable-table-virtual.spec.ts 10  user-page.spec.ts
   3  verify-ui/overlays-auth.spec.ts                    2  verify-ui/routes.spec.ts
```

전체 목록 원본: 세션 스크래치패드 `e2e-baseline2.json` (JSON 리포터 산출물).

### baseline FAIL 81건 — 성격 분류 (사전 실패, 회귀 아님)

| 분류 | 건수 | 근거 |
|---|---|---|
| `verify-ui/*` (실백엔드 localhost:8080 전제, mock 없음) | 18 | `toHaveURL` 로그인 실패 — 백엔드 미기동 |
| `model/model-flow.spec.ts` | 20 | 30s 타임아웃 |
| `selectable-table/*` (clipboard·모달 계열) | 20 | 30s 타임아웃 / dev-server 500 |
| `plc/*`, `modal/modal-overflow-guard-extra`, `socket-message-layout`, `eqp-line-select`, `i18n-language-toggle`, `group-page` 2건 | 19 | 타임아웃 / 500 / locator 미발견 |
| `live-map/live-map-3d-eqp-{cmp,drag,meshpick,redrag}` | 4 | **3D WebGL 경합 타임아웃 (D12 비결정 대상)** |

**D12 비결정성 기록**: 워커 4 병렬에서 `live-map-3d-eqp-*` 4 스펙이 타임아웃으로 떨어졌다.
실패 형태는 assertion 이 아니라 `Test timeout ... exceeded` 이며, 같은 계열의 다른 3D 스펙
(`live-map-3d-auto/bays/editing/floors/seed/status/structure/viewer/undo-counts/edit-advanced/autoplace`
= 13건)은 같은 실행에서 통과했다. 즉 3D 스펙 집합 안에서 **실패 집합이 실행마다 바뀐다**.
AC11 판정 시 이 4 스펙은 baseline PASS 목록에 없으므로 대조 대상이 아니고, 반대로 baseline PASS 인
3D 스펙이 구현 후 타임아웃으로 떨어지면 D12 규칙대로 `--workers=1` 재실행으로 판별한다.

**baseline 재실행 이력**: 1차 실행 도중 C1 신규 파일 3개를 만들었고, 실행 후반부 실패율이
급증해 오염을 의심했다. 신규 파일을 전부 트리 밖으로 옮기고 `git status` clean 을 확인한 뒤
2차 실행한 결과가 위 수치(87/81/14)로 1차(88/80/14)와 사실상 동일했다 —
**1차의 후반부 실패 급증은 오염이 아니라 무거운 spec(model-flow / selectable-table / verify-ui)이
알파벳 순서상 뒤에 몰려 스케줄된 결과**였다. AC11 기준선은 clean 트리에서 얻은 2차 결과를 쓴다.

---

## 자율 확정 결정 기록

Plan 이 Implement 로 위임한 항목과, 구현 중 발견해 해석 우선순위
(Plan 결정 > SPEC 본문 > 기존 코드 컨벤션)로 자율 확정한 항목.

| # | 항목 | 결정 | 근거 |
|---|---|---|---|
| I1 | (D6) `dlqDashboard` prefetch | 기존 dlq 4종 prefetch 재사용 | `DashboardPanel.tsx:168-171` 이 첫 mount 에서 `useGatewayDlq()` / `useBusinessDlq()` / `useQuarantine()` / `useRepairTasks()` 를 그대로 호출 — Plan D6 의 "실측 결과 4종 집계면 위 4 prefetch 재사용" 분기에 해당 |
| I2 | (D6) `userGroups` prefetch | 배선함. `groupQueryKeys.list(0, GROUP_PAGE_SIZE)` + `groupApi.getGroupList(0, GROUP_PAGE_SIZE)`, staleTime 30_000 | `GroupAdminPanel.tsx:31` = `useGroups(listOffset, GROUP_PAGE_SIZE)`, `group-ui.store.ts:31` listOffset 초기값 0, `useGroups.ts:9-12` queryKey/staleTime 실측. userUsers 승계 원칙과 동일(listOffset 0 가정) |
| I3 | (D7) 아이콘 3원칙 위반 여부 | Plan 후보표 **전건 채택, 대체 0건** | 22개 후보 아이콘이 설치된 `lucide-react@0.576` 에 전부 실재(파일 존재 검증). 직역/형태 비중복/16px 판독성 위반 없음 |
| I4 | (D5) 헤딩 이중 타이틀 | user-management 만 해당 → panel 쪽 축소 | 아래 §C6 참조 |

| I5 | 모바일 off-canvas 오버레이 색 | wm `bg-slate-950/45` → tc `bg-foreground/45` | SPEC Constraints "시각 토큰: ui-front coral/neutral (nori-client slate/blue 금지)". tc `index.css` 에 slate 팔레트 토큰 자체가 없다 |

> SHA 기입 규약: 슬라이스 N 의 커밋 해시는 슬라이스 N+1 의 dev-report 갱신에서 채운다
> (코드와 기록을 한 커밋에 묶으면 자기 해시를 미리 알 수 없기 때문). 마지막 슬라이스는 C7 최종 정리에서 채운다.

---

## C1 — `feat(ui): LNB 사이드바 프리미티브 이식 (R1)`

### 변경 파일
- 신설 `src/components/ui/sidebar-context.ts` — 쿠키명 `nori_tc_lnb_state`(wm `wm_lnb_state` 에서 tc 화),
  펼침 256px / rail 56px / 180ms / Ctrl+Cmd-B 상수 + `useSidebar()`
- 신설 `src/components/ui/sidebar.tsx` — shadcn Sidebar 축약 이식판 12 export
  (Provider/Sidebar/Header/Content/Group/GroupButton/RailButton/Menu/MenuItem/MenuButton/MenuLabel/Inset)
- 신설 `src/shared/hooks/useIsMobile.ts` — `useSyncExternalStore` + `md`(768px) 경계
- 수정 `src/index.css` — `.hover-scroll` 단일 클래스 추가

Plan §1 각주대로 sidebar 시각 토큰(`--sidebar*` 8종 / `--shadow-soft-lg` / `--z-dropdown`)은
tc `index.css` 에 이미 있어 CSS 추가는 `.hover-scroll` 뿐이다(F7 확인).

### 게이트
소비자는 C3 에서 붙는다 — 이 커밋의 게이트는 build + lint 다.

```
✓ built in 16.82s
=== LINT ===
> nori-tc-ui@0.0.0 lint
> eslint .
LINT_EXIT=0
```

---

## C2 — `feat(navigation): 2단 내비 정의·아이콘·i18n (R2/R3)`

### 변경 파일
- 수정 `src/shared/lib/app-navigation.ts` — 확정 표 그대로 6 그룹 / 16 항목 트리 +
  `resolveVisibleAppNavigationGroups` / `isAppNavigationRouteActive` / `resolveAppNavigationLocation` 추가.
  구 `APP_TOP_NAVIGATION_ITEMS` / `resolveVisibleAppNavigationItems` 는 **의도적으로 잔존**
  (AppTopBar 가 아직 소비 — C4b 에서 제거). Plan C2 명시
- 신설 `src/shared/lib/app-navigation-icons.ts` — `Record<ItemKey|GroupKey, LucideIcon>` 2 종
- 수정 `src/i18n/locales/{ko,en,vi}.json` — 각 30 키 추가(`navigation.*` 27 + `accessDenied.*` 3),
  3 언어 모두 1096 키로 parity 유지. 기존 키 재포맷 0 (`git diff --numstat` = 31 삽입 / 1 삭제 ×3)
- 신설 `tests/unit/app-navigation-visibility.test.ts` — AC3 권한 필터 게이트 8 테스트

### 결정
- 권한 바인딩은 **값 문자열** 기준. Live-Map 은 `DASH_READ_PERMISSION`(값 `'LIVE_MAP_READ'`,
  `permission.ts:5`) — 테스트가 `groupKeys(['DASH_READ']) === []` 로 상수명 오바인딩을 음성 단언한다
- TC 고유명(Live-Map / SECS / Socket / PLC / Business / Gateway / Repair Task / Gateway DLQ /
  Business DLQ / Model)은 ko/en/vi 전 언어 영어 — `i18n-vi-parity.test.ts` AC3 Tier A 토큰 규칙과 정합
- 그룹 en/vi 신규 번역: 처리실패=`Processing Failures`/`Lỗi xử lý`, 적용=`Deployment`/`Triển khai`,
  모니터링=`Monitoring`/`Giám sát`, 설비=`Equipment`/`Thiết bị`, 시스템=`System`/`Hệ thống`.
  모델 그룹은 `Model` 이 Tier A 토큰이라 en/vi 모두 `Model` 유지
- 고아 키 정리(`dlq.sidebar.*` 등)와 `i18n-vi-parity` 키 치환은 Plan D11/F2 대로 **C5** 에서 수행
  (해당 사이드바가 아직 살아 있어 지금 지우면 런타임에서 키가 깨진다)

### 게이트 (build + lint + test:unit)

```
✓ built in 15.64s
=== LINT ===
> nori-tc-ui@0.0.0 lint
> eslint .
=== UNIT ===
1..240
# tests 240
# pass 240
# fail 0
```

---

## C3 — `feat(navigation): AppLnbSidebar/Flyout + route-modules (R4/R8)`

### 변경 파일
- 신설 `src/app/route-modules.ts` — 6 lazy 페이지 loader + 24 경로 매핑
  (16 확정 라우트 + `/` + `/login` + 구경로 6종)
- 신설 `src/shared/components/AppLnbFlyout.tsx` — body portal 플라이아웃, caret 2겹,
  투명 브릿지(`pl-3`), Esc 닫기, autoFocus. `react-router-dom` → `react-router` 조정
- 신설 `src/shared/components/AppLnbSidebar.tsx` — 그룹 아코디언(닫은 그룹만 기억) /
  rail hover·클릭 플라이아웃(닫힘 지연 180ms) / 모바일 내비 시 off-canvas 닫기 /
  D6 prefetch 2계열

### D6 prefetch 배선 (실측 근거)

| 항목 | prefetch |
|---|---|
| liveMap | `['live-map']` getLiveMap, 5_000 |
| dlqDashboard | **gateway/business/quarantine/repair-task 4종** — `DashboardPanel.tsx:168-171` 이 자체 query 없이 그 4 훅을 mount 해 집계 (I1) |
| dlqGateway / dlqBusiness / dlqQuarantine / dlqRepairTask | 각 `['dlq', <mode>]`, 30_000 |
| eqpBusiness / eqpGateway | `eqpQueryKeys.list()` getEqpList(0,500), 60_000 |
| modelSecs / modelSocket / modelPlc | `modelQueryKeys.list()` getModelList(0,500), 60_000 |
| userUsers | `userQueryKeys.list(0, USER_PAGE_SIZE)`, 30_000 |
| userGroups | **배선함** `groupQueryKeys.list(0, GROUP_PAGE_SIZE)` getGroupList, 30_000 (I2) |
| deployRegister / deployDeploy / deployHistory | 제외 — 구 topbar 사유 주석 승계 |

라우트 청크 preload 는 `preloadRouteModule` 로 항목 `onPointerEnter`/`onFocus`/`onTouchStart`,
rail 버튼 `onFocus` 는 그룹 항목 전체. 전환은 `startTransition(() => navigate(route))`.

### 배선 지점 결정
- prefetch switch 는 별도 파일로 빼지 않고 `AppLnbSidebar.tsx` 안에 둔다 — 구
  `AppTopBar.tsx:43-98` 의 `prefetchByMenuKey` 와 같은 자리·같은 형태다(기존 컨벤션 답습).
  덤으로 AC12 의 두 토큰이 모두 이 파일에 실재하게 된다
- 펼침 항목 링크에 `data-testid="lnb-item-<itemKey>"` 부여 — 신설 e2e(C7)가 locale 과 무관하게
  16 항목을 집을 수 있게 한다(기존 사이드바 testId 컨벤션 답습)

### 게이트 (build + lint — 셸 배선은 C4b)

```
✓ built in 15.79s
=== LINT ===
> nori-tc-ui@0.0.0 lint
> eslint .
```

AC12 선확인: `grep -c "prefetchQuery\|preloadRouteModule"` → `AppLnbSidebar.tsx:15` / `AppLnbFlyout.tsx:0`
(합계 15건 ≥ 1건).

---

## C4a — `feat(routing): 16 라우트 + 리다이렉트 + URL 단일 진실 원천 (R5)`

구 topbar 와 구 도메인 사이드바를 **유지한 채** 라우팅만 전환했다(Plan L1 완화) — 사이드바 클릭이
`navigate` 가 되어 화면 동작은 그대로다. 셸 교체는 C4b.

### 변경 파일
- `src/app/RequireAuth.tsx` — children → **Outlet layout route**
- `src/app/Router.tsx` — 16 정적 라우트 + 리다이렉트 8종(구경로 6 + `/`·`*`),
  `lazy()` 가 `route-modules` 의 loader 를 공유, 모듈 상단 `preloadRouteModule(location.pathname)`
- `src/features/dlq/components/DlqPage.tsx` — `mode` prop 수신, 모드 전환 = `navigate('/dlq/'+mode)`
- `src/features/user-management/components/UserManagementPage.tsx` — `mode` prop,
  `MODE_SEGMENT` 표(`user→users` / `group→groups`)로 navigate
- `src/features/deploy/components/DeployPage.tsx` — `mode` prop, navigate 전환
- `src/features/deploy/stores/deploy-ui.store.ts` — `mode` / `setMode` / `activateMode` 제거,
  내부 `set({mode})` 3곳 제거
- `src/features/deploy/components/DeployRegisterPanel.tsx` — `moveToNextMode` 가 navigate,
  `createServerDeployBridge({activateMode:false})` 인자 제거
- `src/features/deploy/components/DeployMonitorPanel.tsx` — `setMode('deploy')` 2곳 → `navigate('/deploy/deploy')`
- `src/features/eqp/components/EqpPage.tsx` — `EqpScope` 타입 + `scope` prop + URL→store 보정 effect,
  Business/Gateway 전체선택 핸들러가 navigate
- `src/features/model/components/ModelPage.tsx` — 로컬 `selectedInterfaceGroup` state 제거 →
  `scope` prop, `handleSelectInterfaceGroup` 이 navigate
- `src/features/auth/hooks/useLogin.ts` — `LOGIN_ENTRY_ROUTE` `/eqp/live-map` → `/live-map` (D9)
- 삭제 `src/features/dlq/stores/dlq-ui.store.ts`, `src/features/user-management/stores/user-management-ui.store.ts`
- `tests/unit/route-auth-guard.test.ts`, `tests/unit/logout-client-state-cleanup.test.ts` — 구조 변경 반영

### 자율 확정 (Plan 밖 발견)

| # | 항목 | 결정 |
|---|---|---|
| I6 | **단위 테스트 3건이 C4a 구조 변경으로 깨짐** (Plan §6.4 는 `i18n-vi-parity` 만 열거) | 삭제하지 않고 **의도 보존 + 단언 이관**. `route-auth-guard.test.ts` 의 "`<RequireAuth>` 6개" 카운트는 layout route 로는 성립하지 않으므로, **16 보호 라우트가 가드 블록 안쪽 오프셋에 있는지**를 직접 단언하는 더 강한 형태로 바꿨다(개수만 세면 가드 블록 *밖* 에 라우트를 새로 달아도 통과). `logout-client-state-cleanup.test.ts` 는 가드 매칭을 `<Route element={<RequireAuth />}>` 로 갱신. 구 경로 리다이렉트 6종이 가드 **밖** 인지도 함께 단언 |
| I7 | EqpPage 보정 effect 의 무한 루프 위험 | selection 을 렌더 클로저가 아니라 `useEqpUiStore.getState()` 로 읽어 **scope 변경 시에만** 실행. selection 을 의존성에 넣으면 기존 "선택 정합성" effect(빈 그룹이면 `clearSelection`)와 서로를 되돌리는 루프가 된다 |
| I8 | ModelPage 의 "선택 없음 빈 화면" 분기 | 스코프가 URL 로 항상 정해지므로 `selectedModelVersionKey === null` 이 곧 "스코프 목록 표시" 다. 구 `selectedInterfaceGroup !== null` 분기와 구 빈 화면 분기가 **같은 조건**이 되어 둘을 병존시킬 수 없으므로 스코프 목록 쪽으로 합쳤다(빈 화면 제거). dead path 보존 룰의 대상이 아니다 — 조건이 사라진 것이 아니라 하나로 합쳐졌다 |
| I9 | `createLocalDeploy` 는 호출처 0건 (기존 dead code) | 언급만 하고 삭제하지 않는다. `mode` 필드가 사라져 `set({mode:'deploy'})` 한 줄만 제거했다(제거하지 않으면 컴파일 실패) |

### Plan L2 재확인 — deploy store 밖 mode 소비 0건

```
$ grep -rn "state\.mode\|setMode" src/features/deploy
(0건)
```

### 게이트

```
$ npx tsc -b
(무출력 — 통과)

$ npm run build
✓ built in 16.62s

$ npm run lint
> eslint .            (무출력 — 통과)

$ npm run test:unit
# tests 240
# pass 240
# fail 0
```

### 수동 스모크 (Plan C4a 요구) — 라우팅 영향 spec 3개 실측

```
  3 failed
    [chromium] › tests\e2e\group-page.spec.ts:357:1 › Group-AC-1 / Group-AC-2: /user 사이드바 Group 클릭 시 그룹 패널 활성화
    [chromium] › tests\e2e\group-page.spec.ts:478:1 › Group-AC-8a: 권한 없는 사용자는 User 메뉴 미표시 (Group 사이드바 자체에 도달 불가)
    [chromium] › tests\e2e\user-page.spec.ts:338:1 › topbar User 클릭 시 /user 로 라우팅
  24 passed (58.7s)
```

- `/dlq` 딥링크 → `/dlq/dashboard` 리다이렉트 후 패널 렌더, 사이드바 클릭 모드 전환까지
  `dlq-page.spec.ts` 7건 전부 통과 (C4a 스모크 목표 충족)
- group-page 2건은 **baseline 에서도 실패**하던 사전 실패다(C0 표 참조)
- `user-page.spec.ts:338` 은 baseline PASS 였고 이번에 깨졌다 — 원인은 Plan F9 가 예고한
  URL 단언(`/\/user$/` → 실제 `/user/users`)이다. **C7(R12 §6.3)에서 갱신할 계획된 파급**이며
  기능 회귀가 아니다. AC11 최종 판정은 C7 이후 전체 재실행으로 한다

### e2e 파일의 git 추적 상태 (R12 범위에 영향)

`.gitignore:20` 이 `/tests/e2e/` 를 제외한다 — **e2e 스펙은 git 추적 대상이 아니고 로컬 전용**이다
(`git ls-files tests/` = 40건, 전부 `tests/unit` + 헬퍼 2). 따라서 C7 의 신설
`tests/e2e/wm-parity-sidebar.spec.ts` 와 §6 갱신분은 커밋 diff 에 나타나지 않는다.
AC4 / AC11 은 로컬 실행 결과 인용으로만 판정 가능하다(Validate 세션도 로컬 재실행 필요).

(커밋 진행에 따라 계속 추가)
