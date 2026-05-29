# PLAN — nori-client Look & Feel Migration (Phase 1.7 + 2~8)

> 작성일: 2026-05-29 (2026-05-29 D14/R8/D15/R9 정정 반영 갱신)
> 입력: [.claude/specs/nori-client-look-and-feel.md](nori-client-look-and-feel.md) (SPEC, Specify confirmed — D14/R8/D15/R9 신설)
> 선행 완료: Phase 1 (commit `fb0b39f`) + Phase 1.5 (commit `321fe90`) — 기반 토큰 (D14 의 *내용* 영역 토큰만)
> 대상 레포: `nori-tc-ui-front` 단일 (branch `docs/nori-client-look-and-feel-spec` 누적 commit)
> 단계: **Plan (Phase 1.7 + 2~8)** — 실행/코드/npm/commit 금지. 본 문서는 Implement 세션 입력.

## ⚠️ 2026-05-29 D14/R8/D15/R9 정정 반영

SPEC 의도 정정 (commit `072e3a4` + `4b49691`) 후 본 plan 의 의미가 갱신됨:

- **D14**: *틀 = nori-client / 내용 = ui-front*. 페이지 phase 의 작업이 "토큰 소비만" → **"R8 의 layout shell 적용 + ui-front 기능 위젯 재배치"** 로 확장.
- **R8 신설 (Phase 1.7)**: 페이지 phase 진입 *전제 조건*. nori-client 공통 layout 위젯 (Location / SubTitleHeader / TableActions / Common Modal) 의 시각 패턴을 `<PageLayoutShell>` 등 6 개 신규 컴포넌트로 추출. **본 plan 의 § Phase 1.7 추가됨**.
- **D15 + R9**: 각 phase 가 *진행 중 리팩토링 + 품질 개선* 동반. 4 축 baseline (.claude/quality/) 위에서 회귀 0 + 가능한 개선. 본 plan 의 모든 phase 정의에 *R9 게이트* 추가.

**기존 dev-report.md 의 Phase 2 LoginPage 작업 (2026-05-29 commit 미확정) 은 D14 정정 전 의도 (틀=ui-front 그대로, 색만 brand 토큰) 으로 진행됨 → 재검토 필요**. dev-report 의 별 섹션 참조.

---

## Phase 1.7 — R8 공통 layout shell pattern 신설 (페이지 phase 의 새 전제 조건)

> 의존: Phase 1 (`fb0b39f`) + Phase 1.5 (`321fe90`) — 완료
> 후속 unblock: Phase 2~8 (R8 shell 컴포넌트 없이 진입 불가)

### 영향 파일 (신규)

| 파일 | 역할 | 매핑 |
|---|---|---|
| `src/shared/layout/PageLocation.tsx` | bread crumb | nori-client `components/location.jsx` |
| `src/shared/layout/PageHeading.tsx` | heading-primary (icon + name + soft hr) | `components/header_subtitle.jsx` |
| `src/shared/layout/PageHeadingWithActions.tsx` | heading + 우측 action slot | `components/header_subtitle_btn.jsx` |
| `src/shared/layout/PageActionBar.tsx` | 표 위 액션 (조회/등록/엑셀/검색/필터) | `components/table_common.jsx` (TableActions) |
| `src/shared/layout/PageLayoutShell.tsx` | 통합 wrapper + 6 variant | (조합) |
| `src/shared/layout/PageModal.tsx` | 모달 패턴 (dialog.tsx 확장) | `components/common_page_modal.jsx` |
| `src/dev/LayoutShellFixture.tsx` 또는 storybook | 6 variant screenshot fixture | (신규 dev-only) |

### 단계 분해

1. nori-client 원본 위젯 4 개 (`location.jsx` / `header_subtitle.jsx` / `header_subtitle_btn.jsx` / `table_common.jsx` TableActions) + `common_page_modal.jsx` 의 *시각 패턴 추출* (markup / 간격 / hr / 아이콘 위치). sass 클래스 → Tailwind 토큰 매핑.
2. D10 재해석 적용 — weight 500/600, radius 8~12, soft shadow 다단, transition 200-300ms ease-out.
3. D15 / R9 — TypeScript strict (any/unknown/as 0 추가), aria-label / role / focus-visible / heading hierarchy / contrast 4.5:1+ 명시.
4. `<PageLayoutShell variant="single-card | multi-section | split-tab | dashboard-grid | form-sidebar | dashboard-3d">` — 6 variant prop 으로 페이지 phase 의 다양한 shell 패턴 지원.
5. dev fixture 또는 storybook 6 variant screenshot — 사용자 시각 confirm 게이트.
6. 기존 페이지 변경 0 — R8 은 신규 컴포넌트만, 페이지 적용은 Phase 2~8.

### 위험

