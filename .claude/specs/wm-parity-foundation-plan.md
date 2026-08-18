# PLAN: wm-parity-foundation — 구현 계획

> 입력: `.claude/specs/wm-parity-foundation.md` (Specify 산출물)
> 산출물 위치: `.claude/specs/wm-parity-foundation-plan.md` (이 파일)
> 다음 단계 산출물: `.claude/specs/wm-parity-foundation-dev-report.md`
> 전 수치는 **2026-08-18 이 세션에서 직접 재실측**(Grep/Read/wc). wm 이식 대상은
> `c:\workspace_nori\nori-wm-ui-front` 원본을 직접 Read 해 대조했다.

---

## 0. Plan 세션 실측 요약 (SPEC 수치 검증 결과)

SPEC 본문의 수치를 전건 재실측했다. **드리프트 없음** — 아래는 재현 가능한 명령과 결과다.

| 항목 | SPEC 표기 | 재실측 | 판정 |
|---|---|---|---|
| raw `<button>` in `src/features` | 80건 / 22파일 | 80 / 22 | 일치 |
| 공용 `<Button>` in `src/features` | 96건 / 35파일 | 96 / 35 (`src` 전체 108/40 − dev·ui·shared·i18n 12/5) | 일치 |
| raw `<select>` in `src/features` | 15건 / 6파일 | 15 / 6 | 일치 |
| raw `type="checkbox"` in `src/features` | 10건 / 8파일 | 10 / 8 | 일치 |
| `const resolveSuccessPayload` | 11파일 | 11 | 일치 |
| `issueCsrfToken =` | 9파일 | 9 | 일치 |
| `class *ApiError` | 6종 | 6 | 일치 |
| `isApiResponse` 정의 | 6곳 | 6 (auth/eqp/group/model/user + **dlq 로컬**) | 일치 |
| `withCsrfHeaders` | 6파일 | 6 | 일치 |
| `auth.types` 직접 import | 12파일 | 12 | 일치 |
| 죽은 파일 6개 | 446 LOC | 211+110+75+25+24+1 = **446** | 일치 |
| `window.confirm` | 1건 | 1 (`DeployMonitorPanel.tsx:723`) | 일치 |
| `recharts` src 참조 | — | 2건, **둘 다 죽은 `DeployStatusChart.tsx` 안** | — |

**SPEC 라인번호 드리프트 1건(경미)** — R4 의 `LoginPage 수제 버튼(:76,83)/인풋(:67,191,217)` 은 현
HEAD 기준 **버튼 `:73,:80` / 인풋 `:63,:185,:211`** 이다. 실측값을 정본으로 쓴다.
(LoginPage raw button 은 총 6건 — `:73,:80,:220,:247,:253,:263`)

---

## 1. Plan 단계 확인 항목 — R7 `Intl.Collator(numeric)` 실측 결과

**결론: tc 미적용 → 백포트 대상에 포함한다.**

- tc `src/shared/components/SelectableTable/SelectableTable.tsx:197-199`
  ```
  const sorted = [...rows].sort((a, b) =>
    column.accessor(a).localeCompare(column.accessor(b)),
  )
  ```
  → 옵션 없는 `localeCompare`. 숫자 문자열이 사전순으로 뒤집힌다(`"10" < "9"`).
- wm `SelectableTable.tsx:139` = `const SORT_COLLATOR = new Intl.Collator(undefined, { numeric: true })`,
  `:216-220` 에서 tanstack `sortingFn` 으로 소비.
- tc 전역 grep 결과 `Intl.Collator` **0건**. `numeric: true` 를 쓰는 곳은 도메인 유틸 2곳뿐
  (`deploy-register-utils.ts:37`, `model-tree.util.ts:21-22`) — 공용 테이블 정렬과 무관.

**백포트 형태(결정 1 준수 — @tanstack/react-table 미도입)**: tc 는 자체 `useGridSort` 를 유지하므로
wm 처럼 tanstack `sortingFn` 을 쓰지 않고, 모듈 스코프 상수 1개 + 비교기 1줄 교체로 끝낸다.
```
const SORT_COLLATOR = new Intl.Collator(undefined, { numeric: true })
...
const sorted = [...rows].sort((a, b) =>
  SORT_COLLATOR.compare(column.accessor(a), column.accessor(b)),
)
```
회귀 게이트: `tests/e2e/selectable-table/selectable-table-sort.spec.ts`
(fixture 데이터 `Cherry/Apple/Banana` — 순수 알파벳이라 Collator 도입 전후 결과 동일. 즉 **이 spec 은
회귀 감지용이지 신기능 증명용이 아니다**. 숫자 정렬 개선 자체는 단위 테스트로 증명한다 — §5 C11 참조.)

---

## 2. wm 레퍼런스 실측 대조 (이식 3종)

### 2.1 토스트 3파일 — **그대로 이식 가능**

| wm 원본 | 줄수 | tc 이식 경로 | 조정 필요 |
|---|---|---|---|
| `src/shared/stores/toast.store.ts` | 38 | 동일 경로 | **없음** (zustand `create` 만 사용, tc 도 zustand@^5) |
| `src/shared/components/Toaster.tsx` | 50 | 동일 경로 | **없음** (`radix-ui` 모노패키지 `Toast`, `lucide-react`, `@/lib/utils` — 전부 tc 에 존재) |
| `src/shared/lib/notify.ts` | 18 | 동일 경로 | **없음** (fallback 문구를 인자로 받으므로 i18n 결합 없음) |

- **react-router 조정 불필요** — 세 파일 모두 라우터를 import 하지 않는다. (SPEC Constraints 의
  `react-router@^8`(tc) vs `react-router-dom@^7`(wm) 차이는 **이 SPEC 의 이식 대상 파일에는 해당 없음**을
  실측으로 확인. R8/R9 후보 5파일도 라우터 미사용. 즉 본 SPEC 에서 import 경로 조정이 필요한 파일은 0건이다.)
- `toast.store.ts` 는 `Date.now()`/`Math.random()` 없이 모듈 스코프 카운터로 id 를 만든다 — 그대로 유지.
- Toaster 의 `border-danger`/`bg-danger` 토큰은 tc `index.css:137` 에 존재(`--danger`). `emerald-*` 는
  Tailwind 기본 팔레트라 토큰 불필요.

### 2.2 `control-styles.ts` — 이식 시 **시각 변경 발생**(결정 D-1 필요)

wm `src/components/ui/control-styles.ts` 3상수(`controlBaseClassName`/`controlPopupClassName`/
`controlOptionClassName`). 사용 토큰 `border-input`/`bg-card`/`bg-popover`/`shadow-soft-md`/`ring`/
`danger` 는 **tc `index.css` 에 전부 존재**(`:48 --color-input`, `:34 --color-card`, `:71 --color-danger`,
`:87 --shadow-soft-md`) → 토큰 부족으로 인한 이식 불가는 없다.

**단, 클래스 값이 달라 Input/Select 전역 시각이 바뀐다**:

| 축 | tc 현재 | wm control-styles |
|---|---|---|
| 높이 | `h-11` (44px) | `h-10` (40px) |
| 모서리 | `rounded-xl` | `rounded-lg` |
| 글자 | `text-sm` (14px) | `text-[0.9375rem]` (15px) |
| 테두리 | `border-border` | `border-input` |
| 배경 | `bg-background` | `bg-card` |
| 그림자 | 없음 | `shadow-xs` |
| hover | 없음 | `hover:border-foreground/20` |
| 포커스링 | `ring-[3px] ring-ring` | `ring-[3px] ring-inset ring-ring` + `focus-visible:bg-background` |
| 비활성 | `opacity-50` | `bg-muted/65 text-muted-foreground opacity-70` |
| 오류 | 없음 | `aria-invalid:border-danger` + `ring-danger/15` |

→ **D-1 참조.**

### 2.3 `SelectableTable` `isLoading` — **그대로 이식 가능**

wm `SelectableTable.tsx` 의 해당 부분만 발췌 이식:
- `:50-52` prop 선언(`isLoading?: boolean`, `skeletonRowCount?: number`)
- `:128` `const DEFAULT_SKELETON_ROW_COUNT = 10`
- `:161-162` 기본값 구조분해
- `:511-535` `renderSkeletonRow` (`data-testid="selectable-table-skeleton-row"`)
- `:721-722` `<TableBody>` 최상단 분기

tc 의 body 구조(`:527-556`)는 wm(`:720-750`)과 **분기 형태·변수명(`totalColSpan`/`virtual`/`showActionColumn`/
`columnSizeStyle`)이 동일**하므로 삽입 지점이 1:1 대응한다. `Skeleton` 컴포넌트는 tc `components/ui/skeleton.tsx`
에 이미 존재.

**미이식 대상(명시)**: wm 의 tanstack 기반 정렬/컬럼 사이징, `MIN_COLUMN_WIDTH`, `actionColumn.compact`,
`focus({ preventScroll: true })` 는 **결정 1(자체 구현 유지) 범위 밖**이라 가져오지 않는다.
`types.ts` 의 `compact?: boolean` 도 소비처가 없으므로 미이식(글로벌 룰 11).

---

## 3. Plan 단계에서 새로 필요해진 결정 (D-1 ~ D-5)

