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
| C4a | `feat(routing): 16 라우트 + 리다이렉트 + URL 단일 진실 원천 (R5)` | 완료 | `2000a6c` |
| C4b | `feat(shell): LNB 셸 전환 — topbar 개편 + RequirePermission (R6/R7/R11)` | 완료 | `2b08643` |
| C5 | `refactor(sidebar): 도메인 사이드바 재편 (R9)` | 완료 | `585da64` |
| C6 | `feat(layout): AppPageHeading + PageLayoutShell wm 판 (R10)` | 완료 | `c1a73c9` |
| C7 | `test(e2e): wm-parity-sidebar 스펙 신설 + 기존 갱신 (R12)` | 완료 | `537bd6c` |

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

---

## C4b — `feat(shell): LNB 셸 전환 — topbar 개편 + RequirePermission (R6/R7/R11)`

### 변경 파일
- 신설 `src/shared/components/AccessDeniedNotice.tsx` (`data-testid="access-denied-notice"` 부여 —
  AC4 의 권한 미보유 단언이 locale 무관하게 집도록)
- 신설 `src/app/RequirePermission.tsx` — `meQuery.isPending` 로딩 분기 승계, 미보유 시
  `AppShellPage > AccessDeniedNotice`
- 신설 `src/shared/components/AppShellPage.tsx` — 프로필 모달 소유 + 로그아웃 체인 합성(D3/D4)
- 교체 `src/shared/components/AppPageShell.tsx` — `SidebarProvider > AppLnbSidebar + SidebarInset >
  (AppTopBar + content)`, `currentMenu` prop 소멸
- 개편 `src/shared/components/AppTopBar.tsx` — 중앙 nav / 로고 / 구 prefetch switch 제거,
  모바일 토글 + `PageLocation` breadcrumb 추가, 오프셋 상수 폐기
- `src/shared/lib/app-navigation.ts` — 구 `APP_TOP_NAVIGATION_ITEMS` /
  `resolveVisibleAppNavigationItems` / `AppTopNavigationKey` 제거
- `src/app/Router.tsx` — 권한 그룹별 `RequirePermission` 5+1 블록 중첩
- 6 페이지 → `AppShellPage` 전환 + 페이지 자체 권한 게이트 제거
  (Dlq / UserManagement / Deploy / LiveMap / Eqp / Model)
- 3 store 프로필 필드 제거 (`eqp-ui` / `deploy-ui` / `model-ui`) — D4
- `tests/unit/eqp-model-deploy-permission-gating.test.ts`, `tests/unit/route-auth-guard.test.ts` 갱신

### D3 로그아웃 체인 (순서·정리 항목 보존 확인)

- `AppShellPage.onAfterLogout` = 페이지별 정리(prop) → `authApi.logout()`(try/catch 로 실패 무시)
- `AppTopBar.handleLogout` = `onAfterLogout?.()` → finally { `queryClient.clear()` →
  `clearPersistedQueryCache()` → `clearDeployUiSessionState()` → `clearCsrfCookie()` → navigate }
- 정리 항목 4종과 순서가 구 구현과 동일하다 — `logout-client-state-cleanup.test.ts` 의
  handleLogout 본문 정규식 단언 3건이 그대로 통과한다(무수정)

### 자율 확정 (Plan 밖 발견)

| # | 항목 | 결정 |
|---|---|---|
| I10 | `eqp-model-deploy-permission-gating.test.ts` 가 제거된 `resolveVisibleAppNavigationItems` 를 import 하고 페이지 내 `<Navigate to=` 를 단언 | 게이트 자리 이동에 맞춰 **이관**. 메뉴 필터는 `resolveVisibleAppNavigationGroups` 로, 본문 차단은 "Router 가 각 라우트를 올바른 권한 코드의 `RequirePermission` 블록 안에 두는지" 로 단언. 추가로 `RequirePermission` 이 `<Navigate` 를 쓰지 **않는지** 음성 단언해 "/login 튕김" 회귀를 막는다 |
| I11 | `route-auth-guard.test.ts` 의 가드 블록 끝 탐색이 중첩 라우트에서 오작동 | `</Route>` 첫 등장으로 끝을 잡으면 안쪽 `RequirePermission` 블록에서 끊긴다. 여는 태그의 `>` 를 **JSX 중괄호 깊이를 세며** 찾는 스캐너로 교체(정규식 `[^>]*` 는 `element={<RequireAuth />}>` 에서 오판) |
| I12 | AppTopBar 주석이 AC6 grep 을 오염 | 주석에 `APP_TOP_BAR_OFFSET_CLASS` 식별자를 적으면 `grep -rn ... src` 가 1건이 된다. 식별자 없이 서술로 바꿔 0건 유지 |

