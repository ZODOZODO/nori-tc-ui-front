# SPEC — nori-client-forked 자매품화 (ui-front 화면 재구성)

> 작성일: 2026-05-29
> 단계: **Specify (인터뷰 확정 — 2026-05-29)**
> 대상 레포: `nori-tc-ui-front` (단일 레포 — backend / nori-client-forked 변경 없음)
> 기준 레포: **`nori-client-forked`** (`c:/workspace_nori/nori-client-forked`, branch `team1`, name `nori-client` v2.0.0)
> 출처: 사용자 요청 — "nori-tc-ui-front 를 nori-client-forked 의 자매품처럼. forked 의 화면 구성 패턴을 틀로 삼아 더 세련·깔끔하게 현대화하고, 그 틀에 ui-front 의 기존 페이지 콘텐츠 요소만 다시 담아 새 페이지를 만든다. topbar + topbar→sidebar 동작은 ui-front 것 유지. npm only, React 19 환경."

## Why

`nori-tc-ui-front` 와 `nori-client-forked` 는 같은 회사의 인접 도구이나 시각 언어가 완전히 다르다. forked 는 최근 **UI 리뉴얼**(slate + Pretendard + 카드형 레이아웃)을 마쳤고, ui-front 가 그 자매품 인상을 가지되 **기술적·시각적으로 더 앞선** 모습이 되는 것이 목표.

| 항목 | nori-client-forked (기준) | nori-tc-ui-front (대상) |
|---|---|---|
| React | 18.3.1 / react-router 6.30 | **19.2 / react-router 7.13** |
| 스타일 | sass + Bootstrap 5 + reactstrap (레거시) + 신규 리뉴얼 scss | Tailwind 4 + radix-ui (shadcn) |
| 그리드 | tui-grid (레거시) + `@tanstack/react-table@8.21` (신규 마이그레이션 중) | `SelectableTable` + `@tanstack/react-virtual` |
| 차트 | `@toast-ui/chart` (품질 SPC 전용) | (없음) |
| 3D | `@react-three/fiber@8` + drei9 (설비 mesh / 창고 상세) | (없음 — live-map 은 2D SVG/DOM) |
| 폰트 | 리뉴얼 scss = Pretendard / 레거시 = Nanum Gothic | Pretendard + Fraunces(N 로고) |
| 레이아웃 | 좌측 GNB→LNB 그룹 사이드바 + 헤더 + 콘텐츠 + 푸터 | 53px topbar + 도메인별 좌측 Sidebar 패널 |
| i18n | i18next + react-i18next | 자체 i18n-context (ko/en) |

**forked 의 리뉴얼 디자인 언어** (실측 — `src/assets/scss/list_page.scss`, `detail_pages.scss`):
- 페이지 배경 slate `#f1f5f9` / 상세 `#f8fafc`, 카드/헤더 white `#ffffff` + 보더 slate-200 `#e2e8f0`
- 텍스트 slate-900 `#0f172a`, muted slate-400 `#94a3b8`, 액센트 blue-600 `#2563eb`
- Pretendard 우선 폰트, 헤딩 `20px / 700 / letter-spacing -0.4px`, pill 태그 `radius 999px / 12px`
- 카드형 page-head + 내부 스크롤 flex 컬럼 레이아웃

### 핵심 원칙 — 틀 = forked 구조 / 내용 = ui-front / 색 = ui-front 토큰

- **틀(구조 패턴)** — forked 의 *화면 구성 패턴*(리스트 페이지 헤더 / 필터바+페이지네이션 / 데이터 테이블 스타일 / 공통 모달 / 대시보드 카드 / 푸터·버튼그룹 / 상세 페이지 레이아웃)을 ui-front 의 공통 layout 컴포넌트로 추출 → 모든 페이지에 일괄 적용.
- **내용(콘텐츠)** — ui-front 의 기존 *기능 위젯*(EqpSidebar / SelectableTable / ModelDetailPanel / DeployPanel / DlqPanel / 각 Modal)·라우트·API·TanStack Query hook·Zustand store·권한 모델은 **변경하지 않는다**. 새 layout 틀 안에 *재배치*만.
- **색·토큰** — forked 의 slate+blue 렌더값은 *차용하지 않는다*. 구조·여백·계층만 가져오고, 색은 **ui-front 의 N 로고 coral(`#d95d39`)을 brand 로 삼아 2026 트렌드로 정제·확장**해 입힌다 (D-TOKEN).
- **현대화** — forked 리뉴얼보다 한 단계 더: soft shadow 다단, generous spacing, lighter weight, oklch 채도 절제, micro-interaction(200–300ms ease-out), a11y(aria + focus ring + contrast 4.5:1+).
- **ui-front 우위** — 자매품이되 ui-front 가 React 19 + 함수형 + radix + TanStack 으로 *더 빠르고·type-safe·a11y* 하게. 각 phase 에서 회귀 0 + 가능한 품질 개선 동반.

