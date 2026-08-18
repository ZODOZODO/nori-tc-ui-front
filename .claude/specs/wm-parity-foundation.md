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

- [ ] AC1. `npm run build` PASS (tsc -b && vite build, 출력 인용)
- [ ] AC2. `npm run lint` PASS (출력 인용)
- [ ] AC3. `npm run test:unit` PASS (출력 인용)
- [ ] AC4. `grep -rn "<select" src/features` 결과 0건
- [ ] AC5. `grep -rn 'type="checkbox"' src/features` 결과 0건
- [ ] AC6. `grep -rl "<button" src/features` 결과 파일 목록이 정확히 다음 5파일과 일치:
      eqp/components/EqpSidebar.tsx, model/components/ModelSidebar.tsx,
      deploy/components/DeploySidebar.tsx, dlq/components/DlqSidebar.tsx,
      user-management/components/UserManagementSidebar.tsx
- [ ] AC7. `grep -rn "const resolveSuccessPayload" src` 결과 1건 (shared 정의만)
- [ ] AC8. `grep -rln "issueCsrfToken\s*=" src` 결과 1파일 (shared/lib/csrf.ts)
- [ ] AC9. `grep -rn "class .*ApiError" src` 결과 1건 (shared 공통 클래스만)
- [ ] AC10. `grep -rn "recharts" src package.json` 결과 0건
- [ ] AC11. R10 의 6파일 전부에 대해 `git ls-files <경로>` 출력 0줄 (6경로 AND)
- [ ] AC12. `grep -n "isLoading" src/shared/components/SelectableTable/SelectableTable.tsx`
      1건 이상 AND `grep -rn -B8 "isLoading={" src/features --include="*.tsx" | grep -c "<SelectableTable"`
      결과 1 이상 — `<SelectableTable` 태그에 isLoading prop 을 실제 전달하는 소비처 판정.
      (패턴 검증 완료: wm features 양성 4건 / tc 현재 음성 0건. 구 패턴(파일 내 공존)은
      백포트 전에도 dlq 4패널이 매칭되는 무력 assertion 이라 폐기)
- [ ] AC13. `grep -rln "notifyFailure" src/features/user src/features/group` 결과 7파일 이상
- [ ] AC14. `grep -c "<Toaster" src/app/providers/AppProvider.tsx` 결과 1
- [ ] AC15. `grep -rn "window.confirm" src` 결과 0건
- [ ] AC16. e2e 회귀 0: Implement 세션 시작 시 clean HEAD 에서 `npm run test:e2e` 를
      실행해 PASS spec 목록을 dev-report 에 baseline 으로 기록하고, 구현 완료 후 동일
      명령에서 baseline 목록 전부 PASS AND console.error 0건 AND pageerror 0건
      (pre-existing FAIL 은 baseline 밖이므로 판정 제외 — 목록 대조로 기계 판정)
- [ ] AC17. `grep -rn "features/auth/types/auth.types" src` 결과 0건 (R2 판정 —
      features/auth 내부는 이 alias 경로를 쓰지 않음을 실측했으므로 오탐 없음)

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

## SDD 진행 상태

- [x] **Specify** — 이 SPEC.md 작성 완료 (산출물: `.claude/specs/wm-parity-foundation.md`)
- [ ] **Plan** — 별 세션에서 Plan Mode 로 구현 계획 수립 (산출물: `.claude/specs/wm-parity-foundation-plan.md`)
- [ ] **Implement** — 별 세션에서 Acceptance Criteria 만족하는 구현 (산출물: `.claude/specs/wm-parity-foundation-dev-report.md`)
- [ ] **Validate** — 별 세션에서 SPEC + Plan + Dev report 셋 다 입력으로 검증, 위 체크박스 업데이트

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
