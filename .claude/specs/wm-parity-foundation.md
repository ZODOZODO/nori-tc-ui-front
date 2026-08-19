# SPEC: wm-parity-foundation — 공통 컴포넌트/피드백/API 기반 정비

> nori-wm-ui-front 수준으로 개선하는 wm-parity 트랙의 1/2 (Foundation).
> 2/2 는 `wm-parity-sidebar.md` (전역 LNB 전환) — 본 SPEC 완료가 선행 조건.
> 전 수치는 2026-08-18 실측 (분석 세션에서 Grep/wc 로 직접 검증).

## Why

사용자 목표: nori-tc-ui-front 를 nori-wm-ui-front 처럼 개선 — "테이블/버튼 같이 공통으로
모두 사용해야 하는 것들의 공통화". 실측 결과 테이블 축은 완료(raw `<table>` 0건,
SelectableTable 25건/21파일)이나 아래가 미완:

- raw `<button>` **80건/22파일** (공용 `<Button>` 96건/35파일과 병존 — src/features,
  `<Button[\s/>]` 패턴 재실측. live-map 47건 집중)
- raw `<select>` **15건/6파일** — `modelDetailColumnDefs.tsx:313,336,440,462,592` 에
  동일 className 문자열 5회 완전 중복
- raw `<input type="checkbox">` **10건/8파일** — 공용 컴포넌트 부재가 원인
- 토스트/알림 시스템 **0** → 모달별 로컬 `setErrorMessage` 반복 7파일/39회
- API scaffolding 대량 복제: `resolveSuccessPayload` **11파일** 정의,
  `normalize<도메인>Error` 8곳 + plain `normalizeError` 5곳(dlq/line/live-map 계열),
  `issueCsrfToken` 재정의 9파일(전부 shared/lib/csrf.ts 의 requestCsrfCookie +
  readCsrfCookieToken 을 조합하는 동일 로직의 복제 — csrf.ts 자체에는 issueCsrfToken
  정의가 없음, csrf.ts:32,:37 실측),
  `withCsrfHeaders` 6파일, `*ApiError` 클래스 6종, `isApiResponse` 6곳.
  근원: `shared/lib/api-client.ts` 가 29줄(언래핑/에러 정규화 없음)
- `ApiResponse`/`isApiResponse` 를 **12파일**이 `@/features/auth/types/auth.types` 에서
  cross-feature import (auth.types 가 사실상 shared — 2026-08-18 재실측. model.api/
  model-flow.api 는 직접 import 가 아니라 model.types 경유 간접 참조)
- 죽은 코드 6파일 446 LOC + 미사용 의존성 recharts
  (S09 감사 `refactor-audit-nori-tc-ui-front.md` §1.2-1.3 — 4곳+동적참조 검증 HIGH,
  2026-08-18 재실측 동일)

wm 레포에 검증된 해법이 이미 존재하므로 역이식이 원칙 (신규 발명 최소화).

## 확정된 사용자 결정 (2026-08-18)

- **결정 1**: SelectableTable 은 tc 자체 구현 유지 + wm 의 `isLoading`/`skeletonRowCount`
  백포트 (wm `SelectableTable.tsx:44-52`). `actionColumn.compact` 는 필요 시.
  @tanstack/react-table 교체 안 함.
- **결정 2**: 죽은 코드 6파일 + recharts 제거. LiveMapToolbar 포함 **제거 + 통합 계획
  폐기** (인터뷰 확정) — 계획 문서 정정 동반.
- **버튼 수렴은 단계 목표**: 본 SPEC 에서 도메인 사이드바 5파일(18건) **외** raw
  `<button>` 0건 (80→≤18). 사이드바 5파일분은 wm-parity-sidebar 에서 구조 대체로 해소.
- **공용 Checkbox 신설**: radix-ui 기반 `components/ui/checkbox.tsx`. wm 에는 없는
  tc 고유 추가임을 명시 (wm components/ui 18파일 실측 — checkbox 부재, switch 만 존재).

## Requirements

