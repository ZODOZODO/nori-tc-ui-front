# SPEC — Selectable Table Rollout (Excel-style range select / copy / paste)

> 작성일: 2026-05-23
> 단계: Specify (Plan / Implement / Validate 후속)
> 대상 레포: `nori-tc-ui-front` (단일 레포 — backend 변경 없음)
> 출처: 사용자 요청 — model detail Reference 테이블에서 Excel 영역 복사·붙여넣기 가능 여부 문의 → 전체 페이지·모달의 모든 테이블 일괄 도입으로 확장
> 선행 PoC: model-parameter 노드에 [SelectableModelDetailTable](../../src/features/model/components/SelectableModelDetailTable.tsx) + [useGridRangeSelection](../../src/features/model/hooks/useGridRangeSelection.ts) hook 으로 검증 완료 (브라우저 동작 확인)

## Why

nori-tc-ui-front 의 모든 데이터 테이블은 현재 shadcn `<Table>` 기반 정적 DOM 으로, **셀 사각형 영역 선택 / Ctrl+C → Excel TSV / Excel TSV → Ctrl+V paste** 가 불가능. 사용자가 모델 파라미터·DLQ 메시지·Deploy 상태·EQP 정보 등을 Excel 로 옮겨 작업하거나 Excel 에서 일괄 입력하는 워크플로우가 매번 수작업이라 운영 효율 저하.

PoC 결과 무료 OSS grid 라이브러리 중 React 19 호환 + range/copy/paste 풀 지원이 사실상 부재 (react-data-grid v7 beta 는 단일 셀만, Glide alpha 는 canvas 라 shadcn 디자인 결합 어려움). shadcn Table 유지 + 자체 hook 으로 구현하는 것이 디자인 일관성·안정성·React 19 호환 세 조건을 동시에 만족.

현재 상태 — 워크스페이스 grep 으로 확인된 production `<Table>` 사용 파일 **22 개** (PoC 신규 추가 SelectableModelDetailTable 과 skeleton.tsx 제외):

| 카테고리 | 파일 | 변환 난이도 |
|---|---|---|
| 단순 read-only 데이터 | `DashboardPanel`, `RepairTaskPanel`, `QuarantinePanel`, `GatewayDlqPanel`, `BusinessDlqPanel`, `DeployMonitorPanel`, `EqpInfoTable`, `EqpParamTable`, `BusinessGroupModelTable`, `GatewayGroupTable` | 낮음 |
| 행 클릭 → 상세 열기 | `ModelInfoTable`, `UserListTable`, `GroupListTable` | 중간 (UX 결정: 더블클릭 열기로 변경) |
| Diff / preview 색상 표시 | `ModelCheckInDiffModal`, `ParentModelCommitModal` | 낮음 (cell renderer custom) |
| Editable + picker/select/modal-edit | `ModelDetailPanel` (model-parameter 완료, 나머지 노드 9 개) | 높음 (셀별 분기 보존) |
| 복잡 편집 | `DeployRegisterPanel`, `LiveMapDemoModal`, `FlowCard`, `CheckInModal` | 높음 |
| Out of Scope | `DcopItemPickerModal`, `ActionDataIndexEditorModal`, `FlowFilterEditorModal` | — |

## Requirements

### R1 — 제네릭 SelectableTable 컴포넌트 추출
- [ ] `src/shared/components/SelectableTable/` 디렉터리 생성
- [ ] `SelectableTable<TRow>` 컴포넌트 — shadcn `<Table>` 기반, range selection / Ctrl+C TSV / Excel TSV paste / 더블클릭 편집·행 열기 지원
- [ ] `ColumnDef<TRow>` 타입 — `key`, `header`, `accessor: (row: TRow) => string`, `renderCell?`, `editable?`, `width?`, `sticky?`, `sortable?`, `resizable?` 등
- [ ] `SelectableTableFeatures` prop — `{ rangeCopy, rangePaste, sortable, resizable, virtualization, doubleClickToOpen, doubleClickToEdit }` boolean / config
- [ ] [useGridRangeSelection](../../src/features/model/hooks/useGridRangeSelection.ts) hook 을 `src/shared/hooks/` 로 이관
- [ ] 신규 `useGridSort` / `useGridResize` / `useGridVirtual` hook 분리 (single-responsibility)
- [ ] PoC 컴포넌트 SelectableModelDetailTable 을 새 SelectableTable 로 마이그레이션 (model-parameter 회귀 0)

