# SPEC: wm-parity-sidebar — topbar 메뉴의 전역 LNB 사이드바 전환 + 메뉴 트리 재구성

> wm-parity 트랙의 2/2. **선행 조건: `wm-parity-foundation.md` Validate 완료.**
> 메뉴 트리는 2026-08-18 사용자 확정안 (아래 표가 단일 진실 원천).
> 전 수치/구조는 분석 세션에서 실측 (tc/wm 두 레포 코드 직접 대조).

## Why

- 현재 전역 내비는 topbar 중앙의 flat 6항목 (`shared/lib/app-navigation.ts:20-27`,
  하드코딩 영어 라벨 + raw `<button>` 렌더 `AppTopBar.tsx:158-186`).
- 사용자 확정 방향: wm 의 좌측 LNB(2단 그룹>항목, 아코디언/rail/플라이아웃)로 전환하되,
  **기존 상위 메뉴는 sidebar-group 으로, 현재 각 페이지 도메인 사이드바의 1단계 항목을
  sidebar-menu-label 로 승격**하는 전면 재구성. 승격 대상은 실측으로 1:1 확인:
  - EqpSidebar 최상위 아코디언 = Business/Gateway (EqpSidebar.tsx:248,283)
  - ModelSidebar 최상위 섹션 = SECS/Socket/PLC (ModelSidebar.tsx:358-366)
  - DeploySidebar 3모드 = register/deploy/history (DeploySidebar.tsx:18-22)
  - DlqSidebar 5모드 = dashboard/gateway/business/quarantine/repair-task (DlqSidebar.tsx:18-24)
  - UserManagementSidebar 2모드 = User/Group (UserManagementSidebar.tsx:18-21)
- 각 menu-label 은 라우트가 된다 (사용자 승인) — 딥링크/새로고침 복원이 URL 로 가능해지고
  wm 의 `isAppNavigationRouteActive` 활성 판정 구조와 동형이 된다.

## 확정 메뉴 트리 (사용자 확정 2026-08-18 — 변경 금지, 변경 시 SPEC 재승인)

| 그룹 key | 그룹 라벨(ko) | 항목 key | 항목 라벨 | 라우트 | 권한 |
|---|---|---|---|---|---|
| monitoring | 모니터링 | liveMap | Live-Map | `/live-map` | LIVE_MAP_READ |
| dlq | 처리실패 | dlqDashboard | 장애 대시보드 | `/dlq/dashboard` | DLQ_READ |
| dlq | 처리실패 | dlqGateway | Gateway DLQ | `/dlq/gateway` | DLQ_READ |
| dlq | 처리실패 | dlqBusiness | Business DLQ | `/dlq/business` | DLQ_READ |
| dlq | 처리실패 | dlqQuarantine | 격리 설비 | `/dlq/quarantine` | DLQ_READ |
| dlq | 처리실패 | dlqRepairTask | Repair Task | `/dlq/repair-task` | DLQ_READ |
| equipment | 설비 | eqpBusiness | Business | `/eqp/business` | EQP_READ |
| equipment | 설비 | eqpGateway | Gateway | `/eqp/gateway` | EQP_READ |
| model | 모델 | modelSecs | SECS | `/model/secs` | MODEL_READ |
| model | 모델 | modelSocket | Socket | `/model/socket` | MODEL_READ |
| model | 모델 | modelPlc | PLC | `/model/plc` | MODEL_READ |
| deploy | 적용 | deployRegister | 등록 | `/deploy/register` | DEPLOY_READ |
| deploy | 적용 | deployDeploy | 배포 | `/deploy/deploy` | DEPLOY_READ |
| deploy | 적용 | deployHistory | 배포 이력 | `/deploy/history` | DEPLOY_READ |
| system | 시스템 | userUsers | 사용자 | `/user/users` | USER_READ |
| system | 시스템 | userGroups | 그룹 | `/user/groups` | USER_READ |

항목 라벨은 현행 i18n ko 값 재사용 (ko.json:102-106 dlq, :140-142 deploy 실측).
TC 고유명(Live-Map/SECS/Socket/PLC/Business/Gateway/Repair Task)은 전 언어 영어 유지.

권한 칼럼은 **실코드 권한 문자열** 기준 (permission.ts 실측 — 상수명이 아니라 값을
바인딩한다). Live-Map 행만 상수명과 값이 다르다: `DASH_READ_PERMISSION = 'LIVE_MAP_READ'`
(permission.ts:5). 나머지 5개는 상수값 = 문자열 동일.