- [ ] R1. **API scaffolding shared 승격**: `ApiResponse`/`isApiResponse`/
      `resolveSuccessPayload`/`normalizeApiError`/공통 `ApiError`/`withCsrfHeaders` 를
      shared 레이어 단일 정의로 승격, feature 로컬 사본 전부 제거.
      `issueCsrfToken` 은 `shared/lib/csrf.ts` 에 공용 정의를 **신설**해 일원화 —
      csrf.ts 에는 현재 `requestCsrfCookie`/`readCsrfCookieToken` 만 있다(:32,:37 실측).
      공용 정의는 "요청 → 쿠키 읽기 → 미존재 시 공통 ApiError(CSRF_TOKEN_MISSING) throw"
      (로컬 9파일이 전부 이 동일 로직). 로컬 재정의 9파일 전부 제거하되,
      auth.api.ts:83 의 변형 시그니처 `issueCsrfToken(purpose)`(purpose 별 에러 정규화)는
      공용 정의 호출부의 try/catch(normalizeAuthError)로 이동 — auth 에도
      `issueCsrfToken =` 로컬 정의를 남기지 않는다(AC8 이 1파일을 강제).
      dlq/line/live-map 계열의 패턴 3분화(plain Error / 단순 시그니처)도 단일 패턴으로 통일.
- [ ] R2. **auth.types cross-feature import 해소**: `@/features/auth/types/auth.types` 를
      직접 import 하는 **12파일** 전부를 R1 의 shared 정의로 전환 (2026-08-18 재실측 —
      가져가는 심볼은 전부 ApiResponse/isApiResponse 뿐):
      deploy.api.ts:3, live-map-demo-run.api.ts:3, live-map.api.ts:3, layout.api.ts:2,
      comm-log.api.ts:3, line.api.ts:2, group.types.ts:2, user.types.ts:2, eqp.types.ts:1,
      profile.types.ts:1, model.types.ts:2, deploy.types.ts:1.
      (model.api.ts:6/model-flow.api.ts:9 의 ApiResponse 는 auth.types 직접 import 가
      아니라 `../types/model.types` 경유 — model.types.ts:2 전환으로 함께 해소된다.)
- [ ] R3. **토스트 시스템 이식** (wm 3파일 구조): `shared/stores/toast.store.ts` +
      `shared/components/Toaster.tsx`(AppProvider 1회 마운트) + `shared/lib/notify.ts`
      (`notifyFailure`). 소비 배선: user/group 계열 7파일(GroupAddMembersModal,
      UserUpsertModal, GroupUpsertModal, GroupPermissionsModal, UserDeleteConfirmDialog,
      GroupDeleteConfirmDialog, UserPasswordResetModal)의 catch 에 wm 패턴
      `setErrorMessage(notifyFailure(error, fallback))` 적용 — 인라인 폼 에러는 유지.
- [ ] R4. **control-styles 도입 + 폼 컨트롤 수렴**: wm `components/ui/control-styles.ts`
      이식, Input/Select 가 `controlBaseClassName` 을 소비하도록 갱신.
      raw `<select>` 15건 → 공용 Select 경유 0건.
      LoginPage 의 수제 버튼(:76,83)/인풋(:67,191,217) → Button/Input variant 로 수렴.
- [ ] R5. **공용 Checkbox 신설**: radix-ui(모노패키지) Checkbox 기반
      `components/ui/checkbox.tsx`. features 의 raw `<input type="checkbox">` 10건/8파일 수렴.
- [ ] R6. **raw `<button>` 단계 수렴**: 도메인 사이드바 5파일(EqpSidebar/ModelSidebar/
      DeploySidebar/DlqSidebar/UserManagementSidebar) 외 전량 `<Button>` 화 (80→≤18).
      live-map pill 류는 Button 에 className 오버라이드로 시각 보존.
- [ ] R7. **SelectableTable isLoading 백포트**: wm 시그니처(`isLoading?`,
      `skeletonRowCount?` 기본 10) 그대로. 실소비처 최소 1곳 적용(미사용 코드 방지).
      Plan 단계 확인 항목: tc 정렬 비교기의 `Intl.Collator(numeric)` 적용 여부
      (wm SelectableTable.tsx:132-139 대응) — 미적용이면 함께 백포트.
- [ ] R8. **StatusLabel / NameInputDialog 이식** (wm shared/components). 소비처가 이번
      SPEC 범위에 없으면 이식 보류하고 dev-report 에 사유 기록 (미사용 코드 금지 룰 우선).
- [ ] R9. **PageMetricGrid / list-panel-layout.ts / page-heading-styles.ts 이식** — R8 과
      동일 원칙(소비처 생기는 것만, 없으면 보류+기록).
