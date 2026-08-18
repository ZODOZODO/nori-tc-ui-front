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
  **부수 조건**: 커밋 전 Login / EqpManageFormModal / ModelDetailPanel 3화면의 before/after
  스크린샷을 찍어 에이전트가 `Read` 로 직접 확인하고 dev-report 에 첨부한다(글로벌 메모리
  `feedback_3d_visual_verify_screenshot` / `feedback_visual_e2e_real_env_verify` — "지오메트리만 쌓고 통과 단정 금지").
  **승인 게이트가 아니다** — S-08 참조. 판정은 레이아웃 회귀 5 spec 으로만 한다.
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

---

## 3.5 결정 봉인 — **설계는 묻지 않고, 단계 진행은 매번 컨펌받는다**

> 이 절의 목적은 하나다: Implement 중 **"어느 쪽으로 할까요?" 가 한 번도 나오지 않게** 하는 것.
> 아래 표의 모든 항목은 값이 확정돼 있다. 표에 없는 상황이 나오면 그것은 계획 결함이므로
> dev-report 의 `계획 결함` 섹션에 기록하고 **가장 보수적인 선택(기존 동작 보존)** 으로 진행한다.

**사용자와의 상호작용 2종을 혼동하지 않는다 — 하나는 금지, 하나는 필수다.**

| 종류 | 예 | 처리 |
|---|---|---|
| **설계·구현 선택 질의** | "control-styles 값을 어느 쪽으로?", "이 버튼은 어떤 variant 로?", "e2e 를 고칠까요 말까요?", "이 파일도 포함할까요?" | **금지.** 봉인표(S-01~S-20)와 §3.6 기계 규칙에 답이 있다. 없으면 S-19 대로 보존적 선택 + 기록 |
| **단계 완료 보고 + 진행 컨펌** | "C3 완료했습니다. AC10/AC11 green, 출력 인용. 커밋 `abc1234`. C4 진행할까요?" | **필수.** §5.0 의 단계 완료 루틴대로 매 단계 수행 |

즉 **무엇을 만들지는 절대 묻지 않고, 어디까지 갔는지는 매 단계 보고하고 다음 단계 진행 승인을 받는다.**

| # | 이전에 열려 있던 선택 | **봉인된 값** | 근거 |
|---|---|---|---|
| S-01 | control-styles 값 | wm 원본 문자열 그대로 | D-1 확정(A) |
| S-02 | ToggleField 대체물 | wm `switch.tsx` 이식 | D-2 확정(A) |
| S-03 | `*ApiError` 통합 | 단일 `ApiError`, 도메인 별칭 0 | D-3 |
| S-04 | dlq 로컬 `ApiResponse` | 전환함 | D-4 |
| S-05 | refactor-backlog | 284/285 완료 처리(C5-b) | D-5 확정 |
| S-06 | **e2e baseline 측정 조건** | **백엔드 미기동**(프론트 dev server 만). `verify-ui/*` 11 + `demo-matrix.harness` 는 baseline FAIL 로 잡히고 판정에서 제외된다 | 재현성 — 백엔드 상태가 판정에 섞이면 C0/C18 대조가 무효(W8). 프론트 e2e 대부분은 `route.fulfill` mock 이라 백엔드 불필요 |
| S-07 | **C1 분할 여부** | **항상 C1-a / C1-b 로 2분할** | 예산에 따른 재량 판단을 없앤다. 세션이 남아도 분할한다 |
| S-08 | **C9 스크린샷 승인 주체** | **사용자 승인 없음.** 스크린샷은 dev-report 첨부용 증거일 뿐이고, 판정은 `layout-overflow-guard` + `modal-overflow-guard-extra` + `modal-visual-sweep-{eqp,group,livemap}` **5 spec PASS** 로만 한다 | 승인 게이트는 사용자 결정이므로 제거. 기계 판정으로 대체 |
| S-09 | 빈 문자열 select 옵션 | `SELECT_EMPTY_VALUE` 센티널 (§3.6-B) | radix 가 빈 문자열 `SelectItem` 을 throw 로 거부(실측) |
| S-10 | raw `<button>` → `<Button>` 매핑 | §3.6-A 규칙표 | 버튼마다 variant 를 고르는 재량 제거 |
| S-11 | Checkbox 컴포넌트 클래스 | §3.6-C 에 파일 전문 고정 | 새로 디자인할 여지 제거 |
| S-12 | Switch 의 label 결합 방식 | 감싸는 `<label>` 제거 + `id`/`htmlFor` 명시 결합 | 암묵 결합은 브라우저별 이중 토글 위험. 명시 결합이 e2e 로 검증 가능 |
| S-13 | `notifyFailure` 적용 지점 | §5.C8 의 **9줄 고정 목록** | "catch 안의 것만" 은 `Promise.allSettled` 경로를 놓친다(실측) |
| S-14 | AC12 소비처 | `UserListTable.tsx` 1곳 (`GroupListTable` 미적용) | 룰 4(surgical) |
| S-15 | R8/R9 5항목 | 전부 **보류**, 코드 변경 0 | §5.C17 |
| S-16 | 신규 i18n 키 | **0건.** 필요한 문구는 전부 기존 키 재사용 — `error.auth.csrf`(:823), `error.group.default`, `deploy.monitor.redeployConfirm`(:265), `common.confirm`/`common.cancel`(:461-462) | 실측 확인 |
| S-17 | 신규 npm 의존성 | **0건.** `radix-ui@1.4.3` 이 checkbox·select·switch·toast 를 전부 번들(실측) | Constraints |
| S-18 | 커밋 시점 | **각 C 단위 완료 즉시 커밋, main 직접.** 커밋 자체에는 승인을 받지 않는다 | 글로벌 룰 17 |
| S-19 | 계획과 실제가 어긋날 때 | **기존 동작 보존 쪽**으로 진행 + dev-report `계획 결함` 기록. 설계를 질문하지 않는다 | 본 절의 목적 |
| S-20 | **단계 진행 방식** | **§5.0 의 단계 완료 루틴 5스텝을 매 단계 수행.** 검증 → 보고 → 커밋 → dev-report 갱신 → **다음 단계 진행 컨펌 대기**. 컨펌 없이 다음 C 단위로 넘어가지 않는다 | 사용자 지시(2026-08-18) |