**리다이렉트 (사용자 확정)**:
- `/dlq` → `/dlq/dashboard` (근거: dlq-ui.store.ts:12 초기값)
- `/deploy` → `/deploy/register` (근거: deploy-ui.store.ts:117 초기값)
- `/user` → `/user/users`, `/eqp` → `/eqp/gateway`, `/model` → `/model/secs`
- `/eqp/live-map` → `/live-map` (Live-Map 라우트 이동 — 구 경로 redirect 유지, 북마크 보존)
- `/` → `/login` 불변, `*` → `/login` 불변

**세부 확정**: `/deploy/deploy` 세그먼트는 DeployMode 값('register'/'deploy'/'history')과
1:1 유지 (변환 테이블 불요). 그룹명 "처리실패" 채택 (하위 라벨에 이미 DLQ 노출되어 중의성 없음).

## Requirements

- [x] R1. **사이드바 프리미티브 이식**: wm `components/ui/sidebar.tsx`(펼침 256px /
      접힘 56px 아이콘 rail, 미사용 조각 제거된 shadcn 이식판) + `sidebar-context.ts`
      (쿠키 영속 — 키는 tc 용 신규 예: `nori_tc_lnb_state`, Ctrl/Cmd+B 토글) +
      `shared/hooks/useIsMobile.ts` (모바일 off-canvas Dialog 분기).
- [x] R2. **app-navigation.ts 2단 트리 개편**: 위 확정 표 그대로 —
      그룹{key, labelKey} > 항목{key, labelKey, route, requiredPermission}.
      wm 의 `resolveVisibleAppNavigationGroups`(권한 없는 항목 숨김, 빈 그룹째 숨김) /
      `isAppNavigationRouteActive`(하위 경로 prefix) / `resolveAppNavigationLocation`
      (breadcrumb 단일 출처) 이식. i18n 키는 `navigation.group.*` / `navigation.item.*`
      신설(wm 컨벤션), ko/en/vi 3언어.
- [x] R3. **app-navigation-icons.ts 신설**: `Record<AppNavigationItemKey, LucideIcon>` +
      `Record<AppNavigationGroupKey, LucideIcon>` — Record 타입으로 항목 추가 시 아이콘
      누락이 컴파일 에러가 되게. wm 의 아이콘 선정 3원칙 주석(직역/형태 비중복/16px 판독성) 승계.
- [x] R4. **AppLnbSidebar + AppLnbFlyout 이식**: 그룹 아코디언(닫은 그룹만 기억, 기본
      전부 펼침) / rail hover·클릭 플라이아웃(body portal, 닫힘 지연 180ms, 투명 브릿지,
      키보드 접근 autoFocus/Esc 포커스 복귀) / 모바일 내비 시 off-canvas 닫기.
- [x] R5. **라우팅 개편**: 확정 표 16 라우트 + 신규 리다이렉트 6종(/dlq, /deploy, /user,
      /eqp, /model, /eqp/live-map) + 기존 불변 2종(`/`→/login, `*`→/login) 유지.
      각 menu-label 라우트가
      해당 페이지를 해당 스코프/모드로 렌더하고, 기존 페이지 내부 mode state
      (deploy-ui/dlq-ui/user-management/eqp/model 선택 스코프)는 **URL 을 단일 진실
      원천으로** 동기화 (새로고침/딥링크 복원).
- [x] R6. **AppTopBar 개편**: 중앙 nav 제거. 좌측 = 모바일 사이드바 토글(모바일만) +
      breadcrumb(`resolveAppNavigationLocation` 유도). 우측 = LineScopeSelector /
      ThemeToggle / LanguageToggle / 로그아웃 / 프로필 유지. `APP_TOP_BAR_OFFSET_CLASS`
      (fixed+pt 오프셋 구조) 폐기 — wm AppPageShell.tsx:15-19 의 폐기 근거 승계.
- [x] R7. **AppPageShell 재조립**: `SidebarProvider > (AppLnbSidebar + SidebarInset >
      (AppTopBar + content))`. wm `AppShellPage`(프로필 모달 배선 포함 최종 래퍼) 이식,
      전 라우트 페이지가 사용.