- [ ] R10. **죽은 코드 제거**: `LiveMap3DEquipment.tsx`, `DeployStatusChart.tsx`,
      `LiveMapToolbar.tsx`, `PageFooter.tsx`, `LiveMapLegend.tsx`,
      `features/group/types/index.ts` 6파일 + package.json 의 `recharts` 제거.
      **문서 동시 정정(필수)**: tc `.claude/specs/live-map-3d.md`,
      tc `.claude/specs/live-map-layout-builder-phase1-plan.md`(Toolbar 통합 계획 폐기 명시),
      nori-tc-common `.claude/specs/port-carrier-id-lifecycle{,-plan,-dev-report}.md`,
      nori-tc-exec `docs/Architecture/ui/front/10-live-map-dashboard-and-demo-control.md`.
- [ ] R11. **window.confirm 제거**: DeployMonitorPanel.tsx:723 → 공용 ConfirmDialog 전환.

## Constraints

- 시각/동작 회귀 금지 — Button/Select/Checkbox 화는 기존 시각·동작·`data-testid` 보존.
- radix-ui 는 모노패키지(`radix-ui@^1.4.3`)만 — 개별 `@radix-ui/react-*` 추가 금지.
- 신규 의존성 추가 금지 (@tanstack/react-table 포함 — 결정 1).
- 신규 사용자 문자열은 i18n 3언어(ko/en/vi) 모두. TC 고유명은 전 언어 영어 유지.
- wm 코드 이식 시 react-router 차이 주의: tc 는 `react-router@^8`, wm 은
  `react-router-dom@^7` — import 경로 조정.
- 소비처 없는 프리미티브 이식 금지 (글로벌 룰 11) — combobox/searchable-select/
  switch/tooltip 은 본 SPEC 에서 이식하지 않는다 (Out of Scope 참조).
- 사이드바 프리미티브(wm sidebar.tsx/sidebar-context.ts)는 본 SPEC 범위 아님 —
  wm-parity-sidebar 가 이식 (여기서 이식하면 미사용 코드가 됨).

## Acceptance Criteria

> 각 항목 단일 명령/단일 assertion. OR 금지. 전부 nori-tc-ui-front 루트 기준.

> **Validate 판정 (2026-08-19, HEAD `fb91581`)** — 아래 체크박스는 Validate 세션이 SPEC 의 명령을
> 문자 그대로 재실행해 직접 확인한 결과다. dev-report 의 자기 보고는 근거로 쓰지 않았다.
> **16/17 [x], AC16 만 [~]**. 별건으로 AC 로는 잡히지 않는 런타임 회귀 1건을 발견했다 —
> `eqpApi.undoEqpCheckout`(`src/features/eqp/api/eqp.api.ts:451`) 이 `assertSuccessResponse` 가 아니라
> `resolveSuccessPayload<null>` 을 호출해 성공 응답을 항상 실패로 던진다(상세는 §Validate 발견 결함).

- [x] AC1. `npm run build` PASS (tsc -b && vite build, 출력 인용) — `✓ built in 16.69s`
- [x] AC2. `npm run lint` PASS (출력 인용) — exit 0, 경고 0줄
- [x] AC3. `npm run test:unit` PASS (출력 인용) — `# tests 211 / # pass 211 / # fail 0`
- [x] AC4. `grep -rn "<select" src/features` 결과 0건 — 실행 결과 0
- [x] AC5. `grep -rn 'type="checkbox"' src/features` 결과 0건 — 실행 결과 0
- [x] AC6. `grep -rl "<button" src/features` 결과 파일 목록이 정확히 다음 5파일과 일치
      (집합 비교 — 초과 0 / 부족 0, 합계 18건):
      eqp/components/EqpSidebar.tsx, model/components/ModelSidebar.tsx,
      deploy/components/DeploySidebar.tsx, dlq/components/DlqSidebar.tsx,
      user-management/components/UserManagementSidebar.tsx
- [x] AC7. `grep -rn "const resolveSuccessPayload" src` 결과 1건 (shared 정의만)
      — `src/shared/lib/api-error.ts:98`
- [x] AC8. `grep -rln "issueCsrfToken\s*=" src` 결과 1파일 (shared/lib/csrf.ts) — 실측 1파일
- [x] AC9. `grep -rn "class .*ApiError" src` 결과 1건 (shared 공통 클래스만)
      — `src/shared/lib/api-error.ts:49`. 도메인 별칭도 0건(S-03 준수)