---

## 3.6 raw 요소 변환 기계 규칙 (재량 제거)

### A. raw `<button>` → `<Button>` (62건)

**규칙**: `variant`/`size` 는 아래 표로 **기존 className 의 문자열 검사만으로** 결정하고,
**기존 `className` 은 통째로 그대로 넘긴다**(`cn()` = `twMerge` 라 충돌 클래스는 기존 값이 이긴다).

| 기존 className 조건 (순서대로 첫 일치 적용) | variant | size |
|---|---|---|
| `bg-destructive` / `bg-danger` 포함 | `destructive` | `sm` |
| `bg-` 로 시작하는 배경 클래스 포함 | `default` | `sm` |
| `border` 포함 (배경 없음) | `outline` | `sm` |
| 위 어디에도 해당 없음 | `ghost` | `sm` |

- `size` 는 **예외 없이 `sm`**. 기존 className 에 `h-*`/`px-*`/`py-*` 가 있으면 twMerge 로 그것이 이기고,
  없으면 `h-8 px-3` 이 적용된다.
- `type="button"` 이 없던 버튼에는 **추가한다**(폼 내부 오작동 방지). `LoginPage` 의 submit 버튼
  (`:263`)만 `type="submit"` 유지.
- **금지**: `scale-*` / `translate-*` 유틸을 className 에 새로 넣는 것(§4.3 inline transform 합성 버그).
- `data-testid` / `aria-label` / `title` / `disabled` / `ref` / 이벤트 핸들러는 **전부 그대로 전달**.

### B. raw `<select>` → 공용 `<Select>` (15건)

**radix 실측 제약**: `@radix-ui/react-select@2.2.6` 는 `SelectItem` 의 빈 문자열 value 를 던져서 거부한다
(`node_modules/@radix-ui/react-select/dist/index.js:892` —
`"A <Select.Item /> must have a value prop that is not an empty string…"`).
반면 **Root 의 `value=""` 는 허용**되며 placeholder 를 보여준다.

**봉인 규칙**
1. `src/components/ui/select.tsx` 에 **`export const SELECT_EMPTY_VALUE = '__empty__'`** 를 1회 정의한다
   (정의 1 · 소비 5파일이므로 룰 11 의 조기 추상화 아님).
2. 변환 형태(고정):
   ```tsx
   <Select
     value={rawValue === '' ? SELECT_EMPTY_VALUE : rawValue}
     onValueChange={(next) => onChange(next === SELECT_EMPTY_VALUE ? '' : next)}
     disabled={<기존 disabled 식 그대로>}
   >
     <SelectTrigger data-testid={<기존 testid>} className={<기존 className 그대로>}>
       <SelectValue />
     </SelectTrigger>
     <SelectContent>
       <SelectItem value={SELECT_EMPTY_VALUE}>{<기존 빈 option 의 라벨>}</SelectItem>
       {/* 나머지 option 은 SelectItem 으로 1:1 */}
     </SelectContent>
   </Select>
   ```
3. **빈 문자열 option 을 가진 사이트 9곳(실측 전수)** — 위 규칙 적용 대상:
   `EqpPage.tsx:1491`(`EMPTY_VERSION_VALUE = ''`, `:65` 실측),
   `LiveMap3DScene.tsx:1246,1276,1358`,
   `LiveMapDemoModal.tsx:776`,
   `modelDetailColumnDefs.tsx:320,343,447,599`
4. 빈 option 이 없는 6곳(`LiveMap3DScene.tsx:1344`, `modelDetailColumnDefs.tsx:470`,
   `FlowFilterEditorModal.tsx:387,431,572-573`, `ActionDataIndexEditorModal.tsx:428`)은 센티널 없이 1:1 변환.