### AC 판정 (C4b 소관 4건)

```
=== AC5  grep -c "navigationItems.map" src/shared/components/AppTopBar.tsx ===
0
=== AC6  grep -rc "APP_TOP_BAR_OFFSET_CLASS" src ===
0건
=== AC10 grep -c "AppLnbSidebar" src/shared/components/AppPageShell.tsx ===
2
=== AC12 grep -c "prefetchQuery\|preloadRouteModule" src/shared/components/AppLnbSidebar.tsx ===
15
```

### 게이트

```
$ npm run build
✓ built in 17.76s

$ npm run lint
> eslint .            (무출력 — 통과)

$ npm run test:unit
# tests 241
# pass 241
# fail 0
```

### 실화면 확인 (메모리 룰 — 시각 변경은 스크린샷으로 직접 본다)

임시 spec 으로 `/dlq/dashboard` 를 mock 백엔드에 붙여 렌더하고 두 상태를 촬영해 확인했다
(확인 후 spec·PNG 삭제).

- **펼침 256px**: 6 그룹 아코디언 + 항목 아이콘, 현재 항목(`Failure Dashboard`) 활성 강조,
  topbar 중앙 nav 소멸 + `Home › Processing Failures › Failure Dashboard` breadcrumb,
  우측 유틸리티(Line / 테마 / 언어 / 로그아웃 / 프로필) 보존
- **접힘 rail 56px + 플라이아웃**: 그룹 아이콘 6개만 남고, hover 시 body portal 플라이아웃이
  caret 과 함께 그룹 5항목을 띄우며 현재 항목이 활성 표시된다
- 콘솔 오류는 mock 하지 않은 `/api/eqp` prefetch 의 ECONNREFUSED 500 1건뿐 —
  LNB hover prefetch 가 실제로 발화한다는 증거이기도 하다(백엔드 미기동 환경 특성)
- 이 시점에는 DLQ 도메인 사이드바가 아직 함께 보인다 — **C5 에서 제거**한다

### e2e mock 함정 (C7 신설 spec 작성 시 반드시 회피)

진단 중 `page.route('**/api/**', …)` 가 **Vite dev 모듈 요청까지 가로채** 화면이 백지가 되는
현상을 겪었다(`/src/features/dlq/api/dlq.api.ts` 같은 경로가 `**/api/**` 에 걸려 JSON 이 돌아오고
`Failed to load module script … MIME type "application/json"` 로 모듈 로드 실패). 기존 spec 들이
엔드포인트를 하나씩 route 하는 이유다 — **catch-all `**/api/**` 금지**.

---

## C5 — `refactor(sidebar): 도메인 사이드바 재편 (R9)`

### 변경 파일
- 삭제 `DeploySidebar.tsx` / `DlqSidebar.tsx` / `UserManagementSidebar.tsx` (AC8)
- `DlqPage` / `UserManagementPage` / `DeployPage` — 사이드바 제거에 따라
  `useSharedLayoutStore` 4 구독 + `handleSidebarDrag` 소비 제거(store 자체는 Eqp/Model 이 계속 사용)
- `EqpSidebar.tsx` — Business/Gateway 아코디언 헤더와 `businessOpen`/`gatewayOpen` state 제거,
  `scope` prop 으로 해당 스코프 트리만 렌더. **Eqp Create ContextMenu 를 gateway 트리 컨테이너로 이설**
- `ModelSidebar.tsx` — SECS/Socket/PLC 섹션 헤더와 3 open state 제거, `scope` prop 으로 해당
  인터페이스 root 트리만 렌더. **Model Create ContextMenu 를 트리 컨테이너로 이설**
