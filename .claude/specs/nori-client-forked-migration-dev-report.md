# DEV REPORT — nori-client-forked 자매품화 (ui-front 화면 재구성)

> 작성일: 2026-05-29
> 단계: **Implement** (SDD 3/4) — 입력: SPEC + Plan
> 대상 레포: `nori-tc-ui-front` 단일 (branch `docs/nori-client-forked-migration`)
> 산출물: 본 파일 — Validate 단계의 명시 입력

## 0. 원칙 준수

- 처음 진행하는 작업으로 간주. 출발점 코드는 *캔버스*. SPEC + Plan 만 기준.
- SURGICAL — 출발점 파일이 SPEC 부합 시 보존, 미달분만 작성/보강.
- D-GRID-ENGINE — SelectableTable 엔진/동작/prop 불변, 시각 className·토큰만. `@tanstack/react-table` 미도입. recharts 는 deploy phase 에서만.
- 회귀 0 — 라우팅/API/TanStack Query hook/Zustand store/기능 위젯 prop·state 불변.

## Phase 0 — Baseline (2026-05-29)

### 4개 명령 결과

| 명령 | 결과 | 출력 인용 |
|---|---|---|
| `npm install` | ✅ PASS | `up to date, audited 348 packages in 2s` / `found 0 vulnerabilities` |
| `npm run build` | ✅ PASS | `dist/assets/index-CH3w3Kgq.js 186.17 kB │ gzip: 59.12 kB` / `✓ built in 8.87s` |
| `npm run lint` | ❌ **14 errors** | `✖ 14 problems (14 errors, 0 warnings)` |
| `npm run test:e2e` | ❌ **2 failed / 73 passed** | `73 passed (2.2m)` |

### 회귀 게이트 기준선 결정 (사용자 승인 2026-05-29)

**"기존 결함으로 기록 후 delta 게이트"** — 아래 14 lint + 2 e2e 는 출발점 캔버스의 **known pre-existing baseline**. 소스 변경 전 측정값이므로 본 작업의 회귀가 아님. 이후 회귀 게이트 = **이 baseline 대비 NEW 에러/실패 0** (R6 의 "변경 파일 한정" 스코핑과 정합). 전체 AC `lint PASS` / `e2e PASS` 는 이 pre-existing 잔존분 때문에 최종 단계에서 `[~] 부분` 표기 대상.

#### Pre-existing lint 14건 (전부 `react-hooks/set-state-in-effect`)
- `src/features/eqp/components/EqpManageFormModal.tsx` (515, 524)
- `src/features/eqp/components/EqpModelBindingModal.tsx` (154, 169)
- `src/features/eqp/components/EqpPage.tsx` (603, 641, 659, 676)
- `src/features/live-map/components/LiveMapDemoModal.tsx` (215)
- `src/features/model/components/ModelPage.tsx` (462, 506, 566, 583)
- `src/features/user/components/UserPasswordResetModal.tsx` (45)

#### Pre-existing e2e 실패 2건 (user/group 도메인)
- `tests/e2e/group-page.spec.ts:356 › Group-AC-7: 그룹 멤버 추가/제거`
- `tests/e2e/user-page.spec.ts:502 › 사용자 그룹 매핑 표시 + 제거`

### Before 스크린샷

- `.claude/specs/screenshots/before/login.png` — `/login` 정상 렌더 (Nori-TC coral 카드).
- `.claude/specs/screenshots/before/fixture-layout-shell.png` — `/__fixtures/layout-shell` (AC R1 시각 확인 산출물 — PageLocation / PageHeading / PageHeadingWithActions+PageActionBar / single-card / multi-section 변형 렌더).
- **authed 6 라우트 (eqp/model/deploy/dlq/user/live-map)** — generic empty-fallback mock 으로는 blank(데이터 의존 렌더). 충실한 before/after 는 각 R5 phase 에서 해당 라우트 e2e mock 재사용해 캡처 (AC R5 "phase 별 전/후" 정합). 캡처 헬퍼: `tests/e2e/_capture_screens.mjs` / `_capture_one.mjs`.

### Phase 0 결론
출발점 green: install/build PASS. lint/e2e 의 pre-existing 결함은 baseline 으로 고정 — delta 게이트로 진행. R1 진입.

## Phase R1 — layout shell (commit 1)

### SURGICAL 대조 결과 (출발점 캔버스 vs SPEC R1)

| SPEC R1 항목 | 출발점 상태 | 조치 |
|---|---|---|
| 리스트 페이지 헤더 (PageHeading) | 존재하나 **총건수 pill 부재** | `total?: number` prop + secondary Badge pill 보강 (PageHeading + PageHeadingWithActions) |
| 필터/검색 바 | 부재 | **신규** `PageFilterBar.tsx` (조건 슬롯 + 우측 액션, 카드 surface) |
| 페이지네이션 | 부재 | **신규** `PagePagination.tsx` (forked buildPageList ellipsis + page-size [12,25,50,100] + from–to/total, active=coral) |
| 데이터 테이블 스타일 (SelectableTable) | **이미 부합** (bg-muted 헤더/hover/sticky/정렬 ▲▼/brand-accent range) | 보존 (엔진/prop/testId 불변 — e2e 14건 보호) |
| 공통 모달 (PageModal on dialog) | 이미 부합 | 보존 |
| 대시보드 카드 | 부재 | **신규** `PageCard.tsx` + `PageCardGrid` (forked `.card`/`.card-header`/grid 인상) |
| 상세 페이지 레이아웃 | PageLayoutShell `split-tab` variant 존재 (base 스타일) | R5-model phase 에서 채움 (premature abstraction 회피) |
| 푸터 + 버튼그룹 | PageActionBar(버튼그룹) 존재, **푸터 부재** | **신규** `PageFooter.tsx` (forked copyright 인상, 연도 prop 순수성) |
| PageLayoutShell wrapper | 이미 부합 | 보존 |