> 아래 5건은 SPEC 본문만으로는 한 가지로 좁혀지지 않아 Plan 세션에서 사용자에게 제시했다.
> **2026-08-18 사용자 확정: D-1 = A(wm 값 그대로), D-2 = A(wm switch.tsx 이식), D-5 = A(284/285 갱신).**
> D-3 · D-4 는 권장안대로 진행한다. **미결 결정 없음 — Implement 는 추가 확인 없이 착수한다.**

### D-1. control-styles 이식 범위 — Input/Select 전역 시각 변경을 수용할 것인가 · **확정: A**

- **긴장 관계**: SPEC Constraints 첫 줄은 "시각/동작 회귀 금지"이나 그 목적어는
  "Button/Select/Checkbox **화**"(= raw 요소 변환 call-site)다. R4 본문은 별도로
  "Input/Select 가 `controlBaseClassName` 을 소비하도록 갱신"을 지시하며, 이는 §2.2 표대로
  **모든 Input/Select 의 높이·모서리·글자·배경을 바꾼다**.
- **확정(A): wm 값 그대로 이식.**
  근거 — (1) R4 가 문자열로 지시한 작업이 정확히 이것이고, (2) SPEC Why 의 목표가 "nori-wm-ui-front 수준으로
  개선"이며, (3) 필요한 토큰이 tc `index.css` 에 전부 존재해 반쪽 이식할 기술적 이유가 없다.
  **단 게이트 부착(확정 조건)**: 커밋 전 Login / EqpManageFormModal / ModelDetailPanel 3화면의 before/after
  스크린샷을 dev-report 에 첨부하고 사용자 확인을 받는다(글로벌 메모리
  `feedback_3d_visual_verify_screenshot` / `feedback_visual_e2e_real_env_verify` — "지오메트리만 쌓고 통과 단정 금지").
- (기각된 대안 B: 상수 파일만 만들고 값은 tc 현행 클래스로 채우기 — 시각 변경 0 이나 R4 문언과 어긋남)

### D-2. `EqpManageFormModal.ToggleField` — SPEC 내부 모순 · **확정: A**

- **사실**: `EqpManageFormModal.tsx:449-455` 의 `<input type="checkbox" className="sr-only">` 는
  체크박스가 아니라 **수제 토글 스위치**다(`:437-447` 에 트랙 `h-6 w-11 rounded-full` + 썸 `size-5` +
  `translate-x-5.5/0.5`). AC5 는 `type="checkbox"` 0건을 요구하므로 이 파일은 반드시 손대야 한다.
- **모순**: SPEC Out of Scope 는 "switch 이식 안 함 — **현재 tc 에 소비처 없음**"이라 적었으나,
  이 ToggleField 가 바로 그 소비처다. 전제가 실측으로 반증됐다.
- **확정(A): wm `src/components/ui/switch.tsx`(33줄, radix `Switch`) 를 이식하고 ToggleField 를
  `<Switch>` 로 교체한다.**
  근거 — (1) radix-ui 모노패키지에 이미 포함이라 **신규 의존성 0**(Constraints 준수),
  (2) wm switch 의 시각(`h-6 w-11`, 썸 `size-5`, checked=`bg-brand-primary`, unchecked=`bg-muted-foreground/35`)이
  tc ToggleField 의 수제 시각(`h-6 w-11`, `size-5`, `bg-brand-primary` / `bg-muted-foreground/40`)과
  **거의 동일** → 시각 보존이 가장 잘 된다,
  (3) Checkbox 로 바꾸면 토글이 네모 체크로 바뀌어 시각·의미 모두 회귀한다.
- (기각된 대안 B: `<button role="switch">` 수제 교체 / C: 공용 Checkbox 통일 — C 는 토글이 네모
  체크로 바뀌어 시각·의미 회귀)
- **SPEC 정합성 처리**: 이 확정으로 SPEC Out of Scope 의 "switch — 현재 tc 에 소비처 없음" 항목은
  사실과 다르다. Validate 세션이 SPEC 을 갱신할 때 해당 줄을 "switch — ToggleField 소비처 실재,
  wm-parity-foundation D-2 로 이식 완료"로 정정한다(Plan 이 SPEC 을 직접 고치지 않는다).

### D-3. `AuthApiError` 통합 범위

- **사실**: 6개 `*ApiError` 는 **구조가 완전히 동일**하다 — `payload: <Domain>FailResponse` + `status?: number`,
  `<Domain>FailResponse` 는 전부 `ApiResponse<null> & { success:false; data:null; errorCode:string; errorMsg:string }`.
  (auth `:47-52`/`:162-172`, deploy `:42-47`/`:157-167`, eqp `:442-447`/`:504-514`, group `:189-199`,
  model `:501-511`, user `:185-195` 실측)
- AC9 는 `class .*ApiError` **1건**을 요구하므로 `AuthApiError` 도 통합 대상이다.
- **권장**: 공용 `ApiError`(`shared/lib/api-error.ts`) 1개로 통합하고, 각 도메인은
  `export const AuthApiError = ApiError` 같은 **별칭조차 두지 않는다**(AC9 grep 은 `class` 만 보지만
  별칭은 R1 의 "로컬 사본 전부 제거"에 어긋난다). 소비처 20곳의 `error instanceof XApiError` →
  `error instanceof ApiError` 로 일괄 치환. `error.payload.errorMsg` / `error.payload.errorCode` /
  `error.status` 접근은 형태가 같아 **무변경**.
- **부작용 명시**: 통합 후 `instanceof` 가 도메인을 판별하지 못한다. 실측상 도메인 판별에 쓰는 곳은
  `eqp-error.util.ts:14`, `deploy-register-utils.ts:17` 2곳뿐이고 둘 다 **이미 도메인 문맥 안에서만
  호출**되므로 동작 변화 없음. 이 2곳은 dev-report 에 개별 확인 결과를 기록한다.

### D-4. `dlq.api.ts` 로컬 `ApiResponse` — AC 밖이지만 R1 대상

- `dlq.api.ts:14-25` 는 `auth.types` 를 import 하지 않고 **자체 `interface ApiResponse` + `isApiResponse`**
  를 갖는다. 따라서 AC17(auth.types import 0)·AC7·AC9 어느 것도 이 파일을 강제하지 않는다.
- 그러나 R1 은 "`ApiResponse`/`isApiResponse` … feature 로컬 사본 전부 제거"라고 적었다.
- **권장**: 전환한다(C1 에 포함). AC 로 측정되지 않으므로 dev-report 에 별도 항목으로 명시하고,
  Validate 세션이 대조할 수 있게 `grep -rn "interface ApiResponse" src` = 1건을 보조 증거로 남긴다.

### D-5. `nori-tc-common/.claude/specs/refactor-backlog.md` 갱신 여부 (SPEC R10 목록 밖) · **확정: 갱신함**

- **사실**: `refactor-backlog.md` 행 **284(S09 A-1)/285(A-2)/287(A-5)/293(C-10)** 이 이 6파일·recharts 를
  "부채 이관"으로 등록해 두고, 재평가 조건에 **"(a) `LiveMapToolbar` 를 제거할지 통합할지 사용자 결정이
  났는가"** 를 명시하고 있다. SPEC 결정 2 가 바로 그 답(제거 + 통합 계획 폐기)이다.
  `nori-tc-refactor-campaign-dev-report.md:645-648,706,718` 도 같은 6파일을 서술한다.
- SPEC R10 의 문서 정정 목록에는 이 2파일이 **없다**.
- **확정**: `refactor-backlog.md` 의 284/285 행 상태를 "부채 이관"→"완료"로 갱신하고 근거 커밋 SHA 를 채운다
  (**C5-b 별도 커밋**).
  근거 — 그 표는 스스로 "제거 실행 시 문서 동시 정정 필요"를 게이트로 걸어 뒀으므로, 제거를 하고도
  표를 두면 **표가 거짓**이 된다(R10 이 문서 정정을 필수로 건 것과 같은 이유).
  `nori-tc-refactor-campaign-dev-report.md` 는 **완료된 SDD 사이클의 실행 기록**이라 정정 대상이 아니다
  (과거 시점 사실의 기록 — 고치면 이력 조작).
- 같은 근거로 tc `.claude/specs/nori-client-forked-migration{,-plan,-dev-report}.md` 와
  `i18n-hardcoded-audit.md` 의 `recharts`/`PageFooter`/`DeployStatusChart` 언급도 **정정하지 않는다**
  (과거 실행 기록). SPEC 이 지목한 `live-map-3d.md` / `live-map-layout-builder-phase1-plan.md` 는
  **현재 구조를 서술**하는 문서라 정정 대상이 맞다.

---

## 4. 사전 확정 위험 — R4/R5 는 e2e 스펙 수정을 동반한다 (최우선 인지 사항)

> **AC4(raw `<select>` 0) · AC5(raw checkbox 0) 와 AC16(e2e baseline 회귀 0) 은
> e2e 스펙을 함께 고치지 않으면 동시에 만족할 수 없다.** Implement 세션이 이걸 모르고 들어가면
> "구현은 끝났는데 e2e 가 무더기로 깨지는" 상태가 된다.

### 4.1 native `<select>` 의존 e2e — 16 호출 / 9 파일

`page.selectOption()` 은 **native `<select>` 전용**이다. radix `Select` 는 `<button>` 트리거 + portal
목록이라 이 API 가 동작하지 않는다.