- `src/shared/layout/lnb-sidebar.ts` — `lnbFlatNavClass` 제거(F6 고아), `LNB_BUTTON_RESET` 추가
- `src/i18n/locales/{ko,en,vi}.json` — 고아 키 17개 ×3 언어 제거 (1096 → 1079)
- `tests/unit/i18n-vi-parity.test.ts` — F2 키 치환 + vacuous pass 차단 단언 추가

### AC7 — raw `<button>` 0 수렴 방법

foundation 이 남긴 18건은 전부 5 개 도메인 사이드바 안에 있었다. 3 사이드바 파일 제거로 6건,
Eqp/Model 헤더 제거로 3건이 사라지고, **남은 9건을 `<Button>` 으로 수렴**했다
(Eqp: 트리 노드 / 접기·펼치기 2 / business 하위 링크 / gateway 그룹 토글,
Model: branch / root / 접기·펼치기 2).

수렴 시 시각이 바뀌지 않게 `lnb-sidebar.ts` 의 3 헬퍼에 `LNB_BUTTON_RESET = 'h-auto justify-start'`
를 넣었다 — `<Button>` 의 `size` 가 `h-9` 를, base 가 `justify-center` 를 걸어 패딩 기반 높이와
좌측 정렬이 깨지기 때문이다(twMerge 는 나중 클래스가 이긴다). 접기/펼치기 아이콘 버튼은
`variant="ghost"` + 기존 className 유지 + `p-0` 로 원래 32px 정사각을 지켰다.

### 자율 확정 (Plan 밖 발견)

| # | 항목 | 결정 |
|---|---|---|
| I13 | **`DeployPage` 언마운트 정리가 모드 전환마다 발화** — 모드가 라우트로 갈리고 `Router` 가 `ErrorBoundary key={pathname}` 라서 `/deploy/register` → `/deploy/deploy` 이동이 remount 다. 구 구조(`/deploy` 단일 라우트 + store mode)에서는 deploy 구역을 **떠날 때만** 발화하던 `clearDeployUiSessionState()` 가 이제 구역 안 이동에도 돌아 방금 만든 배포의 `activeDeployKey`/`localHistory` 를 지운다(C4a 가 들여온 회귀) | cleanup 에서 `window.location.pathname.startsWith('/deploy')` 로 **구역을 벗어날 때만** 정리. cleanup 시점의 `window.location` 은 이미 다음 경로다(history 갱신 → 리렌더 → cleanup) |
| I14 | 같은 remount 특성 때문에 `ModelPage` 의 store 선택이 스코프를 건너 살아남음 — SECS 에서 모델을 고르고 Socket 으로 가면 Socket 트리에 없는 모델의 버전 목록이 그려진다 | `scope` 변경 effect 로 store 선택만 정리(구 섹션 헤더 클릭이 하던 것과 동일). React 로컬 상태는 remount 로 이미 초기화되므로 건드리지 않는다 — 처음엔 `setCheckInErrorMessage(null)` 도 넣었다가 `react-hooks/set-state-in-effect` 경고 + 중복이라 제거했다 |
| I15 | ModelSidebar 우클릭 메뉴 문안 | `scope` 는 `'SOCKET'` 대문자라 그대로 쓰면 `SOCKET Model Create` 가 된다. `SCOPE_TITLE` 표로 표기를 `Socket` 으로 유지 — `verify-ui/overlays-model-tree.spec.ts:53` 이 `'Socket Model Create'` 문자열로 집는다 |
| I16 | `i18n-vi-parity.test.ts` AC2 의 vacuous pass | 키를 `navigation.item.*` 로 치환하는 데 그치지 않고 `assert.ok(enMap[key])` 존재 단언을 추가했다 — 다음에 또 키가 사라지면 `undefined === undefined` 로 조용히 통과하지 않고 실패한다(F2 의 근본 원인) |

### L7 게이트 — i18n 키 제거 전 소비처 0건 확인

```
$ grep -rn "deploy\.sidebar\." src tests | grep -v locales/   →  0건
$ grep -rn "userMgmt\.sidebar\." src tests | grep -v locales/ →  0건
$ grep -rn "dlq\.sidebar\." src tests | grep -v locales/      →  i18n-vi-parity.test.ts 3건(=F2, 같은 커밋에서 치환)
```

`eqp.sidebar.*` / `model.sidebar.*` 는 타이틀 바·검색·접기가 존치하므로 유지했다.

### AC 판정 (C5 소관 2건)