5. `modelDetailColumnDefs` 의 "현재값이 목록에 없을 때 넣는 fallback option"
   (`:322,345,449,601` — `rawValue && !options.some(...)` 가드)은 **`rawValue` 가 비어있지 않을 때만
   렌더되므로 센티널 불필요**. 가드를 그대로 유지한다.
6. **`<form>` 의존 없음** — 15개 select 가 속한 6파일 전부 `<form>` 0건(실측)이라 `name` prop 불필요.

### C. raw `<input type="checkbox">` → 공용 `<Checkbox>` (10건)

`src/components/ui/checkbox.tsx` **파일 전문을 아래로 고정한다**(디자인 재량 제거).
크기·색은 현행 raw 체크박스(`LiveMapDemoModal.tsx:101`)의 `size-4 rounded border-input
accent-brand-primary` 를 radix 로 옮긴 것이고, 포커스·비활성 처리는 wm `switch.tsx` 와 같은 톤이다.

```tsx
import * as React from 'react'
import { Check, Minus } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { cn } from '@/lib/utils'

/**
 * 체크박스입니다. tri-state(`checked="indeterminate"`)를 지원해 "일부 선택" 헤더 체크박스가
 * 명령형 `input.indeterminate` 조작 없이 상태만으로 표현됩니다.
 */
function Checkbox({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded border border-input bg-card',
        'transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:border-brand-primary data-[state=checked]:bg-brand-primary data-[state=checked]:text-white',
        'data-[state=indeterminate]:border-brand-primary data-[state=indeterminate]:bg-brand-primary data-[state=indeterminate]:text-white',
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator data-slot="checkbox-indicator" className="flex items-center justify-center">
        {props.checked === 'indeterminate' ? (
          <Minus className="size-3" aria-hidden="true" />
        ) : (
          <Check className="size-3" aria-hidden="true" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
```

**변환 규칙**
- `checked` + `onChange(e => …e.target.checked)` → `checked` + `onCheckedChange(next => …next === true)`
- tri-state 2곳은 명령형 ref 제거: `LiveMapDemoModal.tsx:82-97`(`TriStateCheckbox` 의 `useRef`/`useEffect`
  통째로 삭제하고 `checked={state === 'indeterminate' ? 'indeterminate' : state === 'checked'}`),
  `DeployRegisterPanel.tsx:304`(`searchSelectAllRef.current.indeterminate = …` 라인과 ref 삭제)
- `id` / `data-testid` / `aria-label` / `disabled` / `onClick` (stopPropagation) 은 그대로 전달
- **BubbleInput 주의**: radix 는 `<form>` 안에서만 숨은 `<input type="checkbox">` 를 렌더한다
  (`isFormControl = !!form || !!control.closest('form')` 실측). 대상 8파일 중 `<form>` 을 가진 것은
  `LoginPage.tsx` 뿐이고, deploy e2e 가 쓰는 `DeployRegisterPanel` 은 form 이 없어 **`input[type="checkbox"]`
  셀렉터가 아무것도 못 잡는다** → §4.2 의 셀렉터 교체가 필수임이 확인된다.

### D. wm `switch.tsx` 이식 + ToggleField 교체 (1건)

- `src/components/ui/switch.tsx` = wm 원본 33줄 **무수정**.
- `EqpManageFormModal.ToggleField`(`:425-459`) 변환 형태(고정):
  - 감싸는 `<label>` 을 `<div>` 로 바꾸고(**S-12**), 텍스트는 `<label htmlFor={id}>` 로 분리
  - 수제 트랙/썸 `<span>` 2개(`:437-447`)와 `<input type="checkbox" className="sr-only">`(`:450-455`) 삭제
  - `<Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} />` 로 대체
  - `id` 는 호출부가 넘기지 않으므로 `ToggleField` 내부에서 `useId()` 로 생성한다(전역 유일 보장)
  - 컨테이너의 `min-h-11 rounded-xl border border-input px-3` + `disabled ? 'bg-muted opacity-70' : 'bg-card'`
    와 `toggleOn`/`toggleOff` 라벨, `hint` 문단은 **그대로 보존**

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

## 5. 커밋 단위 분할 — 21 단위 (실제 커밋 18개 + 커밋 없는 게이트 3개: C0 / C17 / C18)

> 원칙: ① 각 커밋은 단독으로 `npm run build` + `npm run lint` + `npm run test:unit` 통과,
> ② 커밋마다 "완료 판정에 쓰는 AC" 를 명시, ③ 컨텍스트 60% 에서 끊겨도 다음 세션이 커밋 경계에서
> 이어받는다(**세션 경계 후보는 표의 `세션` 칼럼**), ④ **단계마다 §5.0 의 완료 루틴 5스텝을 수행하고
> 사용자 컨펌을 받은 뒤 다음 단계로 넘어간다(S-20)**.
>
> **C13~C16 의 raw 요소 변환은 §3.6 의 기계 규칙(A: Button 매핑표 / B: SELECT_EMPTY_VALUE 센티널 /
> C: Checkbox 파일 전문 / D: ToggleField→Switch)을 그대로 적용한다.** 각 커밋 절은 대상 파일과
> 잔여 수치만 적고 변환 방식은 반복하지 않는다.