- [x] R8. **prefetch 2계열 이전**: (a) 기존 query hover-prefetch(AppTopBar.tsx:43-98)를
      LNB 항목 hover/focus 로 이전 — menu-label 단위로 세분(예: dlq 5항목별 해당 query,
      deploy 는 기존 제외 사유 주석 승계). queryKey/staleTime 은 각 hook 정의와 일치 유지.
      (b) wm `app/route-modules.ts` 패턴 이식 — React.lazy 와 preload 가 같은 `import()`
      loader 공유, LNB hover/focus/touchstart 에서 `preloadRouteModule`,
      전환은 `startTransition(() => navigate(route))`.
- [x] R9. **도메인 사이드바 5개 재편** (1단계가 LNB 로 승격됐으므로):
      - DeploySidebar / DlqSidebar / UserManagementSidebar → **파일 제거** (flat 모드
        전환만 하던 사이드바라 LNB 가 완전 대체)
      - EqpSidebar → Business/Gateway 아코디언 헤더 제거, 현재 라우트 스코프의 하위
        트리(app 그룹 > 설비 노드, 검색, 우클릭 CRUD ContextMenu)만 유지.
        **유지되는 부분의 raw `<button>` 은 전량 `<Button>` 으로 수렴** — 실측상 헤더는
        :240(Business)/:275(Gateway) 2건뿐이고 트리 노드/검색 버튼 5건(:153,:186,:213,
        :258,:297)이 남으므로, 헤더 제거만으로는 AC7(0건) 달성 불가
      - ModelSidebar → SECS/Socket/PLC 섹션 헤더 제거, 현재 라우트 스코프의
        root > branch 트리(검색, 우클릭 CRUD)만 유지.
        **유지되는 부분의 raw `<button>` 잔존분(실측 5건 중 헤더 외 전부)도 전량
        `<Button>` 수렴** (AC7 전제)
      - shared-layout.store 는 도메인 구분 없는 단일 {sidebarOpen, sidebarWidth,
        expandedSidebarWidth} 를 5개 페이지가 공유한다 (실측 — 도메인별 상태가 아님).
        정리 대상은 store 상태가 아니라 **DeployPage/DlqPage/UserManagementPage 3곳의
        useSharedLayoutStore 소비 코드 제거**. store 자체와 EqpPage/ModelPage 의 소비는
        in-page 트리 패널이 남으므로 유지
- [x] R10. **AppPageHeading + PageLayoutShell wm 판 갱신** (결정 4): AppPageHeading 은
      아이콘을 LNB 정의에서 자동 유도(prop 아님). PageLayoutShell 은 wm 판(bread prop
      제거 — breadcrumb 은 topbar 소관, AppPageHeading 내장)으로 갱신. **모든 라우트
      페이지가 AppPageHeading 을 직접 또는 PageLayoutShell 경유로 렌더** (wm 실측 관행:
      목록형 페이지는 PageLayoutShell, 분할 레이아웃 페이지는 AppPageHeading 직접).
      LayoutShellFixture 동반 갱신.
      wm AppPageHeading 이 경유하는 PageHeading/PageHeadingWithActions 는 tc 에 이미
      있으나 wm 판은 `page-heading-styles.ts` 에 의존한다(wm PageHeading.tsx:4 실측) —
      foundation R9 에서 이식이 보류된 경우 본 R10 이 함께 이식한다.
- [x] R11. **RequirePermission 가드 이식**: 라우트별 권한 게이트 — 미보유 시 로그인
      튕김이 아니라 그 자리에 AccessDeniedNotice 렌더 (wm RequirePermission.tsx:16-17
      의 "세션 끊김 오해 방지" 근거 승계). 각 라우트에 확정 표의 권한 코드 바인딩.
- [x] R12. **로컬 e2e 스펙 신설/갱신**: 신규 `tests/e2e/wm-parity-sidebar.spec.ts` —
      16 라우트 렌더 + 리다이렉트 8종(신규 6 + 불변 `/`,`*`) assertion + 권한 미보유
      AccessDeniedNotice 렌더 assertion + console.error/pageerror 0 게이트.
      제거되는 사이드바 testId 를 참조하던 기존 로컬 e2e 스펙 갱신.

## Constraints