### 변경 파일
- `src/shared/layout/PageHeading.tsx` — 총건수 pill (`total` prop, Badge)
- `src/shared/layout/PageHeadingWithActions.tsx` — 총건수 pill (`total` prop, Badge)
- `src/shared/layout/PagePagination.tsx` — **신규**
- `src/shared/layout/PageFilterBar.tsx` — **신규**
- `src/shared/layout/PageCard.tsx` — **신규** (PageCard + PageCardGrid)
- `src/shared/layout/PageFooter.tsx` — **신규**
- `src/dev/LayoutShellFixture.tsx` — 필터(6)/테이블(7)/페이지네이션(8)/카드(9) scene 추가 + scene2 총건수 pill 시연 (AC R1.2)
- `tests/e2e/_capture_screens.mjs` / `_capture_one.mjs` — 스크린샷 캡처 헬퍼

### D-GRID-ENGINE 준수
SelectableTable.tsx **미변경** — 엔진/동작/prop/testId/data-* 전부 불변. `@tanstack/react-table` 미도입. 이미 캔버스에 forked data_table 시각 언어(bg-muted 헤더/hover/sticky/정렬 아이콘/셀 정렬)가 적용되어 있어 SURGICAL 보존.

### 검증
- `npm run build` ✅ PASS — `✓ built in 11.35s`
- `npx eslint src/shared/layout/ src/dev/LayoutShellFixture.tsx` ✅ EXIT 0 (변경 파일 NEW 에러 0)
- `npx playwright test` ✅ **73 passed / 2 failed** — baseline 과 동일(같은 pre-existing 2건), NEW 회귀 0
- AC R1.2 fixture 시각 confirm ✅ — `/__fixtures/layout-shell` 에 헤더/필터/페이지네이션/테이블/모달/카드 6 변형 + 총건수 pill(240) + coral active page + danger count 렌더. 스크린샷: `.claude/specs/screenshots/after/fixture-layout-shell-R1.png`

### AC 충족
- AC R1.1 (`PageLayoutShell.tsx` + import 페이지 ≥1): ✅ 존재 + `LayoutShellFixture` 가 import (R5 phase 누적으로 실페이지 확산)
- AC R1.2 (fixture 6 변형 렌더): ✅ 충족

## Phase R2 — 토큰 (commit 2)

### SURGICAL 대조 결과 (출발점 index.css vs SPEC R2)

| SPEC R2 항목 | 출발점 상태 | 조치 |
|---|---|---|
| `--font-ui` Pretendard | `'Pretendard', system-ui, sans-serif` (index.css:8) | 이미 부합 — 보존 (AC R2.1) |
| neutral 계층 (bg/card/border/fg/muted) | oklch grayscale 계층 존재 (forked slate **렌더값 미차용**, 계층만) | 보존 |
| coral 액센트 유지 / blue 차용 금지 | `--brand-primary/accent` coral, `--info` neutral gray(blue 제거) | 보존 |
| `--tracking-tight` + 헤딩 weight 700→600 | `--tracking-tight: -0.01em` 존재, 헤딩 `font-semibold` | 보존 |
| soft shadow 다단 / radius tier / focus ring / motion | `--shadow-soft-{sm,md,lg}` / `--radius-{sm,md,lg,xl}` / `--ring` / `--motion-*` 존재 | 보존 |
| **pill 태그 토큰** | **부재** | **신규** `--radius-pill: 9999px` (radius tier 완성, `.total-tag` 토큰화) |
| status semantic (success/warning/danger/info) | oklch 매핑 완료 (info blue 제거, danger hue 분리) | 보존 |
| `.dark` 토큰 | 블루 잔존(chart/sidebar-primary) | **OoS — 미변경** |

### 변경 파일
- `src/index.css` — `--radius-pill: 9999px` 1 토큰 추가 (`@theme inline` radius 그룹). 그 외 전부 보존.

### 결정
- "R2 신규 토큰은 사실상 pill 만" (사용자 명시) 그대로 — 나머지 토큰은 캔버스에 이미 SPEC 부합 상태라 SURGICAL 보존.
- `--radius-pill` 은 토큰 선언 파일(index.css)의 선언적 design token (기존 `--z-*` / `--leading-relaxed` 등과 동일 성격). Badge primitive 의 `rounded-full` 과 동일 full-radius 렌더이며 pill 의 canonical 토큰. R5 phase / Badge 후속 채택 대상.
- `.dark` 미변경 — 다크 자매품화는 OoS, 다크 회귀 0 보장.

### 검증
- `npm run build` ✅ PASS — `✓ built in 9.89s` (Tailwind `--radius-pill` 토큰 정상 처리)
- AC R2.1 (`--font-ui` Pretendard 포함): ✅ `src/index.css:8: --font-ui: 'Pretendard', system-ui, sans-serif;`
- AC R2.2 (brand 토큰 grep ≥5): ✅ 현재 **19 hits** (R5 누적 증가)
- e2e: R2 는 순수 additive 토큰 — 기존 토큰 값/셀렉터 변경 0 → 렌더 출력 불변. 회귀 불가 (R1/R5 phase e2e 가 토큰 적용 결과를 커버).

## Phase R5 — 페이지별

### R5-login — LoginPage (최종 `666091b` = forked 구조 재구성)

> **이력**: 1차 `7a12c75` 은 기존 마크업에 **색치환만**(hex→토큰) 수행 — D-R5-METHOD 4단 중 (5)색만 충족, (1)forked 구조 차용·(4)i18n·브랜딩 누락으로 **기준 미달**. SPEC R5 login 명세가 "single-card 변형" 한 줄로 얇아 생긴 오구현. 사용자가 대화로 직접 **forked 기반 전면 재구성** → 최종 `666091b`. 본 섹션은 `666091b` 기준으로 기록한다.