- **dialog.tsx 확장 vs 대체** — `PageModal` 은 *확장* (dialog.tsx 유지, variant prop 으로 nori-client 패턴 활성화). 대체 시 confirm-dialog.tsx 등 기존 사용처 깨짐 — 명시 금지.
- **AppPageShell 와 계층 충돌** — AppPageShell = topbar + 콘텐츠 wrapper, PageLayoutShell = 콘텐츠 wrapper *안* 의 페이지 내부 shell. 계층 명확히.
- **variant API 폭주** — 6 variant 가 phase 마다 prop 추가로 누적되면 maintainability ↓. variant prop 은 *Phase 1.7 에서 고정* (Phase 2~8 진입 시 prop 추가 금지, 필요 시 별 variant 신설).

### 검증

- [ ] `npm run build` PASS
- [ ] 신규 파일 `tsc -b` 0 errors / `eslint .` 0 errors
- [ ] dev fixture 또는 storybook 6 variant screenshot 캡처
- [ ] 기존 e2e 회귀 0 (페이지 변경 없으니 baseline 유지)
- [ ] `git grep "PageLayoutShell"` → 1 hit (정의 파일만, 사용처 0 — Phase 2~8 에서 사용)
- [ ] R9 4 축 측정 baseline 대비 회귀 0 + 가능한 개선

### 사용자 시각 confirm 게이트

Phase 1.7 commit 후 dev 페이지 / storybook 캡처 첨부 → 사용자 시각 confirm 필수. confirm 거부 시 Phase 2 진입 보류.

---

## 0. Phase 1 + 1.5 산출물이 어떻게 흘러드는지

페이지 phase(2~8)는 **새 토큰을 만들지 않는다**. Phase 1/1.5가 확립한 토큰을 *소비*만 한다. 검증된 자산:

### Phase 1 (`fb0b39f`) → 전 페이지에 흐르는 디자인 토큰 ([src/index.css](../src/index.css))

| 토큰 그룹 | CSS 변수 | Tailwind utility (자동 생성, `@theme`) | 페이지에서의 용도 |
|---|---|---|---|
| 브랜드 | `--color-brand-primary` `--color-brand-accent` (둘 다 coral `oklch(0.62 0.16 36)`, D1 재정의) | `bg-/text-/border-/ring-brand-primary` · `-brand-accent` | CTA · active · focus ring · row-select |
| semantic | `--color-success/warning/danger/info` (+`-foreground`) | `bg-/text-success` 등 | 상태 badge · alert · validation |
| chart | `--color-chart-1~5` (coral monochrome 5-tone) | `fill-chart-1` 등 | **Phase 5 recharts 전용** |
| grid | `--color-grid-row-stripe` `--color-grid-row-select` | `bg-grid-row-stripe` 등 | 표 줄무늬 · 선택 행 |
| link | `--color-link` `--color-link-hover` | `text-link` `hover:text-link-hover` | 명시 링크 (전역 `a` 주입 금지) |
| shadow | `--shadow-soft-sm/md/lg` (다단 soft) | `shadow-soft-sm` 등 | 카드 · 모달 · panel |
| motion | `--motion-duration-fast/base/slow` `--motion-ease-out` | `duration-[var(--motion-duration-base)]` `ease-[...]` | micro-interaction |
| z-index | `--z-base/menu/.../tooltip` 10단 | (CSS var 직접) | 오버레이 계층 |
| typography | `--leading-tight/body/relaxed` `--tracking-tight/normal/wide` | `leading-[var(--leading-body)]` 등 | heading/본문/라벨 리듬 |
| 폰트 | `--font-ui: 'Pretendard', system-ui` | `font-ui` | 전 페이지 본문 |
| 로고 | `--font-fraunces` (보존) | `font-fraunces` | N 로고 전용 |

> Tailwind 4 `@theme` 의 `--color-*` 는 `bg-/text-/border-/ring-/fill-/stroke-<name>` utility 를 자동 생성한다. 따라서 페이지 phase 는 인라인 `[#hex]` 를 `brand-primary` 등 *named utility* 로 치환하는 것이 1차 작업.

### Phase 1.5 (`321fe90`) → 모든 페이지가 공유하는 컴포넌트 ([src/components/ui/](../src/components/ui/) 11 + AppPageShell + SelectableTable)