- **URL 이 단일 진실 원천** — LNB 활성 판정/페이지 모드/breadcrumb 전부 URL 에서 유도.
- 권한 모델 불변: 그룹 내 항목은 기존 read 권한 상속 (확정 표). 백엔드 변경 없음.
- 페이지 콘텐츠 기능 불변: 승격은 내비 구조만 — 각 모드 화면의 기능/데이터 흐름은
  본 SPEC 에서 변경 금지.
- 유지되는 요소의 `data-testid` 보존. 제거 요소의 testId 참조 e2e 는 R12 로 동반 갱신.
- i18n 3언어(ko/en/vi). TC 고유명 전 언어 영어. 도메인 사이드바 제거로 고아가 되는
  기존 i18n 키(dlq.sidebar.* 등)는 정리.
- react-router v8 API (wm 코드는 react-router-dom v7 — import 경로 조정).
- 시각 토큰: ui-front coral/neutral (nori-client slate/blue 금지 — 기존 사이드바 주석 컨벤션).
- radix-ui 모노패키지만 사용. LNB 접힘 상태는 쿠키 영속(wm 컨벤션), 도메인 in-page
  패널 폭은 기존 zustand persist 유지 — 두 영속 채널을 섞지 않는다.

## Acceptance Criteria

> 각 항목 단일 명령/단일 assertion. OR 금지. 전부 nori-tc-ui-front 루트 기준.

- [x] AC1. `npm run build` PASS (출력 인용)
- [x] AC2. `npm run lint` PASS (출력 인용)
- [x] AC3. `npm run test:unit` PASS — R2 의 `resolveVisibleAppNavigationGroups` 권한
      필터(권한 없는 항목 숨김 + 빈 그룹 숨김) 단위 테스트 포함 (출력 인용)
- [x] AC4. `npx playwright test tests/e2e/wm-parity-sidebar.spec.ts` PASS AND
      console.error 0건 AND pageerror 0건 — spec 내용: 16 라우트 각각 렌더 assertion +
      리다이렉트 8종(/dlq, /deploy, /user, /eqp, /model, /eqp/live-map, /, 임의 미존재
      경로) 최종 URL assertion + 권한 미보유 mock 세션에서 확정 표 권한이 걸린 라우트
      1곳의 AccessDeniedNotice 렌더 assertion (R11 게이트)
- [x] AC5. `grep -n "navigationItems.map" src/shared/components/AppTopBar.tsx` 결과 0건
- [x] AC6. `grep -rn "APP_TOP_BAR_OFFSET_CLASS" src` 결과 0건
- [x] AC7. `grep -rn "<button" src/features` 결과 0건 (foundation ≤18 → 0 최종 수렴)
- [x] AC8. `git ls-files src/features/deploy/components/DeploySidebar.tsx src/features/dlq/components/DlqSidebar.tsx src/features/user-management/components/UserManagementSidebar.tsx`
      출력 0줄 (3파일 제거 AND)
- [x] AC9. `grep -rl "AppPageHeading\|PageLayoutShell" src/features/eqp/components/EqpPage.tsx src/features/live-map/components/LiveMapPage.tsx src/features/model/components/ModelPage.tsx src/features/deploy/components/DeployPage.tsx src/features/dlq/components/DlqPage.tsx src/features/user-management/components/UserManagementPage.tsx`
      출력 6줄 (LoginPage 제외 라우트 페이지는 6개 — Router.tsx lazy import 실측)
      AND `grep -n "AppPageHeading" src/shared/layout/PageLayoutShell.tsx` 1건 이상
      (PageLayoutShell 경유 페이지도 AppPageHeading 을 렌더함을 R10 wm 판 갱신으로 보장)
- [x] AC10. `grep -rn "AppLnbSidebar" src/shared/components/AppPageShell.tsx` 1건 이상
      (셸 조립 배선 확인)
- [x] AC11. e2e 회귀 0 — foundation AC16 과 동일 방식: clean 선행 HEAD 에서
      `npm run test:e2e` PASS 목록 baseline 기록 → 구현 후 동일 목록 전부 PASS AND
      console.error 0건 AND pageerror 0건 (R12 로 갱신된 스펙은 갱신본 기준)
- [x] AC12. `grep -rn "prefetchQuery\|preloadRouteModule" src/shared/components/AppLnbSidebar.tsx src/shared/components/AppLnbFlyout.tsx`
      결과 1건 이상 (R8 판정 — LNB 항목 hover/focus 의 prefetch/preload 배선 존재)

## Out of Scope

