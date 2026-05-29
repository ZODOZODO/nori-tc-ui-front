# PLAN — nori-client-forked 자매품화 (ui-front 화면 재구성)

> 작성일: 2026-05-29
> 단계: **Plan** (SDD 2/4) — 입력: `.claude/specs/nori-client-forked-migration.md`
> 대상 레포: `nori-tc-ui-front` 단일 (backend / nori-client-forked 변경 없음)
> 산출물: 본 파일 — 다음 단계(Implement) 의 명시 입력

## 0. 계획 원칙 (절대 준수)

- **처음 진행하는 작업으로 간주** — 이전 시도/기존 구현 비교·언급 금지. 현재 코드는 *출발점 캔버스*. 같은 이름의 파일이 있어도 "이전 작업"이 아니라 SPEC 기준으로 작성/대체할 *현재 자산*.
- **SURGICAL 정합** — 출발점 파일이 SPEC 기준에 이미 부합하면 보존, 미달 부분만 작성/보강. SPEC 과 무관한 인접 코드/포맷 개선 금지. (글로벌 룰 #4)
- **틀=forked 구조 / 내용=ui-front / 색=ui-front coral** — forked 의 *화면 구성 패턴*만 차용. 렌더값(slate/blue) 차용 금지. 색은 ui-front coral 토큰.
- **회귀 0 우선** — 각 phase 는 layout 재배치/시각만. 라우팅/API/TanStack Query hook/Zustand store/기능 위젯 prop·state 변경 금지 (R6).

### 확정 결정 (본 Plan 세션 — 2026-05-29)

- **D-GRID-ENGINE (확정)** — **SelectableTable 엔진 유지 + 시각만 현대화**. `@tanstack/react-table` 도입 안 함.
  - 근거 (검증 매트릭스): *무료 + React 19 + Excel 다중 행·열 range copy/paste + shadcn/Tailwind/coral DOM 디자인* 4개를 동시 충족하는 기성 grid 없음. range copy/paste 보유 grid 는 전부 유료(AG Grid Enterprise / MUI X Premium / Handsontable); 무료인 것은 range copy/paste 부재(react-table, MUI free, AG Community, react-data-grid v7) 또는 디자인·React19 포기(Glide=canvas, peer 최대 18.x).
  - SelectableTable 은 이미 rectangular range TSV copy/paste 보유 ([SelectableTable.tsx:67-95](../../src/shared/components/SelectableTable/SelectableTable.tsx#L67-L95)) + 정렬/resize/가상화/sticky/inline-edit + shadcn `<Table>` + coral 토큰 직결.
  - **영향**: SPEC AC R3 의 `@tanstack/react-table peerDependencies 인용` 항목은 본 결정으로 **무효(N/A)**. → §6 에 SPEC owner 결정 필요로 기록. recharts 는 그대로 도입(DeployPage).

## 1. 영향 파일 인벤토리 (출발점 캔버스)

### R1 — layout shell (`src/shared/layout/`)
| 파일 | SPEC R1 매핑 |
|---|---|
| `PageHeading.tsx` | 리스트 페이지 헤더 (제목/설명/총건수 pill/액션 슬롯) |
| `PageHeadingWithActions.tsx` | 헤더 우측 액션 변형 |
| `PageActionBar.tsx` | 공통 버튼그룹/액션바 |
| `PageLocation.tsx` | breadcrumb (forked header_subtitle 인상) |
| `PageModal.tsx` | 공통 모달 (radix `dialog.tsx` primitive 위) |
| `PageLayoutShell.tsx` | 페이지 콘텐츠 영역 shell (신규 wrapper, AppPageShell 자식) |
| `sidebar-layout.ts` | 사이드바 폭 상수 + `clampSidebarWidth` |
| (신규 가능) 필터/검색 바 + 페이지네이션 컴포넌트 | forked `list_pagination.jsx` 인상 — `src/shared/layout/` 에 작성 |
| (신규 가능) 대시보드 카드 섹션 컴포넌트 | forked `_dashboard.scss` 인상 |
| (신규 가능) 푸터 컴포넌트 | forked `footer.jsx` 인상 |

- radix primitive: `src/components/ui/dialog.tsx` — **확장만, 대체 금지** (R1).
- 데이터 테이블 시각 언어 입힐 대상: `src/shared/components/SelectableTable/SelectableTable.tsx` (엔진 보존, className/토큰만).
- DEV fixture 라우트: `/__fixtures/layout-shell`, `/__fixtures/selectable-table` (`src/app/Router.tsx`) — AC R1 수동 시각 confirm 진입점.

### R2 — 토큰 (`src/index.css`)
| 토큰 | 현재 상태 | R2 작업 |
|---|---|---|
| `--font-ui` | `'Pretendard', system-ui, sans-serif` | 유지/확정 (AC R2) |
| `--brand-primary/accent` | `oklch(0.62 0.16 36)` coral #d95d39 | 유지 (blue 차용 금지) |
| `--shadow-soft-{sm,md,lg}` | 존재 | 다단 soft shadow 일관 확인/확장 |
| `--motion-duration-*`, `--motion-ease-out` | 존재 | micro-interaction 일관 |
| `--radius-*` | 존재 | radius tier 확인 |
| `--leading-*` | 존재 | 헤딩 타이포 재해석 보조 |
| `--tracking-tight` | 존재 (`-0.01em`, index.css:14) | 보존 — 헤딩 letter-spacing 적용 확인 |
| pill 태그 토큰 | **부재 (grep 확인)** | **신규 정의** — 총건수 pill 일관 |
| status semantic (success/warning/danger/info) | 존재 (index.css:125-133, info blue 제거 + danger coral 과 hue 분리 완료) | 보존 — 미달 시만 미세조정 |
| `.dark` 토큰 | 존재 | **유지하되 갱신 OoS** — 변경 안 함 |

### R3 — 라이브러리 (`package.json`)
- `recharts@^3` — **미설치**. DeployPage 차트 phase 에서만 도입. (`recharts@3.8.1` peer `react ^19.0.0` 확인 — 2026-05-24 modified)
- `@tanstack/react-virtual@^3.13.26` — **이미 설치** (SelectableTable 가상화에 사용 중).
- `@tanstack/react-table` — **도입 안 함** (D-GRID-ENGINE).
- 선 도입 금지: 라이브러리는 첫 사용 phase 에서만 추가. 추가 시 `npm view <pkg> peerDependencies` + `npm install` 마지막 5~10줄 commit 인용.

### R4 — 내비게이션 + 사이드바
- `src/shared/components/AppTopBar.tsx` — **로직 diff 0** (AC R4). 시각 토큰 className 만.
- `src/shared/lib/app-navigation.ts` (`navigationItems` / `resolveVisibleAppNavigationItems` / prefetch) — **변경 금지**.
- `src/shared/components/AppPageShell.tsx` — topbar + content offset wrapper. shell 이 topbar→sidebar 구조를 감싸되 끊지 않음.
- `src/components/ui/sidebar-resize-handle.tsx` — 폭 드래그 핸들 (R4.2).
- `src/shared/stores/shared-layout.store.ts` — Zustand + localStorage persist (폭/collapse 상태). R4.2 흡수 대상 백엔드.
- 도메인 사이드바 5종: `EqpSidebar` / `ModelSidebar` / `DeploySidebar` / `DlqSidebar` / `UserManagementSidebar`.

### R5 — 7 라우트 (`src/app/Router.tsx`)
| 라우트 | 페이지 | 사이드바 | 주요 콘텐츠 위젯 | 모달 |
|---|---|---|---|---|
| `/login` | `features/auth/components/LoginPage.tsx` | 없음 | id/pw form | RecoveryModal |
| `/eqp` | `features/eqp/components/EqpPage.tsx` | EqpSidebar | EqpInfoTable / EqpParamTable / GatewayGroupTable / BusinessGroupModelTable | CheckInModal / EqpManageFormModal / EqpModelBindingModal + confirm/result dialogs |
| `/model` | `features/model/components/ModelPage.tsx` | ModelSidebar | ModelInfoTable / ModelDetailPanel(2007 LOC) | ModelCheckInModal 외 다수 |
| `/deploy` | `features/deploy/components/DeployPage.tsx` | DeploySidebar(mode) | DeployRegisterPanel / DeployMonitorPanel / DeployHistoryPanel | — |
| `/dlq` | `features/dlq/components/DlqPage.tsx` | DlqSidebar(mode) | Dashboard/Gateway/Business/Quarantine/RepairTask Panel | — |
| `/user` | `features/user-management/components/UserManagementPage.tsx` | UserManagementSidebar(mode) | UserListTable / GroupListTable | UserUpsertModal / GroupUpsertModal / GroupAddMembersModal 외 |
| `/eqp/live-map` | `features/live-map/components/LiveMapPage.tsx` | 없음 | LiveMapBoard | LiveMapDemoModal |

### 회귀 안전망 (`tests/e2e/`)
- 페이지: `login-page.smoke`, `model-flow`, `dlq-page`, `group-page`, `user-page`
- SelectableTable 관련 14건: `selectable-table-*` (check-in / gateway-group / deploy-monitor / dlq-business / group-list / model-check-in-diff / model-info / model-parameter / model-workflow / parent-model-commit / user-list / virtual / resize / sort)
- 기타: `socket-message-layout`, `deploy-register-selection`
- 명령: `npm run build` (`tsc -b && vite build`) / `npm run lint` (`eslint .`) / `npm run test:e2e` (playwright) / `npm run test:unit`

## 2. 단계별 실행 계획

> 전체 단일 branch (`docs/nori-client-forked-migration` 현재) 에서 phase 별 단일 commit. **phase 별 PR/MR 금지** — SPEC 전체 완료 후 단일 branch → main 일괄 통합 (Constraints).

### Phase 0 — Baseline
- 목표: 출발점 green 확정 + 변경 전 스크린샷 확보.
- 작업: `npm install` → `npm run build` → `npm run lint` → `npm run test:e2e` 전부 PASS 확인 + 출력 마지막 5~10줄 기록. 7 라우트 dev 스크린샷을 `.claude/specs/screenshots/before/` 에 저장.
- 검증: 4개 명령 PASS. 미 PASS 면 Implement 진입 전 사용자 보고 (회귀 기준선이 깨진 상태로 시작 불가).
- commit: 없음 (측정만). 스크린샷만 별도 commit 가능.

### Phase R1 — layout shell (commit 1)
- 목표: forked 구조 패턴의 ui-front 버전을 `src/shared/layout/` 에 SPEC 기준으로 확정 + AppTopBar/AppPageShell 글로벌 chrome 시각 정합.
- 영향 파일: `src/shared/layout/*` (인벤토리 R1), `src/components/ui/dialog.tsx`(확장만), `src/shared/components/SelectableTable/SelectableTable.tsx`(시각 className/토큰만), `AppTopBar.tsx`/`AppPageShell.tsx`(시각 토큰만 — AppTopBar 로직 diff 0), `src/app/Router.tsx`(fixture 라우트).
- 작업:
  1. `PageHeading` / `PageHeadingWithActions` / `PageActionBar` / `PageLocation` / `PageModal` / `PageLayoutShell` 를 SPEC R1 항목에 1:1 대조 → 미달 부분 보강. 부합 부분 보존.
  2. 필터바+페이지네이션 / 대시보드 카드 / 푸터 컴포넌트가 SPEC R1 기준 미존재면 신규 작성.
  3. SelectableTable 에 forked `data_table` 시각 언어(줄간색/hover/sticky header/정렬 아이콘/셀 정렬) 입힘 — **엔진/동작/prop 불변**, className·토큰만.
  4. `dialog.tsx` 는 확장만. `PageModal` 이 그 위에서 header+body+footer CTA 우측.
  5. fixture 라우트(`/__fixtures/layout-shell`)에서 헤더/필터/페이지네이션/테이블/모달/카드 변형 렌더 (수동 시각 confirm — AC R1).
- 검증: `npm run build` 0 errors / `eslint .` 0 (변경 파일) / `npm run test:e2e` 회귀 0 (특히 SelectableTable 14건). AC R1 두 체크박스.
- 위험: SelectableTable className 변경이 e2e selector(testId/data-state) 를 깨뜨릴 수 있음 → testId·data-* 속성 보존 필수.

### Phase R2 — 토큰 (commit 2)
- 목표: forked slate 계층 구조를 ui-front oklch neutral 로 매핑 + coral 액센트 유지 + 신규 토큰(tracking-tight/pill/status) 일관 정의.
- 영향 파일: `src/index.css` (단일).
- 작업:
  1. `--font-ui` Pretendard 확정 (AC R2).
  2. neutral 계층(배경/카드/보더/본문/muted)을 oklch 로 정합. **blue-600 차용 금지, coral 유지.**
  3. `--tracking-tight` 신규 + 헤딩 weight 700→600 재해석.
  4. pill / soft shadow 다단 / radius tier / focus ring / motion duration 토큰 일관 확정.
  5. status semantic(success/warning/danger/info) oklch 매핑 — coral 과 hue 분리.
  6. `.dark` 토큰은 **건드리지 않음** (갱신 OoS).
- 검증: `npm run build` PASS. `git grep -nE "bg-brand-(primary|accent)|text-brand-(primary|accent)|border-brand-(primary|accent)" src/` (R5 누적으로 ≥5 충족 — R2 시점엔 토큰 정의 확인). AC R2 `--font-ui` Pretendard 포함.
- 위험: neutral 매핑이 기존 컴포넌트 대비를 떨어뜨릴 수 있음 → contrast 4.5:1+ 수동 확인.

### Phase R3 — 라이브러리 게이트 (독립 commit 아님 — 사용 phase 에 흡수)
- `recharts` 는 **DeployPage phase 에서만** `npm install`. 그 commit 메시지에 `npm view recharts peerDependencies` + install 마지막 5~10줄 인용 (AC R3 recharts).
- `@tanstack/react-table` 도입 없음 (D-GRID-ENGINE) → 해당 AC 는 §6 결정 대상.

### Phase R5 — 페이지별 (commit 3~8, 각 단일 페이지)

> R1+R2 commit 후 진입 (R5 전제). 권장 순서 = 위험 오름차순. R4.2(사이드바 폭 드래그+collapse 흡수)는 각 페이지 사이드바에 해당 phase 에서 같이 적용.

| # | phase | 페이지 | forked 인상 | R4.2 사이드바 | recharts |
|---|---|---|---|---|---|
| 3 | R5-login | LoginPage | login_new 중앙 카드 | — | — |
| 4 | R5-eqp | EqpPage | 리스트(헤더+필터+테이블+모달) | EqpSidebar resize+collapse | — |
| 5 | R5-user | UserManagementPage | 폼 페이지 + 모달 | UserManagementSidebar | — |
| 6 | R5-dlq | DlqPage | 리스트 + 공통 모달 | DlqSidebar | — |
| 7 | R5-model | ModelPage | 상세(좌 list/우 detail) | ModelSidebar | — |
| 8 | R5-deploy | DeployPage | 대시보드 카드 grid | DeploySidebar | **recharts 도입** |
| — | (보류) | LiveMapPage | D-LIVEMAP 미확정 | — | — |

- 순서 근거: Login(사이드바 없음·최소 위험, shell+토큰 실페이지 검증) → Eqp(첫 도메인 사이드바 R4.2 검증) → User/Dlq(리스트·폼) → Model(ModelDetailPanel 2007 LOC, 최대 복잡) → Deploy(recharts 신규 의존, 마지막). LiveMap 은 **본 Plan 활성 범위 밖** — 사용자 이미지 제공 시 별도.
- 각 phase 작업: 해당 페이지를 `PageLayoutShell` + R1 컴포넌트로 재배치. 도메인 사이드바를 shell 좌측 slot 에 두고 R4.2 동작(폭 드래그 `sidebar-resize-handle` + collapse 토글, localStorage persist via `shared-layout.store`) 적용. 콘텐츠 위젯/모달/SelectableTable 는 **prop·state·API 불변**, 위치만 재배치.
- 각 phase 검증: 해당 페이지 e2e PASS (회귀 0) + `npm run build` + `eslint .`(변경 파일). commit 메시지에 변경 전/후 스크린샷 경로 + 측정 마지막 5~10줄 (AC R5).

### Phase 최종 — 통합 검증
- 목표: SPEC 전체 AC 매트릭스 통과.
- 작업: 전체 `npm install` / `npm run build` / `npm run lint` / `npm run test:e2e` PASS + `git grep -nE "tui-grid|tui-chart|tui-date-picker|reactstrap|bootstrap/dist" src/` → 0 hits. brand 토큰 grep ≥5.
- 검증: AC 전체 §5.

## 3. 위험 + 완화

| 위험 | 영향 | 완화 |
|---|---|---|
| SelectableTable 시각 변경이 e2e selector 파손 | 14 e2e 회귀 | testId/data-row-idx/data-col-idx/data-state/data-col-key 속성 **불변 보존**. className 만 변경. phase R1 직후 14건 재실행. |
| AppTopBar 시각 토큰 변경이 로직 diff 유발 | AC R4 위반 | `app-navigation.ts` 미변경. AppTopBar 는 className 치환만. commit 전 `git diff AppTopBar.tsx` 로 로직 라인 0 확인. |
| neutral 토큰 매핑이 대비/가독성 저하 | 시각 회귀 | contrast 4.5:1+ 수동 확인. `.dark` 미변경으로 다크 회귀 차단. |
| recharts peer 충돌 | install 실패 | recharts 3.8.1 peer `react ^19.0.0` 사전 확인 완료. install 시 `--save` 후 build 재확인. |
| ModelPage(2007 LOC) 재배치 중 콘텐츠 위젯 prop 변경 | 기능 회귀 | 위젯은 위치만 이동, prop/state/import 동결. model-flow + selectable-table-model-* e2e 5건 회귀 게이트. |
| cross-page 오염 (한 phase 가 타 페이지 변경) | Constraints 위반 | phase 별 단일 페이지 commit. `git diff --stat` 으로 변경 파일이 해당 feature 디렉터리 + shared(R1/R2 한정)인지 확인. |
| 출발점 파일을 "재작성"하다 부합 코드까지 변경 | SURGICAL 위반 | SPEC 항목 1:1 대조 후 미달 부분만. 부합 부분 보존. |

## 4. 롤백 방법

- **phase 단위 격리**: 각 phase = 단일 commit. 회귀 발견 시 `git revert <phase-commit>` 로 해당 phase 만 되돌림 (이전 phase 보존).
- **branch 격리**: 전체 작업이 `docs/nori-client-forked-migration` 단일 branch. main 미통합 상태라 main 영향 0. 전체 폐기 시 branch 삭제.
- **토큰 롤백**: R2 는 `src/index.css` 단일 파일 → 해당 commit revert 로 즉시 원복. (`.dark` 미변경이라 다크 부수효과 없음.)
- **라이브러리 롤백**: recharts 도입 commit revert + `npm install` (package-lock 동기).
- **e2e 게이트**: 각 phase commit 전 회귀 0 확인 → 회귀 있으면 commit 안 함(미커밋 변경은 `git restore` 로 폐기).

## 5. AC ↔ Phase Traceability

| SPEC AC | Phase | 검증 명령/방법 |
|---|---|---|
| 전체: `npm install` PASS | Phase 0 / 최종 | `npm install` |
| 전체: `npm run build` PASS | 모든 phase | `tsc -b && vite build` |
| 전체: `npm run lint` PASS | 모든 phase | `eslint .` |
| 전체: `npm run test:e2e` 회귀 0 | 모든 phase | `playwright test` |
| 전체: 레거시 grep 0 hits | 최종 | `git grep -nE "tui-grid\|..."` |
| R1: `PageLayoutShell.tsx` + import 페이지 ≥1 | R1 + R5 누적 | 파일 존재 + import grep |
| R1: fixture 라우트 변형 렌더 | R1 | `/__fixtures/layout-shell` 수동 confirm |
| R2: `--font-ui` Pretendard 포함 | R2 | `git grep --font-ui src/index.css` |
| R2: brand 토큰 grep ≥5 | R5 누적 | `git grep -nE "bg-brand-..."` |
| R3: recharts peer 인용 | R5-deploy | `npm view recharts peerDependencies` commit 인용 |
| R3: react-table peer 인용 | **§6 결정 필요** | D-GRID-ENGINE 으로 N/A |
| R4: AppTopBar 로직 diff 0 | R1 | `git diff` 로 로직 라인 0 |
| R4: topbar→sidebar e2e 회귀 0 | R5 각 페이지 | 도메인별 e2e |
| R5: phase commit 스크린샷 경로 | R5 각 | commit 메시지 |
| R5: 페이지 e2e PASS | R5 각 | 해당 e2e |

## 6. SPEC owner 결정 필요 (Implement 전)

- **AC R3 `@tanstack/react-table peerDependencies 인용` 항목**: D-GRID-ENGINE(SelectableTable 유지) 결정으로 react-table 미도입 → 이 AC 충족 불가.
  - 권장: 해당 AC 라인을 SPEC 에서 **N/A 처리** (사유: 검증 결과 무료+React19+range copy/paste+shadcn 디자인 동시 충족 grid 부재, SelectableTable 자체 구현이 유일 해법). recharts AC 는 유지.
  - 이 처리는 SPEC 본문 수정이므로 Validate 단계 또는 사용자 승인 후 반영.

## 7. 다음 단계 진입 프롬프트 (Implement)

```
@.claude/specs/nori-client-forked-migration.md @.claude/specs/nori-client-forked-migration-plan.md 둘 다 읽고 구현.
이 작업은 처음 진행하는 것이다. 이전 시도/기존 구현 비교·언급 금지 — 현재 코드는 출발점 캔버스, SPEC+Plan 만 기준.
순서 엄수: Phase 0(baseline) → R1(shell) → R2(토큰) → R5(login→eqp→user→dlq→model→deploy). LiveMap 보류.
D-GRID-ENGINE 엄수: SelectableTable 엔진/동작/prop 불변, 시각 className·토큰만. @tanstack/react-table 도입 금지. recharts 는 deploy phase 에서만.
각 AC 검증 명령 PASS + 출력 마지막 5~10줄 인용. phase 별 단일 commit, PR/MR 금지.
산출물: .claude/specs/nori-client-forked-migration-dev-report.md 에 변경 파일/테스트 결과/결정 기록.
```
