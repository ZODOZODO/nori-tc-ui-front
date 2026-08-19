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
| C3 | `feat(navigation): AppLnbSidebar/Flyout + route-modules (R4/R8)` | 완료 | (이 커밋) |
| C4a | `feat(routing): 16 라우트 + 리다이렉트 + URL 단일 진실 원천 (R5)` | 대기 | — |
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

(커밋 진행에 따라 계속 추가)