---

### 5.0 단계 완료 루틴 (S-20) — **모든 C 단위에 예외 없이 적용**

한 단계를 끝낼 때마다 아래 5스텝을 순서대로 수행한다. **스텝 5의 컨펌을 받기 전에는
다음 C 단위의 파일을 단 한 줄도 건드리지 않는다.**

#### 스텝 1 — 검증 (기계 판정)
```bash
npm run build && npm run lint && npm run test:unit
```
+ 그 단계에 배정된 AC grep 과 회귀 e2e spec(각 C 절의 `회귀 게이트`).
**하나라도 FAIL 이면 스텝 2로 넘어가지 않고 그 자리에서 고친다.**

#### 스텝 2 — 사용자 보고 (아래 6줄 형식 고정)
```
[C{번호}] {커밋 제목}
- 변경: {파일 수}개 ({대표 경로 3개까지}, …)
- AC: {해당 AC 번호} {green/부분} — {판정 근거 한 줄}
- 게이트: build PASS / lint PASS / test:unit PASS / e2e {대상 spec} {n} passed
- 잔여 수치: {해당되면 button/select/checkbox 잔여, 아니면 "해당 없음"}
- 특이사항: {계획과 어긋난 점 또는 "없음"}
```
게이트 출력은 **마지막 5~10줄을 코드블록으로 그대로 인용**한다(글로벌 룰 1).
C9 는 스크린샷 3장의 관찰 결과를 한 줄로 덧붙인다.

#### 스텝 3 — main 커밋 (승인 불요, S-18)
해당 C 절의 커밋 메시지로 `git commit` → `git log --oneline -1` 로 SHA 확인.
타 레포 단계(C5-a/C5-b/C6)는 해당 레포에서 커밋한다.
**push 는 하지 않는다** — 사용자가 명시적으로 지시할 때만.

#### 스텝 4 — dev-report 갱신
`.claude/specs/wm-parity-foundation-dev-report.md` 의 §8 고정 8섹션에 이번 단계분을 누적한다.
**커밋 SHA 를 반드시 적는다**(다음 세션이 이어받는 앵커).
이 갱신은 다음 단계 커밋에 함께 담거나 단독 `docs(specs)` 커밋으로 올린다 — 어느 쪽이든 무방.

#### 스텝 5 — 다음 단계 진행 컨펌
보고 말미에 다음 한 줄을 붙이고 **응답을 기다린다**.
```
다음은 [C{다음번호}] {제목} 입니다. 진행할까요?
```
- 사용자가 "진행" / "ㅇㅇ" / "계속" 등으로 승인하면 다음 단계 착수.
- 사용자가 수정을 지시하면 그 지시가 봉인표보다 우선한다(사용자 지시 > 계획).
  변경된 내용은 dev-report 의 `계획 결함` 섹션에 "사용자 지시로 변경"으로 기록.
- **컨펌 없이 연속 진행 금지.** "어차피 독립 단계니까 두 개 묶어서" 도 금지.

> **주의 — 이 컨펌은 설계 질의가 아니다.** 스텝 5에서 "A 로 할까요 B 로 할까요" 를 묻지 않는다.
> 물을 수 있는 것은 오직 "다음 단계로 갈까요" 뿐이다. 설계는 §3.5 봉인표가 이미 답했다.

**커밋 없는 게이트 3개(C0 / C17 / C18)의 예외**: 스텝 3(커밋)을 건너뛰고
검증 → 보고 → dev-report → 컨펌 순으로 수행한다. dev-report 갱신만 있는 경우
`docs(specs)` 단독 커밋으로 올린다.

**C18 이후**: 마지막 컨펌 문구는 "Implement 단계 완료. Validate 세션으로 넘어갈까요?" 로 한다.

| # | 커밋 | 레포 | R | 완료 판정 AC | 선행 | 병렬 | 세션 |
|---|---|---|---|---|---|---|---|
| C0 | (커밋 없음) e2e baseline 기록 | — | AC16 전제 | — | 없음 | — | S1 |
| C1-a | `feat(shared): API 스캐폴딩 shared 정의 신설 + plain-Error 6파일 전환` | ui-front | R1 | AC1~3 | C0 | — | S1 |
| C1-b | `refactor(api): *ApiError 6종을 공용 ApiError 로 단일화` | ui-front | R1 | **AC7 AC8 AC9** + AC1~3 | C1-a | — | S1 |
| C2 | `refactor(api): auth.types cross-feature import 해소` | ui-front | R2 | **AC17** + AC1~3 | C1-b | — | S1 |
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
- **직렬 필수 사슬**: `C0 → C1-a → C1-b → C2` (shared 정의가 없으면 R2 가 성립 불가)
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