#### D-R5-METHOD 4단 적용 (`666091b`)
1. **틀 차용** — forked `login_new`/`_login` 중앙 카드 구조를 차용해 골격 재구성. 카드 `max-w-[500px]`(forked 동일 폭) + `shadow-soft-lg` + radial-gradient 배경. 입력에 User/Lock 아이콘, password Eye/EyeOff 토글, 아이디 저장 체크, 아이디·비밀번호 찾기(RecoveryModal), 언어 토글(Globe), copyright footer 까지 forked 로그인 요소 차용.
2. **콘텐츠 재배치** — `useLogin` hook / `register` / ESC 핸들러 등 동작 보존(prop·API 불변).
3. **사이드바** — login 은 사이드바 없음 (해당 없음).
4. **i18n** — 전 텍스트를 `login.*` 키로 신설·배선(ko/en 각 24키). 하드코딩 문자열 0.
5. **색·브랜딩** — bespoke hex 전량 coral/neutral 토큰화 + CTA `rounded-pill`(R2 `--radius-pill`). **브랜딩**: NORIMES 로고 자리에 nori-tc 로고(`public/nori-tc-logo.png`, 투명 처리) + favicon(forked `favicon.ico` 동일, `index.html`).

#### 변경 파일 (`666091b`)
- `src/features/auth/components/LoginPage.tsx` — forked 구조 재구성 (368 lines)
- `public/nori-tc-logo.png` — nori-tc 로고 (투명, **982KB — 후속 최적화 대상**)
- `public/favicon.ico` — forked 동일
- `index.html` — favicon → `/favicon.ico`
- `src/i18n/locales/ko.json` / `en.json` — `login.*` 키 신설
- `tests/e2e/login-page.smoke.spec.ts` — locale 무관(id/role 셀렉터)
- `tests/e2e/_live_map_layout_check.mjs` / `_perf_measure.mjs` / `_real_model_layout_check.mjs` — 로그인 셀렉터 ko 갱신

#### 검증 (`666091b`)
- `tsc -b` ✅ EXIT 0 (2026-05-30 재확인) / `npx eslint LoginPage.tsx` ✅ EXIT 0 / `npx playwright test login-page.smoke` ✅ 1 passed
- 스크린샷 — before: `.claude/specs/screenshots/before/login.png` / after: `.claude/specs/screenshots/after/login-R5.png`(**1차 `7a12c75` 것 — `666091b` 기준 재캡처 필요**)

### R5 잔여 phase — 규모 발견 (2026-05-29 측정, Implement 핸드오프)

R5-eqp 착수 시 측정: 각 도메인이 coral 이 아닌 **bespoke 하드코딩 팔레트**(eqp=green `#1C7F59`/`#1E3D33`/`#2AAE67` 등)를 전면 사용 → "색=ui-front coral 토큰"(D-TOKEN) 충족은 도메인별 수백 hex 토큰 마이그레이션 필요.

| 도메인 | 하드코딩 hex | 파일 | R4.2(resize/collapse) |
|---|---|---|---|
| eqp | 252 | 13 | **이미 완료** (AppPageShell + EqpSidebar onToggle/onResize + shared-layout store) |
| model | 439 | 15 | shared-layout store 공용 (확인 필요) |
| deploy | 182 | 4 | — |
| dlq | 33 | 4 | — |
| user | 28 | 5 | — |
| user-management | 12 | 2 | — |
| **잔여 합계** | **~946** | **~43** | |

- **R4.2 핵심은 eqp 에서 이미 충족** — shared-layout.store(persist) + SidebarResizeHandle + AppPageShell 인프라 완비. 잔여 phase 는 주로 색 토큰 마이그레이션 + (도메인별) 사이드바 resize/collapse 적용 여부 확인.
- 권장 진행: phase별 fresh 세션(SDD Document-and-Clear, CLAUDE.md §10/§16). 본 dev-report 가 핸드오프 입력. 각 phase = bespoke 팔레트→coral/neutral 토큰 매핑(고유값 ~30개/도메인 → sed 가능) + build + eslint(변경파일) + 해당 e2e PASS + before/after 스크린샷 + 단일 commit.
- 권장 순서(Plan 유지): eqp → user → dlq → model → deploy. (LiveMap 보류 — 사용자 이미지 기반 별도.)

### 다음 세션 진입 프롬프트 (R5-eqp — 사용자 결정: phase별 fresh 세션)

> ⚠️ **R5-eqp 는 색치환 작업이 아니다.** login(`666091b`)이 forked 구조 재구성으로 진행된 것처럼, eqp 도 **D-R5-METHOD 4단(SPEC R5.0)** 으로 진행한다. 아래 hex 매핑은 4단 중 (4)색·브랜딩 단계의 *참고 가이드*일 뿐, 작업의 본체는 (1)forked 리스트 구조 차용 재구성이다.