페이지 1:1 매핑은 불가능 — forked(MES: 생산/품질/자재) 와 ui-front(TC 인프라: eqp/model/deploy/dlq/user) 는 기능 도메인이 다름. 따라서 **공통 layout shell 추출 → ui-front 기존 7 라우트에 일괄 적용** 이 본 SPEC 의 핵심.

## Requirements

### R1 — 공통 layout shell 추출 (forked 구조 → ui-front, **최우선 / 페이지 phase 전제**)

ui-front `src/shared/layout/` 에 forked 구조 패턴의 ui-front 버전을 추출한다. 페이지 phase 진입 전 반드시 선행.

- [ ] **리스트 페이지 헤더** — forked `list_page_header.jsx`(`.page-head`: 제목 `h2` + `.desc` + `.total-tag` pill + 우측 액션) + `header_subtitle.jsx`(heading-primary icon+name+hr) 인상. 신규 `PageHeading` 컴포넌트 작성 (제목 / 설명 / 총건수 pill / 우측 액션 슬롯).
- [ ] **필터/검색 바 + 페이지네이션** — forked `list_pagination.jsx` 인상(페이지 리스트 `1 2 3 … N` ellipsis, page-size select `[12,25,50,100]`, `from–to / total` 요약). 조회 조건 바 + 하단 페이지네이션 공통 컴포넌트.
- [ ] **데이터 테이블 스타일** — forked `data_table.jsx`(TanStack `flexRender` + `@tanstack/react-virtual` + 정렬 아이콘 + row `selected/created/updated` 상태 클래스) 의 시각 언어를 ui-front `SelectableTable` 에 입힌다 (줄간색 / hover / sticky header / 셀 정렬).
- [ ] **공통 모달** — forked `common_page_modal.jsx`(header+body+footer CTA 우측) 인상. 신규 `PageModal` 컴포넌트를 radix `dialog.tsx` primitive 위에 작성 (primitive 자체는 확장만, 대체 금지).
- [ ] **대시보드 카드 레이아웃** — forked `_dashboard.scss` / dashpages 카드 grid 인상. 현황 화면(live-map 등)에 적용할 카드 섹션 컴포넌트.
- [ ] **상세 페이지 레이아웃** — forked `detail_pages.scss`(`.ppmd-*`: location + 헤더 + 섹션 + 내부 스크롤) 인상. 좌 list / 우 detail 분할 등.
- [ ] **푸터 + 공통 버튼그룹** — forked `footer.jsx`(copyright) + `button_control.jsx`(권한 게이트 버튼그룹) 인상의 ui-front 등가.
- [ ] **신규 wrapper** `PageLayoutShell` — 위 요소를 묶는 페이지 콘텐츠 영역 shell. ui-front `AppPageShell`(topbar + wrapper) *자식* 계층으로 배치.

### R2 — 디자인 토큰 정제·확장 (ui-front 토큰 기준, forked 구조 수용)

- [ ] forked 의 slate neutral scale(`#f1f5f9`/`#e2e8f0`/`#0f172a`/`#94a3b8`) 의 *계층 구조*(배경/카드/보더/본문/muted)를 ui-front `index.css` 의 oklch neutral 토큰으로 매핑 — **단 액센트는 ui-front brand(coral `#d95d39` 계열) 유지, forked 의 blue-600 액센트는 차용 금지**.
- [ ] Pretendard 를 `--font-ui` 기본으로 유지/확정 (forked 리뉴얼과 동일 폰트). Fraunces 는 N 로고 전용 보존.
- [ ] 헤딩 타이포(forked 20px/700/-0.4px) 를 ui-front 2026 톤으로 재해석 — weight 700→600/semibold, letter-spacing 토큰화(`--tracking-tight`).
- [ ] pill 태그(총건수 등) / soft shadow 다단 / radius tier / focus ring / motion duration 토큰을 일관 정의.
- [ ] forked 의 status color(success/warning/danger/info) 를 ui-front semantic 토큰(oklch)으로 매핑 — blue 계열 제거, coral 과 hue 분리.

