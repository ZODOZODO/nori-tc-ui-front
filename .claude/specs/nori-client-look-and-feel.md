# SPEC — nori-client Look & Feel Migration

> 작성일: 2026-05-28
> 단계: **Specify (confirmed — Open Questions Q1~Q3 사용자 확정 완료 2026-05-28)**
> 대상 레포: `nori-tc-ui-front` (단일 레포 — backend / nori-client 변경 없음)
> 출처: 사용자 요청 — "nori-tc-ui-front 의 모든 페이지를 nori-client 와 자매품처럼. 단 React 19 환경 + 최신 트렌드 (세련/깔끔) 로 재해석. topbar + topbar → sidebar 동작은 ui-front 것 유지. pnpm 금지, npm only."

## Why

`nori-tc-ui-front` 와 `nori-client` 는 *같은 회사 (보부하이테크 도메인)* 의 사용자가 함께 사용하는 인접 도구임에도, 시각 언어가 완전히 다름:

| 항목 | nori-client | nori-tc-ui-front |
|---|---|---|
| 폰트 | Nanum Gothic 400/700/800 ([_base.scss:2,34](../../../nori-client/src/assets/scss/_base.scss#L2)) | Noto Sans KR + Fraunces 로고 ([index.css:8](../../src/index.css#L8)) |
| 헤더 배경 | dark navy `#050e26` ([_header.scss:4](../../../nori-client/src/assets/scss/_header.scss#L4)) | white `bg-white` 53px fixed ([AppTopBar.tsx:142](../../src/shared/components/AppTopBar.tsx#L142)) |
| 주 액센트 | orange `#F88125` ([_color.scss:26](../../../nori-client/src/assets/scss/_color.scss#L26)) hover/link + cerulean blue `#3855B3` ([_color.scss:8](../../../nori-client/src/assets/scss/_color.scss#L8)) | green `#1C7F59` + orange `#d95d39` N 로고 ([AppTopBar.tsx:144](../../src/shared/components/AppTopBar.tsx#L144)) |
| 표 시스템 | TUI Grid (vanilla JS + jQuery-free wrapper, React 17/18 peer) | shadcn `<Table>` + `SelectableTable` + `@tanstack/react-virtual` (selectable-table-rollout SPEC 도입) |
| 차트 | TUI Chart 4 | (없음 — 도입 필요) |
| 3D | `@react-three/fiber` 8 + drei 9 + three 0.182 (React 17/18) | (없음 — 도입 필요) |
| 레이아웃 grid | 3-row `header / main / footer` ([_base.scss:83-92](../../../nori-client/src/assets/scss/_base.scss#L83)) + GNB hover → LNB drawer | 53px fixed topbar + 콘텐츠 + 각 feature 의 좌측 Sidebar 패널 |
| i18n | i18next + react-i18next | 자체 [i18n-context](../../src/i18n/i18n-context.ts) (ko/en) |
| 스타일 | sass partials + Bootstrap 5 + reactstrap | Tailwind 4 + radix-ui (shadcn) |

같은 회사 도구임에도 사용자가 두 앱을 오갈 때 *완전히 다른 회사 제품* 으로 인식되어 학습 비용 + 브랜드 일관성 손실. 동시에 nori-client 는 2010 년대 한국 SI 어드민 톤 (작은 라운드, 두꺼운 폰트, dark navy header, 작은 아이콘) 이라 그대로 따라가면 ui-front 가 *옛날 느낌* 으로 후퇴.

이 SPEC 은 **틀 = nori-client / 내용 = ui-front** 원칙으로 자매품 인상을 만든다:

- **틀 (page layout shell)** — nori-client 의 *공통 layout 위젯* (`Location` bread crumb / `SubTitleHeader` heading-primary / `header_subtitle_btn` / `TableActions` (`table_common.jsx`) / `common_page_modal` 모달 패턴 / GNB+LNB drawer 인상) 의 *시각 패턴* 을 ui-front 의 신규 공통 layout 컴포넌트로 추출 → ui-front 모든 페이지에 일괄 적용. 2026 트렌드로 재해석 (D10 의 weight/radius/shadow/transition 변환 규칙 적용).
- **내용 (page content)** — ui-front 의 기존 *기능 위젯* (EqpSidebar / EqpInfoTable / SelectableTable / ModelDetailPanel / DeployRegisterPanel / DlqPanel / 각 Modal 등) 과 라우트 / API / TanStack Query hook / Zustand store / 권한 모델 은 **변경하지 않는다**. 단 새 layout shell 안에 *재배치* 만 — 카드 영역 / 표 영역 / 액션 버튼 / 사이드 패널의 위치 / 여백 / 헤더 구조가 nori-client 처럼.
- **현대화** — nori-client 의 2010 년대 SI 톤 (작은 라운드, 두꺼운 폰트, dark navy header, 작은 아이콘) 은 빼고 2026 트렌드 (oklch 절제, soft shadow 다단, generous spacing, micro-interaction).

페이지 1:1 매핑은 *불가능* — ui-front (TC 관리) 와 nori-client (MES) 는 기능 도메인이 다름. 따라서 **공통 layout shell pattern 추출 → 모든 페이지에 일괄 적용** 이 SPEC 의 핵심.

## Requirements

### R1 — 디자인 토큰 시스템 통합 (foundation)

- [ ] `src/index.css` 의 `@theme` / `:root` CSS variables 에 nori-client 재해석 컬러 팔레트 도입:
  - `--color-brand-primary` = `#d95d39` (현 N 로고 색 [AppTopBar.tsx:144](../../src/shared/components/AppTopBar.tsx#L144) 재활용, 사용자 결정)
  - `--color-brand-accent` = nori-client cerulean 의 modern indigo 재해석 (예: `#3F4ECE` 또는 oklch 등가) — Q1 사용자 확정
  - `--color-success` / `--color-warning` / `--color-danger` / `--color-info` = nori-client semantic ([_color.scss:122-134](../../../nori-client/src/assets/scss/_color.scss#L122)) 의 oklch 재해석
  - `--color-grid-row-stripe` = nori-client `$grayscale-200 #E6E7E9` ([_color.scss:21](../../../nori-client/src/assets/scss/_color.scss#L21)) 의 oklch 등가
  - `--color-grid-row-select` = nori-client `$blue-500 #00A8F0` ([_color.scss:51](../../../nori-client/src/assets/scss/_color.scss#L51)) 의 modern 톤 재해석
  - `--chart-1 ~ --chart-5` = nori-client teal/blue/orange/danger/success 5-tone (기존 token 덮어쓰기)
- [ ] `--font-ui` 를 `'Pretendard', system-ui, sans-serif` 로 교체 ([index.css:8](../../src/index.css#L8))
- [ ] `pretendard` npm 패키지 도입 (확정 — `npm view pretendard` PASS: version 1.3.9, license OFL-1.1, 단일 패키지에 variable 포함, `pretendard-variable` 별도 패키지는 404 미존재)
- [ ] 기존 `--font-fraunces` 는 N 로고 전용으로 보존 (제거하지 않는다 — surgical change 원칙)

#### R1.2 — 보조 디자인 토큰 (shadow / radius tier / focus ring / z-index / animation / link color)

D1 에서 컬러·폰트만 다뤘으나, 2026 트렌드 재해석을 위해 다음 토큰도 함께 통합한다:

- [ ] **shadow tier** — Tailwind 4 기본 `shadow-sm/md/lg/xl/2xl` 을 nori-client `_header.scss:173` (`0 0 1px rgba(secondary,0.16), 0 0 20px rgba(secondary,0.23)` 더블 shadow) 의 *다단 soft shadow* 인상으로 재해석. 새 토큰 `--shadow-soft-sm/md/lg` 신설 또는 Tailwind shadow customizer 로 oklch 등가
- [ ] **radius tier** — 현 `--radius: 0.625rem` (10px) 단일 유지. Phase 1 에서는 기존 `@theme inline` 의 `--radius-sm/md/lg/xl` calc 매핑 (`calc(var(--radius) - 4px)` 등) 을 **유지** — Plan S1 위험 식별의 trade-off (모든 컴포넌트 `rounded-sm/-md/-lg/-xl` utility 의 px 변경 → 회귀 위험 차단). Phase 2~ 페이지 phase 진입 시 페이지별 시각 결정과 함께 명시 값 (`--radius-sm: 0.375rem` 등) 점진 치환 검토. nori-client 의 4px 작은 radius 는 8~12px 로 재해석하는 방향성은 유지
- [ ] **focus ring 토큰** — 현 `focus-visible:ring-[#1C7F59]/30` 하드코딩 → `var(--ring)` + brand primary 의 0.3 opacity 토큰화. a11y contrast ratio 4.5:1 이상 확보
- [ ] **z-index 토큰** — nori-client `_base.scss` 의 12 단계 시스템 (`$zindex-base=0`, `$zindex-menu=500`, `$zindex-banner=800`, `$zindex-toolbar=900`, `$zindex-header=1000`, `$zindex-dropdown=2200`, `$zindex-modal=3000`, `$zindex-toast=3200`, `$zindex-overlay=3500`, `$zindex-tooltip=4000`) 를 ui-front 의 CSS variable 로 흡수 — radix-ui 의 기본 z-index 와 충돌 없게 매핑
- [ ] **animation duration / easing 토큰** — Tailwind 4 의 transition utility (`duration-200`, `ease-out`) 를 일관 사용. 신규 토큰 `--motion-duration-fast: 150ms`, `--motion-duration-base: 200ms`, `--motion-duration-slow: 300ms` 정의. nori-client `_header.scss:17` 의 `transition: all .2s` 인상 흡수
- [ ] **글로벌 링크 색 토큰** — nori-client `_base.scss:19-20` (`a:link { color: $cerulean-500 }`, `a:hover { color: $primary }`) 패턴을 ui-front 의 `--color-link` / `--color-link-hover` 로 토큰화. 단 *전역 a 셀렉터 스타일 주입은 금지* (radix-ui 컴포넌트와 충돌) — Tailwind `@layer base` 안에서 명시 적용
- [ ] **typography rhythm 토큰** — nori-client 본문 line-height 1.6 (`_base.scss:36`, Nanum Gothic 두꺼움 보정) 은 Pretendard 에 과함. Pretendard 적정 값으로 재해석 + 인라인 `tracking-[...]` 하드코딩 (LiveMap 5+ 파일 / LoginPage / AppTopBar) 표준화:
  - `--leading-tight: 1.25` — heading (h1~h3, dialog title)
  - `--leading-body: 1.5` — 본문 / 표 셀 / 라벨 (Nanum 1.6 → Pretendard 1.5)
  - `--leading-relaxed: 1.7` — 긴 본문 (필요 시, 사용처 적음)
  - `--tracking-tight: -0.01em` — heading (Pretendard 자간 살짝 좁힘)
  - `--tracking-normal: 0` — 본문 기본
  - `--tracking-wide: 0.04em` — small caps / 라벨 (LiveMap 의 tracking-[0.06~0.16em] 인상 표준화)
  - 인라인 `tracking-[Nem]` 사용처는 R7 / R4 phase 에서 새 토큰으로 점진 치환 (한꺼번에 일괄 교체 금지 — 변경 범위 폭주 회피)

### R2 — Topbar 시각 정렬

- [ ] [AppTopBar.tsx](../../src/shared/components/AppTopBar.tsx) 의 **구조·동작·라우팅·prefetch 로직은 변경하지 않는다** — 사용자 명시 결정.
- [ ] 시각 토큰만 교체:
  - 헤더 height 53px 유지
  - active nav underline color `#1C7F59` → `var(--color-brand-primary)` 또는 `var(--color-brand-accent)` (Q1 확정 후)
  - 텍스트 컬러 (`#173f31` / `#6A7971` / `#2B4A3F`) → oklch grayscale 토큰
  - 로고 N 박스 `#d95d39` 는 그대로 유지 (브랜드 기준)
- [ ] LanguageToggle / Logout / Profile 버튼은 신규 토큰으로 자연 재스타일 — 구조 변경 없음

### R3 — 라이브러리 매핑 (nori-client → ui-front R19 호환 + 무료)

사용자 결정 기준: *"nori-client 가 가지고 있는 라이브러리를 상위 호환하며, 무료이면서, nori-tc-ui-front 에서 사용이 가능한것"*

#### R3.0 — 사전 조사 (2026-05-28)

**워크스페이스 전체 (`c:/workspace_nori/*/package.json`) grep**: 차트/그리드 후보가 다른 nori-tc-* 6 개 레포에 도입된 곳 **0건**. nori-client 만 `@tanstack/react-table 8.21.3`, `@toast-ui/react-grid 4.20.3`, `@toast-ui/chart 4.4.1`, `@react-three/fiber 8.17.10` 보유. → ui-front 도입 결정은 다른 nori-tc-* 레포에 영향 없음.

**nori-client TUI Grid 실사용 기능 카탈로그** (36 사용 파일):
| 기능 | 사용 페이지 수 | 비고 |
|---|---|---|
| `sortable: true` | 광범위 (wo_mst_page 만 12 회) | 헤더 클릭 정렬 |
| `renderer:` custom React component | 광범위 | 셀 커스텀 컴포넌트 |
| `filter:` | 일부 | 헤더 드롭다운 필터 |
| `editor:` | 일부 | 셀 인라인 편집 |
| `summary:` 합계 row | **5 페이지** | prod_plan / prod_inv_board / board_list_Ps / perf_monthly/weekly/daily |
| `rowHeaders: ['checkbox']` | **4 페이지** | wip_mst / prod_proc / prod_mst / proc_mst |
| `treeColumn` / `frozenColumn` / `cellMerge` / `paginator` / `copyOptions` / `exporter` / `relationColumns` | **0 hits — 미사용** |

**nori-client TUI Chart 종류** (5 사용 파일): `ColumnChart` / `BarChart` / `LineChart` / `PieChart` / `LineScatterChart` (SPC line + scatter combo).

**nori-client @react-three/fiber 패턴** (2 사용 파일): `Canvas` + `OrbitControls` (drei) + `ambientLight` / `spotLight` / `pointLight` + `Suspense` + `GLTFLoader` + `useFrame` / `useLoader` + `<mesh>` + `<primitive>` — 표준 R3F+drei. v9+drei v10 으로 1:1 상위 호환.

**nori-client `gsap` / `react-transition-group` 사용처**: gsap = `components/equipment.jsx` 1 파일만, react-transition-group = `components/header.jsx` 1 파일만. **광범위 의존 아님** — ui-front 의 Tailwind transition + radix-ui 로 동등 효과 가능 → 도입 불필요.

#### R3.1 — 후보 라이브러리 R19 peer 검증 (`npm view` 2026-05-28)

**Grid 후보**:
| 후보 | R19 peer | 버전 | 라이선스 | 결과 |
|---|---|---|---|---|
| `@tanstack/react-table` | ✅ `react >=16.8` | 8.21.3 | MIT | **최종 후보 A (확정)** — nori-client 도 도입, *상위 호환* 조건 충족 |
| `react-data-grid` | ✅ `react ^19.2` | 7.0.0-beta.59 | MIT | 후보 B — R19 명시 peer (유일), beta 단계 위험 |
| `ag-grid-react` (Community) | ✅ `react ^16/17/18/19` | 35.3.0 | MIT (Community) | 후보 C — 무거움 (~1.5MB), 자체 디자인 시스템 |
| `tabulator-tables` (vanilla) | (peer 없음) | 6.4.0 | MIT | 후보 D — 자체 React wrapper 작성 필요 |
| `ka-table` | ✅ `react ^16/17/18/19` | 12.0.3 | MIT | 후보 E — 인지도 ↓ |
| `react-tabulator` | ❌ `react ^16/17` only | 0.21.0 | MIT | **탈락 (R18/19 미지원)** |
| `@glideapps/glide-data-grid` | ❌ `react ^16/17/18` only | 6.0.3 | MIT | **탈락 (R19 미지원)** |
| `@silevis/reactgrid` | ❌ `react ^16/^17/^18.2` only | 4.1.17 | MIT | **탈락 (R19 미지원)** |
| `handsontable` / `@handsontable/react` | (peer 없음) | 17.1.0 / 16.2.0 | **상업** (`SEE LICENSE IN LICENSE.txt`) | **탈락 (유료)** |
| `material-react-table` | △ `react >=18`, **MUI 6+ 강제** | 3.2.1 | (license 미명시) | **탈락 (shadcn 충돌)** |
| `@mui/x-data-grid` | ✅ `react ^17-^19`, **MUI 강제** | 9.3.0 | MIT (Community) | **탈락 (shadcn 충돌)** |

**Chart 후보**:
| 후보 | R19 peer | 버전 | 라이선스 | bundle (압축) | 결과 |
|---|---|---|---|---|---|
| `recharts` | ✅ `react ^16-^19` | 3.8.1 | MIT | ~95KB | **최종 후보 A (확정)** — shadcn/ui 공식 chart, declarative SVG, ComposedChart 로 LineScatter (SPC) 커버 |
| `echarts-for-react` + `echarts@^5` | ✅ `react ^15 \|\| >=16` | 3.0.6 / 5.x | Apache 2.0 | ~360KB | 후보 B (SPC 정밀시 보조) |
| `react-chartjs-2` + `chart.js@^4` | ✅ `react ^16-^19` | 5.3.1 / 4.x | MIT | ~135KB | 후보 C |
| `@nivo/core` (per-chart 패키지) | ✅ `react ^16.14-^19` | 0.99.0 | MIT | ~150KB+/chart | 후보 D |
| `react-apexcharts` + `apexcharts@^5` | ✅ `react >=16.8` | 2.1.0 / 5.x | MIT | ~250KB | 후보 E |

**3D 후보** (단일 표준):
| 후보 | R19 peer | 버전 | 라이선스 | 결과 |
|---|---|---|---|---|
| `@react-three/fiber` | ✅ `react >=19 <19.3, three >=0.156` | 9.x | MIT | **최종 (확정)** |
| `@react-three/drei` | ✅ `react ^19, three >=0.159, @react-three/fiber ^9.0.0` | 10.7.7 | MIT | **최종 (확정)** |
| `three` | (peer 없음) | 0.184.0 | MIT | **최종 (확정)** |

**DatePicker 후보**:
| 후보 | R19 peer | 버전 | 라이선스 | 결과 |
|---|---|---|---|---|
| `react-day-picker` | ✅ `react >=16.8.0` | 10.0.1 | MIT | **최종 (확정)** — shadcn 표준 |

**Pretendard 배포 방식**:
| 후보 | 비고 | 결과 |
|---|---|---|
| `pretendard` npm 패키지 | `npm view pretendard`: version 1.3.9, license OFL-1.1, variable 통합 (`pretendard-variable` 404 미존재) | **최종 (확정)** |
| self-host woff2 | 더 명시적, subset 가능 | 대안 (필요 시 phase 1 재결정) |

#### R3.2 — 최종 라이브러리 매핑 (사용자 권장 확정 2026-05-28)

| nori-client 라이브러리 | ui-front 대체 | 결정 근거 |
|---|---|---|
| `@toast-ui/react-grid` / `tui-grid` | **`SelectableTable` + `@tanstack/react-virtual` + `@tanstack/react-table@^8.21`** | TUI Grid React wrapper R17/18 peer (R19 미보장). selectable-table-rollout.md L69 외부 grid 도입 금지 결정 승계. SelectableTable 가 sortable / renderer / range copy / virtualization 담당, TanStack Table headless model 이 filter / summary / row selection (checkbox) 보강. nori-client 도 TanStack Table 도입 — *상위 호환* 조건 충족. 미사용 기능 (tree / frozen / cellMerge / paginator / copyOptions / exporter / relationColumns) 은 도입 불필요. |
| `@toast-ui/chart` | **`recharts@^3.8`** | R19 공식 지원 (react ^16-^19 peer), declarative SVG, shadcn/ui 공식 chart, `--chart-1~5` 토큰 직접 매핑, ComposedChart 로 LineScatterChart (SPC) 표현 가능. ECharts (~360KB) 대비 가벼움 (~95KB). |
| `@toast-ui/select-box` | `radix-ui` Select (이미 도입 — [components/ui/select.tsx](../../src/components/ui/select.tsx)) | shadcn 표준. |
| `tui-date-picker` | **`react-day-picker@^10.0`** + radix Popover | shadcn 표준, R19 OK 검증 완료. day/month/range 1:1 대체. |
| `@react-three/fiber@8` + `@react-three/drei@9` + `three@0.182` | **`@react-three/fiber@^9`** + **`@react-three/drei@^10.7`** + **`three@^0.184`** | 직접 상위 호환. R3F v9 React 19 공식 지원. nori-client 의 Canvas / OrbitControls / lights / GLTFLoader / useFrame / useLoader 1:1 호환. expo/react-native peer 는 optional (실제 미사용 시 무시). |
| `bootstrap` + `reactstrap` | Tailwind 4 + radix-ui (이미 도입) | 동등 기능, utility-first. |
| `sass` | Tailwind 4 utility + CSS modules (필요 시) | 의존 제거. nori-client 의 SCSS partial 패턴은 Tailwind 토큰으로 흡수. |
| `i18next` + `react-i18next` | 기존 [i18n-context](../../src/i18n/i18n-context.ts) | 통일. nori-client 의 i18n 키는 ui-front locale (ko/en) 에 필요 시 흡수 (각 phase 결정). |
| `gsap` | **Tailwind transition + radix-ui 의 motion props** | nori-client 사용처 1 파일 (`equipment.jsx`) — 광범위 의존 아님. ui-front 에서 동등 효과는 Tailwind/radix 로 충분. **도입 불필요**. |
| `react-transition-group` | Tailwind transition + radix-ui (예: Collapsible / Accordion) | nori-client 사용처 1 파일 (`header.jsx` 메뉴 hover drawer). ui-front 의 AppTopBar 는 동일 UX 미사용 — **도입 불필요**. |
| `react-quill-new` | (도입 시) `@tiptap/react` | 사용처는 nori-client 게시판 — ui-front 에 해당 페이지 없음 → 본 SPEC **OoS**. |
| `qrcode.react@^4` / `html5-qrcode@^2` / `@zxing/browser` | (도입 시) 그대로 | 사용처는 nori-client header 의 바코드 modal — ui-front 에 해당 기능 없음 → 본 SPEC **OoS**. |
| `rxjs` | 그대로 (peer 없음) | 동일. |
| `react-icons` | `lucide-react` (이미 도입) | 통일. |
| (신규 폰트) | **`pretendard@^1.3` npm 패키지** | `npm view pretendard` PASS: version 1.3.9, license OFL-1.1. variable 패키지 통합. |

#### R3.3 — 도입 시점 (페이지 phase 와 결합)

선 도입 금지 — 사용처 없는 의존성 부풀림 방지. 각 라이브러리는 첫 사용 phase 에서만 의존성 추가. 각 phase commit 메시지에 `npm view <pkg> peerDependencies` 출력 마지막 5~10 줄 + `npm install` 출력 인용 의무.

- [ ] **Phase 1 (토큰 + Pretendard)** — 신규: `pretendard@^1.3`
- [ ] **Phase 4 (Model)** — 신규: `@tanstack/react-table@^8.21` (SelectableTable + react-table 결합으로 summary / row checkbox / advanced filter 보강)
- [ ] **Phase 5 (Deploy)** — 신규: `recharts@^3.8` (dashboard 인상의 차트 도입)
- [ ] **Phase 8 (LiveMap)** — 신규: `@react-three/fiber@^9` + `@react-three/drei@^10.7` + `three@^0.184`
- [ ] Date picker 사용처 식별 시 (각 phase) — 신규: `react-day-picker@^10.0`

### R4 — 페이지별 *layout shell 적용 + 내부 콘텐츠 재배치* (Phase 2~)

ui-front 의 7 라우트 (login / eqp / eqp/live-map / model / deploy / dlq / user) 를 phase 별로 진행. 각 phase 는 단일 페이지 commit (selectable-table-rollout 격리 패턴 승계, phase 별 PR/머지 금지).

**중요**: 페이지 phase 진입 전 **R7 (공유 컴포넌트 시각 토큰) + R8 (공통 layout shell pattern)** 이 commit 되어야 한다. R8 의 layout shell 컴포넌트 없이는 페이지 phase 진입 불가.

**각 phase 의 작업 — *틀 = R8 의 layout shell 적용, 내용 = ui-front 기존 기능 위젯 재배치***:

1. R8 의 `<PageLayoutShell>` (Location bread + PageHeading + ActionBar 슬롯 + Content 슬롯) 으로 해당 페이지 wrap
2. 기존 페이지의 *내부 기능 위젯* (Sidebar / Table / Panel / Modal) 은 그대로 사용 — 단 shell 의 slot 안에 *재배치*. 기능 위젯의 prop / state / hook / API 변경 금지.
3. nori-client 의 *해당 카테고리 페이지 인상* (대시보드 카드 grid / 표 페이지 location+heading+actions+table / 상세 페이지 sidebar+tab+form) 의 *시각 배치* 따름.
4. D10 재해석 규칙 적용 (weight 500/600 / radius 8~12 / soft shadow / muted color / 200-300ms ease-out).

- [ ] **Phase 2: LoginPage** ([features/auth/components/LoginPage.tsx](../../src/features/auth/components/LoginPage.tsx)) — nori-client `login.jsx` / `_login.scss` 인상 (중앙 카드, soft shadow, brand color CTA, 좌측 일러스트 영역). **유일하게 1:1 매핑 가능한 페이지** — 둘 다 단순 form. layout shell 의 *single-card variant* 적용.
- [ ] **Phase 3: EqpPage** — nori-client *표 페이지 인상* (Location + PageHeading + ActionBar + 표 + Modal). ui-front 의 EqpSidebar / EqpInfoTable / EqpParamTable / 6종 Modal 모두 shell 안에 재배치. Sidebar 는 shell 의 좌측 slot, 표는 Content slot, Modal 진입 버튼은 ActionBar slot.
- [ ] **Phase 4: ModelPage + ModelDetailPanel** — nori-client *상세 페이지 인상* (Location + PageHeading + 좌 list / 우 detail 분할 + tab + form + 표). ModelDetailPanel 의 8 노드 / SelectableTable / Modal 그대로, 배치만 nori-client 패턴.
- [ ] **Phase 5: DeployPage** — nori-client *대시보드 인상* (Location + PageHeading + 카드 grid + Recharts 차트 + 표). Recharts 도입 (D5).
- [ ] **Phase 6: DlqPage** — nori-client *표 페이지 인상* + Common Modal 패턴. 5 패널의 표 영역을 shell 의 multi-section variant 안에.
- [ ] **Phase 7: User / UserManagement / Profile** — nori-client *form 페이지 인상* + Modal 패턴. UserListTable / GroupListTable / 멤버 관리 Modal 재배치.
- [ ] **Phase 8: LiveMapPage (3D)** — nori-client `eqp_layout.jsx` 의 3D + 차트 + 표 인상. R3F v9 + drei v10 도입 (D6).

각 phase 의 commit 메시지에 *변경 전 / 변경 후 스크린샷 경로* 명시 (사용자 시각 확인은 dev 환경에서 phase 단위).

### R5 — 회귀 안전망

- [ ] 각 phase 는 *layout shell 적용 + 콘텐츠 재배치*. 페이지 로직 / 라우팅 / API / TanStack Query hook / Zustand store / radix prop / 기능 위젯의 prop·state 변경 금지.
- [ ] 각 phase 의 e2e 회귀 (`playwright test`) 통과 + console.error / pageerror 0 건.
- [ ] selectable-table-rollout e2e 회귀 0 (SelectableTable 컴포넌트 시각만 바뀜 — 동작 동일).
- [ ] `tsc -b` / `eslint .` / `vite build` 통과.

### R6 — i18n 회귀

- [ ] Pretendard 도입 후 ko/en 모두 글자 깨짐 / 클리핑 없음 (육안 확인 + Playwright screenshot diff).

### R7 — 공유 컴포넌트 (shadcn primitives + shared) 시각 토큰 통합 — **Phase 1.5 (페이지 phase 진입 전)**

**재해석 원칙 (D1·D2 와 동일하게 컴포넌트 단위에도 적용)**:
- nori-client SCSS partial 의 *인상* (modal 중앙정렬·soft shadow·CTA 강조 / button 색 가족 / form border + focus 강조 / table 줄무늬·sticky header) 은 유지
- **옛 SI 톤은 제거** — 두꺼운 weight (700 → 500/600), 작은 radius (4px → 8~12px), 진한 채도 (orange #F88125 그대로 → coral #d95d39 + indigo accent), 두꺼운 border (1px solid 진색 → 0.5~1px subtle grayscale), 큰 그림자 (0 0 20px → 다단 soft shadow), 진한 link color (cerulean #3855B3 → muted indigo)
- 2026 트렌드 — soft shadow (multi-layer), wider radius, lighter weight, oklch 채도 절제, subtle border, micro-interaction (200-300ms ease-out transition), generous spacing, contrast ↑ a11y

**근거**: nori-client 의 모달/alert/form 패턴이 **30+ 파일에 264 occurrences** 광범위 사용 (워크스페이스 grep). ui-front 도 모든 페이지가 동일 공유 컴포넌트 (Dialog / Button / Input / Select 등) 를 사용 — 컴포넌트 시각 일관성 확보가 페이지 phase 의 *전제 조건*. 페이지 phase 마다 컴포넌트를 따로 만지면 cross-phase 시각 어긋남 + 재작업 위험.

**대상 — ui-front `src/components/ui/*.tsx` 11 개** (선 도입 검증):
- [ ] [badge.tsx](../../src/components/ui/badge.tsx) — 상태 chip / 카테고리 표시. nori-client `_color.scss` 의 status color (success/warning/danger/info low/medium tone) 매핑
- [ ] [button.tsx](../../src/components/ui/button.tsx) — primary/secondary/ghost/outline/destructive variant. nori-client `_button.scss` 인상 (radius 4 → 8, weight 700 → 500/600, brand primary `#d95d39` + brand accent indigo + danger/success)
- [ ] [confirm-dialog.tsx](../../src/components/ui/confirm-dialog.tsx) — alert/confirm 대체. nori-client `_modal.scss` 인상 (중앙 정렬, soft shadow, CTA 강조)
- [ ] [context-menu.tsx](../../src/components/ui/context-menu.tsx) — 우클릭 메뉴. focus/highlight color 토큰
- [ ] [dialog.tsx](../../src/components/ui/dialog.tsx) — 모달 표준. nori-client `_modal.scss` 인상 (overlay opacity, panel radius, close button 위치)
- [ ] [input.tsx](../../src/components/ui/input.tsx) — `#1C7F59` → `var(--color-brand-primary)`, border `#D8E1DB` → 새 grayscale 토큰
- [ ] [resizable-divider.tsx](../../src/components/ui/resizable-divider.tsx) — 색만 갱신
- [ ] [select.tsx](../../src/components/ui/select.tsx) — input 과 동일 토큰 매핑
- [ ] [sidebar-resize-handle.tsx](../../src/components/ui/sidebar-resize-handle.tsx) — 색만 갱신
- [ ] [skeleton.tsx](../../src/components/ui/skeleton.tsx) — nori-client `_loading.scss` 인상 (gradient / pulse 톤)
- [ ] [table.tsx](../../src/components/ui/table.tsx) — nori-client `_table.scss` 인상 (header 배경 `#F6F9F7` → 새 토큰, row 줄무늬 옵션)

**대상 — ui-front `src/shared/components/*` 3 개**:
- [ ] [AppPageShell.tsx](../../src/shared/components/AppPageShell.tsx) — 페이지 공통 shell (헤더 + 콘텐츠 wrapper). 토큰만 갱신, 구조 미변경.
- [ ] [AppTopBar.tsx](../../src/shared/components/AppTopBar.tsx) — **R2 에서 별도 처리** (R7 와 중복 작업 금지)
- [ ] [SelectableTable/](../../src/shared/components/SelectableTable/) — **R1 의 SelectableTable 토큰 갱신 항목과 통합** (중복 금지)

**SPEC 명시 처리 패턴**:
- [ ] 신규 alert/confirm/toast/notification 시스템 도입 **금지** — ui-front 의 confirm-dialog.tsx 가 nori-client 의 `window.alert` / `window.confirm` 패턴을 *기능 측면* 에서 이미 대체. 본 SPEC 은 *시각 토큰만* 갱신.
- [ ] sonner / react-hot-toast 등 toast 라이브러리 신규 도입 **금지** — nori-client 도 toast 미사용 (grep 0 hits). 도입 필요 시 별 SPEC.
- [ ] form validation message 시각만 nori-client `_form.scss` 의 error color 인상으로 갱신 — `react-hook-form` + `zod` 구조 미변경.

**R7 의 e2e 회귀**:
- [ ] 각 컴포넌트의 e2e 시나리오가 존재하는 경우 회귀 0 (예: `*-dialog.spec.ts`, `selectable-table-*.spec.ts`)
- [ ] R7 commit 메시지에 11 개 컴포넌트의 storybook fixture 또는 dev 페이지 screenshot 경로 명시 (변경 전/후)

### R8 — 공통 layout shell pattern 신설 — **Phase 1.7 (페이지 phase 진입 전 필수)**

**근거**: nori-client 의 모든 페이지 (60+) 가 `Location` + `SubTitleHeader` + `TableActions` + `Common Modal` 의 *동일 layout shell* 위에 콘텐츠를 올림 (워크스페이스 grep — boardpages / dashpages / mngpages / perfpages / procpages / prodpages / qualitypage 전수 사용). ui-front 는 이 등가 부재 (`AppPageShell` 하나만, 그것도 단순 wrapper). 페이지마다 nori-client 인상을 흉내 내려면 **shell 이 먼저 있어야 한다**. 이게 *틀 = nori-client* 의 핵심 — D14 참조.

**대상 — 신규 공통 layout 컴포넌트 (`src/shared/layout/` 안)**:

- [ ] `<PageLocation>` — nori-client [location.jsx](../../../nori-client/src/components/location.jsx) 인상. Home › subtitle › name bread crumb. Props: `subtitle` / `name`. 2026 재해석 — `·` 구분자 → chevron `›`, weight 700 → 500, 채도 절제.
- [ ] `<PageHeading>` — nori-client [header_subtitle.jsx](../../../nori-client/src/components/header_subtitle.jsx) 의 `heading-primary` (icon + name + hr) 인상. Props: `icon?` / `name` / `description?`. hr → soft border, icon 색은 brand-primary muted variant.
- [ ] `<PageHeadingWithActions>` — nori-client `header_subtitle_btn.jsx` 인상. heading + 우측 button group slot. ActionBar 슬롯과 통합 가능.
- [ ] `<PageActionBar>` — nori-client `TableActions` ([table_common.jsx](../../../nori-client/src/components/table_common.jsx)) 인상. 표 위 액션 영역 (조회 / 등록 / 엑셀 다운로드 / 검색 / 필터). Children slot. 우측 정렬, gap, button group spacing 2026 톤.
- [ ] `<PageLayoutShell>` — 통합 wrapper. 구조: `<PageLocation>` + `<PageHeading*>` + `<PageActionBar?>` + `<main>{children}</main>`. Props: `bread` (subtitle/name) / `heading` / `actions?` / `children` (콘텐츠). ui-front 의 모든 페이지가 이 shell 로 wrap.
- [ ] `<PageModal>` — nori-client [common_page_modal.jsx](../../../nori-client/src/components/common_page_modal.jsx) 인상. header (title + close) + body + footer (CTA 우측 정렬). ui-front 의 기존 [dialog.tsx](../../src/components/ui/dialog.tsx) 를 *확장* (대체 금지 — confirm-dialog 등 사용처 영향 차단). variant prop 으로 nori-client 패턴 활성화.

**R8 의 변환 규칙 (D10 적용)**:
- [ ] 두꺼운 weight 700 (nori-client heading) → 500/600
- [ ] 작은 radius (nori-client 4px / hr 1px solid) → 8~12px / hr 0.5px subtle
- [ ] dark navy header (#050e26) 인상 흡수 금지 — 흰색 / muted grayscale 유지 (D2)
- [ ] aria-* / role / focus ring 명시 (a11y 4.5:1)

**R8 의 e2e + AC**:
- [ ] `<PageLayoutShell>` 의 storybook fixture 또는 dev 페이지에 6 variant (bread만 / heading만 / heading+actions / single-card login / multi-section / modal) screenshot
- [ ] 기존 페이지 e2e 회귀 0 — R8 commit 머지 전 baseline 확보 (페이지 phase 진입 전 단계)
- [ ] AppPageShell 은 *유지* — R8 의 `<PageLayoutShell>` 은 AppPageShell 의 *상위* (AppPageShell = topbar + 콘텐츠 wrapper, PageLayoutShell = 콘텐츠 wrapper 안의 *페이지 내부 shell*). 명확한 계층 분리.

## Constraints

- **React 19.2 / Vite 7.3 / Tailwind 4.2 / radix-ui / TanStack Query 5 / Zustand 5 환경** 그대로. peer 충돌 의심 라이브러리는 도입 전 `npm view <pkg> peerDependencies` 검증.
- **npm only** — pnpm / yarn 사용 금지 (사용자 명시).
- **외부 grid 라이브러리 도입 금지** — selectable-table-rollout SPEC 결정 [selectable-table-rollout.md:69](selectable-table-rollout.md#L69) 승계. TUI Grid 임시 wrapper 도 금지.
- **AppTopBar 구조 변경 금지** — 사용자 명시. 시각 토큰만 교체.
- **ui-front 의 기존 라우트 / 페이지 / 기능 / API 호출 / 권한 모델 변경 금지** — 자매품화는 *시각 마이그레이션 only*. nori-client 의 페이지를 가져오는 게 아니다.
- **nori-client 의 dark navy 헤더 (#050e26) 그대로 도입 금지** — 사용자가 "옛 느낌 빼고 세련" 명시. 현 ui-front 흰색 헤더 유지 (Q1 확정 시 변경 가능).
- **font-fraunces 제거 금지** — N 로고 전용으로 보존.
- **각 phase 의 commit 은 단일 페이지** (또는 단일 R 단위) — cross-page 오염 0 (selectable-table-rollout R7 패턴). **phase 별 PR / MR 생성 금지**.
- **MR 정책** — 본 SPEC 의 모든 Phase (1 / 1.5 / 2~8) 가 동일 branch (`docs/nori-client-look-and-feel-spec` 또는 후속) 에 commit 만 누적. SPEC 전체 완료 후 **단일 MR 로 branch → main 일괄 통합**. 중간 phase 머지 금지.
- **SelectableTable 컴포넌트 자체의 비주얼 토큰만** R7 (Phase 1.5) 에서 한 번 갱신 (`#1C7F59` 등 옛 green → `brand-accent` 토큰 + `grid-row-stripe/select` 토큰). 동작 / API / range copy 로직 변경 금지.

## Acceptance Criteria

각 기준은 **기계 검증 가능**해야 한다. 단일 명령 단위.

### 전체 (모든 phase 공통)

- [ ] `npm install` PASS — peer 충돌 0
- [ ] `npm run build` PASS (`tsc -b && vite build`)
- [ ] `npm run lint` PASS
- [ ] `npm run test:e2e` PASS — 자연 실행 PASS 결과로 검증 (회귀 0). console.error / pageerror 자동 감지는 ui-front fixture 에 `page.on('console')` / `page.on('pageerror')` 미등록 — 본 SPEC 범위 외, 별 SPEC 으로 분리
- [ ] selectable-table-* e2e PASS (회귀 0)
- [ ] `git grep -E "tui-grid|tui-chart|tui-date-picker|reactstrap|bootstrap/dist|@react-three/fiber.*\^?8" src/` → 0 hits (nori-client 잔재 0)

### R1 — 디자인 토큰

- [ ] `git grep -E "var\(--color-brand-primary\)|bg-brand-primary|text-brand-primary|border-brand-primary" src/` ≥ 5 곳 (도입 확산 — Tailwind 4 utility class `bg-brand-primary` 등도 포함). D1 으로 brand-primary 자체는 N 로고 hex 유지 (사용처 0 가능) — 페이지 phase (R4) 누적 도입 시 충족. 보조 검증: `git grep -E "var\(--color-brand-accent\)|bg-brand-accent|text-brand-accent|border-brand-accent" src/` ≥ 5 (현 Phase 1.5 누적 충족)
- [ ] [src/index.css](../../src/index.css) 의 `--font-ui` 가 `'Pretendard'` 포함 문자열로 갱신
- [ ] `npm view recharts react@19` peer 확인 PASS — 출력 인용 commit 메시지에 첨부

### R2 — Topbar

- [ ] [AppTopBar.tsx](../../src/shared/components/AppTopBar.tsx) 의 `import` / `navigationItems` / `handleNavigateMenu` / `handleLogout` / `prefetchByMenuKey` 시그니처 git diff 0 라인 변경
- [ ] AppTopBar 의 변경 라인이 모두 className 토큰 치환에 한정됨 — git diff 가 import / interface / 함수 / handler / prefetch / navigationItems / JSX 구조 부분 0 라인 변경. 워크스페이스 전체 (c:/workspace_nori/*) snapshot 인프라 (`toHaveScreenshot` / `toMatchSnapshot`) 부재 확인 → 비주얼 자동 검증은 본 SPEC 범위 외, dev 캡처 (R7 commit 메시지 캡처 경로) 와 수동 시각 확인으로 대체

### R4 — 각 페이지 phase

- [ ] 각 phase commit 메시지에 변경 전 / 변경 후 스크린샷 경로 명시
- [ ] 해당 페이지 e2e PASS — 동작 회귀 0

### R7 — 공유 컴포넌트 일괄 통합 (Phase 1.5)

- [ ] `git grep -E "#1C7F59|#D8E1DB|#93A19A|#243129|#8D9893|#EDF4EF|#F6F9F7|#EAF5EE" src/components/ui/ src/shared/components/AppPageShell.tsx` → 0 hits (옛 green 토큰 잔재 0)
- [ ] R7 commit 메시지에 11 개 shadcn primitives + AppPageShell + SelectableTable 의 변경 전/후 스크린샷 또는 dev 페이지 캡처 경로
- [ ] 모든 페이지 e2e 회귀 0 (R7 commit 후 페이지 phase 진입 전 baseline 확보)

## Out of Scope

- **nori-client 의 페이지 / 기능 / 라우트 / API 의 ui-front 로의 이식** — 사용자 명시: 시각 마이그레이션 only
- **ui-front 의 기능 / 라우트 / API / 권한 모델 변경**
- **모바일 대응** (Q3 사용자 확정 — 기본은 OoS, 대체 SPEC 으로 분리)
- **i18n 키 nori-client 와의 통합** — ui-front 자체 i18n-context 그대로
- **TopBar 구조 / 동작 변경** — 시각 토큰만 교체
- **외부 grid 라이브러리 도입** — selectable-table-rollout 결정 승계
- **rich text editor (react-quill-new → tiptap) 도입** — 사용처 페이지 식별 시점에 별 SPEC
- **바코드 / QR 스캐너 도입** — nori-client 의 `html5-qrcode` / `qrcode.react` 사용처는 ui-front 에 없음. 도입 시 별 SPEC
- **gsap 애니메이션 1:1 복원** — Framer Motion 도입 여부는 phase 별 케이스 결정
- **dark navy 헤더 (#050e26) 그대로 도입** — 사용자 "옛 느낌 제거" 명시 (Q1 확정 시 재검토)
- **nori-client 의 useDeviceType 모바일 분기 파일 (*.mobile.jsx) 패턴 도입** — Q3
- **신규 alert / confirm / toast / notification 라이브러리 도입** — sonner / react-hot-toast 등 신규 의존성 금지. ui-front 의 [confirm-dialog.tsx](../../src/components/ui/confirm-dialog.tsx) + Dialog 가 nori-client 의 `window.alert` / `window.confirm` (264 occurrences 30+ 파일) 패턴 *기능 측면* 이미 대체 — 본 SPEC 은 *시각 토큰만* 갱신
- **신규 shadcn primitives 도입** — accordion / tabs / sheet / popover / tooltip / hover-card / dropdown-menu / radio-group / checkbox / switch / slider / progress / breadcrumb 등 ui-front 에 부재 인 primitive 신규 추가 금지. 필요 페이지 식별 시 별 SPEC 으로 처리.
- **react-hook-form / zod 구조 변경** — form validation 시각 토큰 (에러 색 / border) 만 갱신, hook / resolver / schema 미변경
- **다크 모드 자매품화** — ui-front `src/index.css` 에 `.dark` variant + 토큰 정의는 *존재* 하나 실제 토글 / 사용은 **0 곳** (workspace grep). nori-client 도 다크 모드 미사용. 본 SPEC 은 light 모드만 재해석 — `.dark` 토큰은 *유지 (제거 금지)* 하되 갱신 OoS. 다크 모드 도입 필요 시 별 SPEC
- **에러 / 빈 상태 / 404 / Network Error 페이지 신설** — ui-front 에 ErrorPage / NotFoundPage / EmptyState 컴포넌트 부재 (workspace grep 검증). Router 의 `path="*"` 는 `/login` redirect — 별도 페이지 없음. 본 SPEC 은 기존 컴포넌트 시각 토큰만 갱신, 신설 페이지 추가 OoS. 신설 필요 시 별 SPEC
- **인라인 form error 메시지 구조 변경** — LoginPage 의 `<p role="alert" className="text-xs text-red-500">` 등은 색·간격 토큰만 갱신, 구조 미변경 (R7 안에서 처리)
- **글로벌 `a` 셀렉터 스타일 주입** — `@layer base { a { ... } }` 형태로 모든 `<a>` 에 색 강제 주입 금지 (radix-ui Trigger / Slot / NavigationMenu 의 link 와 충돌). 링크 색은 명시적 className 으로만 적용

## Phase 분해

| Phase | 산출물 | 위험 | 사용자 게이트 |
|---|---|---|---|
| 1. 토큰 + Pretendard + AppTopBar 토큰 ✅ | R1 + R2 완료 (commit `fb0b39f`) | brand accent indigo hex PoC 결정 (→ D1 재정의로 폐기) | commit 후 dev 확인 |
| **1.5. 공유 컴포넌트 시각 통합** ✅ | R7 완료 (commit `321fe90`) — shadcn primitives 11 + AppPageShell + SelectableTable 토큰 갱신 | 페이지 phase 의 전제 조건 | 시각 사용자 confirm |
| **1.7. 공통 layout shell pattern 신설** (R8) | `<PageLocation>` / `<PageHeading>` / `<PageActionBar>` / `<PageLayoutShell>` / `<PageModal>` 신규 컴포넌트 (`src/shared/layout/`) — D10 재해석 + nori-client 인상 | **페이지 phase 의 새 전제 조건 — D14 신설로 추가됨**. shell 없이 페이지 phase 진입 시 *내용=ui-front* 만 남고 *틀=nori-client* 가 빠짐 | **storybook fixture 6 variant + 사용자 시각 confirm 필수** |
| 2. LoginPage | R4 Phase 2 — layout shell single-card variant 적용 + ui-front 폼 위젯 재배치 | 최초 페이지 — shell 단일 매핑 검증 | 시각 사용자 confirm 필수 |
| 3. EqpPage | R4 Phase 3 — shell `multi-section + sidebar` + EqpSidebar/Table/Modal 재배치 | sidebar 위젯의 shell 통합 첫 적용 | dev 확인 |
| 4. ModelPage + ModelDetailPanel | R4 Phase 4 — shell `split + tab` + ModelDetailPanel/SelectableTable 재배치 | 가장 큰 패널 — 8 노드 배치 | dev 확인 |
| 5. DeployPage | R4 Phase 5 — shell `dashboard grid` + Recharts 도입 + 카드 + 표 재배치 | Recharts 첫 도입 (chart token 매핑) | dev 확인 |
| 6. DlqPage | R4 Phase 6 — shell `multi-section` + 5 패널 재배치 + PageModal 적용 | 모달 변환 첫 검증 | dev 확인 |
| 7. User / UserManagement / Profile | R4 Phase 7 — shell `form + sidebar` + UserListTable/GroupListTable/Modal 재배치 | 폼 인상 + 멤버 관리 모달 | dev 확인 |
| 8. LiveMapPage | R4 Phase 8 — shell `dashboard 3D variant` + R3F v9 + drei 10 도입 | @react-three/fiber 9 첫 도입 — 위험도 최고 | dev 확인 + 사용자 confirm |

## Confirmed Decisions (2026-05-28 사용자 확정)

### D1 — 컬러 시스템 재해석 강도 ✅ (2026-05-29 사용자 재정의)

**최초 결정** (2026-05-28): brand-accent = nori-client cerulean indigo 재해석 (`#3F4ECE`)
**재정의** (2026-05-29): indigo 톤 사용자 시각 거부 → **N 코랄 단일 hue 통일 + 파랑 토큰 전체 제거 + N 코랄 monochrome chart palette**

- brand primary = `#d95d39` (`oklch(0.62 0.16 36)` — N 로고 색 유지)
- brand accent = `oklch(0.62 0.16 36)` — **brand-primary 와 동일 coral** (indigo 폐기)
- link = coral, link-hover = deep coral `oklch(0.52 0.19 32)`
- semantic — 파랑 제거 (info 는 neutral cool gray), danger 는 coral 과 hue 분리 (saturated deep red):
  - success = `oklch(0.62 0.15 145)` green (의미 보존)
  - warning = `oklch(0.75 0.17 75)` amber (coral 과 조화 yellow-orange)
  - danger = `oklch(0.55 0.24 20)` deep red (coral hue 36° → 20° 분리 + saturate ↑)
  - info = `oklch(0.55 0.02 250)` neutral cool gray (blue 제거, chroma 0.02 거의 무채색)
- surface — cyan 제거:
  - grid-row-stripe = `oklch(0.97 0.005 40)` 거의 흰색 + warm tint
  - grid-row-select = `oklch(0.62 0.16 36)` coral (table.tsx alpha 적용)
- chart 1-5 — coral monochrome 5-tone (파랑 / cerulean 제거):
  - chart-1 = coral primary, chart-2 = amber, chart-3 = rust, chart-4 = peach/golden, chart-5 = neutral cool
- ui-front 의 green `#1C7F59` 은 **단계적 폐기** — 각 phase 에서 brand-primary/accent 로 치환 (유지)
- SelectableTable cell selection alpha 매우 옅게 — anchor `bg-brand-accent/10`, range `bg-brand-accent/5`, table row `bg-brand-accent/10` (사용자 시각 확정)

### D2 — 헤더 시각 톤 ✅

- ui-front 현 흰색 53px 헤더 **그대로 유지**
- nori-client dark navy `#050e26` 헤더는 **도입하지 않음**
- 자매품 인상은 헤더 아래의 *콘텐츠 영역* (카드/표/모달/폼) 톤 통합으로 확보

### D3 — 모바일 대응 ✅

- 본 SPEC **범위 외** (데스크탑 only)
- nori-client 의 `*.mobile.jsx` 분기 패턴은 도입하지 않음 — 필요 시 별 SPEC 으로 분리

### D4 — Grid 라이브러리 ✅

- **`@tanstack/react-table@^8.21` + `SelectableTable` + `@tanstack/react-virtual`** 결합
- nori-client 도 `@tanstack/react-table 8.21.3` 도입 — *상위 호환* 조건 충족
- selectable-table-rollout.md L69 외부 grid 도입 금지 결정 승계
- shadcn 토큰 100% 일관
- 탈락: react-tabulator (R17 only) / glide-data-grid (R18 only) / @silevis/reactgrid (R18 only) / handsontable (유료) / material-react-table (MUI 충돌) / @mui/x-data-grid (MUI 충돌)
- 보류 (다른 결정 시 후순위 후보): react-data-grid 7 beta / ag-grid-react Community / tabulator-tables vanilla / ka-table

### D5 — Chart 라이브러리 ✅

- **`recharts@^3.8`** 단독
- nori-client 의 ColumnChart / BarChart / LineChart / PieChart / LineScatterChart 모두 커버 (LineScatter 는 ComposedChart 로)
- shadcn/ui 공식 chart, `--chart-1~5` 토큰 직접 매핑, ~95KB
- 보류 (SPC 정밀도 요구 시 보조 도입 검토): echarts-for-react + echarts

### D6 — 3D 라이브러리 ✅

- **`@react-three/fiber@^9` + `@react-three/drei@^10.7` + `three@^0.184`**
- 단일 표준 후보 (다른 대안 부재)
- nori-client v8 + drei v9 의 1:1 상위 호환

### D7 — DatePicker ✅

- **`react-day-picker@^10.0`** + radix Popover
- shadcn 표준, R19 OK, tui-date-picker 의 day/month/range 1:1 대체

### D8 — Pretendard 배포 ✅

- **npm `pretendard@^1.3` 패키지** (`npm view pretendard`: version 1.3.9, license OFL-1.1)
- variable 통합 (`pretendard-variable` 별도 패키지 404 미존재)
- self-host woff2 는 보류 (phase 1 진입 시 bundle size 측정 후 필요 시 재결정)

### D9 — gsap / react-transition-group 도입 ✅

- **도입 불필요** — Tailwind transition + radix-ui 로 흡수
- 근거: nori-client 의 gsap 사용처 = `components/equipment.jsx` 1 파일만, react-transition-group = `components/header.jsx` 1 파일만 (워크스페이스 grep 검증). 광범위 의존 아님.

### D10 — 컴포넌트 재해석 강도 (R7 와 결합) ✅

- nori-client 컴포넌트 *인상* 은 유지하되 **2026 트렌드로 재해석** (D1·D2 의 컴포넌트 단위 확장)
- 변환 규칙:
  - font-weight 700 → 500/600
  - radius 4px → 8~12px
  - 진한 채도 → oklch 절제
  - 두꺼운 border → 0.5~1px subtle grayscale
  - 큰 단일 shadow → 다단 soft shadow (multi-layer)
  - 진한 link cerulean #3855B3 → muted indigo
- transition 200-300ms ease-out micro-interaction
- 모달 / alert / confirm / skeleton / badge / select / input / button 등 모든 잡다한 컴포넌트가 이 규칙으로 일괄 재해석

### D11 — 보조 디자인 토큰 통합 (R1.2) ✅

- shadow / radius tier / focus ring / z-index / animation duration·easing / 글로벌 링크 색 / **typography rhythm (leading / tracking)** 모두 R1.2 에서 토큰화
- typography rhythm:
  - `--leading-tight: 1.25` (heading), `--leading-body: 1.5` (본문), `--leading-relaxed: 1.7` (긴 본문)
  - `--tracking-tight: -0.01em` (heading), `--tracking-normal: 0`, `--tracking-wide: 0.04em` (라벨)
  - nori-client 본문 1.6 (Nanum Gothic) → Pretendard 1.5 재해석
  - 인라인 `tracking-[Nem]` 하드코딩 (LiveMap 5+ / LoginPage / AppTopBar) 은 R7 / R4 phase 에서 점진 치환 — 일괄 교체 금지
- Phase 1 (R1 + R1.2) 에서 일괄 도입
- nori-client `_base.scss` 의 12 단계 z-index 흡수
- 글로벌 `a` 셀렉터 주입 금지 (radix-ui 충돌 회피)

### D12 — 다크 모드 OoS ✅

- ui-front `.dark` variant 토큰 정의 *존재* 하나 실제 사용 0 (workspace grep)
- nori-client 도 다크 모드 미사용
- 본 SPEC 은 light 모드만 재해석. `.dark` 토큰 유지 (제거 금지), 갱신 OoS

### D13 — 에러 / 빈 상태 / 404 페이지 OoS ✅

- ui-front 에 ErrorPage / NotFoundPage / EmptyState 컴포넌트 부재
- 신설 OoS, 본 SPEC 은 기존 컴포넌트 (LoginPage 의 인라인 form error 등) 시각 토큰만 갱신

### D14 — *틀 = nori-client / 내용 = ui-front* 원칙 ✅ (2026-05-29 사용자 명시)

**의도 정정**: 최초 SPEC 의 "시각 토큰만 갱신" 은 *틀 = ui-front 그대로* 였음. 사용자가 Phase 1+1.5 commit 후 시각 격차 확인 → "거의 똑같은 페이지 + 현대화" 가 의도였음을 명시 → 정정.

**원칙**:
- **틀 (page layout shell)** = nori-client 의 *공통 layout 위젯* 의 시각 패턴 → ui-front 의 신규 공통 컴포넌트로 추출 (R8). 모든 페이지가 이 shell 위에 콘텐츠를 올림.
- **내용 (page content)** = ui-front 의 기존 *기능 위젯* (Sidebar / Table / Panel / Modal) + 라우트 + API + TanStack Query hook + Zustand store + 권한 모델. 변경 금지 — shell 안에 *재배치* 만.
- **현대화** = D10 재해석 규칙 일관 적용. 옛 SI 톤 제거.

**페이지 1:1 매핑 금지** — ui-front (TC 관리) 와 nori-client (MES) 는 기능 도메인이 다름. LoginPage 만 단일 form 으로 1:1 매핑 가능, 그 외는 *공통 shell 적용 + 콘텐츠 재배치*.

**Phase 1 + 1.5 commit (`fb0b39f` / `321fe90` / `3f53e4b`) 는 기반 토큰** — D14 의 *내용* 영역 토큰만 다룬 셈. *틀* 은 R8 (Phase 1.7) 에서 신설.

---

## Validate 노트

Phase 1 + Phase 1.5 의 commit 별 검증 결과 / 객관 증거 / SPEC 정정 사유의 누적 기록.

### Phase 1 (commit `fb0b39f` — feat(theme): R1+R1.2+R2 + npm-only 정리)

- `npm install pretendard@^1.3` → `added 347 packages, ... found 0 vulnerabilities` (46s). peer 충돌 0
- `npm view pretendard` → version 1.3.9, license OFL-1.1, peerDependencies = {} (peer 없음)
- `npm run build` PASS → `✓ built in 8.08s` (baseline 8.42s 유사)
- Phase 1 변경 파일 lint PASS (main.tsx + AppTopBar.tsx 0 errors). baseline 14 errors (EqpPage / ModelPage / UserPasswordResetModal 등 Phase 1 무관 파일) — 별 SPEC 으로 분리
- `git grep -E "var\(--color-brand-accent\)" src/` → 2 hits (`AppTopBar.tsx:174-175`)
- `git grep -nE "--font-ui:.*Pretendard" src/index.css` → 1 hit (`src/index.css:8`)
- AppTopBar 시그니처 git diff 0 라인 (import / 함수 / handler / prefetch / navigationItems / 인터페이스)
- `node -e "require.resolve('pretendard/dist/web/variable/pretendardvariable.css')"` → `C:\workspace_nori\nori-tc-ui-front\node_modules\pretendard\dist\web\variable\pretendardvariable.css` PASS. woff2 = `PretendardVariable.woff2` (1 개)

### Phase 1.5 (commit `321fe90` — feat(theme): R7 shadcn primitives 11 + AppPageShell + SelectableTable)

- `npm run build` PASS → `✓ built in 9.18s`
- Phase 1.5 변경 12 파일 lint PASS (0 errors). button.tsx 변경 0 (이미 토큰 사용, D10 weight/radius 충족)
- R7 AC 첫 항목 — `git grep -E "#1C7F59|#D8E1DB|#93A19A|#243129|#8D9893|#EDF4EF|#F6F9F7|#EAF5EE" src/components/ui/ src/shared/components/AppPageShell.tsx src/shared/components/SelectableTable/` → **0 hits** (exit code 1 = no match)
- `npx playwright test tests/e2e/selectable-table-*.spec.ts` → **31 passed / 0 failed (56.8s)** — R7 Constraint 마지막 항목 (SelectableTable 동작/API/range copy 0 변경) 충족

### 전체 e2e (Phase 1 + Phase 1.5 동일)

`npm run test:e2e` → **73 passed / 2 failed (2.1m)**. 2 fail 은 baseline 부터 존재 (Phase 1 git stash 검증 = fb0b39f = 321fe90 동일 결과).

| spec | fail line | assertion | locator | 원인 추론 | fail since |
|---|---|---|---|---|---|
| `tests/e2e/group-page.spec.ts` | 364 | `toBeVisible()` | `getByTestId('group-member-panel')` | group-row-10 클릭 후 멤버 패널 미활성 — frontend feature gap 또는 mock state 누락 | main (Phase 1 stash 검증) |
| `tests/e2e/user-page.spec.ts` | 510 | `toBeVisible()` | `getByTestId('user-group-chip-10')` | user-row-1 클릭 후 그룹 chip 미표시 — frontend feature gap 또는 mock state 누락 | main (Phase 1 stash 검증) |

두 fail 모두 data-testid 기반 element 가시성 — 시각 토큰 변경과 원리적으로 무관. SPEC 의 시각 마이그레이션 회귀 0. 두 fail 의 frontend feature 보강은 본 SPEC 범위 외, 별 SPEC 으로 분리.

### 인프라 부재 확인 (워크스페이스 전체 c:/workspace_nori/* grep 기반)

- **visual snapshot 인프라 부재** — `toHaveScreenshot|toMatchSnapshot` 워크스페이스 전체 0 hits. SPEC L269 (현 정정 후) 의 비주얼 자동 검증 불가능. dev 캡처 + R7 commit 메시지 캡처 경로로 대체
- **console.error / pageerror 감지 인프라 부재** — `page.on('console')` / `page.on('pageerror')` ui-front 의 tests/e2e fixture 또는 spec 파일에 미등록. SPEC L256 (현 정정 후) 에서 검증 범위 축소 — `npm run test:e2e` PASS 자체로 검증, console.error 자동 감지는 별 SPEC

### D1 재정의 (2026-05-29) — coral 통일 객관 측정

dev http://127.0.0.1:3000 에서 Playwright `getComputedStyle` 실측 (Vite HMR 자동 반영):

```
[ANCHOR-V2] borderColor: oklch(0.62 0.16 36)               ← coral (= brand-accent)
            backgroundColor: oklab(0.62 ... -0.094 / 0.1)  ← coral 10% (매우 옅음)
[RANGE-V2]  borderColor: oklab(0.62 ... -0.094 / 0.25)    ← coral 25%
            backgroundColor: oklab(0.62 ... -0.094 / 0.05) ← coral 5% (더 옅음)
```

- 모든 brand-accent utility class (AppTopBar underline / Input focus border / Select highlighted / ContextMenu focus / SelectableTable anchor/range/sort/resize) 가 *코드 변경 0* 로 indigo → coral 자동 업데이트
- table.tsx 의 `<TableRow data-state="selected">` 도 `bg-brand-accent/10` 으로 변경 (cyan grid-row-select 제거)
- SelectableTable.tsx 의 anchor `/15→/10`, range `/10→/5` 로 alpha 더 옅게 (사용자 "매우 옅은 N 색")
- chart-1~5 coral monochrome 으로 재편 (recharts Phase 5 진입 시 정합)
- 미적용 잔재: 페이지 파일 (ModelDetailPanel / ModelPage / EqpPage / DeployPage / DlqPage / UserPage / LiveMapPage / LoginPage / DcopItemPickerModal / 등) 의 인라인 옛 hex (`#1C7F59 / #EAF5EE / #1F2D26 / #DCE5E0 / #5B6962 / 등` 옛 green + 파랑 잔재) — R4 Phase 2~8 작업 대상

### SPEC 정정 이력 (본 commit 의 변경 사항)

- **L48 radius** — Plan S1 trade-off (calc 매핑 유지, Phase 2~ 점진 명시 치환) 명문화
- **L244 R1 → R7** — SelectableTable 토큰 갱신 phase 표기 정정
- **L256 console.error** — 인프라 부재로 검증 범위 축소
- **L262 brand-primary regex** — var() OR Tailwind utility class 4 종 그룹 (D1 결정과 충돌 안 함). brand-accent 보조 검증 추가
- **L269 Playwright screenshot diff** — snapshot 인프라 부재로 AppTopBar git diff 시그니처 0 라인 검증 + 워크스페이스 전체 인프라 부재 인용으로 대체

---

## Summary Instructions
이 SPEC 의 대화를 요약할 때 항상 보존:
- 변경된 src/ 파일 경로 (index.css / AppTopBar.tsx / 각 phase 페이지 파일)
- `npm` 명령 PASS/FAIL + 출력 마지막 5~10 줄
- 어떤 phase 가 머지되었는지 + 그 phase 의 시각 변경 결정
- Open Questions Q1~Q3 의 최종 사용자 결정