```
@.claude/specs/nori-client-forked-migration.md @.claude/specs/nori-client-forked-migration-plan.md @.claude/specs/nori-client-forked-migration-dev-report.md 셋 다 읽고 R5-eqp 구현.
이미 완료: Phase0/R1/R2/R5-login (commit ae45c09/d9d2b8c/666091b). baseline delta 게이트(pre-existing 14 lint + 2 e2e) 유지.
방식: SPEC R5.0 = D-R5-METHOD 4단 엄수 (login 666091b 기준 사례). 색치환만 하고 끝내지 말 것.
  (1) 틀 차용 — forked 리스트 구조(list_page_header+list_pagination+data_table+common_page_modal)를
      R1 shell(PageHeading[pill]+PageFilterBar+PagePagination+SelectableTable+PageModal)로 EqpPage 골격 재구성.
  (2) 콘텐츠 재배치 — EqpInfoTable/EqpParamTable/GatewayGroupTable/BusinessGroupModelTable + CheckInModal/EqpManageFormModal/EqpModelBindingModal 을 골격 slot 에 배치 (prop/state/API/testId/data-* 불변, R6).
  (3) 사이드바 — EqpSidebar 좌측 slot + R4.2(resize/collapse) — 인프라 이미 완비(AppPageShell+shared-layout store), shell 배치만 확인.
  (4) i18n — eqp 화면 텍스트 eqp.* 키 신설 후 t() 배선 (하드코딩 0).
  (5) 색·브랜딩 — src/features/eqp/ 13파일 252 hex(green 팔레트) → coral/neutral 토큰.
      매핑 가이드: green brand(#1C7F59/#166749/#2AAE67)→brand-primary, dark green text(#1E3D33/#1F2D26/#243129)→foreground,
      muted green(#51605A/#647169/#7A8680/#8A8A8A)→muted-foreground, borders(#E4EAE6/#D8E1DB/#B8C9C1)→border,
      light green bg(#EAF5EE/#F1F6F3/#FAFCFB/#F7FAF8)→muted 또는 brand-primary/10(선택 하이라이트), white→card,
      error red(#C5534B/#B4483F)→danger, error bg(#FFF7F7/#F0D2D0)→danger/10.
D-GRID-ENGINE 엄수(SelectableTable 엔진/동작/prop 불변, 시각 className·토큰만).
검증: build + eslint(변경파일) + eqp 관련 e2e(selectable-table-check-in/gateway-group + 기타) PASS + before/after 스크린샷 + 단일 commit.
이후 순서: user → dlq → model → deploy (각 phase 동일 4단). LiveMap 보류.
```

## Phase R5-eqp — EqpPage 자매품 재구성 (2026-05-30)

### 사용자 결정 (D-R5-METHOD 적용 범위 확정)
인터뷰에서 사용자가 "검색바/페이지 버튼을 다 넣어야 한다 — 왼쪽에서 eqpId 검색, 왼쪽 선택(설비/gateway app/business app)에 따라 보이는 테이블이 달라야 한다. forked 의 GNB→LNB→리스트 페이지 구조처럼, topbar 도메인 클릭 시 새로 나타난다"고 명시. → SPEC owner 로서 **콘텐츠 리스트 테이블에 PageFilterBar+PagePagination state 추가를 명시 승인** (R6 "위젯 prop·state 불변"은 기능 위젯 내부에 한정, 페이지 레벨 표현 state 추가는 본 결정으로 허용). 사이드바 eqpId 검색·선택별 테이블 분기·R4.2(resize/collapse)는 **이미 구현돼 있어** 색·i18n 만 적용.