```
=== AC7  grep -rn "<button" src/features ===
(0건)
=== AC8  git ls-files <3 사이드바 파일> ===
lines=0
=== 부수 확인: lnbFlatNavClass 잔존 ===
0건
```

### 게이트

```
$ npm run build
✓ built in 16.48s

$ npm run lint
> eslint .            (무출력 — 통과)

$ npm run test:unit
# tests 241
# pass 241
# fail 0
```

### 실화면 확인

임시 spec + mock 으로 `/eqp/gateway` 와 `/model/secs` 를 촬영해 확인했다(확인 후 삭제).

- **EqpSidebar**: Business/Gateway 헤더가 사라지고 타이틀 바 + 검색 + gateway 트리만 남았다.
  `gateway_app1` 그룹 노드가 좌측 정렬·소형 타이포로 정상 렌더되고, 선택 시 coral 좌측 액센트 +
  `bg-muted` 가 그대로 적용된다 — `<Button>` 수렴이 시각을 바꾸지 않았음을 확인
- **ModelSidebar**: SECS/Socket/PLC 섹션 헤더가 사라지고 타이틀 바 + 검색 + 스코프 트리만 남았다
- 두 화면 모두 `console.error` / `pageerror` 0건
- **미확인 남음**: leaf 노드(`lnbLeafClass`) 는 mock 그룹핑이 설비를 붙이지 못해 이 스냅샷에
  나오지 않았다. 같은 `LNB_BUTTON_RESET` 을 쓰는 sub-link 가 정상임을 확인했고, leaf 를 실제로
  클릭하는 e2e(`selectable-table-gateway-group` / `plc-model-tree` / `model-flow`)가 C7 스윕에서
  판정한다

---

## C6 — `feat(layout): AppPageHeading + PageLayoutShell wm 판 (R10)`

### 변경 파일
- 신설 `src/shared/layout/page-heading-styles.ts` — `min-h-21` 높이 계약(foundation R9 보류분)
- 신설 `src/shared/layout/AppPageHeading.tsx` — 아이콘을 LNB 정의에서 자동 유도
- 교체 `PageHeading.tsx` / `PageHeadingWithActions.tsx` — wm 판(아이콘 틀 박스 + 높이 계약)
- 교체 `PageLayoutShell.tsx` — wm 판. `bread` prop 제거(breadcrumb 은 topbar 소관),
  `heading.icon` 제거(자동 유도)
- 6 라우트 페이지에 `AppPageHeading` 배선 (AC9)
- `src/dev/LayoutShellFixture.tsx` — `bread` / `heading.icon` 소비 2곳 갱신
- `UserAdminPanel.tsx` / `GroupAdminPanel.tsx` — D5 이중 타이틀 해소
- `src/i18n/locales/{ko,en,vi}.json` — 고아가 된 `user.title` / `group.title` 제거 (1079 → 1077)

### 자율 확정

| # | 항목 | 결정 |
|---|---|---|
| I17 | `AppPageHeading` 의 `name` prop | **선택으로 완화**하고 생략 시 현재 경로의 LNB 항목 라벨을 쓴다. Plan D5 는 "name = `t(navigationLocation.item.labelKey)`" 를 요구하는데, 그대로 두면 6 페이지가 각자 `useLocation` + `resolveAppNavigationLocation` + `t()` 를 반복한다. 컴포넌트가 이미 같은 값을 아이콘 유도에 쓰고 있으므로 라벨도 거기서 뽑는다 — 아이콘과 같은 이유로 "페이지가 제목을 따로 소유하면 LNB 와 갈라진다". 제목을 못 정하는 경로(LNB 밖 + name 미지정)는 빈 `h1` 대신 `null` 을 반환 |
| I4 확정 | (D5) 이중 타이틀 실측 | `/user/users` 의 `<h1>` 목록이 실제로 `["Users","User Management"]` 2건이었다(스크립트 단언으로 확인). **panel 쪽 h1 제거** — `PageHeadingWithActions` 를 설명 + 총건수 Badge + 액션 버튼 한 줄로 축소했다. 정보 손실 0(설명·건수·`user-create-button`/`group-create-button` testId 모두 보존), 수정 후 `<h1>` = `["Users"]` 1건 |
| I18 | `user.title` / `group.title` i18n 키 | panel h1 제거로 소비처 0 → ko/en/vi 에서 제거(L7 규칙: 키 제거 전 `grep` 0건 확인). e2e 주석 3곳이 이 키를 *언급*하지만 참조가 아니라 설명문이고, 해당 스펙은 이미 locale 무관 testId 로 단언한다 |