- [x] AC10. `grep -rn "recharts" src package.json` 결과 0건 — 실측 0
- [x] AC11. R10 의 6파일 전부에 대해 `git ls-files <경로>` 출력 0줄 (6경로 AND) — 실측 0줄
- [x] AC12. `grep -n "isLoading" src/shared/components/SelectableTable/SelectableTable.tsx`
      1건 이상 AND `grep -rn -B8 "isLoading={" src/features --include="*.tsx" | grep -c "<SelectableTable"`
      결과 1 이상 — `<SelectableTable` 태그에 isLoading prop 을 실제 전달하는 소비처 판정.
      (패턴 검증 완료: wm features 양성 4건 / tc 현재 음성 0건. 구 패턴(파일 내 공존)은
      백포트 전에도 dlq 4패널이 매칭되는 무력 assertion 이라 폐기)
      — 실측 `isLoading` 3건(`:47,:140,:571`) AND `<SelectableTable` 소비처 카운트 1
- [x] AC13. `grep -rln "notifyFailure" src/features/user src/features/group` 결과 7파일 이상
      — 실측 정확히 7파일
- [x] AC14. `grep -c "<Toaster" src/app/providers/AppProvider.tsx` 결과 1 — 실측 1
- [x] AC15. `grep -rn "window.confirm" src` 결과 0건 — 실측 0
- [~] AC16. **부분 — 87/90.** e2e 회귀 0: Implement 세션 시작 시 clean HEAD 에서 `npm run test:e2e` 를
      실행해 PASS spec 목록을 dev-report 에 baseline 으로 기록하고, 구현 완료 후 동일
      명령에서 baseline 목록 전부 PASS AND console.error 0건 AND pageerror 0건
      (pre-existing FAIL 은 baseline 밖이므로 판정 제외 — 목록 대조로 기계 판정)
      - **충족**: baseline PASS 90 중 87 통과. 미통과 3건은 **매 실행 집합이 바뀌고**
        (Validate run1 = drag/meshpick/redrag, run2 = autoplace/drag/meshpick, dev-report run1 =
        autoplace/drag, run2 = drag/redrag) 전부 `live-map-3d-eqp-*` WebGL 스펙이다.
        실패 형태는 전건 타임아웃 + `ContextResult::kTransientFailure`(GPU 컨텍스트 생성 실패)이고
        assertion 실패가 아니다. 4건 전부 `--workers=1` 격리 실행에서 통과(3 passed 50.3s / 3 passed 1.0m).
        3D 외 영역의 PASS/FAIL/skip 집합은 baseline 과 **완전히 동일**하다.
      - **미충족**: 봉인 조건(백엔드 미기동 · 워커 4) 단일 실행에서 "baseline PASS 전건" 을
        글자 그대로 만족하지 못한다. 이 머신에서 해당 조건은 3D 스펙에 대해 비결정적이라
        재실행으로 해소되지 않는다(Validate 2회 실행 모두 87/90). 글로벌 룰 14 에 따라 `[x]` 금지.
      - **참고**: dev-report 의 `88/90` 수치는 재현되지 않는다(Validate 2회 모두 87). 통과 수 자체가
        실행마다 흔들리므로 이 AC 는 고정 수치가 아니라 "미통과가 3D 경합 타임아웃에 한정" 으로 읽어야 한다.
      - **보조 관찰**: baseline PASS 44 파일 중 `dlq-page` / `user-page` / `login-page.smoke` 3 파일
        (18 테스트)은 console/pageerror 리스너가 없어 "console.error 0" 을 단언하지 않는다(실측 0건).
        `demo-matrix.harness.spec.ts` 는 마지막 단언이 초기값 `null` 검사라 vacuous PASS 다.
- [x] AC17. `grep -rn "features/auth/types/auth.types" src` 결과 0건 (R2 판정 —
      features/auth 내부는 이 alias 경로를 쓰지 않음을 실측했으므로 오탐 없음) — 실측 0

## Out of Scope

- 전역 LNB 사이드바 전환 전반 → `wm-parity-sidebar.md` (본 SPEC 완료 후)
- 도메인 사이드바 5파일의 raw button 18건 → wm-parity-sidebar 에서 구조 대체로 해소
- combobox / searchable-select / switch / tooltip 이식 — 현재 tc 에 소비처 없음
  (글로벌 룰 11: 미사용 코드 금지). 소비처가 생기는 시점에 개별 이식
