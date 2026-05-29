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

### R5-login — LoginPage (commit 3)

#### SURGICAL 대조
- 출발점: 중앙 카드 + coral CTA 구조는 이미 존재. **단 전면 하드코딩 hex**(`#FAF8F5`/`#D95D39`/`#E8E4DF`/`#F5F3EF`/`#2D2D2D`/`#5A5A5A`/`red-500` 등) — D-TOKEN(색=ui-front 토큰) 위반 + soft shadow 부재.
- 조치: 하드코딩 hex 전량을 ui-front 토큰으로 치환 + 카드/모달에 `shadow-soft-lg` + CTA `rounded-pill`(R2 토큰 실소비). **구조/ID/aria/role/동작(useLogin hook, ESC 핸들러, register) 전부 불변 — 시각 토큰 className 만** (R6).

#### 토큰 매핑
- 페이지 bg `#FAF8F5` → `bg-muted` / 카드 `bg-white border-[#E8E4DF]` → `bg-card border-border shadow-soft-lg`
- coral `#D95D39` → `bg-brand-primary`/`text-brand-primary`/`border-brand-primary`, hover `#C85332` → `hover:bg-brand-primary/90`
- text `#2D2D2D` → `text-foreground`, `#5A5A5A`/`#6A7C74` → `text-muted-foreground`
- input `bg-[#F5F3EF]` → `bg-muted`, ring `#D95D39/30` → `ring-ring`
- error `red-500` → `text-danger`/`border-danger`
- CTA radius `rounded-full` → `rounded-pill` (R2 `--radius-pill` 토큰 적용)
- RecoveryModal: 동일 토큰 치환 (구조/role=dialog/aria-modal 보존)

#### 변경 파일
- `src/features/auth/components/LoginPage.tsx` — className 토큰 치환만 (로직 0 변경)

#### 검증
- `npm run build` ✅ — `✓ built in 10.02s`
- `npx eslint src/features/auth/components/LoginPage.tsx` ✅ EXIT 0
- `npx playwright test login-page.smoke` ✅ **1 passed (3.8s)**
- 스크린샷 — before: `.claude/specs/screenshots/before/login.png` / after: `.claude/specs/screenshots/after/login-R5.png` (카드 soft shadow elevation + 중립 토큰 bg + coral CTA pill)

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