### R2 — Phase 2: 단순 read-only 데이터 테이블 일괄 전환
- [ ] DLQ 5 패널 (`DashboardPanel`, `RepairTaskPanel`, `QuarantinePanel`, `GatewayDlqPanel`, `BusinessDlqPanel`) — range copy 활성, 기존 row 액션 (재시도·격리 해제 등) 보존
- [ ] `DeployMonitorPanel` — read-only 모니터 데이터 range copy 활성
- [ ] EQP 정보 테이블 4 종 (`EqpInfoTable`, `EqpParamTable`, `BusinessGroupModelTable`, `GatewayGroupTable`) — range copy 활성

### R3 — Phase 3: model detail 나머지 노드 + diff modal 전환

#### R3.1 — ModelDetailPanel 8 노드 마이그레이션
- [x] `ModelDetailPanel` 의 model-parameter 외 노드 (workflow / dcop-itemes / secs-message / socket-message / mes-message / variableides / reportides / eventides) — range copy + 기존 picker·select·flow modal 분기 보존. workflow 는 dead path ([ModelDetailPanel.tsx:787](../../src/features/model/components/ModelDetailPanel.tsx#L787) `detailNodes.filter((node) => node !== 'workflow')`, git 80605b4) 라 자연 진입 e2e 불가 — createWorkflowColumns factory 는 reference workflow 복원 시 재사용 자산으로 보존.

#### R3.2 — ModelCheckInDiffModal / ParentModelCommitModal (별 PR — R3 범위 외)
- [ ] `ModelCheckInDiffModal` / `ParentModelCommitModal` — diff 색상 cell renderer 유지하면서 range copy 활성 (별 PR — R3 Validate 시점 미진입)

### R4 — Phase 4: 행 클릭 테이블 UX 전환
- [ ] `ModelInfoTable`, `UserListTable`, `GroupListTable` — 단일 클릭은 셀 선택, **더블클릭으로 행 열기**
- [ ] 기존 단일 클릭 진입 흐름 사용자 인지 안내 (PR 본문 또는 changelog)

### R5 — Phase 5: 복잡 편집 패널 검토
- [ ] `DeployRegisterPanel`, `LiveMapDemoModal`, `FlowCard`, `CheckInModal` — 셀 편집 구조가 폼·모달 호출에 묶여 있어 case-by-case 검토. 전환 가치 < 위험이면 보존 결정 가능 (SPEC Validate 에서 확정).

### R6 — Phase 1 인프라
- [ ] 가상화 — `react-window` 또는 `@tanstack/react-virtual` 도입 (MIT, React 19 호환). 1 차 PoC 검증 후 라이브러리 확정.
- [ ] 컬럼 정렬 — header 클릭 → asc / desc / off 3 단계
- [ ] 컬럼 리사이즈 — header 우측 경계 드래그
- [ ] 필터 / 가로 스크롤 행 고정 / 컬럼 그룹화 — **이 SPEC 의 Out of Scope**

### R7 — 회귀 안전망
- [ ] 각 phase 의 PR 은 *해당 카테고리만* 다루고 다른 카테고리는 건드리지 않는다 — 충돌 시 즉시 롤백 가능
- [ ] Phase 별 PR 머지 후 dev 환경에서 사용자 1회 confirm 후 다음 phase 진입

## Constraints

- **외부 grid 라이브러리 도입 금지** — Path B 결정 (Glide / AG Grid / MUI X / Handsontable 모두 검토 후 탈락). 가상화용 react-window / react-virtual 은 허용 (renderer-agnostic, shadcn DOM 그대로 사용).
- **shadcn / Tailwind 디자인 토큰 유지** — `#1C7F59` 그린 / `#22322B` 본문 / `#F6F9F7` 헤더 / sticky 첫 컬럼 / radius 등 기존 ModelDetailPanel·shadcn `<Table>` 토큰 매칭.
- **React 19.2 / Vite 7.3 / Tailwind 4.2 / radix-ui (shadcn) 환경** 그대로 — peer 충돌 가능성 있는 라이브러리는 사용 전 `npm view ... peerDependencies` 검증.
- **TanStack Query 데이터 흐름 변경 금지** — 각 페이지의 hook (`useDeployHistoryList` 등) 은 그대로, 표시 레이어만 교체.
- **picker / editor 모달 (DcopItemPickerModal, ActionDataIndexEditorModal, FlowFilterEditorModal) 은 손대지 않는다** — Out of Scope.
- **체크박스 row select / pagination / 가로 스크롤 영역 외부 컨트롤** 등 페이지별 외부 UI 는 보존 — SelectableTable 은 표만 책임.

## Acceptance Criteria

각 기준은 **기계 검증 가능**해야 한다. Phase 별 PR 머지 직전 자동 PASS 확인.

### 전체 (모든 phase 공통)

- `cd nori-tc-ui-front && npx tsc -b` PASS (사전 존재 AppProvider.tsx 의 query-core 중복 에러는 별 SPEC 영역 — 제외)
- `cd nori-tc-ui-front && npm run lint` PASS (eslint 에러 변경 파일 0건; 사전 존재 deploy / group 2건은 별 영역)
- 변경된 파일에 한해 새 ESLint warning 0
- `cd nori-tc-ui-front && npx vite build` PASS (bundle 빌드 회귀 없음)
- 페이지별 기존 Playwright e2e (`tests/`) 회귀 PASS
- **신규 / 변경 Playwright e2e 의 `page.on('console', msg => msg.type() === 'error')` 및 `page.on('pageerror', ...)` error level 메시지 0건** (글로벌 CLAUDE.md 14번 — assertion 통과 + console.error/pageerror 0 모두 동시 충족만 PASS). 각 e2e test 마지막에 `expect(consoleBucket.errors).toEqual([])` 명시

### R1 — 제네릭 추출

- [ ] `src/shared/components/SelectableTable/index.ts` 가 `SelectableTable`, `ColumnDef`, `SelectableTableFeatures` export
- [ ] `src/features/model/components/SelectableModelDetailTable.tsx` 는 새 컴포넌트의 thin wrapper 로 축소 (또는 삭제 + ModelDetailPanel 이 SelectableTable 직접 사용)
- [ ] **Playwright e2e** `tests/e2e/selectable-table-model-parameter.spec.ts` — 사각형 선택 → Ctrl+C → 클립보드에 TSV 형식 (행 \n, 셀 \t) 일치 / Excel TSV → Ctrl+V → 셀들 onChangeDetailValue 호출 확인

### R2 — 단순 read-only

각 카테고리 대표 1 파일에 대해 단일 e2e + console.error/pageerror 0 명시. 다른 파일은 회귀 e2e PASS 로 검증.

- [ ] DLQ 대표 `BusinessDlqPanel` — 2x2 영역 Ctrl+C → 클립보드 TSV (행=`\n`, 셀=`\t`, 4 셀 fixture 정합) (Playwright e2e + console.error/pageerror 0)
- [ ] Deploy 대표 `DeployMonitorPanel` — 2x2 영역 Ctrl+C → 클립보드 TSV (Playwright e2e + console.error/pageerror 0)
- [ ] EQP 대표 `EqpInfoTable` — 2x2 영역 Ctrl+C → 클립보드 TSV (Playwright e2e + console.error/pageerror 0)
- [ ] DLQ 5 패널 (`DashboardPanel` / `RepairTaskPanel` / `QuarantinePanel` / `GatewayDlqPanel` / `BusinessDlqPanel`) 기존 액션 (재시도 / 격리 해제) 회귀 없음 — 기존 e2e PASS
- [ ] `DeployMonitorPanel` 기존 액션 (deploy 액션 / 모니터 액션) 회귀 없음 — 기존 e2e PASS
- [ ] EQP 4 종 (`EqpInfoTable` / `EqpParamTable` / `BusinessGroupModelTable` / `GatewayGroupTable`) 기존 액션 회귀 없음 — 기존 e2e PASS

### R3.1 — ModelDetailPanel 8 노드 마이그레이션

- [~] 부분 — ModelDetailPanel 의 9 개 detail node 각각에서 range copy 동작 — Playwright e2e 1개 (대표 노드 `socket-message` 또는 `workflow`). 충족: `dcop-itemes` 로 대체 검증 (`tests/e2e/selectable-table-model-workflow.spec.ts` `R3-AC-1` 2x2 range copy → TSV PASS) + `R3-AC-6` (7 노드 testId 노출 PASS) + `R3-AC-1` / `R3-AC-3` 에 console.error/pageerror 0 assertion 통과. 미충족: SPEC 이 명시한 대표 노드 `workflow` / `socket-message` 자연 e2e 진입 — `workflow` 는 dead path (사이드바 진입 불가, git 80605b4 — C1 결정 (c) 보존), `socket-message` 는 reference 사이드바 진입 가능하나 본 e2e 에 별도 케이스 미추가 (createGenericInputColumns 공유 경로라 dcop-itemes / model-parameter 가 같은 factory 패턴 검증).
- [~] 부분 — picker / select / flow modal 셀 클릭 → 기존 모달 / dropdown 동작 회귀 0 (drag 와 click 충돌 없음). 충족: `R3-AC-3` (dcop-itemes EventId dropdown) PASS + console.error 0. 미충족: workflow 노드의 modal trigger / Message Name select / Flow Name 중복 always-edit Input — dead path 라 e2e 자연 진입 불가. 코드 인스펙션으로만 검증 (`createWorkflowColumns` modal column `editable: false` — drag↔modal 충돌 차단).

### R3.2 — ModelCheckInDiffModal / ParentModelCommitModal (별 PR — R3 범위 외)

- [ ] `ModelCheckInDiffModal` — diff 색상 cell renderer (추가/삭제/수정 행별 background) 유지 + 2x2 영역 range copy → 클립보드 TSV (Playwright e2e + console.error/pageerror 0). 별 PR
- [ ] `ParentModelCommitModal` — diff 색상 cell renderer 유지 + 2x2 영역 range copy → 클립보드 TSV (Playwright e2e + console.error/pageerror 0). 별 PR

### R4 — 행 클릭 → 더블클릭 전환

3 파일 각각 명시적 e2e + console.error 0. UX 변경이라 회귀 면적 큼 — 파일별 검증 강제.

- [ ] `ModelInfoTable` — 단일 클릭 시 셀 anchor 지정 + 더블클릭 시 행 열기 동작 (Playwright e2e + console.error/pageerror 0)
- [ ] `UserListTable` — 단일 클릭 시 셀 anchor 지정 + 더블클릭 시 행 열기 동작 (Playwright e2e + console.error/pageerror 0)
- [ ] `GroupListTable` — 단일 클릭 시 셀 anchor 지정 + 더블클릭 시 행 열기 동작 (Playwright e2e + console.error/pageerror 0)
- [ ] 기존 단일 클릭으로 행 열기를 가정한 e2e 가 있으면 더블클릭으로 업데이트 (파일별 변경 명시)

### R5 — 복잡 편집 (의사결정 산출물)

각 파일별 별 sub-AC. 결정은 "전환" 또는 "보존" 둘 중 하나 — 결정 시점 / 검토자 / 근거 모두 SPEC Validate 단계에서 명시.

- [ ] `DeployRegisterPanel` — 전환 결정 시: Playwright e2e + console.error/pageerror 0. 보존 결정 시: 결정 사유 + 검토 일자 + 결정자 SPEC Validate 섹션에 명시
- [ ] `LiveMapDemoModal` — 전환 결정 시: Playwright e2e + console.error/pageerror 0. 보존 결정 시: 결정 사유 + 검토 일자 + 결정자 SPEC Validate 섹션에 명시
- [ ] `FlowCard` — 전환 결정 시: Playwright e2e + console.error/pageerror 0. 보존 결정 시: 결정 사유 + 검토 일자 + 결정자 SPEC Validate 섹션에 명시
- [ ] `CheckInModal` — 전환 결정 시: Playwright e2e + console.error/pageerror 0. 보존 결정 시: 결정 사유 + 검토 일자 + 결정자 SPEC Validate 섹션에 명시

### R6 — 가상화 / 정렬 / 리사이즈

- [ ] 가상화 라이브러리 1차 PoC 결과 (`react-window` vs `@tanstack/react-virtual`) — 선택 라이브러리 + 근거 + peer dependency 검증 결과 SPEC update commit
- [ ] `SelectableTable` 의 `features.virtualization` 활성 시 1,000 행 렌더 후 스크롤 60fps 유지 — Playwright trace 측정 (마지막 5~10줄 인용 + 60fps 평균값 명시)
- [ ] header 클릭 → 정렬 토글 (asc → desc → off 3 단계) 동작 (Playwright e2e + console.error/pageerror 0)
- [ ] header 우측 경계 drag → 컬럼 width 변경 동작 (Playwright e2e + console.error/pageerror 0)

## Out of Scope

- **picker / editor 모달**: `DcopItemPickerModal`, `ActionDataIndexEditorModal`, `FlowFilterEditorModal` — 셀 영역 선택 UX 가 의미 없는 선택용 / 구조화 편집 UI. 별 SPEC 으로도 다루지 않음.
- **컬럼 필터** — 페이지별 필터 입력창이 이미 있어 grid-level 필터 도입 시 UX 중복. 후속 SPEC 후보.
- **컬럼 그룹화 / 집계 / pivot** — Excel 의 고급 기능. 이 SPEC 에서는 일반 표만.
- **테마 변경 (dark mode)** — 별 작업.
- **CSV / XLSX export 버튼** — 클립보드 paste 가 동일 효과를 제공 (Excel 에서 paste 후 .xlsx 저장).
- **모바일 / 터치 UX** — 데스크탑 기준. 터치 환경 range select 는 별 SPEC.
- **backend 변경** — 본 SPEC 은 UI-only.
- **row 선택 체크박스 / bulk action** — 기존 페이지에 있으면 보존, 신규 도입은 별 SPEC.

## SDD 진행 상태

전체 SPEC 은 phase R1~R7 다단계라 [x] / [ ] 는 phase 단위로 표기한다. 현재는 R3.1 한정 사이클 완료.

- [x] **Specify (R1~R7 전체)** — 이 SPEC.md 작성 완료 (2026-05-23)
- [x] **Plan (R3.1 한정)** — R3.1 Plan 확정 (2026-05-26, `.claude/progress/selectable-table-rollout-r3.md`). R1 / R2 / R3.2 / R4 / R5 / R6 / R7 미수행.
- [x] **Implement (R3.1 한정)** — ModelDetailPanel 8 노드 마이그레이션 완료 (2026-05-26). R3.2 (ModelCheckInDiffModal) + 후속 Phase 미진행.
- [~] **Validate (R3.1 한정, 부분)** — R3.1 Validate 완료 (2026-05-26, `.claude/progress/selectable-table-rollout-r3-validate.md`). 충족: e2e 3 PASS + console.error 0 + tsc / vite build / lint PASS (변경 파일 한정). 미충족: workflow 자연 e2e 진입 (dead path — 코드 인스펙션 보완), `socket-message` 자연 e2e 케이스 미추가. R3.2 (ModelCheckInDiffModal) 별 PR 보류.