- @tanstack/react-table 도입 (결정 1 로 기각)
- 거대 파일 4개(EqpPage 1,741 / DeployRegisterPanel 1,566 / ModelPage 1,509 /
  DeployMonitorPanel 1,499) 분해 + deploy-ui.store(814줄) 순수함수 분리
  → `ui-front-refactor` 스킬 트랙 (SDD 밖, 별도 진행)
- user/group 7파일 외 나머지 catch/에러 처리 전면 전환
- live-map 고정 hex 60건 토큰 일원화(2026-08-18 재실측), `as unknown` 6건 정리 (소소 항목, 별도)
- RequirePermission 이식 → wm-parity-sidebar R11 에서 다룸
- role-landing(역할별 로그인 랜딩) → wm-parity-sidebar 도 다루지 않음. tc 권한 모델에
  wm 식 역할 축이 있는지 확인 후 별도 SPEC (sidebar SPEC 의 Out of Scope 와 일치)

## Validate 발견 결함 (2026-08-19) — **수정 완료**

> AC 로는 잡히지 않는 런타임 회귀 1건을 발견하고 근본 원인까지 해소했다.
> 상세 조치는 dev-report §10.

### V-1. `undoEqpCheckout` 이 성공 응답을 항상 실패로 던진다 (C1-b `1b429c4` 회귀) — **해소**

- **위치**: `src/features/eqp/api/eqp.api.ts:451`
- **사실**: 이 호출만 `assertSuccessResponse` 가 아니라 `resolveSuccessPayload<null>(...)` 을 쓴다.
  공용 `resolveSuccessPayload` 는 `payload.data === null` 이면 `ApiError` 를 던진다
  (`src/shared/lib/api-error.ts:103`).
- **응답 형태**: 이 엔드포인트의 타입은 `EqpDualCommandResponse = ApiResponse<null>`
  (`src/features/eqp/types/eqp.types.ts:399`) 이고, 백엔드도 `ResponseEntity.ok(ApiResponse.success(null))`
  를 반환한다(`nori-tc-ui-backend` `EqpParamController.java:216`). 즉 **data 는 성공 시에도 항상 null** 이라
  이 경로는 예외 상황이 아니라 **성공할 때마다 100% 던진다**.
- **원인**: `1b429c4` diff 에서 한 줄짜리 형제 5곳(`saveEditParams`/`checkin`/`create`/`update`/`delete`)은
  `assertSuccessResponse` 로 바뀌었으나, 여러 줄로 쓰인 이 호출은 4번째 인자 `true`(allowNullData)만
  삭제되고 함수명이 그대로 남았다. baseline `3704176` 에서 `allowNullData=true` 였던 14곳 중 13곳만
  전환됐다(eqp 6 중 5).
- **사용자 영향**: EqpPage 의 "체크아웃 되돌리기" 가 서버 성공에도
  `error.eqp.undoCheckout`("체크아웃 되돌리기에 실패했습니다.")를 표시하고
  (`EqpPage.tsx:1252,1257`), mutation 의 `onSuccess` 캐시 무효화가 돌지 않아 화면이 stale 로 남는다.
- **탐지 실패 이유**: 이 경로를 덮는 e2e / 단위 테스트가 0건이라 AC1~AC3·AC16 이 전부 green 이다.
- **dev-report 와의 불일치**: dev-report `C1-b-결함-1` 은 `undoCheckout` 을 포함해 전건
  `assertSuccessResponse` 로 전환했다고 적었으나 코드는 그렇지 않았다(dev-report §9 정정-1 로 정정).

**조치 (2026-08-19)** — 증상 1줄만 고치지 않고 재발 경로를 막았다.

1. **근본 원인 차단**: `resolveSuccessPayload` 의 타입 파라미터를
   `<TData extends NonNullable<unknown>>` 으로 제약했다. 이제 `resolveSuccessPayload<null>` 은
   **빌드가 깨진다** — 버그 형태를 일부러 되돌려 실증했다:
   `src/features/eqp/api/eqp.api.ts(451,29): error TS2344: Type 'null' does not satisfy the constraint '{}'.`