### D-R5-METHOD 4단 적용
1. **틀 차용** — GatewayGroupTable·BusinessGroupModelTable 를 forked 리스트 페이지 틀로 재구성: 헤더(`h2` 제목 + 총건수 `Badge` pill) + `PageFilterBar`(검색 Input) + `SelectableTable`(필터+페이지 슬라이스) + `PagePagination`(R1 컴포넌트, page-size [12,25,50,100]). page/pageSize/searchKeyword 로컬 state 추가, slice 시점 `safePage` clamp(effect 미사용 — `react-hooks/set-state-in-effect` 회피).
2. **콘텐츠 재배치** — SelectableTable testId/columns/wrapRow/data-* 불변, EqpInfoTable·EqpParamTable·모달 prop/state/API 불변. eqpItems/models 를 EqpPage→테이블에 그대로 전달, 테이블이 필터·페이지 슬라이스만 표현.
3. **사이드바** — EqpSidebar 좌측 slot + R4.2(AppPageShell+shared-layout store+SidebarResizeHandle) **기존 인프라 유지**, 색·i18n 만.
4. **i18n** — 정적 한국어 → `eqp.*` 키 신설(ko/en 각 ~44키). 동적 메시지(eqpId·카운트 임베드)는 `t()` **보간 미지원**(`t=(key)=>dict[key]`)이라 보류 — 아래 follow-up.
5. **색** — eqp 13파일 **252 hex 전량 → 시맨틱 토큰**. brand green(#1C7F59/#166749/#2AAE67)→brand-primary(coral), dark green(#1E3D33 등)→foreground, muted green→muted-foreground, border green→border/input, light green bg→muted/card/brand-primary tint, error red→danger, diff add/change/del→success/warning/danger, amber notice→warning. **status 점(emerald/sky/amber 유틸)은 런타임 상태 semantic 이라 보존**(brand 색 아님).

### 변경 파일 (16 tracked)
- `src/features/eqp/components/`: EqpSidebar / GatewayGroupTable / BusinessGroupModelTable / EqpInfoTable / EqpParamTable / EqpPage / CheckInModal / EqpModelBindingModal / EqpManageFormModal / EqpDeleteConfirmDialog / EqpDeleteResultDialog / EqpLifecycleActionDialog / EqpLifecycleResultDialog (13)
- `src/i18n/locales/ko.json` / `en.json` — `eqp.*` 키 신설
- `tests/e2e/selectable-table-check-in.spec.ts` — AC-R5-CI-2 diff 색 단언을 hex→토큰(`bg-success/5`·`bg-warning/5`·`bg-danger/5`)으로 갱신(검증 동작 동일, 클래스 계약만 토큰화)

### 검증
- `npm run build` ✅ PASS — `✓ built in 7.96s` (tsc 0 errors)
- `npx eslint src/features/eqp/components/` ✅ **NEW 에러 0** — 8건 전부 baseline pre-existing `react-hooks/set-state-in-effect`(EqpManageFormModal×2, EqpModelBindingModal×2, EqpPage×4; import 추가로 라인만 이동). 내가 추가한 GatewayGroupTable/BusinessGroupModelTable 은 effect 제거로 clean.
- `npx playwright test` (전체) ✅ **75 passed / 0 failed** (2.4m). baseline 의 pre-existing 2 e2e 는 commit e7d5c8b 로 이미 해소됨 → NEW 회귀 0.
- eqp hex 잔존: `grep -coE '#[0-9A-Fa-f]{6}'` → 13파일 전부 0 (토글 thumb `bg-white` 1건만 의도적 유지 — coral 버튼의 `text-white` 와 동일 대비 요소).
- before/after 스크린샷: `.claude/specs/screenshots/before/eqp-R5.png`·`eqp-gateway-R5.png` / `.claude/specs/screenshots/after/eqp-R5.png`·`eqp-gateway-R5.png`. after = gateway_app1 그룹 헤더 pill(30) + 검색 필터바 + SelectableTable + 페이지네이션(1–25/30, coral active) + i18n 사이드바. before = "설비 30개" 텍스트 + 필터/페이지네이션 없음 + 한글 하드코딩.

### Follow-up (보류 — 투명 기록)
- **대형 모달 내부 i18n 미완** — CheckInModal / EqpModelBindingModal / EqpManageFormModal 은 **색 토큰화는 전량 완료**했으나 내부 폼 라벨·동적 메시지 i18n 은 미적용. 사유: (1) `t()` 보간 미지원으로 eqpId·카운트 임베드 동적 문자열 단일 키 변환 불가, (2) D-I18N "커스텀 i18n 유지" 경계상 shared 보간 인프라 확장은 eqp 범위 밖, (3) 분량(EqpManageFormModal 1275 LOC). → SPEC R5.0 (4)단의 "하드코딩 0" 은 **주요 표면(페이지/사이드바/테이블/dialog)에서 충족**, 대형 모달 내부는 별도 follow-up. Validate 시 `[~] 부분` 표기 권장.

### 사용자 피드백 보정 (2026-05-30, a32c738 직후)
- **(1) 콘텐츠 eqpid 검색 제거** — gateway/business 그룹 콘텐츠 테이블의 `PageFilterBar`(검색 Input) 삭제. eqpId 검색은 좌측 사이드바에서만 제공(중복 제거). GatewayGroupTable/BusinessGroupModelTable 의 searchKeyword state·필터 로직·미사용 import(Search/Input/PageFilterBar) 제거, 페이지네이션·총건수 pill 은 유지. 미사용 `eqp.filter.*` 키 2개 locale 에서 제거.
- **(2) EqpSidebar nori-client LNB 시각 적용** (사용자 선택: "forked LNB 시각만 입히기") — forked `sidebar.jsx`/`header_sidebar.scss` 패턴 차용: Business→`Boxes`/Gateway→`Network` lucide 아이콘, flat nav(박스 카드 제거), 그룹 헤더 선택 시 solid coral(`sidebar__top` is-expanded 인상), 하위 그룹/eqp 링크 active=`brand-primary/10` + 좌측 2px 액센트(`sidebar__sublink` is-active 인상), hover 전환(transition-colors). **slate/blue 렌더값 차용 금지 → coral/neutral 토큰. 구조·라우팅·선택 동작·ContextMenu·검색·R4.2 토글/resize 불변(R4.1/R4.2). 그룹 아코디언(하위 접힘)은 R4.2 OoS 라 미도입.**
- 검증: `npm run build` ✅ ✓ built in 7.77s / `eslint` ✅ EXIT 0 / `playwright test` 전체 ✅ 75 passed / 0 failed. after 스크린샷 재캡처(사이드바 LNB + 검색바 제거 반영).

### 사용자 피드백 보정 2 (2026-05-30, 39d7541 직후)
- **(1) 그룹 아코디언 도입** — Business/Gateway 가 기본 펼쳐져 있던 것을 **헤더 클릭 시에만 펼침/접힘**으로 변경(`businessOpen`/`gatewayOpen` 로컬 state, 헤더 클릭 = 전체선택 + 토글). 초기값은 현재 선택 컨텍스트 기반 lazy init(새로고침 복원 시 선택 그룹 자동 펼침), 검색 중에는 결과 노출 위해 파생값으로 강제 펼침(effect 미사용). **R4.2 의 "그룹 아코디언 비흡수(OoS)" 결정을 사용자 명시 요청으로 도입** — SPEC owner 결정으로 R4.2 OoS 해제. R4.1 의 메뉴/라우팅/선택 state·핸들러는 불변(아코디언은 표현용 로컬 state).
- **(2) 그룹 아이콘 제거** — Business→Boxes / Gateway→Network lucide 아이콘 삭제(사용자 요청), import 제거.
- **e2e 보정** — 아코디언 기본 접힘으로 `selectable-table-gateway-group`(×2) / `selectable-table-check-in`(openCheckInModal) 이 gateway_app1·EQP 노드를 직접 클릭하던 흐름이 깨져, 각 테스트에 "Gateway 헤더 클릭으로 펼침" 단계를 선행 추가. 동작 검증 의미 동일.
- 검증: `npm run build` ✅ ✓ built in 7.76s / `eslint EqpSidebar` ✅ EXIT 0 / `playwright test` 전체 ✅ 75 passed / 0 failed. after 스크린샷 재캡처(기본 접힘 + 아이콘 제거 반영).

### 사용자 피드백 보정 3 (2026-05-30)
- **(1) gateway_app 2단계 아코디언** — Gateway 펼침 시 gateway_app1/2/3 는 보이되, 각 gateway_app 의 **하위 eqp 노드는 해당 gateway_app 헤더 클릭 시에만 펼침**. `expandedGatewayGroups: Set<number>`(appIndex 집합) 로컬 state, gateway_app 클릭 = `onSelectGatewayGroup`(전체선택 유지) + 토글. 초기값 lazy init(선택 그룹 + 선택 eqp 소속 그룹 펼침), 검색 중 강제 펼침(파생값). business_app 은 하위가 없어 그대로.
- **(2) 상단 브랜드 로고 교체** — `AppTopBar` 의 "N 박스 + Nori-TC 텍스트" → login 과 동일한 `public/nori-tc-logo.png` 이미지(`<img h-8 w-auto>`). 브랜드 자산 스왑이며 `navigationItems`/`resolveVisibleAppNavigationItems`/라우팅/prefetch 는 **미변경**(AC R4 git diff 0 유지).
- **e2e 보정** — gateway_app 아코디언으로 `selectable-table-check-in` 의 EQP 노드가 gateway_app1 펼침 전엔 숨음 → openCheckInModal 에 `Gateway → gateway_app1 → EQP` 순 클릭으로 보정. gateway-group e2e 는 그룹 테이블 콘텐츠 검증이라 영향 없음.
- 검증: `npm run build` ✅ ✓ built in 7.83s / `eslint EqpSidebar+AppTopBar` ✅ EXIT 0 / `playwright test` 전체 ✅ 75 passed / 0 failed. after 스크린샷 재캡처(2단계 아코디언 + 로고 반영).

## eqp 세션에서 확립한 공통 컨벤션 (이후 phase 재사용)
- **콘텐츠 검색바** — 도메인 사이드바에 이미 검색이 있으면 콘텐츠 테이블엔 중복 검색바 두지 않음(eqp). 사이드바에 검색이 없는 도메인은 콘텐츠 리스트에 검색/필터가 적절할 수 있음 → phase 진입 시 사용자 확인.
- **사이드바 forked LNB 시각** — flat nav / 그룹 아이콘 없음(사용자 선호) / active=`bg-brand-primary/10`+좌측 2px 액센트 / 선택 그룹 헤더=solid coral / hover `transition-colors`. **자식이 있는 트리형 사이드바는 클릭 시에만 펼치는 아코디언**(eqp gateway 2단계). 자식 없는 단순 nav 는 아코디언 불필요.
- **색** — bespoke hex → coral/neutral 토큰 전량. **status/diff semantic 색(emerald/sky/amber 런타임 상태, add/change/delete)은 success/warning/danger 로 매핑하되 brand coral 로 치환 금지.**
- **i18n** — 정적 한국어만 `<domain>.*` 키 신설. **동적 메시지(id·카운트 임베드)는 `t()` 보간 미지원이라 보류**(정적만, follow-up 기록).
- **대형 모달** — 색 토큰화 우선 완수, 내부 폼 라벨 i18n 은 분량/보간 한계로 follow-up 가능(투명 기록).
- **e2e 스크린샷 캡처** — standalone `node` chromium 은 vite dev cold-start 에서 동적 import 레이스로 blank → **playwright `test` 러너**(webServer/warmup 관리, reuseExistingServer)로 임시 spec 작성해 캡처 후 spec 삭제. before 는 `git stash`(추적 변경만)로 parent 상태 캡처 → `stash pop`.
- **회귀 게이트** — baseline pre-existing lint(`react-hooks/set-state-in-effect`) 대비 **NEW 0**. 새 page-clamp 는 effect 금지(slice 시점 `safePage` clamp). 사이드바 상호작용 바뀌면 닿는 e2e 의 클릭 흐름 보정(단언 의미 동일 유지).
- **단일 commit** — phase 별 1 commit, PR/MR 금지.

## 다음 세션 진입 프롬프트 (R5-user — phase별 fresh 세션)

> ⚠️ R5-user 는 색치환 작업이 아니다. eqp(`a32c738` 외)처럼 **D-R5-METHOD 4단(SPEC R5.0)** 으로. UserManagementSidebar 는 User/Group **2-모드 전환**(트리/아코디언 아님)이라 사이드바 검색·아코디언이 없으니, User/Group **콘텐츠 리스트엔 forked 리스트 틀의 검색/필터가 적절할 수 있음 → 진입 시 사용자에게 확인**.

```
@.claude/specs/nori-client-forked-migration.md @.claude/specs/nori-client-forked-migration-plan.md @.claude/specs/nori-client-forked-migration-dev-report.md 셋 다 읽고 R5-user 구현.
이미 완료: Phase0/R1/R2/R5-login/R5-eqp + 글로벌 chrome(AppTopBar nori-tc-logo). baseline delta 게이트(pre-existing lint: UserPasswordResetModal.tsx:45 set-state-in-effect / e2e 0 failed) 유지.
방식: SPEC R5.0 = D-R5-METHOD 4단 엄수. dev-report 의 "eqp 세션에서 확립한 공통 컨벤션" 그대로 따를 것. 색치환만 하고 끝내지 말 것.
  (1) 틀 — forked 폼/리스트 구조를 R1 shell(PageHeading[pill] / PageFilterBar / PagePagination / SelectableTable / PageModal / PageActionBar)로 UserManagementPage 골격 재구성.
      User/Group 리스트는 플랫 목록이라 콘텐츠 검색/필터·페이지네이션이 적절 — 단 도입 전 사용자에게 1회 확인(eqp 는 사이드바 검색 중복이라 콘텐츠 검색 제거했던 점 환기).
  (2) 콘텐츠 재배치 — UserListTable/GroupListTable + UserAdminPanel/GroupAdminPanel + UserUpsertModal/UserPasswordResetModal/UserDeleteConfirmDialog/GroupUpsertModal/GroupAddMembersModal/GroupDeleteConfirmDialog 를 골격 slot 에 배치 (prop/state/API/testId/data-* 불변, R6).
  (3) 사이드바 — UserManagementSidebar(User/Group 2-모드 전환) 에 forked LNB 시각만(active 좌측 액센트 + hover transition + flat, 아이콘 없음). 자식 없으니 아코디언 불필요. mode 전환 동작/testId(user-management-sidebar-user|group) 불변(R4.1).
  (4) i18n — user.*/group.* 정적 키 신설 후 t() 배선. 동적 메시지(userId·카운트 임베드)는 t() 보간 미지원이라 보류(dev-report 기록).
  (5) 색 — user/user-management/group ~46 hex → coral/neutral 토큰. status/뱃지 semantic 색은 보존.
D-GRID-ENGINE 엄수(SelectableTable 엔진/동작/prop/testId/data-* 불변, 시각 className·토큰만).
검증: build + eslint(변경파일, baseline delta NEW 0) + user-page/group-page/selectable-table-user-list/selectable-table-group-list e2e PASS + before/after 스크린샷(playwright test 러너로 캡처, before 는 git stash) + 단일 commit.
이후 순서: dlq → model → deploy (각 phase 동일 4단). LiveMap 보류.
```

## Phase R5-user — UserManagement 자매품 재구성 (2026-05-30)

### 사용자 결정 (진입 시 1회 확인 — 프롬프트 명시)
인터뷰에서 2개 도입 결정을 확인. 근거는 코드 직접 확인:
- **콘텐츠 검색/필터 바 → 추가 안 함**. User/Group 목록은 **서버사이드 페이지네이션**이고 `getUserList(offset, limit)` / `getGroupList(offset, limit)` 에 **keyword 파라미터 없음**([user.api.ts:201](../../src/features/user/api/user.api.ts#L201)). 클라이언트 검색은 현재 페이지(20건)만 필터해 "전체 검색"으로 오해를 유발하고, 백엔드 파라미터 추가는 R6(API 불변) 위반. eqp(사이드바 검색 중복) 와 사유는 다르나 결론은 동일(콘텐츠 검색 없음).
- **페이지네이션 → 기존 Prev/Next 유지**(forked PagePagination 미도입). [user-page.spec.ts:449-480](../../tests/e2e/user-page.spec.ts) 이 `user-list-prev`/`user-list-next` testId + `user-list-pagination-summary` 의 `1 / 3` 포맷 + `offset=20`(페이지크기 20) 서버 동작을 단언. 유지하면 e2e 무수정 + R6 testId 불변. forked 자매품 인상은 **헤더 총건수 pill + 카드 surface + 사이드바 LNB + coral 토큰**으로 달성.

### D-R5-METHOD 4단 적용
1. **틀 차용** — UserAdminPanel / GroupAdminPanel 헤더를 forked 리스트 페이지 헤더 틀(`PageHeadingWithActions` = 제목 + 총건수 pill + 우측 액션 슬롯)로 재구성. 기존 `<header><h1 text-2xl>+<Button>` → `PageHeadingWithActions name/description/total/actions`. 총건수 pill = 해당 query 의 `count`(서버 total). 사이드바는 forked LNB 시각.
2. **콘텐츠 재배치** — UserListTable / GroupListTable + 6 모달/다이얼로그(UserUpsert/UserPasswordReset/UserDeleteConfirm/GroupUpsert/GroupAddMembers/GroupDeleteConfirm)의 prop/state/API/TanStack hook/Zustand store/testId/data-* **불변**. SelectableTable 엔진·rangeCopy·wrapRow·더블클릭 불변(D-GRID-ENGINE).
3. **사이드바** — UserManagementSidebar 에 forked 리뉴얼 LNB 시각: flat nav / **아이콘 없음**(사용자 선호) / active = `bg-brand-primary/10` + 좌측 2px `border-l-2 border-brand-primary` 액센트 + coral 텍스트 / 비active hover `transition-colors`. 헤더 `t('userMgmt.sidebar.title')`. **자식 트리 없음 → 아코디언 미도입**. mode 전환 동작·testId(`user-management-sidebar-user|group`) 불변(R4.1). R4.2(resize/collapse)는 프롬프트 범위 밖(시각만) — 미도입.
4. **i18n** — 정적 한국어를 `user.*` / `group.* `/ `userMgmt.*` 키로 신설(ko/en 각 15키): 사이드바 제목, 패널 제목/설명/등록버튼, 테이블 action/empty/syncing, 페이지 로딩. 동적 메시지(userId·카운트 임베드 `총 N건 · X / Y 페이지`, 삭제 확인 `사용자 ${id}...`)는 `t()` 보간 미지원이라 하드코딩 보류. **대형 모달 내부 폼 라벨 i18n 은 eqp 컨벤션대로 follow-up**(색 토큰화는 전량 완료).
5. **색** — user/group/user-management **45 hex 전량 → 시맨틱 토큰**. green brand(#1C7F59 등)→brand-primary(coral), dark green text(#1F2D26/#243129 등)→foreground, muted green(#4A5A52/#5C6A63/#7F8A84 등)→muted-foreground, border green(#E2E9E4/#DCE5DB/#EDF1EE 등)→border/input, light green bg(#EAF5EE active)→brand-primary/10, white→card/background, error red(#B4483F/#F0D2D0/#FFF7F7)→danger/danger-20/danger-5, copy-success(#1C7F59)·result box(#2D5543/#EAF3EE/#CFE1D8)→success 계열. **status/diff semantic(success/danger)은 brand coral 치환 금지** — 보존.

### 변경 파일 (17 tracked + 4 screenshot)
- `src/features/user-management/components/`: UserManagementSidebar(LNB) / UserManagementPage(로딩 토큰+i18n)
- `src/features/user/components/`: UserAdminPanel(PageHeading) / UserListTable(토큰+i18n) / UserUpsertModal / UserPasswordResetModal / UserDeleteConfirmDialog (색토큰)
- `src/features/group/components/`: GroupAdminPanel(PageHeading) / GroupListTable(토큰+i18n) / GroupUpsertModal / GroupAddMembersModal / GroupDeleteConfirmDialog (색토큰)
- `src/i18n/locales/ko.json` / `en.json` — `userMgmt.*`/`user.*`/`group.*` 키 신설
- `tests/e2e/`: user-page / group-page / selectable-table-group-list — heading 텍스트 단언 보정(아래)
- 스크린샷: `.claude/specs/screenshots/{before,after}/user-R5.png`·`group-R5.png`

### e2e 보정 (단언 의미 동일, locale 무관화)
패널 제목을 `t('user.title')`/`t('group.title')`로 i18n 배선하면서, 테스트 기본 로케일이 EN(`navigator.language` 기반, Playwright en-US)이라 heading 이 "User/Group Management"로 렌더 → 기존 `getByRole('heading', {name:'사용자 관리'|'그룹 관리'})` 단언이 실패. **login/eqp 에서 확립한 "e2e 는 locale 무관 셀렉터" 컨벤션**대로, heading 텍스트 단언을 locale 무관 testId(`user-list-table`/`group-list-table`, 패널 활성 확인)로 보정. 단언 의미(해당 패널 활성)는 동일. testId/data-* 는 불변(R6) — 테스트가 참조하는 셀렉터만 더 견고하게.

### 검증
- `npm run build` ✅ PASS — `✓ built in 8.58s` (tsc 0 errors)
- `npx eslint src/features/{user,group,user-management}` ✅ **NEW 에러 0** — 1건은 baseline pre-existing `UserPasswordResetModal.tsx:45` set-state-in-effect(effect 미변경, className 만 토큰화).
- `npx playwright test` (전체) ✅ **75 passed / 0 failed** (2.0m). 4 대상 spec(user-page/group-page/selectable-table-user-list/selectable-table-group-list) 포함 cross-page 회귀 0.
- hex 잔존: `grep -rnoE '#[0-9A-Fa-f]{6}' src/features/{user,group,user-management}` → **0** (45→0 전량 토큰화).
- before/after 스크린샷: `.claude/specs/screenshots/{before,after}/user-R5.png`·`group-R5.png` (playwright test 러너 + scroll-reset 캡처, before 는 git stash 로 parent 상태). before=녹색 LNB+pill 없는 헤더+"액션", after=coral LNB(좌측 액센트)+32 총건수 pill 헤더+"Add user"+i18n.

### Follow-up (보류 — 투명 기록)
- **모달 내부 폼 라벨 i18n 미완** — 6 모달/다이얼로그는 색 토큰화 전량 완료했으나, 폼 필드 라벨(회사/부서/그룹 코드 등)·동적 메시지(userId·카운트 임베드)·삭제 확인 텍스트는 미적용. 사유: (1) `t()` 보간 미지원, (2) eqp 컨벤션(대형 모달 내부 i18n follow-up). 주요 표면(페이지/사이드바/테이블)은 충족. Validate 시 `[~] 부분` 표기 권장.

## eqp/user 세션 공통 컨벤션 보강 (이후 phase 재사용)
- **i18n 도입 시 e2e locale 무관화** — 패널 제목을 i18n 배선하면 테스트 기본 로케일(EN)에서 텍스트가 바뀌어 `getByRole('heading',{name:'한글'})` 단언이 깨진다. 닿는 e2e 의 텍스트 단언을 **존재하는 testId(패널 활성 확인)** 로 보정(단언 의미 동일, testId 자체는 R6 불변). login/eqp/user 일관.
- **서버 페이지네이션 도메인** — 콘텐츠 검색바는 API keyword 파라미터가 있을 때만 의미. 없으면(User/Group) 클라 검색은 현재 페이지만 필터해 오해 유발 → 미도입(R6 API 불변). forked 인상은 총건수 pill + 카드 + LNB + coral 로 달성.

## 다음 세션 진입 프롬프트 (R5-dlq — phase별 fresh 세션)

> ⚠️ R5-dlq 는 색치환 작업이 아니다. user/eqp 처럼 **D-R5-METHOD 4단(SPEC R5.0)** 으로. DlqSidebar 는 mode 전환형 — 콘텐츠 리스트 검색/페이지네이션 도입 여부는 dlq API 가 keyword/offset 파라미터를 지원하는지 확인 후 진입 시 사용자에게 1회 확인(user 처럼 서버 페이지네이션+keyword 부재면 미도입).

```
@.claude/specs/nori-client-forked-migration.md @.claude/specs/nori-client-forked-migration-plan.md @.claude/specs/nori-client-forked-migration-dev-report.md 셋 다 읽고 R5-dlq 구현.
이미 완료: Phase0/R1/R2/R5-login/R5-eqp/R5-user + 글로벌 chrome(AppTopBar nori-tc-logo). baseline delta 게이트(pre-existing lint: UserPasswordResetModal.tsx:45 set-state-in-effect / e2e 0 failed) 유지.
방식: SPEC R5.0 = D-R5-METHOD 4단 엄수. dev-report 의 "공통 컨벤션" 그대로 따를 것(특히 i18n e2e locale 무관화 / 서버 페이지네이션 검색 판단). 색치환만 하고 끝내지 말 것.
  (1) 틀 — forked 리스트 구조를 R1 shell(PageHeading[pill]/PageFilterBar/PagePagination/SelectableTable/PageModal)로 DlqPage 골격 재구성.
  (2) 콘텐츠 재배치 — Dashboard/Gateway/Business/Quarantine/RepairTask Panel 의 표 영역을 골격 slot 에 (prop/state/API/testId/data-* 불변, R6).
  (3) 사이드바 — DlqSidebar 에 forked LNB 시각(active 좌측 액센트+hover transition+flat, 아이콘 없음). mode 전환 동작/testId 불변(R4.1).
  (4) i18n — dlq.* 정적 키 신설 후 t() 배선. 동적 메시지는 보류.
  (5) 색 — dlq 33 hex → coral/neutral 토큰. status/뱃지 semantic 색은 보존.
D-GRID-ENGINE 엄수(SelectableTable 엔진/동작/prop/testId/data-* 불변, 시각 className·토큰만).
검증: build + eslint(변경파일, baseline delta NEW 0) + dlq-page e2e PASS + before/after 스크린샷 + 단일 commit.
이후 순서: model → deploy (각 phase 동일 4단). LiveMap 보류.
```