- role-landing(역할별 로그인 랜딩) — wm 은 ADMIN/OPERATOR 등 역할 상수 기반인데
  tc 권한 모델에 동일 역할 축이 있는지 미확인. 확인 후 별도 SPEC
- DLQ 5모드 화면 각각의 기능 개선 (내비 승격만, 콘텐츠 불변)
- 도메인 in-page 트리(설비 목록/모델 트리)의 기능 변경 — 스코프 필터링 외 불변
- combobox / searchable-select / switch / tooltip 이식 (foundation 과 동일 사유)
- 거대 파일 분해 (`ui-front-refactor` 트랙)
- LiveMapToolbar — foundation R10 에서 제거 확정 (본 SPEC 무관)

## SDD 진행 상태

- [x] **Specify** — 이 SPEC.md 작성 완료 (산출물: `.claude/specs/wm-parity-sidebar.md`)
- [x] **Plan** — 별 세션에서 구현 계획 수립 완료 (산출물: `.claude/specs/wm-parity-sidebar-plan.md`,
      2026-08-19 — wm 원본 16파일 전건 Read 대조 + tc 실측, 커밋 슬라이스 C0~C7 / 결정 D1~D14)
- [x] **Implement** — 별 세션에서 Acceptance Criteria 만족하는 구현 완료 (산출물: `.claude/specs/wm-parity-sidebar-dev-report.md`,
      커밋 `484a2c1`~`537bd6c` 8 슬라이스 C1~C7)
- [x] **Validate** — 별 세션에서 SPEC + Plan + Dev report 셋 다 입력으로 검증 완료 (2026-08-20).
      AC1~AC12 전건 재실행 PASS, R1~R12 / D1~D14 / I1~I21 코드 대조 위반 0, e2e baseline PASS 87 전건 통과(회귀 0).
      단위 테스트 이관본 3건(route-auth-guard / eqp-model-deploy-permission-gating / logout-client-state-cleanup)과
      i18n-vi-parity vacuous-pass 차단은 **의도적 코드 되돌리기 5종**으로 실패 재현을 확인해 무력화가 아님을 검증.
      Validate 가 기준선 트리 전수 대조로 찾은 잔여 결함 2건(이 range 가 만든 고아 i18n 키 3 /
      eqp 스코프 진입 캐시 무효화 소실)은 후속 `fix(ui)` 커밋에서 근본 원인까지 수정 완료 —
      고아 키 재측정 0건, 무효화 범위를 형제 group 핸들러와 대칭으로 복원, e2e 회귀 0 재확인.
      dev-report 의 남은 소견 3건은 SPEC Out of Scope / Plan D2 결정 / 레포 정책에 각각 해당해
      이 SPEC 완료에 필요 없음(신규 요구사항으로 다룰 사안).

## 다음 단계 진입 프롬프트

> 새 세션 진입 시 아래 블록을 그대로 복붙. **wm-parity-foundation Validate 완료 후 진입.**

**Plan 진입 (새 세션 + Plan Mode)**:
```
@.claude/specs/wm-parity-sidebar.md 보고 구현 계획 수립.
영향 파일 / 단계 / 위험 / 롤백 방법 포함.
실행 / 코드 수정 금지.
산출물: .claude/specs/wm-parity-sidebar-plan.md 에 저장.
```

**Implement 진입 (새 세션)**:
```
@.claude/specs/wm-parity-sidebar.md @.claude/specs/wm-parity-sidebar-plan.md 둘 다 읽고 구현.
SPEC 의 Acceptance Criteria 모두 만족하도록 각 AC 당 실패 테스트 먼저.
Plan 의 결정 (확장자 / dead path / OR→단일 노드 좁힘) 엄수.
산출물: .claude/specs/wm-parity-sidebar-dev-report.md 에 변경 파일 / 테스트 결과 / 결정 기록.
```

**Validate 진입 (새 세션)**:
```
@.claude/specs/wm-parity-sidebar.md @.claude/specs/wm-parity-sidebar-plan.md @.claude/specs/wm-parity-sidebar-dev-report.md
셋 다 읽고, 구현이 SPEC 의 모든 Acceptance Criteria 와 Plan 의 결정을 만족하는지 검증.
누락 / 위반 발견 시 보고. 통과 항목은 SPEC 의 AC 체크박스 + SDD 진행 상태를 [x] 로 업데이트.
```