### R3 — 라이브러리 매핑 (forked → ui-front, React 19 호환 + 무료)

| forked 라이브러리 | ui-front 대체 | 결정 근거 |
|---|---|---|
| tui-grid / `@toast-ui/react-grid` (+ forked 신규 `@tanstack/react-table@8.21`) | **`SelectableTable` + `@tanstack/react-table@^8` + `@tanstack/react-virtual`** | tui-grid React wrapper R19 비보장. forked 도 이미 TanStack 으로 마이그레이션 중 — *상위 호환* 충족. headless model 이 정렬/필터/row selection/summary 보강. (D-GRID) |
| `@toast-ui/chart` | **`recharts@^3`** | React 19 호환, 선언적 SVG, shadcn 공식 chart, `--chart-1~5` 토큰 직접 매핑, 경량(~95KB). (D-CHART) |
| `tui-date-picker` | `react-day-picker` + radix Popover (사용처 식별 시) | shadcn 표준, R19 OK. |
| `@react-three/fiber@8` + drei9 + three | **선정 보류** — 필요 시 `@react-three/fiber@^9` + `drei@^10` + `three@^0.18x` | ui-front 도메인에 3D 콘텐츠 부재. live-map 도 2D. (D-3D) |
| bootstrap + reactstrap + sass | Tailwind 4 + radix-ui (이미 도입) | utility-first, 의존 제거. |
| i18next + react-i18next | 기존 ui-front i18n-context (ko/en) 유지 | 통일. (D-I18N) |
| react-icons | lucide-react (이미 도입) | 통일. |
| gsap / react-transition-group | Tailwind transition + radix motion | forked 사용처 소수 — 도입 불필요. |
| react-quill-new | (OoS) | 사용처는 forked 게시판 — ui-front 에 해당 페이지 없음. |
| qrcode.react / html5-qrcode / @zxing | (OoS) | forked 바코드 모달 — ui-front 에 기능 없음. |
| xlsx | (보류) | 엑셀 export 사용처 식별 시 그대로 도입 검토. |

- [ ] 선 도입 금지 — 각 라이브러리는 첫 사용 phase 에서만 의존성 추가. 추가 시 `npm view <pkg> peerDependencies` 출력 + `npm install` 출력 마지막 5~10줄 commit 메시지 인용.

### R4 — Topbar→도메인 Sidebar 내비게이션 보존 + 사이드바 동작 흡수

#### R4.1 — topbar→sidebar 내비게이션 동작 보존 (사용자 명시 — "topbar 와 topbar 누르면 sidebar 에 나오는 것을 가져가고 싶다")

ui-front 의 핵심 내비게이션 구조 — **상단 `AppTopBar` 의 nav(dash/eqp/model/deploy/dlq/user) 클릭 → 해당 라우트 이동 → 그 도메인 페이지가 자신의 좌측 Sidebar(`EqpSidebar` / `ModelSidebar` / `DlqSidebar` / `DeploySidebar` / `UserManagementSidebar` 등)를 렌더** — 를 **동작 그대로 보존**한다.

- [ ] AppTopBar 의 라우팅 / 권한 필터(`resolveVisibleAppNavigationItems`) / hover prefetch 로직 **변경 금지** — 시각 토큰만 (Constraints 와 동일).
- [ ] 각 도메인의 좌측 Sidebar 가 topbar 메뉴 선택에 따라 노출되는 동작 **보존** — sidebar 의 메뉴 항목 / 라우팅 / 상태는 변경하지 않는다.
- [ ] R1 의 layout shell(`PageLayoutShell`)은 이 topbar→sidebar 구조를 **감싸되 끊지 않는다** — 도메인 Sidebar 는 shell 의 *좌측 slot* 에 재배치, AppTopBar 는 `AppPageShell` 상단에 유지.

#### R4.2 — forked 사이드바 동작 흡수 (도메인 Sidebar 에)

forked 사이드바에서 다음 *동작만* 흡수:

- [ ] **폭 드래그 리사이즈** — 리사이즈 핸들 + localStorage 폭 기억. ui-front `sidebar-resize-handle.tsx` / `sidebar-layout.ts` 기반 위에 구현.
- [ ] **접기/펼치기 토글** — collapse 토글 + 상태 localStorage 기억.
- 비흡수(OoS): 상세페이지 자동 접기 / 상위→하위 그룹 아코디언 (사용자 미선택).

### R5 — 페이지별 layout shell 적용 + 콘텐츠 재배치

ui-front 7 라우트를 phase 별 단일 commit 으로. **R1(shell) + R2(토큰) commit 후** 진입.

- [ ] **LoginPage** (`/login`) — forked `login_new.scss` / `_login.scss` 인상(중앙 카드 / soft shadow / brand CTA). single-card 변형.
- [ ] **EqpPage** (`/eqp`) — forked *리스트 페이지 인상*(헤더+필터+테이블+모달). EqpSidebar(좌측 slot) / EqpInfoTable·EqpParamTable(content) / 모달(액션바 진입) 재배치.
- [ ] **ModelPage** (`/model`) — forked *상세 페이지 인상*(좌 list / 우 detail 분할 + form + 표). ModelDetailPanel / SelectableTable / 모달 재배치.
- [ ] **DeployPage** (`/deploy`) — forked *대시보드 인상*(카드 grid + 표). 차트 도입 시 Recharts(R3).
- [ ] **DlqPage** (`/dlq`) — forked *리스트 페이지 인상* + 공통 모달. 패널들의 표 영역 재배치.
- [ ] **User / UserManagement / Profile** (`/user`) — forked *폼 페이지 인상* + 모달. UserListTable / GroupListTable / 멤버 모달 재배치.
- [ ] **LiveMapPage** (`/eqp/live-map`) — **별도 구상 / 이미지 기반 진행**. 사용자가 실제 구현 시 디자인 이미지를 제공 → 그 이미지대로. 본 SPEC 에서는 상세 미확정(D-LIVEMAP).

각 phase commit 메시지에 변경 전/후 스크린샷 경로 명시.

### R6 — 회귀 안전망 + 품질 동반

- [ ] 각 phase 는 layout 재배치만 — 라우팅/API/TanStack Query hook/Zustand store/기능 위젯 prop·state 변경 금지.
- [ ] phase 변경 파일 — `tsc -b` 0 errors / `eslint .` 0 errors(변경 파일 한정) / `npm run build` GREEN.
- [ ] phase 변경 파일이 닿는 e2e / unit 회귀 0. SelectableTable 관련 e2e 회귀 0.
- [ ] phase 진행 중 만난 any/unknown·중복 markup 은 *기회 개선*(over-refactor 금지 — 무관 파일 리팩터링 금지).
- [ ] commit 메시지에 측정 결과 마지막 5~10줄 인용.

## Constraints

- **React 19.2 / Vite 7.3 / Tailwind 4.2 / radix-ui / TanStack Query 5 / Zustand 5 환경** 그대로. peer 충돌 의심 라이브러리는 도입 전 `npm view <pkg> peerDependencies` 검증.
- **npm only** — pnpm / yarn 금지 (사용자 명시).
- **AppTopBar 구조·동작·라우팅·prefetch 변경 금지** — 시각 토큰만. topbar→도메인 sidebar 패턴 유지 (사용자 명시).
- **ui-front 의 기존 라우트 / 페이지 / 기능 / API 호출 / 권한 모델 변경 금지** — 자매품화는 *화면 구성·시각 재구성*. forked 의 페이지(MES 도메인)를 이식하는 게 아니다.
- **forked 의 slate+blue 렌더값 직접 차용 금지** — 구조·계층만. 색은 ui-front coral 토큰.
- **forked 의 레거시 톤(Nanum/navy/orange/Bootstrap) 도입 금지** — forked 리뉴얼 scss 도 *구조 참고용*, 렌더값 복사 아님.
- **외부 grid 라이브러리(AG Grid 등) 도입 금지** — SelectableTable + TanStack Table headless 로 충족.
- **각 phase commit 은 단일 페이지(또는 단일 R 단위)** — cross-page 오염 0. **phase 별 PR/MR 생성 금지**. SPEC 전체 완료 후 단일 branch → main 일괄 통합.
- 산출물(본 SPEC)은 git track (`.claude/specs/`).

## Acceptance Criteria