### AC9 판정

```
$ grep -rl "AppPageHeading\|PageLayoutShell" <6 라우트 페이지>   →  6
$ grep -c "AppPageHeading" src/shared/layout/PageLayoutShell.tsx →  3
```

### 게이트

```
$ npm run build
✓ built in 16.13s

$ npm run lint
> eslint .            (무출력 — 통과)

$ npm run test:unit
# tests 241
# pass 241
# fail 0
```

### 실화면 확인 + 남은 소견 (Validate 판단 요청)

- `/user/users`: 아이콘 + `Users` h1 → 설명 + 건수 Badge + `Add user` → User List 카드.
  중복 제목 해소 확인
- `/dlq/gateway`: 페이지 h1 `Gateway DLQ` 아래 **패널 카드 헤더도 `Gateway DLQ`** 로 문구가 겹친다.
  다만 이건 `PageHeading*` 소비가 아니라 카드 헤더(건수 Badge / 최종 갱신 시각 / 검색 / Refresh 를
  같이 얹은 기능 블록)라 D5 의 축소 대상(F5 가 지목한 user/group 패널)에 들어가지 않고,
  SPEC Out of Scope("DLQ 5모드 화면 각각의 기능 개선 — 내비 승격만, 콘텐츠 불변")에 걸린다.
  **손대지 않고 남긴다** — 카드 헤더 문구 정리가 필요하면 별도 결정으로 진행할 사항

---

## C7 — `test(e2e): wm-parity-sidebar 스펙 신설 + 기존 갱신 (R12)`

> **git 추적 밖**: `.gitignore:20` 이 `/tests/e2e/` 를 제외한다. 아래 e2e 변경은 로컬 파일에만
> 존재하고 이 커밋의 diff 에는 나타나지 않는다(커밋에 담기는 것은 이 dev-report 와 C7 에서
> 발견해 고친 **src 수정 3건**뿐이다). Validate 세션은 로컬에서 재실행해 확인해야 한다.

### 신설 — `tests/e2e/wm-parity-sidebar.spec.ts` (25 테스트)
- 16 라우트: 최종 URL + `<h1>` 렌더 + 해당 LNB 항목의 `aria-current="page"` (라벨 텍스트가 아니라
  속성으로 봐서 locale 무관)
- 리다이렉트 8종: `/dlq` `/deploy` `/user` `/eqp` `/model` `/eqp/live-map` + `/` `*`
- 권한 미보유(EQP_READ 만): `/dlq/dashboard` 에서 `access-denied-notice` 렌더 + URL 유지 +
  권한 없는 LNB 항목 부재 + 있는 항목 존재
- 전 테스트 `console.error` 0 AND `pageerror` 0

**mock 은 `url.pathname.startsWith('/api/')` 술어로 건다** — `'**/api/**'` glob 은 Vite dev 의
모듈 요청(`/src/features/dlq/api/dlq.api.ts`)까지 삼켜 화면이 백지가 된다(C4b 진단에서 실증).

### 갱신 — 기존 스펙 (Plan §6 + 실행에서 추가 발견)