**측정 조건 봉인 (S-06)**: **백엔드(localhost:8080)를 띄우지 않는다.**
- 근거 — 프론트 e2e 대부분은 `route.fulfill` 로 백엔드를 mock 하므로 불필요하고, 백엔드 상태가
  섞이면 C0/C18 대조 자체가 무효가 된다(W8). 판정은 목록 대조이지 절대 통과 수가 아니다.
- 그 결과 `verify-ui/*` 11 spec 과 `demo-matrix.harness.spec.ts` 는 **baseline FAIL** 로 잡히고
  **최종 판정에서도 제외**된다. dev-report 에 "백엔드 미기동 조건 — 12 spec baseline 제외"를 명시한다.
- C18 은 **같은 조건(백엔드 미기동)** 에서 재측정한다. 조건을 바꾸지 않는다.
- 이 조건 때문에 놓치는 회귀는 SPEC 범위 밖이다(AC16 은 baseline 대조로 정의돼 있다).

---

### 5.C1-a / C1-b — API 스캐폴딩 shared 승격 (R1) · AC7/AC8/AC9

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

**분할 봉인 (S-07): C1 은 예외 없이 2커밋으로 나눈다.** 예산이 남아도 나눈다(재량 제거).

| 커밋 | 범위 | 판정 |
|---|---|---|
| **C1-a** | `shared/types/api.types.ts` + `shared/lib/api-error.ts` 신설, `shared/lib/csrf.ts` 에 `issueCsrfToken` 추가. **plain-`Error` 계열 6파일** 전환 — `line.api.ts`, `comm-log.api.ts`, `layout.api.ts`, `live-map.api.ts`, `live-map-demo-run.api.ts`, `dlq.api.ts`(D-4) | AC1~3 만. AC7/8/9 는 아직 미달 |
| **C1-b** | `*ApiError` 6종 → 단일 `ApiError` 통합 + `withCsrfHeaders`/`resolveSuccessPayload`/`normalize*Error` 로컬 정의 제거 + `instanceof` 소비처 20곳 치환 | **AC7 AC8 AC9** + AC1~3 |

근거 — 이 커밋이 SPEC 전체에서 가장 큰 diff(약 25파일)이고 런타임 에러 경로를 바꾼다.
plain-Error 계열은 소비처가 `Error.message` 뿐이라 위험도가 낮고, `*ApiError` 통합은 `instanceof`
20곳을 건드린다. 두 위험을 한 커밋에 섞으면 revert 단위가 커진다.

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

**적용 지점 봉인 (S-13) — 아래 9줄이 전부다.** "catch 안의 것만" 같은 서술 규칙은
`Promise.allSettled` 경로를 놓치므로(실측) 줄 단위로 고정한다. 나머지 `setErrorMessage` 30회
(null 리셋 · 클라이언트 사전 검증 문구)는 **손대지 않는다**.

| 파일:줄 | 현재 | 변환 후 |
|---|---|---|
| `GroupAddMembersModal.tsx:108-110` | `setErrorMessage(error instanceof GroupApiError ? error.payload.errorMsg : t('error.group.removeMember'))` | `setErrorMessage(notifyFailure(error, t('error.group.removeMember')))` |
| `GroupUpsertModal.tsx:122` | `setErrorMessage(error.payload.errorMsg)` | (아래 `:125` 와 합쳐 `instanceof` 분기 제거) |
| `GroupUpsertModal.tsx:125` | `setErrorMessage(t('group.upsert.saveError'))` | `setErrorMessage(notifyFailure(error, t('group.upsert.saveError')))` — `:121` 의 `if (error instanceof …)` 분기 삭제 |
| `GroupPermissionsModal.tsx:165,169-176,181` | `firstErrorMessage: string \| null` 에 문구를 담아 `:181` 에서 표시 | `firstError: unknown` 으로 **원본 에러를 보관**하고 `:181` 을 `setErrorMessage(notifyFailure(firstError, t('error.group.default')))` 로. `:172-175` 의 `instanceof` 분기 삭제 |
| `GroupDeleteConfirmDialog.tsx:39-43` | `instanceof` 2분기 | `setErrorMessage(notifyFailure(error, t('error.group.delete')))` |
| `UserUpsertModal.tsx:176-180` | `instanceof` 2분기 | `setErrorMessage(notifyFailure(error, t('user.upsert.saveError')))` |
| `UserDeleteConfirmDialog.tsx:39-43` | `instanceof` 2분기 | `setErrorMessage(notifyFailure(error, t('error.user.delete')))` |
| `UserPasswordResetModal.tsx:93-96` | `instanceof` 2분기 | `setErrorMessage(notifyFailure(error, t('user.passwordReset.error')))` |

- **fallback 문구는 전부 기존 i18n 키 재사용 — 신규 키 0건**(S-16). 위 표의 키는 전건 실재 확인.
- C1-b 의 `ApiError` 통합으로 `error.payload.errorMsg === error.message` 가 되므로
  `notifyFailure` 의 `error.message` 경로가 그대로 서버 사유를 집는다 → `instanceof` 분기가 불필요해진다.