2. **회귀 수정**: `undoEqpCheckout` → `assertSuccessResponse`.
3. **제약 정합**: `resolveSuccessPayload<unknown>(` 12곳의 명시 타입인자 제거(api 5파일).
4. **동일 안티패턴 제거**: `groupApi.addGroupPermission` 도 `assertSuccessResponse` 로
   (`Promise<void>` 인데 데이터 추출 헬퍼를 쓰던 마지막 1곳).
5. **죽은 참조 정정**: `useModelFlowMutations.ts` JSDoc 의 `ModelApiError` → `ApiError`.
6. **계약 테스트 신설**: `tests/unit/api-void-endpoint-contract.test.ts` — `Promise<void>` API
   **전 17건** + 헬퍼 계약 4건 = 21 테스트. 수정 전 실행 시 `undoEqpCheckout` 1건만 정확히 RED.

게이트: build PASS / lint PASS / `test:unit` **232 pass 0 fail**(211 → 232) /
회귀 e2e `41 passed` + `3 failed`(전부 baseline FAIL 과 동일) = **회귀 0**.

**인접 부채 3건도 함께 해소**(dev-report §11):
`layout.api.deleteObject` 에 봉투 검증 추가 / `model-flow.api.remove` 의 인라인 복제를 헬퍼 호출로 /
`create*FailResponse`·`*FailResponse` **8종을 shared 단일 정의로 통합**(호출부 24곳 전환,
고아가 된 `default*ErrorMessage` 5개·`isLoginFailResponse`·i18n 키 3개 동반 제거).
이 통합으로 **R1 의 "feature 로컬 사본 전부 제거" 가 비로소 실제로 완료**됐다 — Plan §5.C1 의
제거 대상 표가 `create*FailResponse` 계열을 열거하지 않아 8개 복제본이 남아 있었다.

## SDD 진행 상태

- [x] **Specify** — 이 SPEC.md 작성 완료 (산출물: `.claude/specs/wm-parity-foundation.md`)
- [x] **Plan** — 별 세션에서 Plan Mode 로 구현 계획 수립 (산출물: `.claude/specs/wm-parity-foundation-plan.md`)
- [x] **Implement** — 별 세션에서 Acceptance Criteria 만족하는 구현 (산출물: `.claude/specs/wm-parity-foundation-dev-report.md`)
- [x] **Validate** — SPEC + Plan + Dev report 셋 다 입력으로 검증 완료, 위 체크박스 갱신
      (AC 16/17 [x] · AC16 [~] — 3D WebGL 경합 타임아웃 한정). 검증 중 발견한 런타임 회귀 V-1 은
      근본 원인(타입 제약 부재) + 2차 원인(void API 계약 무검증)까지 해소하고 계약 테스트 21건을
      추가했다. dev-report 의 사실 오류 4건은 §9 로 정정했다.
      후속 `wm-parity-sidebar` 착수 가능.

## 다음 단계 진입 프롬프트

> 새 세션 진입 시 아래 블록을 그대로 복붙.

**Plan 진입 (새 세션 + Plan Mode)**:
```
@.claude/specs/wm-parity-foundation.md 보고 구현 계획 수립.
영향 파일 / 단계 / 위험 / 롤백 방법 포함.
실행 / 코드 수정 금지.
산출물: .claude/specs/wm-parity-foundation-plan.md 에 저장.
```

**Implement 진입 (새 세션)**:
```
@.claude/specs/wm-parity-foundation.md @.claude/specs/wm-parity-foundation-plan.md 둘 다 읽고 구현.
SPEC 의 Acceptance Criteria 모두 만족하도록 각 AC 당 실패 테스트 먼저.
Plan 의 결정 (확장자 / dead path / OR→단일 노드 좁힘) 엄수.
산출물: .claude/specs/wm-parity-foundation-dev-report.md 에 변경 파일 / 테스트 결과 / 결정 기록.
```

**Validate 진입 (새 세션)**:
```
@.claude/specs/wm-parity-foundation.md @.claude/specs/wm-parity-foundation-plan.md @.claude/specs/wm-parity-foundation-dev-report.md
셋 다 읽고, 구현이 SPEC 의 모든 Acceptance Criteria 와 Plan 의 결정을 만족하는지 검증.
누락 / 위반 발견 시 보고. 통과 항목은 SPEC 의 AC 체크박스 + SDD 진행 상태를 [x] 로 업데이트.
```