| 분류 | 대상 | 처리 |
|---|---|---|
| §6.1 제거 testId 7파일 18건 | `dlq-sidebar-*` / `user-management-sidebar-*` / `deploy-sidebar-*` | 가시성 단언은 `lnb-item-*` 로, 모드 전환 클릭은 신 라우트 `goto` 로 (15건) |
| §6.2 헤더 role-button 16파일 | `getByRole('button', {name:'Gateway'\|'Business'\|'SECS'\|'Socket'\|'PLC', exact:true})` | 클릭 22건 → 스코프 라우트 `goto`, 로케이터 참조 4건 → `lnb-item-*` |
| §6.3 URL 단언 4곳 | `group-page:366` / `user-page:347` / `verify-ui/routes.spec` 라우트 표 / `verify-ui/_shared:232` | 신 최종 URL 로 갱신. `routes.spec` 의 `AUTHENTICATED_ROUTES` 는 6 → **16 라우트로 확장** |
| **Plan 밖 추가 발견 (실행에서 드러남)** | `locator('aside button', {hasText:'Gateway'})` 4파일 (`eqp-line-select` / `modal-visual-sweep-eqp` / `plc-eqp-form` / `plc-eqp-polling-group`) | §6.2 가 잡은 `getByRole` 형태와 문법이 달라 목록에 없었다. Gateway 스코프 진입은 `goto('/eqp/gateway')`, Eqp Create 우클릭은 `eqp-sidebar-gateway-tree` 컨테이너로 |
| **Plan 밖 추가 발견** | `getByRole('complementary').getByRole('button', {name:'배포'\|'Deploy'})` 2파일 (`deploy-monitor-view-modal` / `selectable-table-deploy-monitor`) | 삭제된 DeploySidebar(`<aside>`) 클릭 → `goto('/deploy/deploy')` |
| **Plan 밖 추가 발견** | 권한 미보유 차단 단언 2건 (`group-page` Group-AC-8b / `user-page` `/user 직접 접근 차단`) | `toHaveURL(/(login\|forbidden\|eqp)/)` → `access-denied-notice` 렌더 (R11 의 **의도된 동작 변경**: /login 튕김 폐기) |

### C7 에서 발견해 고친 **src** 회귀 3건 (실측 → 수정 → 재검증)

전체 스윕 1차에서 baseline PASS 11건이 떨어졌다. `--workers=2` → `--workers=1` 로 좁혀
**4건이 직렬에서도 재현**됨을 확인하고(= 플레이크 아님) 원인을 실측했다.

| # | 증상 | 실측 원인 | 수정 |
|---|---|---|---|
| I19 | `live-map-flow-groups` "그룹 추가" 가 `expect(336).toBeGreaterThan(336)` 로 실패 (리사이즈 드래그가 0px) + "드래그&드롭" 이 노드 미발견 | `<AppPageHeading />`(min-h-21 + border-b + gap-4)를 `LiveMapHeader` 위에 **쌓아** 캔버스 세로 공간을 ~84px 빼앗았다. 이 화면은 보드 높이가 fit 스케일을 정하고, 리사이즈 핸들이 뷰포트 밖으로 밀려 합성 드래그가 핸들에 닿지 않았다 | 헤딩을 `className="min-h-0 gap-0 border-b-0 pb-0"` 로 컴팩트화하고 `LiveMapHeader` 의 중복 제목 줄을 제거해 **순 증가 0**으로 맞췄다(Plan D5 의 "3D 풀블리드 훼손 없게 컴팩트 배치" 이행) |
| I20 | `live-map-3d-undo-counts` 가 90s 타임아웃 — `live-map-3d-undo` 클릭이 `absolute left-4 top-4 … flex-wrap` 패널에 **intercepted** | 전역 LNB 가 본문 폭을 256px 가져가면서 좌측 편집 패널이 더 넓게 wrap 해 같은 `top-4` 줄의 우측 컨트롤 클러스터(Undo/Save) 아래로 파고들었다 | 우측 클러스터를 `z-20` 으로 올려 히트 테스트를 이기게 하고, 좌측 편집 패널을 `top-4` → `top-16` 으로 내려 **시각 겹침까지** 해소(기존 `right-4 top-16` 상세 패널과 같은 줄). 스크린샷으로 두 툴바가 겹치지 않고 모든 컨트롤이 보이는 것을 확인 |
| I21 | (스펙 측) `live-map` 에 `<h1>` 2개 | `LiveMapHeader` 가 `livemap.title` 을 `<h1>` 로 그리고 있었다 — 내가 추가한 페이지 헤딩과 충돌 | I19 수정으로 그 제목 줄 자체를 제거해 해소(h1 1개) |

### AC4 판정 — PASS

```
$ npx playwright test tests/e2e/wm-parity-sidebar.spec.ts
  25 passed (43.1s)
```
최종 전체 스윕에서도 `wm-parity-sidebar.spec.ts` = `{"expected":25,"unexpected":0,"skipped":0}`.
각 테스트가 `console.error` / `pageerror` 배열을 `[]` 로 단언하므로 오류 0 게이트가 함께 걸려 있다.

### AC11 판정 — PASS (회귀 0)