- `GroupAddMembersModal` 의 `allSettled` 경로(`:146-158`)는 `resultSummary` 로 **이미 인라인 표시**하므로
  대상 아님(중복 토스트 방지). 이 파일은 `:108` 만으로 AC13 의 "notifyFailure 포함"을 충족한다.
- **인라인 폼 에러 유지**(SPEC 명시) — `notifyFailure` 의 반환값을 그대로 `setErrorMessage` 에 넣는
  wm 패턴이라 토스트와 인라인이 같은 문구로 동시에 뜬다.

**검증**: `grep -rln "notifyFailure" src/features/user src/features/group` → **7파일 이상** (AC13)

---

### 5.C9 — control-styles 이식 + Input/Select 갱신 (R4 프리미티브)

**D-1 확정(A) 반영 — wm 값을 그대로 가져온다(시각 변경 수용).**

- 신설 `src/components/ui/control-styles.ts` (wm 원본 3상수)
- 수정 `src/components/ui/input.tsx` — `controlBaseClassName` + `'h-10 px-3'`
- 수정 `src/components/ui/select.tsx` — wm 대비 실측 diff 5곳:
  `SelectValue` 에 `min-w-0 truncate` / `SelectTrigger` 를 `controlBaseClassName` + `h-10 gap-2 overflow-hidden text-left` /
  `SelectContent` 를 `controlPopupClassName` 소비 / `SelectLabel` 패딩·굵기 / `SelectItem` 을 `controlOptionClassName` + `pl-8`

**판정 봉인 (S-08) — 사용자 승인 게이트 없음.** 이 커밋의 통과 조건은 아래 **기계 판정 2개뿐**이다.

1. `npm run build` / `npm run lint` / `npm run test:unit` PASS
2. **레이아웃 회귀 5 spec PASS** — 이 커밋 직후 아래만 먼저 돌려 조기 검출한다:
   ```
   npx playwright test tests/e2e/layout-overflow-guard.spec.ts \
     tests/e2e/modal/modal-overflow-guard-extra.spec.ts \
     tests/e2e/modal/modal-visual-sweep-eqp.spec.ts \
     tests/e2e/modal/modal-visual-sweep-group.spec.ts \
     tests/e2e/modal/modal-visual-sweep-livemap.spec.ts
   ```
   (C0 baseline 에서 이 5 spec 이 FAIL 이었다면 그 spec 은 판정 제외 — 목록 대조 원칙 동일)

**스크린샷은 증거이지 게이트가 아니다.** `/login`, EQP 관리 폼 모달, 모델 상세 패널 3화면의
before/after 를 Playwright `page.screenshot()` 으로 찍어 `Read` 로 직접 확인하고 dev-report 에 첨부한다
(메모리 `feedback_3d_visual_verify_screenshot`). **확인 결과가 "의도한 변경"이면 그대로 커밋한다 —
승인을 기다리지 않는다.** 의도치 않은 깨짐(요소 잘림·겹침)이 보이면 그것은 회귀이므로 5 spec 판정과
무관하게 수정하고, 수정 내용을 dev-report 에 기록한다.

**변경 범위 인지**: 이 커밋은 `<Input>`/`<Select>` **기존 소비처 전부**의 시각을 바꾼다
(높이 44→40px 포함). §2.2 표의 9축이 의도된 변경이며 이것 자체는 회귀가 아니다.

---

### 5.C10 — 공용 Checkbox 신설 + wm Switch 이식 (R5 프리미티브)

**D-2 확정(A) 반영 — `switch.tsx` 이식이 이 커밋에 포함된다.**

- 신설 `src/components/ui/switch.tsx` — wm 원본(33줄) **무수정 이식**. radix-ui 모노패키지의
  `Switch` 사용이라 신규 의존성 0. 소비처는 C13 의 `EqpManageFormModal.ToggleField` 1곳
  (미사용 프리미티브가 되지 않도록 **C13 과 같은 세션(S3→S4 연속)에서 소비 배선까지 마친다**).
- 신설 `src/components/ui/checkbox.tsx` — **wm 에 원본 없음**(wm `components/ui` 18파일 실측: checkbox 부재).
  **§3.6-C 에 파일 전문이 고정돼 있다(S-11). 그대로 옮겨 적고 디자인을 새로 정하지 않는다.**
- 신설 `src/components/ui/select.tsx` 의 `SELECT_EMPTY_VALUE` export (§3.6-B) — 이 커밋에 포함.
  (C9 에서 select.tsx 를 이미 손대므로 C9 에 넣어도 되지만, **봉인상 C10 에 둔다** — 소비는 C13~C16.)
- **`indeterminate` 지원 확인 완료** — `@radix-ui/react-checkbox@1.3.3` 의
  `CheckedState = boolean | 'indeterminate'`(`dist/index.d.ts:11` 실측). 소비처 2곳
  (`LiveMapDemoModal.tsx:87`, `DeployRegisterPanel.tsx:304`)의 명령형 ref 조작이 통째로 사라진다.
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