- shadcn primitives 11개(badge/button/confirm-dialog/context-menu/dialog/input/resizable-divider/select/sidebar-resize-handle/skeleton/table) + AppPageShell + SelectableTable 가 **이미 토큰화 완료** (`git grep 옛-hex src/components/ui/` = 0 hits, [SPEC L446](nori-client-look-and-feel.md#L446)).
- 의미: 페이지 phase 는 `<Button>` `<Dialog>` `<Input>` `<Table>` `<SelectableTable>` 를 *쓰기만* 하면 자매품 인상이 자동 적용된다. 페이지 작업의 잔여분은 **페이지 파일 자체의 인라인 hex/bracket-token** (컴포넌트 밖, 레이아웃/래퍼/커스텀 마크업).

### 따라서 페이지 phase 의 작업 = 딱 2종

1. **인라인 `[#hex]` → named token utility** 치환 (`bg-[#D95D39]` → `bg-brand-primary`, 옛 green `#1C7F59` → `brand-primary/accent`, grayscale hex → `text-muted-foreground` 등 기존 shadcn grayscale 토큰)
2. **인라인 `tracking-[Nem]` / `leading-[N]` / `rounded-[Npx]` / `shadow-[...]` → 토큰 utility** 치환 ([SPEC R1.2 / D11](nori-client-look-and-feel.md#L405), 일괄 금지·점진)

로직/라우팅/API/Query hook/radix prop/JSX 구조는 **0 라인 변경** (R5).

---

## 1. Phase 의존성 그래프 & 병렬 가능 여부

```
Phase 1 (토큰) ──┐
                 ├─→ Phase 1.5 (공유 컴포넌트) ──┬─→ Phase 2 (Login)   [순차: 기준 페이지]
Phase 1.5 완료 ──┘  (둘 다 완료 = 전제)         │
                                                ├─→ Phase 3 (Eqp)     ┐
                                                ├─→ Phase 4 (Model)   │ 상호 독립
                                                ├─→ Phase 5 (Deploy)* │ → 이론상 병렬
                                                ├─→ Phase 6 (Dlq)     │   가능 (파일 비중첩)
                                                ├─→ Phase 7 (User)    ┘
                                                └─→ Phase 8 (LiveMap)** [최후·독립]
```

### 병렬성 판정 (도구 검증 기반)

- **전제**: Phase 1 + 1.5 는 이미 commit 완료([fb0b39f](nori-client-look-and-feel.md#L431)/[321fe90](nori-client-look-and-feel.md#L442)) → 모든 후속 phase 의 unblock 조건 충족.
- **파일 중첩 0**: Phase 2~8 의 영향 파일은 각 `src/features/<feature>/` 로 격리됨(grep 확인). 공유 컴포넌트는 Phase 1.5 에서 이미 동결 → cross-phase 파일 충돌 없음.
- **따라서 Phase 3~8 은 기술적으로 병렬 가능**. 단 다음 제약으로 **순차 권장**:
  - **R4 명시**: "한 PR 한 페이지"(회귀 격리). 동일 branch 에 commit 누적이라 worktree 병렬 시 merge 순서/리베이스 비용.
  - **Phase 2 가 시각 기준**([SPEC Phase 분해](nori-client-look-and-feel.md#L309) "최초 페이지 시각 결정 — 이후 phase 의 기준"). Phase 2 confirm 전 3~8 착수 시 기준 변경에 따른 재작업 위험.
  - **Phase 4 의존**: `@tanstack/react-table` 도입(SelectableTable 보강)이 Phase 3 의 SelectableTable 사용 인상에 영향 가능. Phase 3 → 4 순서 권장.
- **결론**: Phase 2 (기준 확정) → Phase 3~7 (순차 또는 신중 병렬) → Phase 8 (최후, 위험 최고). **권장 = 순차** (회귀 격리 + 기준 일관).

\* Phase 5 recharts(신규 차트), \*\* Phase 8 보드(예시 파일 기반 재구성) = token-only 초과 — §DECISION 에서 사용자 확정 완료. Phase 8 R3F 3D 는 별 SPEC 분리.

---

## 2. 전체 일정 추정 (상대 규모 — 마이그레이션 표면 grep 기반)

> 1 unit ≈ 인라인 토큰 치환 + 페이지별 시각 confirm 1 라운드 + e2e/build/lint 검증 1 사이클. 절대 시간 아님 (세션 단위 상대 비교).

| Phase | 페이지 | arb-hex | bracket-token | 파일 | 신규 dep | 위험 | 상대 규모 |
|---|---|---|---|---|---|---|---|
| 2 | Login | 48 | 8 | 1 | — | 기준 확정 | **S** (1 파일이나 기준이라 confirm 비용↑) |
| 3 | Eqp | 252 | 12 | 13 | — | sidebar+표 첫 적용 | **L** |
| 4 | Model | 439 | 12 | 15 | `@tanstack/react-table` | 최대 패널·table 보강 | **XL** |
| 5 | Deploy | 182 | 9 | 4 | `recharts`* | 차트 신규 surface | **M~L** (차트 범위에 따라) |
| 6 | Dlq | 33 | 4 | 4 | — | 모달 인상 | **S** |
| 7 | User/UM/Profile | 70 | 3 | 8 | — | 폼 인상 | **M** |
| 8 | LiveMap | 235 | 69 | 9 | — (R3F 별 SPEC) | 보드 재구성·검증공백 | **L~XL** (예시 파일 규모에 따라) |

**총 추정**: ≈ Login(S) + Eqp(L) + Model(XL) + Deploy(M~L) + Dlq(S) + User(M) + LiveMap(L~XL) ≈ **7 세션 분량**, Phase 4 가 단일 최대 비중. D-3d 확정으로 Phase 8 의 R3F 3D 재작성은 별 SPEC 분리 → 본 SPEC 의 Phase 8 은 chrome token-only + 예시 파일 기반 보드 재구성으로 축소.

\* Phase 5 recharts = 신규 차트 surface(D-chart 확정), ** Phase 8 보드 = 예시 파일 기반 재구성(D-3d 확정).

---

## 3. Phase 별 상세 계획

각 phase 공통 검증 사이클 (SPEC [Acceptance Criteria 전체](nori-client-look-and-feel.md#L251)):
```
npm run build      # tsc -b && vite build  → PASS
npm run lint       # eslint .              → 변경 파일 0 errors (baseline 14 무관 errors 제외)
npm run test:e2e   # playwright test       → 해당 phase spec PASS + selectable-table-* 회귀 0
git diff           # 로직/구조 0 라인 변경 확인 (R5)
```
> 검증 결과 보고 시 각 명령 출력 마지막 5~10줄 코드블록 인용 (CLAUDE.md 규칙 1).

---

### Phase 2 — LoginPage

- **영향 파일**: [src/features/auth/components/LoginPage.tsx](../src/features/auth/components/LoginPage.tsx) (단일, 286줄)
- **신규 라이브러리**: 없음
- **현황(grep)**: arb-hex 48 / bracket 8. coral `#D95D39` 는 이미 사용 중이나 *인라인 hex* → token utility 미치환. grayscale hex (`#1D2A24`/`#33413A`/`#5A6A62`/`#D3DED8`/`#E8E4DF`/`#F5F3EF`/`#FAF8F5`/`#2D2D2D`/`#5A5A5A`/`#ADADAD`/`#9AA8A2`) 다수, `bg-[#00000033]` overlay, `tracking-[3px]`/`tracking-[-1px]`/`rounded-[20px]`/`rounded-[10px]` 인라인.
- **nori-client 참조**: [_login.scss](../../../nori-client/src/assets/scss/_login.scss) — 중앙 카드 · soft shadow · brand CTA.
- **핵심 위험**:
  - **기준 페이지** — 여기서 확정한 카드 radius/shadow/spacing/CTA 인상이 Phase 3~8 의 시각 기준. confirm 신중.
  - `#D95D39` 인라인 → `brand-primary` 치환은 D1 재정의(coral 통일)와 정합. green 잔재 없음(이미 coral 톤).
  - `bg-[#00000033]` overlay → `--z-overlay` 토큰 + shadcn dialog overlay 인상 정합 검토.
- **단계 분해**:
  1. grayscale hex → shadcn grayscale 토큰(`text-foreground`/`text-muted-foreground`/`border-input`/`bg-muted` 등) 매핑표 작성 → 치환
  2. coral 인라인 hex → `brand-primary`/`brand-primary/30` ring utility 치환
  3. `tracking-/rounded-/shadow-` bracket → `--tracking-*`/`rounded-xl`/`shadow-soft-*` 토큰 치환 (D11 점진)
  4. 인라인 form error (`text-red-500`) → `text-danger` 토큰 (R7 OoS 경계: 구조 미변경, 색만)
- **사용자 confirm 게이트**: ✅ **필수** (SPEC Phase 분해 "시각 사용자 confirm 필수") — dev 환경 `/login` 육안 + ko/en 토글(R6).
- **검증**: `tests/e2e/login-page.smoke.spec.ts` PASS + build/lint.

---

### Phase 3 — EqpPage

- **영향 파일** (13, [src/features/eqp/components/](../src/features/eqp/components/)): EqpPage · EqpSidebar · EqpInfoTable · EqpParamTable · BusinessGroupModelTable · GatewayGroupTable · CheckInModal · EqpManageFormModal · EqpModelBindingModal · EqpDeleteConfirmDialog · EqpDeleteResultDialog · EqpLifecycleActionDialog · EqpLifecycleResultDialog
- **신규 라이브러리**: 없음
- **현황(grep)**: arb-hex 252 / bracket 12 / 13 파일. EqpInfoTable·EqpParamTable·BusinessGroupModelTable·GatewayGroupTable·CheckInModal 은 SelectableTable 사용(Phase 1.5 토큰화 완료) → 페이지측 잔여는 sidebar·래퍼·dialog 커스텀 마크업.
- **nori-client 참조**: [_table.scss](../../../nori-client/src/assets/scss/_table.scss) — 행 줄무늬 · sticky header · row-select highlight (`--color-grid-row-stripe/select` 토큰 소비).
- **핵심 위험**:
  - **sidebar 패턴 첫 적용** — EqpSidebar 의 인상이 Phase 4(ModelSidebar)·5(DeploySidebar)·6(DlqSidebar)·7(UMSidebar) 의 기준. sidebar 토큰 결정 신중.
  - 13 파일 광범위 → 누락 위험. 치환 후 `git grep 옛-hex src/features/eqp` = 0 확인.
  - dialog 5종 — Phase 1.5 `<Dialog>` 토큰 위 페이지측 인라인 잔재만 제거 (중복 작업 금지).
- **단계 분해**:
  1. EqpSidebar 토큰화 (기준 sidebar 인상 확정)
  2. EqpPage 레이아웃 래퍼 hex → 토큰
  3. 표 4종 페이지측 잔여 hex → grid 토큰
  4. dialog/modal 5종 페이지측 잔여 hex → 토큰
- **사용자 confirm 게이트**: dev 확인 (SPEC: confirm 필수 아님, dev 확인). sidebar 기준이라 스크린샷 경로 commit 메시지 명시.
- **검증**: `selectable-table-check-in.spec.ts` + `selectable-table-gateway-group.spec.ts` PASS + 전체 selectable-table-* 회귀 0 + build/lint.

---

### Phase 4 — ModelPage + ModelDetailPanel

- **영향 파일** (15, [src/features/model/components/](../src/features/model/components/)): ModelPage · ModelDetailPanel · ModelSidebar · ModelFlowSidebar · ModelInfoTable · modelDetailColumnDefs · FlowCard · ActionDataIndexEditorModal · BranchModelCreateModal · DcopItemPickerModal · FlowFilterEditorModal · ModelCheckInDiffModal · ModelCheckInModal · ModelCreateOrUpdateModal · ModelDeleteConfirmDialog · ParentModelCommitModal
- **신규 라이브러리**: ⏱ **`@tanstack/react-table@^8.21`** (D4 — SelectableTable + react-table 결합으로 summary / row checkbox / advanced filter 보강). **도입 시점 = 본 phase 첫 작업**. `npm view @tanstack/react-table peerDependencies` (react>=16.8) + `npm install` 출력 인용 commit 메시지 의무([R3.3](nori-client-look-and-feel.md#L163)).
- **현황(grep)**: arb-hex 439 / bracket 12 / 15 파일 — **전 phase 중 최대**. ModelDetailPanel·ModelInfoTable·modelDetailColumnDefs·ModelCheckInDiffModal·ParentModelCommitModal 이 SelectableTable 사용.
- **nori-client 참조**: [_form.scss](../../../nori-client/src/assets/scss/_form.scss) — border + focus 강조 폼 인상.
- **핵심 위험**:
  - **최대 패널 + 최다 hex(439)** — 분할 commit 필요(ModelDetailPanel 단독 / 모달군 / sidebar 별도)로 회귀 격리.
  - **`@tanstack/react-table` 도입이 token-only 초과** — 단 D4 가 명시 승인. *SelectableTable 의 동작/API/range copy 0 변경*(Constraint 마지막) 엄수 — react-table 은 headless model(filter/summary/checkbox)만 보강, 렌더링은 SelectableTable 유지.
  - SelectableTable 첫 페이지 적용 — Phase 1.5 토큰 위에서 페이지 데이터 결합 검증.
- **단계 분해**:
  1. `npm install @tanstack/react-table@^8.21` (peer 검증 인용) — react-table 결합 범위 = **nori-client grid 동일 기능 동등성** (sortable/renderer/filter/editor/summary/checkbox, §DECISION D-table 확정). 미사용 기능 제외.
  2. ModelSidebar/ModelFlowSidebar 토큰화 (Eqp sidebar 기준 승계)
  3. ModelDetailPanel + modelDetailColumnDefs hex → 토큰 (단독 commit)
  4. ModelInfoTable + 표 잔여 → grid 토큰
  5. 모달 7종 페이지측 잔여 hex → 토큰
- **사용자 confirm 게이트**: dev 확인.
- **검증**: `model-flow.spec.ts` + `selectable-table-model-info/parameter/workflow/check-in-diff.spec.ts` + `selectable-table-parent-model-commit.spec.ts` PASS + build/lint.

---

### Phase 5 — DeployPage (+ Recharts)

- **영향 파일** (4, [src/features/deploy/components/](../src/features/deploy/components/)): DeployPage · DeploySidebar · DeployMonitorPanel · DeployHistoryPanel · DeployRegisterPanel · SelectedEquipmentRow
- **신규 라이브러리**: ⏱ **`recharts@^3.8`** (D5). 도입 시점 = 본 phase. `npm view recharts react@19` peer 인용 ([R1 AC L264](nori-client-look-and-feel.md#L264) 명시) + `npm install` 출력 commit 메시지.
- **현황(grep)**: arb-hex 182 / bracket 9 / 4 파일. DeployMonitorPanel 은 SelectableTable 사용. **기존 차트 0건** (svg/canvas/recharts 부재 — grep 확인).
- **nori-client 참조**: [_dashboard.scss](../../../nori-client/src/assets/scss/_dashboard.scss) 카드 인상 + TUI Chart(ColumnChart/BarChart/LineChart/PieChart/LineScatterChart).
- **핵심 위험**:
  - ⚠️ **recharts 도입 = 신규 시각 surface (token-only 초과)** — SPEC R4 Phase 5 가 "Recharts 도입 **(도입 필요 시)**"로 *조건부* 표기. 현 Deploy 에 차트가 없으므로 **무엇을 차트로 그릴지** 미정. → §DECISION **D-chart** 게이트 필수.
  - chart-1~5 coral monochrome 토큰(Phase 1)과 recharts 매핑 정합 — 새 색 발명 금지.
  - recharts 3.x bundle (~95KB) build size 영향 측정.
- **단계 분해**:
  1. DeployPage/Sidebar/패널 인라인 hex → 토큰 (차트 무관, token-only 부분 선행)
  2. **D-chart 게이트** — 차트 대상(배포 이력 추이? 장비 상태 분포?) 사용자 확정 후에만 recharts 도입
  3. (확정 시) `npm install recharts@^3.8` + chart-1~5 토큰 매핑 차트 구현
- **사용자 confirm 게이트**: dev 확인 + **D-chart 사전 게이트** (차트 surface 자체가 신규).
- **검증**: `selectable-table-deploy-monitor.spec.ts` PASS + build(size 비교)/lint.

---

### Phase 6 — DlqPage

- **영향 파일** (8, [src/features/dlq/components/](../src/features/dlq/components/)): DlqPage · DlqSidebar · DlqTableShell · DashboardPanel · BusinessDlqPanel · GatewayDlqPanel · QuarantinePanel · RepairTaskPanel
- **신규 라이브러리**: 없음 (DashboardPanel 이 "dashboard" 명칭이나 차트 아닌 SelectableTable 기반 — recharts 본 phase 도입 안 함)
- **현황(grep)**: arb-hex 33 / bracket 4 / 4 파일 — 소규모. 5개 패널이 SelectableTable 사용(Phase 1.5 완료) → 페이지측 잔여 적음.
- **nori-client 참조**: [_modal.scss](../../../nori-client/src/assets/scss/_modal.scss) 모달 인상 + 표 줄무늬.
- **핵심 위험**:
  - 모달 인상 첫 검증 — Phase 1.5 `<Dialog>` 토큰이 실 페이지에서 정합한지 확인 (재작업 시 R7 로 회귀).
  - 소규모라 위험 낮음.
- **단계 분해**: DlqPage/Sidebar/TableShell 래퍼 hex → 토큰 → 5 패널 페이지측 잔여 → 토큰.
- **사용자 confirm 게이트**: dev 확인.
- **검증**: `dlq-page.spec.ts` + `selectable-table-dlq-business.spec.ts` PASS + build/lint.

---

### Phase 7 — User / UserManagement / Profile

- **영향 파일** (8): [user/components/](../src/features/user/components/) UserAdminPanel · UserListTable · UserUpsertModal · UserPasswordResetModal · UserDeleteConfirmDialog · [user-management/components/](../src/features/user-management/components/) UserManagementPage · UserManagementSidebar · [profile/components/](../src/features/profile/components/) UserProfileModal
- **신규 라이브러리**: 없음 (date picker 사용처 식별 시 `react-day-picker@^10` 도입 — 본 phase 의 폼에 날짜 입력 있으면 검토, [R3.3](nori-client-look-and-feel.md#L169))
- **현황(grep)**: user 28 / user-management 12 / profile 30 = arb-hex 70 / bracket 3 / 8 파일. UserListTable 은 SelectableTable 사용.
- **nori-client 참조**: [_form.scss](../../../nori-client/src/assets/scss/_form.scss) + [_button.scss](../../../nori-client/src/assets/scss/_button.scss).
- **핵심 위험**:
  - **group feature 와의 경계** — group-page.spec.ts / user-page.spec.ts 에 **baseline 2 fail 존재** ([SPEC L455-456](nori-client-look-and-feel.md#L455), frontend feature gap, 시각 무관). Phase 7 검증 시 이 2 fail 은 *기존 부터 존재* 임을 git stash 대조로 재확인 필요 (신규 회귀와 구분).
  - GroupListTable 은 group feature 소속 → Phase 7 범위 외(SPEC Phase 7 = User/UM/Profile). 단 user-management 가 group 멤버십 UI 와 결합 가능 — 파일 경계 grep 재확인.
  - react-hook-form/zod 구조 미변경 (form 색·border 토큰만, R7/OoS).
- **단계 분해**: UserManagementPage/Sidebar → UserAdminPanel/UserListTable → 모달 3종(Upsert/PasswordReset/Delete) + UserProfileModal.
- **사용자 confirm 게이트**: dev 확인.
- **검증**: `user-page.spec.ts` + `selectable-table-user-list.spec.ts` PASS (group-page 2 fail = baseline 대조) + build/lint.

---

### Phase 8 — LiveMapPage (3D 결정 필요)

- **영향 파일** (9, [src/features/live-map/components/](../src/features/live-map/components/)): LiveMapPage · LiveMapBoard · LiveMapMachineNode · LiveMapHeader · LiveMapToolbar · LiveMapLegend · LiveMapTooltipCard · LiveMapCommLogPanel · LiveMapDemoModal
- **신규 라이브러리**: ⏱ **`@react-three/fiber@^9` + `@react-three/drei@^10.7` + `three@^0.184`** (D6). 도입 시점 = 본 phase. peer 검증(`react>=19<19.3, three>=0.156`) 인용 의무.
- **현황(grep)**: arb-hex 235 / bracket **69**(전 phase 최다 inline typography) / 9 파일. **현재 LiveMap = 2D CSS 절대배치 보드** — [LiveMapBoard.tsx](../src/features/live-map/components/LiveMapBoard.tsx) 가 `transform`/`absolute`/pointer drag 기반, [LiveMapMachineNode.tsx:38-76](../src/features/live-map/components/LiveMapMachineNode.tsx#L38) 가 div 로 "기계" 모양 수작업 렌더. **svg/canvas/three 0건**.
- **nori-client 참조**: [eqp_layout.jsx](../../../nori-client/src/containers/pages/dashpages/eqp_layout.jsx) (R3F Canvas+OrbitControls+lights+GLTFLoader 3D 인상).
- **신규 라이브러리**: ⚠️ **D-3d 확정으로 R3F/drei/three 본 SPEC 도입 안 함** (별 SPEC 분리). 따라서 Phase 8 신규 dep = **없음**.
- **핵심 위험** (D-3d 확정 후):
  - 🔴 **보드 재구성 = token-only 초과 (사용자 승인 예외)** — D-3d 단서로 LiveMapBoard/MachineNode 는 **Phase 8 진입 시 사용자 제공 예시 파일대로 페이지 재구성**. token 치환을 넘는 *마크업/레이아웃 재작성* → R5 token-only 의 명시적 예외(사용자 확정). 예시 파일 수령 전 보드 착수 금지.
  - 🔴 **e2e 검증 공백** — LiveMap playwright `.spec.ts` 부재 (`_live_map_layout_check.mjs` 는 비-playwright). 시각 회귀 자동 검증 수단 없음 → 수동 dev 확인 + 사용자 confirm 의존.
  - bracket-token 69 (`tracking-[...]`/`shadow-[...]`/`rounded-[...]`) — D11 점진 치환 대상 최다 (주변 chrome).
- **단계 분해** (D-3d 확정 분기 A):
  1. 주변 chrome 6종(LiveMapHeader/Toolbar/Legend/TooltipCard/CommLogPanel/DemoModal) 인라인 hex → 토큰, bracket-token → 토큰 (token-only, 예시 파일 무관 선행 가능)
  2. **예시 파일 게이트** — 사용자로부터 보드 예시 파일 수령
  3. LiveMapBoard/LiveMapMachineNode + LiveMapPage 를 예시 파일대로 재구성 (마크업/레이아웃 재작성, 토큰 적용)
  4. R3F/three 3D 도입은 **별 SPEC** (본 SPEC 범위 외)
- **사용자 confirm 게이트**: ✅ **예시 파일 수령(필수 선행) + dev 확인 + 사용자 confirm 필수**.
- **검증**: playwright spec 부재 → `npm run test:e2e` 전체 회귀 0(타 페이지 영향 없음 확인) + build/lint + **수동 dev 시각 확인** (자동 검증 불가 명시 보고). 보드 재구성은 예시 파일 대비 육안 일치 확인.

---

## 4. DECISION — 사용자 확정 완료 (2026-05-29)

> SPEC 의 D1~D13 은 컬러/라이브러리 선택을 확정했고, 아래 3건은 *"신규 surface 를 실제로 그릴지/범위"* 미결을 사용자가 2026-05-29 확정. 해당 phase Implement 의 작업 내용을 결정한다.

### D-3d (Phase 8) — LiveMap 3D 도입 범위 ✅ 확정 (2026-05-29)
- **사실**: 현 LiveMap 은 2D CSS 보드(three 0건, [LiveMapMachineNode.tsx:38](../src/features/live-map/components/LiveMapMachineNode.tsx#L38)). e2e spec 부재.
- **확정 = 분기 A 채택 (R3F 3D 재작성은 별 SPEC 분리)** + **추가 단서**: 보드 내용은 수정 예정. **Phase 8 진입 시 사용자가 예시 파일을 제공하고, 그 예시 파일대로 페이지를 그대로 재구성**한다. 즉 LiveMapBoard/MachineNode 는 *token-only 가 아니라 예시 파일 기반 재구성*. 주변 chrome(Header/Toolbar/Legend/Tooltip/CommLog/DemoModal)은 token-only. R3F/three/drei 도입은 본 SPEC 에서 **하지 않음** (별 SPEC).

### D-chart (Phase 5) — Deploy 차트 대상 ✅ 확정 (2026-05-29)
- **사실**: 현 Deploy 에 차트 0건. SPEC R4 "Recharts 도입 (도입 필요 시)" 조건부.
- **확정 = 권장 채택**: Phase 5 진입 시 차트 대상(배포 이력 추이 / 장비 상태 분포 등) 사용자 확정 후 recharts 도입. 대상 미확정 상태로 선 도입 금지(R3.3).

### D-table (Phase 4) — `@tanstack/react-table` 결합 범위 ✅ 확정 (2026-05-29)
- **사실**: D4 가 react-table 도입 확정(상위 호환). SelectableTable 동작 0 변경 제약.
- **확정 = nori-client TUI Grid 와 동일 기능 동등성 확보** (개발 진행 중 추가 수요 대비 headroom). 범위 = nori-client **실사용 기능 카탈로그** ([SPEC L80-89](nori-client-look-and-feel.md#L80)): `sortable` / `renderer`(custom React 셀) / `filter`(헤더 드롭다운) / `editor`(셀 인라인 편집) / `summary`(합계 row) / `rowHeaders: checkbox`. **미사용 기능은 제외** (treeColumn/frozenColumn/cellMerge/paginator/copyOptions/exporter/relationColumns — nori-client 0 hits). react-table 은 headless model(정렬/필터/summary/선택 상태)만 담당, 렌더링은 SelectableTable 유지 → SelectableTable 동작/API/range copy 0 변경 제약 양립.

---

## 5. 제약 준수 체크리스트 (전 phase 공통, [SPEC Constraints](nori-client-look-and-feel.md#L234))

- [ ] npm only (pnpm/yarn 금지)
- [ ] 외부 grid 라이브러리 도입 금지 (SelectableTable + react-table headless 만)
- [ ] AppTopBar 구조 변경 금지 (R2 = Phase 1 완료, 재작업 금지)
- [ ] 라우트/페이지/기능/API/권한 모델 변경 금지 — 시각 토큰만
- [ ] dark navy 헤더 도입 금지 / font-fraunces 제거 금지
- [ ] **phase 별 PR/MR 생성 금지** — branch 에 commit 누적, **SPEC 전체 완료 후 단일 MR** 일괄 통합
- [ ] 신규 alert/confirm/toast/shadcn primitive 도입 금지 (OoS)
- [ ] react-hook-form/zod 구조 변경 금지 (form 시각 토큰만)
- [ ] 다크 모드 `.dark` 토큰 유지(제거 금지)·갱신 OoS
- [ ] 글로벌 `a` 셀렉터 주입 금지 (명시 className 만)
- [ ] 각 phase commit 메시지: 변경 전/후 스크린샷 경로 + (신규 dep phase) `npm view`/`npm install` 출력 인용

## 6. 롤백 방법

- 각 phase 단일 페이지 commit(R4) → 회귀 발견 시 해당 commit `git revert` 로 페이지 단위 격리 롤백 (cross-page 오염 0).
- 신규 dep phase(4/5/8): `npm install` 전 `package-lock.json` snapshot → 롤백 시 lock 복원 + `node_modules` 재설치.
- 단일 MR 정책이라 main 영향 0 (merge 전 전부 branch 내부) → 전체 롤백 = branch 폐기.

---

## 다음 단계 진입 프롬프트 (Implement, phase 별)

```
@.claude/specs/nori-client-look-and-feel.md @.claude/specs/nori-client-look-and-feel-plan.md 둘 다 읽고 Phase <N> 구현.
SPEC 의 Acceptance Criteria + Plan 의 §3 Phase <N> 단계 분해 엄수.
DECISION 게이트(해당 시 D-3d/D-chart/D-table) 사용자 확정 후 착수.
산출물: .claude/specs/nori-client-look-and-feel-dev-report.md 에 변경 파일 / npm 출력 / 테스트 결과 / 결정 기록.
```