최종 전체 스윕(`npx playwright test`, 로컬 워커 4):

```
  90 failed
  14 did not run
  113 passed (18.8m)
```

baseline 대조 (JSON 리포터 파싱):

```
baseline PASS: 87 | after total: 217

### baseline PASS 중 after 미통과 (회귀 후보): 0

### baseline PASS 중 after 에 이름이 없는 항목 (스펙 갱신으로 제목 변경/삭제): 0

### after 전체 집계: {"expected":113,"unexpected":90,"skipped":14}
```

- **baseline PASS 87건 전부 통과** → 회귀 0. D12 의 `--workers=1` 예외 조항을 쓸 필요가 없었다
  (3D 스펙 포함 전건이 워커 4 병렬에서 그대로 통과)
- 새로 통과 26건 = 신설 spec 25 + `group-page` Group-AC-1/AC-2(baseline FAIL 이었는데 로케이터
  갱신으로 살아남)
- 남은 90 실패는 baseline 81 + `verify-ui/routes.spec` 라우트 표 확장분(6→16 라우트라 실백엔드
  없이 실패하는 항목이 +10). 즉 **성격이 바뀐 실패는 없다**

### AC1 / AC2 / AC3 최종 재실행

```
$ npm run build
✓ built in 16.96s

$ npm run lint
> eslint .            (무출력 — 통과)

$ npm run test:unit
# tests 241
# pass 241
# fail 0
```

---

## AC 최종 자기 판정 (Validate 세션이 재검증할 대상)

| AC | 판정 | 근거 |
|---|---|---|
| AC1 `npm run build` | PASS | `✓ built in 16.96s` |
| AC2 `npm run lint` | PASS | eslint 무출력 (경고 0 · 오류 0) |
| AC3 `npm run test:unit` | PASS | 241/241. `resolveVisibleAppNavigationGroups` 권한 필터(항목 숨김 + 빈 그룹 숨김) 8 테스트 포함 |
| AC4 신설 e2e | PASS | 25/25 + console.error/pageerror 0 |
| AC5 `navigationItems.map` 0건 | PASS | grep 0 |
| AC6 `APP_TOP_BAR_OFFSET_CLASS` 0건 | PASS | grep 0 (주석 언급까지 제거) |
| AC7 `<button` in `src/features` 0건 | PASS | grep 0 |
| AC8 3 사이드바 파일 제거 | PASS | `git ls-files` 0줄 |
| AC9 6 페이지 헤딩 + PageLayoutShell 경유 | PASS | grep 6줄 / `AppPageHeading` 3건 |
| AC10 셸 배선 | PASS | `AppPageShell.tsx` 내 `AppLnbSidebar` 2건 |
| AC11 e2e 회귀 0 | PASS | baseline PASS 87 전건 통과 (부분 판정 불필요) |
| AC12 LNB prefetch 배선 | PASS | `AppLnbSidebar.tsx` 15건 |

SPEC 의 AC 체크박스 마킹은 **Validate 세션 소관**이라 이 세션에서 건드리지 않았다.

## 남은 소견 (Validate / 사용자 판단 요청)

1. **DLQ·Deploy 패널 카드 헤더 문구가 페이지 헤딩과 겹친다** — 예: `/dlq/gateway` 에서 페이지
   `h1 = Gateway DLQ` 아래 패널 카드 헤더도 `Gateway DLQ`. `PageHeading*` 소비가 아니라 건수·최종
   갱신 시각·검색·Refresh 를 얹은 기능 블록이고 SPEC Out of Scope("콘텐츠 불변")라 손대지 않았다.
2. **모델 스코프 목록으로 되돌아가는 수단** — 모델을 고르면 중앙이 그 모델의 버전 목록으로 바뀌고,
   같은 스코프 LNB 항목을 다시 눌러도 이미 활성이라 navigate 가 일어나지 않는다(wm 이식 동작).
   다른 스코프로 갔다 오면 초기화된다. Plan D2 가 `handleSelectInterfaceGroup` 제거를 명시해
   그대로 따랐고, 필요하면 별도 결정 사항이다.
3. **e2e 는 git 추적 밖**이라 AC4/AC11 은 커밋 diff 로 검증할 수 없다 — Validate 는 로컬 재실행 필요.