기계 검증 가능 — 단일 명령 / 단일 노드 단위.

### 전체
- [ ] `npm install` PASS (peer 충돌 0)
- [ ] `npm run build` PASS (`tsc -b && vite build`)
- [ ] `npm run lint` PASS
- [ ] `npm run test:e2e` PASS (회귀 0)
- [ ] `git grep -nE "tui-grid|tui-chart|tui-date-picker|reactstrap|bootstrap/dist" src/` → 0 hits (forked 레거시 잔재 0)

### R1 — layout shell
- [ ] `src/shared/layout/PageLayoutShell.tsx` 신규 생성 + `import` 하는 페이지 ≥ 1 (도입 확산은 R5 phase 누적)
- [ ] PageLayoutShell dev fixture 라우트(`import.meta.env.DEV`)에서 헤더/필터/페이지네이션/테이블/모달/카드 변형 렌더 (수동 시각 confirm)

### R2 — 토큰
- [ ] `src/index.css` 의 `--font-ui` 가 `'Pretendard'` 포함 문자열
- [ ] `git grep -nE "bg-brand-(primary|accent)|text-brand-(primary|accent)|border-brand-(primary|accent)" src/` ≥ 5 (R5 phase 누적 충족)

### R3 — 라이브러리
- [ ] `npm view @tanstack/react-table peerDependencies` 출력에 `react` 19 호환 표기 — commit 메시지 인용
- [ ] `npm view recharts peerDependencies` 출력 react 19 호환 — commit 메시지 인용

### R4 — topbar→sidebar 보존
- [ ] `AppTopBar.tsx` 의 `navigationItems` / `resolveVisibleAppNavigationItems` / 라우팅 / prefetch 시그니처 git diff 0 라인 (시각 토큰 className 치환만)
- [ ] topbar nav 클릭 → 해당 도메인 라우트 이동 → 좌측 Sidebar 노출 e2e 회귀 0

### R5 — 각 페이지 phase
- [ ] 각 phase commit 메시지에 변경 전/후 스크린샷 경로 명시
- [ ] 해당 페이지 e2e PASS (동작 회귀 0)

## Out of Scope

- forked 의 페이지 / 기능 / 라우트 / API 의 ui-front 이식 (시각·구조 재구성 only)
- ui-front 의 기능 / 라우트 / API / 권한 모델 변경
- 모바일 대응 (forked `*.mobile.jsx` 패턴 — 데스크탑 only)
- i18n 키 forked 통합 (ui-front i18n-context 유지)
- TopBar 구조·동작 변경
- 외부 grid 라이브러리(AG Grid 등) 도입
- 3D(`@react-three/fiber`) 도입 — 콘텐츠 부재로 보류, 필요 시 별 SPEC
- rich text editor(react-quill-new → tiptap) — forked 게시판 페이지 ui-front 부재
- 바코드 / QR 스캐너(html5-qrcode / qrcode.react / @zxing)
- 엑셀(xlsx) export — 사용처 식별 시 별도
- 신규 alert / confirm / toast 라이브러리(sonner 등) — ui-front confirm-dialog 가 기능 대체, 시각 토큰만
- 사이드바 상세페이지 자동 접기 / 그룹 아코디언 (R4 미선택)
- 다크 모드 자매품화 (light 모드만 재해석, `.dark` 토큰 유지하되 갱신 OoS)
- LiveMapPage 상세 디자인 — 사용자 별도 구상, 이미지 기반 실제 구현 시 확정

## Confirmed Decisions (2026-05-29 인터뷰)