| 대상 select | 소스 | 의존 spec |
|---|---|---|
| `live-map-3d-add-eqp-select` | `LiveMap3DScene.tsx:1269` | `live-map-3d-auto:112`, `live-map-3d-edit-advanced:115,117`, `live-map-3d-eqp-drag:72`, `live-map-3d-eqp-redrag:85` |
| `live-map-3d-add-select` | `LiveMap3DScene.tsx:1240` | `live-map-3d-edit-advanced:171`, `live-map-3d-editing:157`, `live-map-3d-structure:108`, `live-map-3d-undo-counts:83,91,123` |
| `live-map-3d-assign-select` | `LiveMap3DScene.tsx:1336` | `live-map-3d-editing:166` |
| `live-map-3d-eqp-select` | `LiveMap3DScene.tsx:1351` | `live-map-3d-editing:169` |
| LiveMapDemoModal 의 `<select>` | `LiveMapDemoModal.tsx` | `live-map-scenario-upload:127,131` (`dialog.locator('select')`), `demo-matrix.harness:96-97` |

→ 변환 커밋과 **같은 커밋 안에서** 위 9개 spec 을 radix 구동 방식
(`getByTestId(...).click()` → `page.getByRole('option', { name })`.click()`) 으로 고친다.

### 4.2 native checkbox 의존 e2e — 3 파일

| 셀렉터 | spec |
|---|---|
| `input[type="checkbox"]` | `deploy/deploy-register-bulk-guard.spec.ts:105`, `deploy/deploy-register-scenario-modal.spec.ts:146`, `verify-ui/overlays-deploy.spec.ts:47,49` |

→ radix `Checkbox` 는 `<button role="checkbox">` 를 렌더하므로 셀렉터를 `[role="checkbox"]` 또는
`data-testid` 로 바꾼다. 반면 `group-page.spec.ts:459`(`getByTestId(...).check()`)와
`model-flow.spec.ts:939`(`getByLabel(...).check()`)는 Playwright `check()` 가 `role=checkbox` 를
지원하므로 **`data-testid`/`aria-label` 만 트리거 루트로 옮기면 무수정 통과**한다.

### 4.3 그 밖의 함정

- `SelectableTable.isNativeInteractiveTarget`(`:59-68`)이 `INPUT/SELECT/TEXTAREA/BUTTON` 을 통과시킨다.
  radix Select 트리거·Checkbox 루트는 둘 다 `<button>` 이라 **셀 내부 native 우선 처리 계약은 유지**된다.
- `LiveMap3DScene` 뱃지 버튼(`:1098-1122`)은 `badgeRefs: Map<string, HTMLButtonElement>` 에 담겨
  `BadgeProjector` 가 **`el.style.transform` 을 명령형으로 갱신**한다(`:226`). `<Button>` 으로 감싸도
  `asChild=false` 면 실제 DOM 은 `<button>` 이라 ref 타입·동작 유지. 다만 메모리
  `project_ui_front_tailwind_v4_scale_imperative_transform` 대로 **`scale-*`/`translate-*` 유틸을
  className 오버라이드로 넣으면 안 된다**(inline transform 과 합성되어 밀림). tc `buttonVariants` 에는
  해당 유틸이 없음을 확인했다.
- eslint `i18next/no-literal-string` 이 `mode:'all'` + 템플릿 리터럴까지 검사한다. **새로 넣는 한글
  리터럴은 전부 `t()`/`i18n.t()` 경유**. `jsx-attributes.exclude` 에 `aria-label`/`placeholder`/`title` 이
  **없으므로** 이 속성들도 t() 필수.
- `tests/unit/dependency-declaration.test.ts` 가 `src` 의 모든 bare import 를 `package.json` 과 대조한다.
  → **`DeployStatusChart.tsx` 삭제와 `package.json` 의 recharts 제거는 반드시 같은 커밋**(순서가 갈리면
  중간 커밋에서 이 테스트가 FAIL).
- Windows dev 서버 stale 서빙(메모리 `project_ui_front_vite_watcher_stale_windows`) — e2e 는
  `reuseExistingServer: !CI` 다. baseline 측정 전·최종 측정 전 **3000 포트를 taskkill 하고 새로 띄운다.**

---

## 5. 커밋 단위 분할 (C0 ~ C18)

> 원칙: ① 각 커밋은 단독으로 `npm run build` + `npm run lint` + `npm run test:unit` 통과,
> ② 커밋마다 "완료 판정에 쓰는 AC" 를 명시, ③ 컨텍스트 60% 에서 끊겨도 다음 세션이 커밋 경계에서
> 이어받는다. **세션 경계 후보는 표의 `세션` 칼럼**.

| # | 커밋 | 레포 | R | 완료 판정 AC | 선행 | 병렬 | 세션 |
|---|---|---|---|---|---|---|---|
| C0 | (커밋 없음) e2e baseline 기록 | — | AC16 전제 | — | 없음 | — | S1 |
| C1 | `feat(shared): API 스캐폴딩 shared 승격` | ui-front | R1 | **AC7 AC8 AC9** + AC1~3 | C0 | — | S1 |
| C2 | `refactor(api): auth.types cross-feature import 해소` | ui-front | R2 | **AC17** + AC1~3 | C1 | — | S1 |
| C3 | `chore(cleanup): 죽은 코드 6파일 + recharts 제거` | ui-front | R10(코드) | **AC10 AC11** + AC1~3 | 없음 | ✅ | S2 |
| C4 | `docs(specs): live-map 문서에서 제거 파일 서술 정정` | ui-front | R10(문서) | 수동 대조 | C3 | ✅ | S2 |
| C5-a | `docs(specs): port-carrier-id-lifecycle 3파일 정정` | **common** | R10(문서) | 수동 대조 | C3 | ✅ | S2 |
| C5-b | `docs(specs): refactor-backlog 284/285 행 완료 처리` | **common** | D-5 | 수동 대조 | C3 | ✅ | S2 |
| C6 | `docs(arch): live-map 구성요소 서술 정정` | **exec** | R10(문서) | 수동 대조 | C3 | ✅ | S2 |
| C7 | `feat(shared): 토스트 시스템 이식 + AppProvider 마운트` | ui-front | R3(인프라) | **AC14** + AC1~3 | 없음 | ✅ | S2 |
| C8 | `feat(user,group): 실패 알림을 토스트로 배선` | ui-front | R3(소비) | **AC13** + AC1~3 | C7 | — | S2 |
| C9 | `feat(ui): control-styles 이식 + Input/Select 갱신` | ui-front | R4(프리미티브) | AC1~3 + **스크린샷 게이트** | 없음 (D-1 확정) | ✅ | S3 |
| C10 | `feat(ui): 공용 Checkbox 신설 + wm Switch 이식` | ui-front | R5(프리미티브) | AC1~3 | 없음 (D-2 확정) | ✅ | S3 |
| C11 | `feat(table): SelectableTable isLoading + numeric 정렬 백포트` | ui-front | R7 | **AC12** + AC1~3 | 없음 | ✅ | S3 |
| C12 | `fix(deploy): window.confirm 을 ConfirmDialog 로 전환` | ui-front | R11 | **AC15** + AC1~3 | 없음 | ✅ | S3 |
| C13 | `refactor(ui): 폼·모달 계열 raw control 수렴` | ui-front | R4/5/6 부분 | 부분(§5.13) | C9,C10 | — | S4 |
| C14 | `refactor(model): model 계열 raw control 수렴` | ui-front | R4/6 부분 | 부분(§5.14) | C9,C10 | ✅(C13과) | S4 |
| C15 | `refactor(live-map): LiveMap3DScene 수렴 + e2e 갱신` | ui-front | R4/6 부분 | 부분(§5.15) | C9,C10 | — | S5 |
| C16 | `refactor(live-map): 잔여 live-map 수렴` | ui-front | R4/5/6 완료 | **AC4 AC5 AC6** | C13,C14,C15 | — | S5 |
| C17 | (커밋 없음 또는 소량) R8/R9 판정 기록 | ui-front | R8/R9 | dev-report 기록 | C16 | — | S6 |
| C18 | (커밋 없음) 최종 게이트 — 전체 e2e baseline 대조 | — | — | **AC16** + AC1~3 최종 | C16 | — | S6 |

**병렬 가능 관계 요약**
- **직렬 필수 사슬**: `C0 → C1 → C2` (shared 정의가 없으면 R2 가 성립 불가)
- **완전 독립(어느 시점에든 착수 가능)**: C3(+C4~C6), C7(+C8), C9, C10, C11, C12
  (D-1·D-2 가 Plan 단계에서 확정돼 C9/C10 의 결정 대기 선행이 사라졌다)
- **수렴 4종(C13~C16)** 은 C9·C10 이후. C13/C14 는 서로 파일이 겹치지 않아 병렬 가능.
  C15·C16 은 같은 live-map 디렉터리라 직렬.
- C16 이 AC4/AC5/AC6 을 동시에 green 으로 만드는 **유일한 지점**이다.

---

### 5.C0 — e2e baseline (Implement 세션의 **첫 단계**, 커밋 없음)

**AC16 은 baseline 목록 대조로만 기계 판정된다.** 로컬 e2e 에는 사전 실패가 있으므로
(메모리 `project_ui_front_e2e_preexisting_local_failures`, `project_ui_front_e2e_line_mock_array`)
**PASS 목록과 FAIL 목록을 둘 다 기록**해야 판정이 성립한다.

절차(그대로 실행):
```bash
cd c:/workspace_nori/nori-tc-ui-front
git status --porcelain          # clean HEAD 확인 (출력 0줄이어야 함)
git rev-parse --short HEAD      # baseline SHA 기록
# Windows stale dev server 방지 — 포트 3000 정리 후 실행
netstat -ano | grep ':3000' || true
npm run test:e2e 2>&1 | tee ../_scratch/e2e-baseline.txt
```
dev-report 에 기록할 것(§AC16 판정 근거):
1. baseline SHA
2. 총 spec 수(현재 **70 파일**) / passed / failed / skipped 수치
3. **PASS spec 전체 목록** (파일:테스트명)
4. **FAIL spec 전체 목록 + 실패 사유 1줄** — 이 목록은 판정 제외 집합이다
5. 출력 마지막 5~10줄 코드블록 인용

주의:
- `verify-ui/*` 11 spec 과 `demo-matrix.harness.spec.ts` 는 **실백엔드(localhost:8080) 전제**다.
  백엔드 없이 돌리면 baseline FAIL 로 잡히고, 그러면 최종 판정에서도 제외된다 — 이 상태를
  dev-report 에 "백엔드 미기동으로 baseline 제외"라고 명시한다(사후 해석 여지 제거).
- 최종 게이트(C18)는 **동일 조건**(같은 백엔드 기동 여부)에서 재측정해야 대조가 성립한다.

---

### 5.C1 — API 스캐폴딩 shared 승격 (R1) · AC7/AC8/AC9

**신설 파일**
| 경로 | 내용 |
|---|---|
| `src/shared/types/api.types.ts` | `ApiResponse<TData>` + `isApiResponse` + `isRecord` (wm 동일 경로/형태) |
| `src/shared/lib/api-error.ts` | `ApiFailResponse` 타입 + `createFailResponse(payload, fallbackMessage)` + **`class ApiError`**(`payload`+`status?`) + `normalizeApiError(error, fallbackMessage)` + `resolveSuccessPayload(payload, status, fallbackMessage)` |

**수정 파일 — `src/shared/lib/csrf.ts`**: `issueCsrfToken()` 공용 정의 신설.
```
requestCsrfCookie() → readCsrfCookieToken() → 없으면 throw new ApiError(
  createFailResponse({ errorCode:'CSRF_TOKEN_MISSING', errorMsg: i18n.t('error.auth.csrf') }))
```
- **i18n 키 신설 불필요** — `error.auth.csrf` 가 ko/en/vi 3파일 `:823` 에 이미 존재(실측). 재사용한다
  (글로벌 룰 3 — 요청되지 않은 신규 키 금지).

**로컬 정의 제거 대상 전수 (11 + 9 + 6 + 6 + 6 + 1)**

| 심볼 | 제거할 파일:줄 |
|---|---|
| `resolveSuccessPayload` (11) | deploy.api:187, eqp.api:105, group.api:72, layout.api:65, live-map-demo-run.api:60, live-map.api:40, model-flow.api:71, model.api:87, profile.api:34, user.api:65, shared/api/line.api:16 |
| `issueCsrfToken` (9) | auth.api:83, deploy.api:136, eqp.api:62, group.api:36, layout.api:56, live-map-demo-run.api:49, model-flow.api:31, model.api:45, user.api:29 |
| `class *ApiError` (6) | auth.types:162, deploy.api:157, eqp.types:508, group.types:189, model.types:502, user.types:185 |
| `withCsrfHeaders` (6) | deploy.api:199, eqp.api:194, group.api:249, model-flow.api:101, model.api:252, user.api:155 |
| `isApiResponse` (6) | auth.types:75, dlq.api:21, eqp.types:461, group.types:143, model.types:345, user.types:139 |
| `interface ApiResponse` (2) | auth.types:9, **dlq.api:14** (D-4) |
| `normalize*Error` (9 정의) | auth.api:112, deploy.api:169, eqp.api:83, group.api:54, comm-log.api:20, layout.api:72, live-map-demo-run.api:69, live-map.api:47, model-flow.api:50, model.api:66, profile.api:16, user.api:47, line.api:23 → **공용 `normalizeApiError` 로 통일** |
| `isRecord` 중복 export (4) | eqp.types:455, group.types:137, model.types:340, user.types:134 → shared 로 |

**`auth.api.ts` 의 변형 시그니처 처리 (R1 명시 요구)**
- 현행 `issueCsrfToken(purpose)`(`:83-104`)는 ① `requestCsrfCookie()` 실패를 purpose 별
  (`login-csrf`/`logout-csrf`) 로 정규화하고 ② 토큰 부재 시 `AuthApiError(CSRF_TOKEN_MISSING)` 를 던진다.
- 전환: 공용 `issueCsrfToken()` 을 호출하고 **호출부 3곳**(`prepareCsrfToken:159`, `login:145`, `logout:193`)을
  `try { await issueCsrfToken() } catch (e) { throw normalizeAuthError(e, fallback, ctx) }` 로 감싼다.
  `AuthApiError` 는 D-3 에 따라 `ApiError` 로 통합되므로 `normalizeAuthError` 는 auth 전용
  403 문맥 보정(`buildForbiddenAuthResponse` / `createContextualAuthFailResponse`)만 남긴 얇은 래퍼가 된다.
  → **`auth.api.ts` 에 `issueCsrfToken =` 정의를 남기지 않는다**(AC8 이 1파일을 강제).

**소비처 일괄 치환 20곳** (`instanceof` 실측 목록):
`auth.api:117`, `deploy.api:173`, `deploy-register-utils:17`, `eqp.api:87`, `EqpPage:151`,
`eqp-error.util:14`, `group.api:58`, `GroupAddMembersModal:109,151`, `GroupDeleteConfirmDialog:39`,
`GroupPermissionsModal:172`, `GroupUpsertModal:121`, `model-flow.api:54`, `model.api:70`, `ModelPage:60`,
`useModelMutations:142`, `user.api:51`, `UserDeleteConfirmDialog:39`, `UserPasswordResetModal:93`,
`UserUpsertModal:176`, `useLogin.ts:9`

**검증**
```bash
grep -rn "const resolveSuccessPayload" src   # AC7 → 1건
grep -rln "issueCsrfToken\s*=" src           # AC8 → src/shared/lib/csrf.ts 1파일
grep -rn "class .*ApiError" src              # AC9 → 1건
grep -rn "interface ApiResponse" src         # D-4 보조 → 1건
npm run build && npm run lint && npm run test:unit
```

**위험**: 이 커밋이 SPEC 전체에서 **가장 큰 diff**(약 25파일)이며 런타임 에러 경로를 바꾼다.
→ 세션 예산이 부족하면 C1 을 `C1-a(shared 정의 신설 + line/comm-log/layout/live-map/dlq 등
plain-Error 계열 6파일 전환)` / `C1-b(*ApiError 6종 통합 + 소비처 20곳)` 로 2분할해도 좋다.
단 AC7/AC8/AC9 는 C1-b 완료 시점에만 green 이다.

---

### 5.C2 — auth.types cross-feature import 해소 (R2) · AC17

**대상 12파일(실측 전수)**
`deploy.api.ts:3`, `deploy.types.ts:1`, `eqp.types.ts:1`, `group.types.ts:2`, `comm-log.api.ts:3`,
`layout.api.ts:2`, `live-map-demo-run.api.ts:3`, `live-map.api.ts:3`, `model.types.ts:2`,
`profile.types.ts:1`, `user.types.ts:2`, `shared/api/line.api.ts:2`
→ 전부 `@/shared/types/api.types` 로 교체. (SPEC 이 적은 대로 `model.api.ts:6`/`model-flow.api.ts:9` 는
`../types/model.types` 경유라 `model.types.ts:2` 전환으로 함께 해소된다 — 실측 확인.)

**features/auth 내부 상대 경로 2건도 함께 정리**: `auth.api.ts:14`, `useLogin.ts:9`
(AC17 grep 대상은 아니지만 C1 의 `AuthApiError` 통합으로 어차피 손대는 줄이다.)

**검증**: `grep -rn "features/auth/types/auth.types" src` → **0건** (AC17) + AC1~3

---

### 5.C3 — 죽은 코드 6파일 + recharts 제거 (R10 코드) · AC10/AC11

**삭제 파일 (경로 실측 — `PageFooter.tsx` 는 `src/shared/layout/` 아래다. SPEC 은 경로 없이 파일명만 적었다)**
```
src/features/live-map/components/LiveMap3DEquipment.tsx   (211 LOC)
src/features/deploy/components/DeployStatusChart.tsx      (110 LOC)
src/features/live-map/components/LiveMapToolbar.tsx       ( 75 LOC)
src/shared/layout/PageFooter.tsx                          ( 25 LOC)
src/features/live-map/components/LiveMapLegend.tsx        ( 24 LOC)
src/features/group/types/index.ts                         (  1 LOC)
```
`package.json` 의 `"recharts": "^3.8.1"`(`:41`) 제거 + `npm install` 로 lock 동기.
`src/shared/layout/` 은 PageFooter 외 13파일이 남으므로 디렉터리는 유지된다.

**dead 재검증 (글로벌 룰 — 4곳 이상 확인. 이 세션 실측 결과)**
| 검증축 | 결과 |
|---|---|
| ① 코드 참조 | `grep -rn <이름> src tests` → 자기 파일 외 **0건**. `LiveMap3DEquipment` 매칭 3건은 전부 별개 파일 `LiveMap3DEquipmentField`(현역) |
| ② 동적/문자열 참조 | `grep -rn "<이름>'"` → **0건** |
| ③ git 추적 | `git ls-files` 로 6경로 전부 실재 확인(AC11 의 before 상태) |
| ④ 배럴 재export | `features/group` 내 `from './types'` / `from '../types'` → **0건** |
| ⑤ 상위 감사 | `nori-tc-common` refactor-campaign 게이트가 진입점/라우팅/store/외부/동적 5축 전수 재확인 완료로 기록(`nori-tc-refactor-campaign-dev-report.md:706`) |

**순서 강제**: 파일 삭제와 `package.json` recharts 제거를 **한 커밋에** 넣는다(§4.3 —
`dependency-declaration.test.ts`).

**검증**
```bash
grep -rn "recharts" src package.json        # AC10 → 0건
git ls-files <6경로>                         # AC11 → 0줄 (6경로 AND)
npm run build && npm run lint && npm run test:unit
```

---

### 5.C4 — tc 문서 정정 (R10 문서, ui-front 레포)

| 파일:줄 | 현재 서술 | 정정 |
|---|---|---|
| `.claude/specs/live-map-3d.md:8` | "설비 3D 모델 = … (`LiveMap3DEquipment`)" | 현역 컴포넌트명 `LiveMap3DEquipmentField` 로 정정 |
| `.claude/specs/live-map-3d.md:46` | "`LiveMap3DEquipment` 미-memo 라 …" | 동 |
| `.claude/specs/live-map-3d.md:47` | "**memo**: `LiveMap3DEquipment`/`LiveMap3DObject` 를 React.memo" | 동 |
| `.claude/specs/live-map-layout-builder-phase1-plan.md:264` | "⚠ `LiveMapToolbar.tsx` 는 lineOptions prop 보유하나 현재 미연결 — **통합 필요**" | **통합 계획 폐기 + 파일 제거됨**으로 정정 (SPEC 결정 2). 검색/상태 필터의 현 소재를 함께 적는다 — `LiveMapBoard.tsx:571,579` |

**정정하지 않는 문서(사유 명시)**: `nori-client-forked-migration{,-plan,-dev-report}.md`,
`i18n-hardcoded-audit.md` — 완료된 SDD 사이클의 **실행 기록**이라 당시 사실이 맞다(D-5 참조).

---

### 5.C5-a / C5-b — nori-tc-common 문서 정정 (R10 문서 + D-5, **별 레포 별 커밋 2건**)

레포: `c:\workspace_nori\nori-tc-common` (현재 main, clean)

| 파일:줄 | 현재 | 정정 |
|---|---|---|
| `.claude/specs/port-carrier-id-lifecycle.md:126` | "기존 소비처 [LiveMap3DEquipment] / [LiveMapMachineNode] 무영향" | `LiveMap3DEquipmentField` 로 정정 |
| `.claude/specs/port-carrier-id-lifecycle-plan.md:119` | "기존 portItems 소비처([LiveMap3DEquipment], …" | 동 |
| `.claude/specs/port-carrier-id-lifecycle-dev-report.md:196` | "front 의 `LiveMap3DEquipment`, …" | 동 |

**C5-a 커밋 메시지**: `docs(specs): 제거된 LiveMap3DEquipment 서술을 현역 컴포넌트명으로 정정`

**C5-b (D-5 확정 — 별도 커밋)**: `.claude/specs/refactor-backlog.md`
- 행 **284(S09 A-1, 죽은 파일 6개)** / **285(S09 A-2, recharts)** 상태를 "부채 이관"→"완료"로,
  증거 칸에 C3 커밋 SHA 를 채운다. 재평가 조건 (a)(b)(c) 는 **해소 근거**(SPEC 결정 2 = LiveMapToolbar
  제거 확정 / 문서 5건 정정 완료 = C4·C5-a·C6)로 대체 서술한다.
- 행 **287(A-5, `live-map-3d.model.ts` 중복 export)** / **293(C-10, 배럴 재export)** 은 본 SPEC 이
  손대지 않으므로 **상태 유지**. 단 "순서 284·286 에 종속" 서술 중 284 종속이 해소됐음을 각주로 남긴다.
- 행 **286(A-4, 미사용 export 24건)** 은 확신도 분리가 선행 조건이라 본 SPEC 밖 — **무변경**.

**C5-b 커밋 메시지**: `docs(specs): refactor-backlog 284/285 행을 wm-parity-foundation 제거 실행으로 완료 처리`

---

### 5.C6 — nori-tc-exec 문서 정정 (R10 문서, **별 레포 별 커밋**)

레포: `c:\workspace_nori\nori-tc-exec` (현재 main, clean)

`docs/Architecture/ui/front/10-live-map-dashboard-and-demo-control.md:15-16`
```
- `LiveMapToolbar`
  - 검색어, line filter, status filter를 제공합니다.
```
→ 이 항목을 삭제하고, `LiveMapBoard` 항목의 설명에 검색어·상태 필터 제공을 합친다
(**실측 근거**: 검색/상태 필터 UI 는 `LiveMapBoard.tsx:571,579`, line 필터는 공유 topbar
`LineScopeSelector` 경유 — `LiveMapPage.tsx:88-89,155-157` 이 store 값을 소비).

커밋 메시지: `docs(arch): live-map 구성요소에서 제거된 LiveMapToolbar 서술을 정정`

---

### 5.C7 — 토스트 시스템 이식 (R3 인프라) · AC14

**신설 3파일** — §2.1 표대로 wm 원본을 **무수정 이식**.
- `src/shared/stores/toast.store.ts`
- `src/shared/components/Toaster.tsx`
- `src/shared/lib/notify.ts`

**수정 1파일** — `src/app/providers/AppProvider.tsx`
`<I18nProvider>{children}</I18nProvider>` 아래에 `<Toaster />` 1회 마운트.
(I18nProvider **안**에 넣을 필요는 없다 — Toaster 자체는 `t()` 를 쓰지 않고 문구를 push 시점에 받는다.
다만 형제로 두면 향후 t() 도입 시 깨지므로 **I18nProvider 자식으로 마운트**한다.)

**검증**: `grep -c "<Toaster" src/app/providers/AppProvider.tsx` → **1** (AC14).
import 줄(`import { Toaster } from …`)은 `<Toaster` 를 포함하지 않아 카운트에 잡히지 않음 — 확인 완료.

---

### 5.C8 — user/group 실패 알림 배선 (R3 소비) · AC13

**대상 7파일(SPEC 지정 = 실측 `setErrorMessage` 보유 파일과 정확히 일치)**

| 파일 | `setErrorMessage` 호출 수 |
|---|---|
| `group/components/GroupAddMembersModal.tsx` | 8 |
| `group/components/GroupUpsertModal.tsx` | 7 |
| `group/components/GroupPermissionsModal.tsx` | 5 |
| `group/components/GroupDeleteConfirmDialog.tsx` | 4 |
| `user/components/UserUpsertModal.tsx` | 8 |
| `user/components/UserDeleteConfirmDialog.tsx` | 4 |
| `user/components/UserPasswordResetModal.tsx` | 3 |

**적용 규칙(wm 패턴)**: `catch` 블록의 `setErrorMessage(<사유 계산>)` →
`setErrorMessage(notifyFailure(error, t('...')))`.
- **인라인 폼 검증 에러는 유지**(SPEC 명시) — `catch` 밖에서 호출되는 `setErrorMessage` 는 손대지 않는다.
  즉 39회 전부가 아니라 **catch 안의 것만** 대상.
- C1 의 `ApiError` 통합으로 `error.payload.errorMsg` 가 `Error.message` 와 동일해지므로
  `notifyFailure` 의 `error.message` 경로가 그대로 사유를 집는다.

**검증**: `grep -rln "notifyFailure" src/features/user src/features/group` → **7파일 이상** (AC13)

---

### 5.C9 — control-styles 이식 + Input/Select 갱신 (R4 프리미티브)

**D-1 확정(A) 반영 — wm 값을 그대로 가져온다(시각 변경 수용).**

- 신설 `src/components/ui/control-styles.ts` (wm 원본 3상수)
- 수정 `src/components/ui/input.tsx` — `controlBaseClassName` + `'h-10 px-3'`
- 수정 `src/components/ui/select.tsx` — wm 대비 실측 diff 5곳:
  `SelectValue` 에 `min-w-0 truncate` / `SelectTrigger` 를 `controlBaseClassName` + `h-10 gap-2 overflow-hidden text-left` /
  `SelectContent` 를 `controlPopupClassName` 소비 / `SelectLabel` 패딩·굵기 / `SelectItem` 을 `controlOptionClassName` + `pl-8`

**게이트(D-1 권장안 A 채택 시 필수)**: `/login`, EQP 관리 폼 모달, 모델 상세 패널 3화면의
before/after 스크린샷을 dev-report 에 첨부 → 사용자 확인 후 커밋 확정.
(스크린샷은 실제 dev 서버 기동 + Playwright `page.screenshot()` → `Read` 로 직접 확인. 메모리
`feedback_3d_visual_verify_screenshot` 준수 — "지오메트리만 쌓고 통과 단정 금지".)

**주의**: 이 커밋은 `<Input>`/`<Select>` **기존 소비처 전부**의 시각을 바꾼다(높이 4px 감소 포함).
`layout-overflow-guard.spec.ts` / `modal/modal-overflow-guard-extra.spec.ts` /
`modal/modal-visual-sweep-*.spec.ts` 4 spec 이 레이아웃 회귀 감지 대상이다 — 이 커밋 직후
**해당 4 spec 만 먼저 돌려** 조기 검출한다.

---

### 5.C10 — 공용 Checkbox 신설 + wm Switch 이식 (R5 프리미티브)

**D-2 확정(A) 반영 — `switch.tsx` 이식이 이 커밋에 포함된다.**

- 신설 `src/components/ui/switch.tsx` — wm 원본(33줄) **무수정 이식**. radix-ui 모노패키지의
  `Switch` 사용이라 신규 의존성 0. 소비처는 C13 의 `EqpManageFormModal.ToggleField` 1곳
  (미사용 프리미티브가 되지 않도록 **C13 과 같은 세션(S3→S4 연속)에서 소비 배선까지 마친다**).
- 신설 `src/components/ui/checkbox.tsx` — **wm 에 원본 없음**(wm `components/ui` 18파일 실측: checkbox 부재).
  radix-ui 모노패키지 `Checkbox` 기반으로 tc 가 새로 작성한다.
  스타일 기준은 wm `switch.tsx` 의 톤(`data-[state=checked]:bg-brand-primary`, `focus-visible:ring-[3px] ring-ring`,
  `disabled:cursor-not-allowed disabled:opacity-50`)을 따르고, 현행 raw 체크박스의
  `size-4 shrink-0 rounded border-input accent-brand-primary`(`LiveMapDemoModal.tsx:101` 실측) 크기를 보존한다.
- **`indeterminate` 지원 필수** — 실측 소비처 2곳이 tri-state 다:
  `LiveMapDemoModal.tsx:87`(`inputRef.current.indeterminate`), `DeployRegisterPanel.tsx:304`(`searchSelectAllRef`).
  radix 는 `checked="indeterminate"` 로 표현하므로 **명령형 ref 조작(useEffect)이 통째로 사라진다**.
**미이식 확정**: combobox / searchable-select / tooltip (SPEC Out of Scope, tc 소비처 0).

> **주의 — 미사용 프리미티브 방지(글로벌 룰 11)**: C9(control-styles)는 기존 Input/Select 가 즉시
> 소비하므로 단독 커밋으로 안전하다. 그러나 C10 의 `checkbox.tsx`/`switch.tsx` 는 C13 전까지
> 소비처가 0이다. **C10 과 C13 사이에 세션을 끊지 않는다**(§8 의 S3→S4 를 한 흐름으로 본다).
> 부득이 끊긴다면 dev-report 에 "C10 단독 상태 = 소비처 0, C13 에서 해소 예정"을 명시한다.

---

### 5.C11 — SelectableTable isLoading + numeric 정렬 백포트 (R7) · AC12

**수정 2파일**
- `src/shared/components/SelectableTable/SelectableTable.tsx`
  - `isLoading?` / `skeletonRowCount?`(기본 10) prop + `DEFAULT_SKELETON_ROW_COUNT`
  - `renderSkeletonRow` (wm `:511-535` 형태, `data-testid="selectable-table-skeleton-row"`)
  - `<TableBody>` 최상단 `isLoading` 분기 (현행 `:528` 앞)
  - `:197-199` 비교기를 `SORT_COLLATOR.compare(...)` 로 교체 (§1)
- **실소비처 1곳**: `src/features/user/components/UserListTable.tsx`
  - 근거: `:143` 에 `isInitialLoading = userListQuery.isLoading && items.length === 0` 가 이미 있고,
    `:153-177` 이 **로딩 전용 `<Table>` + `<TableHeader>` 6컬럼을 별도로 중복 정의**한다 —
    wm 이 `isLoading` prop 을 만든 이유(주석 `:45-48`)와 정확히 같은 부채다. 이걸 지우고
    `<SelectableTable ... isLoading={isInitialLoading}>` 로 대체하면 헤더 중복 정의가 사라진다.
  - (동일 패턴이 `GroupListTable.tsx:144` 에도 있으나 AC12 는 1곳이면 충족 — 룰 4(surgical) 대로 1곳만.)

**AC12 판정**
```bash
grep -n "isLoading" src/shared/components/SelectableTable/SelectableTable.tsx     # ≥1
grep -rn -B8 "isLoading={" src/features --include="*.tsx" | grep -c "<SelectableTable"  # ≥1
```

**numeric 정렬 증명(RED→GREEN)**: `tests/unit/` 에 비교기 단위 테스트 1개 추가
(`["9","10","2"]` → asc 가 `2,9,10` 임을 단언). e2e `selectable-table-sort.spec.ts` 는 알파벳
데이터라 이 개선을 증명하지 못하고 **회귀 감지용**으로만 쓴다.
> 비교기가 컴포넌트 내부에 있으면 단위 테스트가 못 붙는다 — `SORT_COLLATOR` 를 export 하거나
> 정렬 비교 함수를 `SelectableTable/` 내 별도 모듈로 뽑는다. **2개 소비처(컴포넌트+테스트)가
> 생기므로 룰 11 의 조기 추상화에 해당하지 않는다.**

**회귀 게이트**: `selectable-table-*` 14 spec + `user-page.spec.ts` + `selectable-table-user-list.spec.ts`

---

### 5.C12 — window.confirm 제거 (R11) · AC15

`src/features/deploy/components/DeployMonitorPanel.tsx:723`
```
if (!window.confirm(t('deploy.monitor.redeployConfirm'))) { return }
```
- 이 파일은 **이미 `ConfirmDialog` 를 import(`:4`)하고 `:964` 에서 렌더**한다 → 신규 프리미티브 0.
- 동기 흐름 → 비동기 확인 흐름 전환이 필요하다: `handleRedeploy(deployKey)` 를
  ① `pendingRedeployKey` state 설정만 하는 부분과 ② 다이얼로그 confirm 시 실행되는 부분으로 분리.
  `:713-751` 의 server-backed 분기만 확인 대상이고 local 분기(`:753~`)는 무확인 유지(현행 동작 보존).
- **i18n 키 신설 불필요** — `deploy.monitor.redeployConfirm` 이 ko/en/vi `:265` 에 이미 존재.
  ConfirmDialog 의 confirm/cancel 라벨은 기본값(`common.confirm`/`common.cancel`, `:461-462`) 사용.

**검증**: `grep -rn "window.confirm" src` → **0건** (AC15)
**회귀 게이트**: `selectable-table-deploy-monitor.spec.ts`, `deploy/deploy-monitor-view-modal.spec.ts`

---

### 5.C13 — 폼·모달 계열 raw control 수렴 (R4/R5/R6 부분)

**대상 8파일**

| 파일 | button | select | checkbox | 비고 |
|---|---|---|---|---|
| `auth/components/LoginPage.tsx` | 6 (`:73,80,220,247,253,263`) | 0 | 1 (`:238`) | 인풋 `:63,185,211` 도 `<Input>` 화 (R4) |
| `eqp/components/EqpPage.tsx` | 0 | **1** (`:1484`) | 0 | 파라미터 버전 선택. `selectOption` 의존 e2e **없음**(실측) |
| `deploy/components/DeployRegisterPanel.tsx` | 1 | 0 | 2 (`:849,864`) | `:849` 는 indeterminate(`:304`) |
| `group/components/GroupAddMembersModal.tsx` | 1 | 0 | 1 (`:211`) | e2e `group-page:459` 가 testid 로 `.check()` |
| `group/components/GroupPermissionsModal.tsx` | 0 | 0 | 1 (`:252`) | |
| `group/components/GroupUpsertModal.tsx` | 0 | 0 | 1 (`:177`) | `id="group-upsert-is-active"` label 연결 보존 |
| `eqp/components/EqpManageFormModal.tsx` | 0 | 0 | 1 (`:451`) | **D-2 확정 — `ToggleField`(`:425-459`) 를 wm `<Switch>` 로 교체**. 트랙/썸 수제 span 2개(`:437-447`)도 함께 제거되고 라벨 텍스트(`toggleOn`/`toggleOff`)·`disabled` 배경은 보존 |
| `model/components/DcopItemPickerModal.tsx` | 1 | 0 | 1 (`:262`) | e2e `model-flow:939` 가 `getByLabel().check()` |

**동반 e2e 수정 3파일**: `deploy/deploy-register-bulk-guard.spec.ts:105`,
`deploy/deploy-register-scenario-modal.spec.ts:146`, `verify-ui/overlays-deploy.spec.ts:47,49`
→ `input[type="checkbox"]` 셀렉터를 `[role="checkbox"]` 로.

**부분 판정(수치 확정)**
- AC5: 10 → **2건** 잔여 (`LiveMapDemoModal.tsx:94,471` — C16 에서 해소)
- AC6: 80 → **71건** 잔여 (이 커밋이 9건 변환: LoginPage 6 + DeployRegisterPanel 1 +
  GroupAddMembersModal 1 + DcopItemPickerModal 1)
- AC4: 15 → **14건** 잔여 (`EqpPage.tsx:1484` 1건 변환)

**최종 판정은 C16.** dev-report 에 커밋별 잔여 수치를 표로 누적한다.

---

### 5.C14 — model 계열 raw control 수렴 (R4/R6 부분)

| 파일 | button | select |
|---|---|---|
| `model/components/modelDetailColumnDefs.tsx` | 1 | **5** (`:313,336,440,462,592` — className 문자열 5회 완전 중복) |
| `model/components/ModelDetailPanel.tsx` | 3 | 0 |
| `model/components/ModelFlowSidebar.tsx` | 2 | 0 |
| `model/components/FlowFilterEditorModal.tsx` | 0 | 3 |
| `model/components/ActionDataIndexEditorModal.tsx` | 0 | 1 |

- `ModelFlowSidebar` 는 **AC6 허용 5파일에 없다** — 이름이 사이드바지만 반드시 변환 대상이다(실측 확인).
- `modelDetailColumnDefs` 의 5개 select 는 `SelectableTable` 셀 안에 렌더된다. radix Select 트리거는
  `<button>` 이라 `isNativeInteractiveTarget`(`:64`)이 계속 통과시킨다 → 셀 range 선택과 충돌 없음.
- 중복 className 5회는 공용 `<Select>` 전환으로 **자연 소멸**한다(별도 상수 추출 불필요 — 룰 11).
- `ActionDataIndexEditorModal` 은 메모리 `project_ui_front_table_common_selectabletable` 대로
  drag-reorder 충돌로 SelectableTable 화에서 제외된 파일이다. **본 커밋은 select 1건만 손대고
  테이블 구조는 건드리지 않는다.**

**부분 판정(수치 확정)**: 이 커밋이 button 6 / select 9 변환
→ AC6 71 → **65건** 잔여, AC4 14 → **5건** 잔여, AC5 변동 없음(2건 유지)

**회귀 게이트**: `model/model-flow.spec.ts`, `selectable-table-model-*` 4 spec,
`model/model-check-in-diff-overflow.spec.ts`

---

### 잔여 수치 누적표 (C13~C16 검산)

| 커밋 | button 변환 | 잔여 | select 변환 | 잔여 | checkbox 변환 | 잔여 |
|---|---|---|---|---|---|---|
| (착수 전) | — | 80 | — | 15 | — | 10 |
| C13 | 9 | 71 | 1 | 14 | 8 | 2 |
| C14 | 6 | 65 | 9 | 5 | 0 | 2 |
| C15 | 14 | 51 | 4 | 1 | 0 | 2 |
| C16 | 33 | **18** | 1 | **0** | 2 | **0** |

C16 종료 시 button 잔여 18 = 허용 5파일(EqpSidebar 7 / ModelSidebar 5 / DeploySidebar 2 /
DlqSidebar 2 / UserManagementSidebar 2) 합계와 정확히 일치 → **AC6 성립**.

---

### 5.C15 — LiveMap3DScene 수렴 + e2e 갱신 (R4/R6 부분) · 최고 위험

`src/features/live-map/components/LiveMap3DScene.tsx` — button **14** / select **4**

- select 4건 = `:1240`(add-select), `:1269`(add-eqp-select), `:1336`(assign-select), `:1351`(eqp-select).
  **`data-testid` 를 radix 트리거로 그대로 옮긴다.**
- **동반 e2e 수정 7파일 / 11 호출** (§4.1 표) — `selectOption(value)` →
  트리거 click + `getByRole('option', …)` click. option 의 접근가능 이름은 현재 `<option>` 텍스트와
  동일하게 맞춘다.
- 뱃지 버튼(`:1098`)은 `badgeRefs` + 명령형 `style.transform` 을 쓴다 → `<Button>` 변환 시
  **`scale-*`/`translate-*` 유틸 금지**(§4.3).
- `frameloop="demand"` 라 select 변경 후 `invalidate()` 경로가 유지되는지 확인 — radix Select 는
  onValueChange 로 동일 setter 를 호출하므로 로직 변화 없음.

**회귀 게이트**: `live-map/live-map-3d-*.spec.ts` **14 spec 전부** + 스크린샷 1장
(메모리 `feedback_3d_visual_verify_screenshot` — 3D 는 반드시 눈으로 확인).

---

### 5.C16 — 잔여 live-map 수렴 (R4/R5/R6 완료) · **AC4/AC5/AC6**

| 파일 | button | select | checkbox |
|---|---|---|---|
| `LiveMapDemoModal.tsx` | 9 | 1 | 2 (`:94` tri-state, `:471`) |
| `LiveMapObjectEditor.tsx` | 8 | 0 | 0 |
| `LiveMapFlowArrowDialog.tsx` | 4 | 0 | 0 |
| `LiveMapPage.tsx` | 3 | 0 | 0 |
| `LiveMapCommLogPanel.tsx` | 3 | 0 | 0 |
| `LiveMapBoard.tsx` | 2 | 0 | 0 |
| `LiveMapFlowGroupDialog.tsx` | 2 | 0 | 0 |
| `LiveMapTooltipCard.tsx` | 1 | 0 | 0 |
| `LiveMapMachineNode.tsx` | 1 | 0 | 0 |

**동반 e2e 수정 2파일**: `live-map/live-map-scenario-upload.spec.ts:127,131`(`dialog.locator('select')`),
`demo-matrix.harness.spec.ts:96-97`

**최종 AC 판정**
```bash
grep -rn "<select" src/features                       # AC4 → 0건
grep -rn 'type="checkbox"' src/features               # AC5 → 0건
grep -rl "<button" src/features                       # AC6 → 정확히 아래 5파일
#   eqp/components/EqpSidebar.tsx
#   model/components/ModelSidebar.tsx
#   deploy/components/DeploySidebar.tsx
#   dlq/components/DlqSidebar.tsx
#   user-management/components/UserManagementSidebar.tsx
```
(허용 5파일의 raw button 합계 = 7+5+2+2+2 = **18건**, SPEC 의 "80→≤18" 과 일치.
`SelectableTable.tsx:489` 의 정렬 헤더 버튼은 `src/shared` 라 AC6 대상 밖 — 변경 불필요.)

**회귀 게이트**: `live-map/*` 14 spec + `modal/modal-visual-sweep-livemap.spec.ts`

---

### 5.C17 — R8/R9 판정 (이식 vs 보류)

SPEC 이 "소비처가 이번 SPEC 범위에 없으면 이식 보류 + dev-report 사유 기록"을 명시했다.
**Plan 실측 결과 5건 전부 보류 권장**:

| 항목 | wm 원본 | tc 소비처 실측 | 판정 |
|---|---|---|---|
| `StatusLabel.tsx` | 41줄, `bg-success/warning/danger/info` 점 | 토큰은 tc 에 존재(`index.css:133-138`)하나 **R1~R7·R10·R11 어느 것도 상태 표시를 건드리지 않음**. 도입하려면 eqp/live-map 상태 배지 전면 교체 = 별도 SPEC | **보류** |
| `NameInputDialog.tsx` | 82줄, 이름 1개 입력 | tc 에 "이름만 받는 복사/생성" 흐름 없음 | **보류** |
| `PageMetricGrid.tsx` | 116줄, KPI 카드 그리드 | 도입 = live-map/deploy 대시보드 신규 UI. 본 SPEC 범위 밖 | **보류** |
| `list-panel-layout.ts` | px 기반 좌측 목록 폭 clamp | tc 의 분할 패널(`EqpPage:1040`, `ModelPage:551`)은 **percent 기반 + 세로(Y축) 분할**(`ResizableDivider` 는 `deltaY`) — 계약 자체가 다름 | **보류** |
| `page-heading-styles.ts` | `min-h-21 … pb-4` 상수 | tc `PageHeading.tsx` 는 `pb-3`, min-h 없음. 상수화 자체는 소비처 2(PageHeading/PageHeadingWithActions)지만 **wm 값을 쓰면 전 페이지 제목 높이가 바뀜**(시각 변경) | **보류** |

→ 이 커밋은 **코드 변경 0**. dev-report 의 "R8/R9 보류 사유" 섹션으로만 남긴다.
(만약 사용자가 이식을 원하면 각 항목은 별도 SPEC 으로 — 전부 시각/기능 확장이라 "Foundation" 성격이 아니다.)

---

### 5.C18 — 최종 게이트 (AC16 + AC1~3)

```bash
cd c:/workspace_nori/nori-tc-ui-front
# 포트 3000 정리 (Windows stale 서빙 방지)
npm run build      # AC1 — 출력 마지막 5~10줄 인용
npm run lint       # AC2 — 동
npm run test:unit  # AC3 — 동
npm run test:e2e   # AC16
```
**AC16 판정 절차(기계 대조)**
1. C0 의 baseline PASS 목록 ⊆ 최종 PASS 목록 → 하나라도 빠지면 **FAIL**
2. baseline FAIL 목록은 판정 제외(사전 실패)
3. 각 spec 의 `page.on('console')` error / `page.on('pageerror')` 0건 — 기존 spec 대부분이 이미
   `attachErrorSinks` 로 단언하고 있어 spec PASS 가 곧 이 조건이다. 단언이 없는 spec 은 dev-report 에
   목록으로 명시(글로벌 룰 14 — "console.error 누락 = PASS 보고 누락")
4. 세 목록(baseline PASS / 최종 PASS / 최종 FAIL) 을 dev-report 에 그대로 붙인다

---

## 6. 위험 목록 및 완화

| # | 위험 | 확률 | 영향 | 완화 |
|---|---|---|---|---|
| W1 | **R4/R5 가 e2e 16+7 호출을 깨뜨림** | **확실** | 높음 | §4 에 전건 목록화. **변환 커밋과 같은 커밋에서 spec 수정**. C13/C15/C16 각각 자기 spec 만 먼저 실행 |
| W2 | C1 의 `*ApiError` 6→1 통합이 20곳 `instanceof` 를 건드림 | 중 | 높음 | 6 클래스 구조가 **완전 동일**함을 실측 확인(D-3). 도메인 판별 용도 2곳만 개별 검증 후 dev-report 기록 |
| W3 | control-styles 이식으로 전 화면 Input/Select 높이 4px 감소 → 레이아웃 깨짐 | 중 | 중 | D-1 게이트(before/after 스크린샷). C9 직후 `layout-overflow-guard` + `modal-*` 4 spec 선행 실행. 메모리 `feedback_verify_layout_edge_cases` 대로 **데이터 많은/overflow 케이스**로 확인 |
| W4 | recharts 제거 순서 오류로 `dependency-declaration.test.ts` FAIL | 중 | 낮음 | C3 단일 커밋 강제(§4.3) |
| W5 | LiveMap3D 뱃지 버튼 `<Button>` 화 시 transform 합성 버그 | 낮 | 중 | `scale-*`/`translate-*` 금지 명시. `live-map-3d-eqp-drag`/`-redrag`/`-meshpick` 3 spec + 스크린샷 |
| W6 | radix Select portal 이 SelectableTable 셀 range 선택과 충돌 | 낮 | 중 | `isNativeInteractiveTarget:64` 가 `BUTTON` 을 통과시켜 계약 유지됨을 확인. `selectable-table-*` 14 spec 으로 검증 |
| W7 | 신규 한글 리터럴로 eslint i18next 에러 | 중 | 낮음 | 신규 사용자 문구는 ko/en/vi 3파일 동시 추가. 다만 **본 계획상 신규 키는 0건**(csrf/redeploy/confirm/cancel 전부 기존 키 재사용) |
| W8 | e2e baseline 이 백엔드 유무에 따라 달라져 대조 무효 | 중 | 높음 | C0 와 C18 을 **동일 조건**에서 측정. 조건을 dev-report 첫 줄에 명시 |
| W9 | 컨텍스트 소진으로 세션 중단 | 높 | 중 | §5 표의 `세션` 칼럼대로 S1~S6 분할. 각 세션 끝에 dev-report 갱신 후 커밋 |
| W10 | ~~D-2 미결정 상태로 착수~~ → **Plan 단계에서 해소**(D-1/D-2/D-5 확정) | — | — | 잔여 위험 없음 |
| W11 | C10 의 checkbox/switch 가 C13 전까지 소비처 0 (미사용 코드) | 중 | 낮음 | C10→C13 사이 세션 미분할. 부득이 끊기면 dev-report 에 명시(§5.C10 주의) |
| W12 | EqpManageFormModal 토글의 `<label>` 감싸기 → `<Switch>` 전환 시 클릭 영역 변화 | 중 | 낮음 | radix Switch 는 자체 `<button>` 이라 label 클릭 위임이 필요하다 — `<label htmlFor>` + `id` 로 명시 연결하거나 label 을 유지하고 Switch 를 자식으로 둔다. `modal-visual-sweep-eqp.spec.ts` + `plc/plc-eqp-form.spec.ts` 로 검증 |

---

## 7. 롤백 방법

**단위 롤백(권장)** — 커밋이 §5 표대로 잘려 있으므로 개별 revert 가 성립한다.
```bash
git revert --no-edit <SHA>          # 단일 커밋
git revert --no-edit <A>^..<B>      # 연속 구간 (예: C13~C16 수렴 4종)
```
| 커밋 | 롤백 시 주의 |
|---|---|
| C1/C2 | 둘은 짝이다. C1 만 revert 하면 C2 의 shared import 가 깨진다 → **C2→C1 역순**으로 |
| C3 | revert 후 **`npm install` 재실행**(package-lock 복원) |
| C4/C5/C6 | 레포가 달라 각 레포에서 개별 revert |
| C9 | 시각만 되돌리는 부분 롤백은 `control-styles.ts` 상수 값을 tc 현행 문자열로 되돌리면 됨(D-1 대안 B 로 수렴) — 파일 삭제 불필요 |
| C13~C16 | 소스와 e2e spec 이 같은 커밋에 있어 revert 하면 둘 다 정합하게 되돌아온다 |

**전체 롤백**: 본 SPEC 착수 직전 SHA(`cd868ee` = "docs(specs): wm-parity SDD 트랙 SPEC 2건 추가") 로
`git revert` 구간 실행. **`git reset --hard` / force push 금지**(글로벌 룰 17).

**타 레포**: nori-tc-common(`e90ec2b`) / nori-tc-exec(`20ac0bb`) 은 문서 커밋뿐이라 단독 revert 안전.

---

## 8. 세션 분할 가이드 (컨텍스트 60% 대비)

| 세션 | 범위 | 진입 시 읽을 것 | 종료 조건 |
|---|---|---|---|
| **S1** | C0 → C1 → C2 | SPEC + 이 Plan §5.C0~C2 | AC7/8/9/17 green + dev-report 에 baseline 기록 |
| **S2** | C3 → C4/C5-a/C5-b/C6 → C7 → C8 | Plan §5.C3~C8 + D-5 | AC10/11/13/14 green |
| **S3** | C9 → C10 → C11 → C12 | Plan §5.C9~C12 (D-1/D-2 확정 완료) | AC12/15 green + C9 스크린샷 승인 |
| **S4** | C13 → C14 | Plan §5.C13~C14 + §4 | 해당 e2e green, 잔여 수치 기록. **C10 의 switch/checkbox 소비처가 여기서 생긴다** |
| **S5** | C15 → C16 | Plan §5.C15~C16 + §4.1 | **AC4/5/6 green** |
| **S6** | C17 → C18 | Plan 전체 + dev-report | **AC16 green**, dev-report 완성 |

각 세션 종료 시 `.claude/specs/wm-parity-foundation-dev-report.md` 에 누적 기록
(변경 파일 / 테스트 결과 마지막 5~10줄 인용 / 결정 / 잔여 AC). **콘솔 출력만 남기고 끝내지 않는다**
(글로벌 룰 16).

---

## 9. Out of Scope 재확인 (이 Plan 이 다루지 않는 것)

- 전역 LNB 사이드바 전환 · 도메인 사이드바 5파일의 raw button 18건 → `wm-parity-sidebar.md`
- **사이드바 프리미티브(wm `sidebar.tsx` / `sidebar-context.ts`) 이식** — 본 SPEC 범위 아님(Constraints).
  wm `components/ui` 18파일 중 tc 미보유 7종(combobox / control-styles / searchable-select /
  sidebar / sidebar-context / switch / tooltip) 가운데 **본 Plan 이 가져오는 것은 `control-styles` +
  `switch` 2종**이다(D-2 확정). 나머지 5종은 소비처 0으로 미이식.
- `@tanstack/react-table` 도입(결정 1 기각) · 신규 의존성 일체
- 거대 파일 4개 분해 · `deploy-ui.store` 순수함수 분리 → `ui-front-refactor` 스킬 트랙
- user/group 7파일 외 catch 전면 전환 · live-map 고정 hex 60건 · `as unknown` 6건
- `RequirePermission` 이식 · role-landing
- `nori-client-forked-migration*` / `i18n-hardcoded-audit.md` / `nori-tc-refactor-campaign-dev-report.md`
  문서 정정 (완료된 사이클의 실행 기록 — D-5)

---

## 10. Implement 세션 진입 프롬프트

```
@.claude/specs/wm-parity-foundation.md @.claude/specs/wm-parity-foundation-plan.md 둘 다 읽고 구현.
SPEC 의 Acceptance Criteria 모두 만족하도록 각 AC 당 실패 테스트 먼저.
Plan 의 확정 결정 5건 엄수 — D-1 control-styles wm 값 그대로 이식(시각 변경 수용, 스크린샷 게이트) /
D-2 EqpManageFormModal ToggleField 를 wm switch.tsx 이식으로 교체 / D-3 ApiError 6->1 단일화 /
D-4 dlq 로컬 ApiResponse 도 전환 / D-5 refactor-backlog 284,285 행 완료 처리(C5-b 별도 커밋).
추가 확인 없이 착수한다 (미결 결정 없음).
Plan §5.C0 의 e2e baseline 기록을 첫 단계로 반드시 수행.
Plan §4 의 e2e 스펙 동반 수정(select 16호출 9파일 / checkbox 3파일)을 변환 커밋과 같은 커밋에.
산출물: .claude/specs/wm-parity-foundation-dev-report.md 에 변경 파일 / 테스트 결과 / 결정 기록.
```