→ **5건 전부 보류로 봉인(S-15). 코드 변경 0.** dev-report 의 "R8/R9 보류 사유" 섹션으로만 남긴다.
Implement 는 이 판정을 재검토하지 않는다 — 전부 시각/기능 확장이라 "Foundation" 성격이 아니고,
소비처 없는 프리미티브 이식은 SPEC Constraints 와 글로벌 룰 11 이 금지한다.
(향후 필요해지면 별도 SPEC 으로 다룬다.)

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
| W12 | EqpManageFormModal 토글의 `<label>` 감싸기 → `<Switch>` 전환 시 클릭 영역 변화 | 중 | 낮음 | **S-12 로 봉인** — 감싸는 label 제거 + `useId()` 기반 `id`/`htmlFor` 명시 결합(§3.6-D). 암묵 결합의 이중 토글 위험을 원천 제거. `modal-visual-sweep-eqp.spec.ts` + `plc/plc-eqp-form.spec.ts` 로 검증 |
| W13 | radix Select 가 빈 문자열 `SelectItem` 을 throw 로 거부 | **확실**(9곳) | 높음 | §3.6-B 의 `SELECT_EMPTY_VALUE` 센티널로 봉인. 대상 9곳 전수 목록화 완료 |
| W14 | Implement 중 계획에 없는 상황 발생 | 중 | 낮음 | **S-19** — 기존 동작 보존 쪽으로 진행 + dev-report `계획 결함` 기록. **사용자에게 묻지 않는다** |

---

## 7. 롤백 방법

**단위 롤백(권장)** — 커밋이 §5 표대로 잘려 있으므로 개별 revert 가 성립한다.
```bash
git revert --no-edit <SHA>          # 단일 커밋
git revert --no-edit <A>^..<B>      # 연속 구간 (예: C13~C16 수렴 4종)
```
| 커밋 | 롤백 시 주의 |
|---|---|
| C1-a/C1-b/C2 | 셋은 한 사슬이다. 앞쪽만 revert 하면 뒤쪽의 shared import 가 깨진다 → **C2 → C1-b → C1-a 역순**으로 |
| C3 | revert 후 **`npm install` 재실행**(package-lock 복원) |
| C4/C5/C6 | 레포가 달라 각 레포에서 개별 revert |
| C9 | 시각만 되돌리는 부분 롤백은 `control-styles.ts` 상수 값을 tc 현행 문자열로 되돌리면 됨(D-1 대안 B 로 수렴) — 파일 삭제 불필요 |
| C13~C16 | 소스와 e2e spec 이 같은 커밋에 있어 revert 하면 둘 다 정합하게 되돌아온다 |

**전체 롤백**: 본 SPEC 착수 직전 SHA(`cd868ee` = "docs(specs): wm-parity SDD 트랙 SPEC 2건 추가") 로
`git revert` 구간 실행. **`git reset --hard` / force push 금지**(글로벌 룰 17).

**타 레포**: nori-tc-common(`e90ec2b`) / nori-tc-exec(`20ac0bb`) 은 문서 커밋뿐이라 단독 revert 안전.

---

## 8. 세션 분할 가이드 (컨텍스트 60% 대비)

> **진행 리듬은 "단계마다 §5.0 루틴"이 1차, 세션 분할은 2차다.** 아래 S1~S6 은 컨텍스트 예산이
> 어디쯤에서 끊길지에 대한 안내일 뿐, 한 세션에 몇 단계를 담을지는 실제 소모량이 정한다.
> **컨펌 대기는 세션 경계가 아니다** — 같은 세션에서 승인을 받고 이어가는 것이 정상이다.
> "C10 과 C13 사이에서 세션을 끊지 않는다"는 원칙은 **`/clear` 를 하지 않는다**는 뜻이지
> 컨펌을 생략한다는 뜻이 아니다.

| 세션 | 범위 | 진입 시 읽을 것 | 종료 조건 |
|---|---|---|---|
| **S1** | C0 → C1-a → C1-b → C2 | SPEC + 이 Plan §3.5/§3.6 + §5.C0~C2 | AC7/8/9/17 green + dev-report 에 baseline 기록 |
| **S2** | C3 → C4/C5-a/C5-b/C6 → C7 → C8 | Plan §5.C3~C8 + D-5 | AC10/11/13/14 green |
| **S3** | C9 → C10 → C11 → C12 | Plan §5.C9~C12 (D-1/D-2 확정 완료) | AC12/15 green + C9 스크린샷 승인 |
| **S4** | C13 → C14 | Plan §5.C13~C14 + §4 | 해당 e2e green, 잔여 수치 기록. **C10 의 switch/checkbox 소비처가 여기서 생긴다** |
| **S5** | C15 → C16 | Plan §5.C15~C16 + §4.1 | **AC4/5/6 green** |
| **S6** | C17 → C18 | Plan 전체 + dev-report | **AC16 green**, dev-report 완성 |

각 세션 종료 시 `.claude/specs/wm-parity-foundation-dev-report.md` 에 누적 기록.
**콘솔 출력만 남기고 끝내지 않는다**(글로벌 룰 16).