- **D-SCOPE** — 틀=forked 구조 / 내용=ui-front / 색=ui-front 토큰. forked 화면 구성 패턴을 가져와 현대화 후 ui-front 콘텐츠 재배치. (사용자: "look & feel 과 비슷, forked 화면 구성 패턴을 따와서 더 세련되게, 그 토대로 ui-front 페이지 내용 요소만 다시 담아 새 페이지")
- **D-DELIVERABLE** — 본 세션 산출물은 **SPEC 문서만**. 구현/코드 변경 없음.
- **D-FIDELITY** — 구조 동일 + 비주얼 현대화 (2026 트렌드). 픽셀 복제·영감만 아님.
- **D-STRUCT** — 가져올 구조 패턴: 리스트 헤더 / 필터바+페이지네이션 / 테이블 스타일 / 공통 모달 / 대시보드 카드 / 푸터·버튼그룹 / 상세 레이아웃 (전부).
- **D-SIDEBAR** — ui-front 도메인 sidebar 에 흡수: 폭 드래그 리사이즈 + 접기/펼치기 토글. (자동 접기 / 그룹 아코디언 제외)
- **D-GRID** — `SelectableTable` 확장 + `@tanstack/react-table@^8`. forked 도 TanStack 마이그레이션 중 — 상위 호환.
- **D-CHART** — `recharts@^3`. (ECharts 는 SPC 정밀 요구 시 보조 후보)
- **D-3D** — 선정 보류 (3D 콘텐츠 부재). 필요 시 `@react-three/fiber@^9`.
- **D-I18N** — ui-front 커스텀 i18n 유지 (react-i18next 미도입).
- **D-TOKEN** — ui-front 토큰 정제·확장 (forked slate 구조 계층 수용, coral 액센트 유지, forked blue 차용 금지).
- **D-PAGES** — 기존 7 라우트 전체. 공통 shell/레이아웃 우선. profile 모달 포함.
- **D-LIVEMAP** — live-map 은 사용자 별도 구상. 실제 구현 시 디자인 이미지 제공 → 그 이미지대로. 본 SPEC 상세 미확정.

## SDD 진행 상태

- [x] **Specify** — 본 SPEC.md 작성 (2026-05-29 인터뷰 확정). 산출물: `.claude/specs/nori-client-forked-migration.md`
- [ ] **Plan** — 별 세션 Plan Mode. 산출물: `.claude/specs/nori-client-forked-migration-plan.md`
- [ ] **Implement** — 별 세션. 산출물: `.claude/specs/nori-client-forked-migration-dev-report.md`
- [ ] **Validate** — 별 세션. SPEC + Plan + Dev report 셋 입력으로 검증, 체크박스 업데이트

## 다음 단계 진입 프롬프트

> **공통 가드 (모든 후속 단계 — Plan / Implement / Validate 절대 준수)**
> 이 작업은 **처음 진행하는 것으로 간주**한다. "이전 시도 / 기존 구현이 어땠다 / 과거에 무엇을 했다 / 재작업" 류의 **비교·언급·전제 일절 금지**. 현재 코드 상태는 단순 *출발점*으로만 보고, SPEC 을 유일한 기준으로 계획·구현한다. 같은 이름의 파일·컴포넌트가 코드에 있더라도 그것을 "이전 작업"으로 해석하지 말고, SPEC 기준으로 새로 작성·대체할 *현재 자산*으로만 취급한다.

**Plan 진입 (새 세션 + Plan Mode)**:
```
@.claude/specs/nori-client-forked-migration.md 보고 구현 계획 수립.
이 작업은 처음 진행하는 것이다. 이전 시도/기존 구현에 대한 비교·언급 금지 — 현재 코드는 출발점으로만 보고 SPEC 만 기준으로 계획.
영향 파일 / 단계(R1 shell → R2 토큰 → R5 페이지 phase) / 위험 / 롤백 방법 포함.
실행 / 코드 수정 금지.
산출물: .claude/specs/nori-client-forked-migration-plan.md 에 저장.
```

**Implement 진입 (새 세션)**:
```
@.claude/specs/nori-client-forked-migration.md @.claude/specs/nori-client-forked-migration-plan.md 둘 다 읽고 구현.
SPEC 의 Acceptance Criteria 모두 만족하도록 진행. R1(shell) → R2(토큰) → R5(페이지) 순서 엄수.
Plan 의 결정(라이브러리 도입 시점 / dead path / 색 토큰 매핑) 엄수.
산출물: .claude/specs/nori-client-forked-migration-dev-report.md 에 변경 파일 / 테스트 결과 / 결정 기록.
```

**Validate 진입 (새 세션)**:
```
@.claude/specs/nori-client-forked-migration.md @.claude/specs/nori-client-forked-migration-plan.md @.claude/specs/nori-client-forked-migration-dev-report.md
셋 다 읽고, 구현이 SPEC 의 모든 Acceptance Criteria 와 Plan 의 결정을 만족하는지 검증.
누락 / 위반 발견 시 보고. 통과 항목은 SPEC 의 AC 체크박스 + SDD 진행 상태를 [x] 로 업데이트.
```