**dev-report 고정 섹션 (Validate 세션이 대조할 스키마)**
1. `측정 조건` — baseline SHA / 백엔드 미기동(S-06) 명시
2. `e2e baseline` — 총계 + **PASS 전체 목록** + **FAIL 전체 목록 + 사유 1줄**
3. `커밋 로그` — C 단위별 SHA / 변경 파일 / 해당 AC
4. `잔여 수치 누적표` — button / select / checkbox (§5 의 검산표와 같은 형식)
5. `게이트 출력` — build / lint / test:unit / e2e 각각 **마지막 5~10줄 코드블록 인용**
6. `R8/R9 보류 사유` — 5항목 (S-15)
7. `스크린샷` — C9 의 3화면 before/after + 관찰 결과
8. **`계획 결함`** — 계획에 없던 상황과 그때 택한 보존적 선택(S-19). **없으면 "없음" 이라고 적는다**

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

> §11 에 전문이 있다. 새 세션 첫 메시지로 그대로 복붙한다.

---

## 11. Implement 진입 프롬프트 (복붙용 전문)

```
@.claude/specs/wm-parity-foundation.md @.claude/specs/wm-parity-foundation-plan.md 둘 다 읽고 구현.

[설계는 묻지 않는다 / 진행은 반드시 묻는다 — 둘을 혼동하지 말 것]
- 설계·구현 선택("어느 쪽으로 할까요", "이것도 포함할까요")은 **금지**.
  Plan §3.5 봉인표(S-01~S-20)와 §3.6 기계 규칙에 모든 답이 있다.
  없으면 기존 동작 보존 쪽으로 진행하고 dev-report `계획 결함` 에 기록한다.
- 단계 진행은 **필수로 묻는다**. Plan §5.0 의 단계 완료 루틴 5스텝을 매 단계 예외 없이 수행:
  (1) 검증 — build / lint / test:unit + 해당 AC grep + 그 단계의 회귀 e2e spec
  (2) 사용자 보고 — §5.0 스텝2 의 6줄 형식. 게이트 출력 마지막 5~10줄을 코드블록으로 인용
  (3) main 커밋 — 승인 불요(글로벌 룰 17). push 는 하지 않는다
  (4) dev-report 갱신 — 커밋 SHA 포함
  (5) "다음은 [C{n}] {제목} 입니다. 진행할까요?" 로 컨펌 받고 **대기**
  컨펌 전에 다음 단위 파일을 한 줄도 건드리지 않는다. 여러 단위를 묶어서 진행하지 않는다.
  독립 단계라는 이유로 연속 진행하지 않는다.

[첫 단계 — 반드시 이것부터]
Plan §5.C0 의 e2e baseline. clean HEAD, 백엔드 미기동(S-06), 포트 3000 정리 후 npm run test:e2e.
PASS 목록과 FAIL 목록을 둘 다 dev-report 에 기록. 이 목록이 AC16 의 유일한 판정 기준이다.
C0 은 커밋이 없으므로 스텝 3을 건너뛰고 검증 → 보고 → dev-report → 컨펌 순으로 진행한다.

[진행 순서]
Plan §5 의 21 단위(C0 → C1-a → C1-b → C2 → C3 → C4 → C5-a → C5-b → C6 → C7 → C8 →
C9 → C10 → C11 → C12 → C13 → C14 → C15 → C16 → C17 → C18) 를 그 순서로, **한 번에 하나씩**.
C0 / C17 / C18 은 커밋 없는 게이트, 나머지 18 개가 실제 커밋이다.
C10 과 C13 사이에서는 /clear 를 하지 않는다(프리미티브 미사용 구간 방지) — 컨펌은 그대로 받는다.

[변환은 기계 규칙으로]
raw 요소 변환은 Plan §3.6 을 그대로 적용한다 —
A) Button: className 문자열 조건표로 variant 결정, size 는 예외 없이 sm, 기존 className 통째 전달
B) Select: SELECT_EMPTY_VALUE 센티널. 빈 문자열 option 9곳 목록 그대로
   (radix 가 빈 문자열 SelectItem 을 throw 로 거부 — 실측)
C) Checkbox: §3.6-C 의 파일 전문을 그대로. 디자인을 새로 정하지 않는다
D) ToggleField: 감싸는 label 제거 + useId 기반 id/htmlFor 명시 결합

[e2e 동반 수정 — 잊으면 AC4/AC5 와 AC16 이 동시 성립 불가]
Plan §4 대로 selectOption 16호출 9파일 + input[type=checkbox] 셀렉터 3파일을
해당 변환 커밋과 같은 커밋에서 고친다.

[하지 않는 것]
신규 npm 의존성 0 / 신규 i18n 키 0 / R8·R9 5항목 전부 보류(코드 변경 0) /
사이드바 프리미티브 이식 없음 / 도메인 사이드바 5파일의 raw button 18건은 그대로 둔다.

[산출물]
.claude/specs/wm-parity-foundation-dev-report.md — Plan §8 의 고정 8섹션 스키마로.
게이트 출력은 마지막 5~10줄 코드블록 인용 필수.
```
