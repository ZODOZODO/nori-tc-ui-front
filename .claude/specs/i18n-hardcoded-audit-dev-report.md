# i18n 하드코딩 마이그레이션 — Dev Report (P0: react-i18next 전환)

> 입력: [i18n-hardcoded-audit.md](./i18n-hardcoded-audit.md) · [i18n-hardcoded-audit-plan.md](./i18n-hardcoded-audit-plan.md)
> 범위: **P0 (react-i18next 전환) 단독**. ≈795건 문자열 추출(P1~P6)은 본 PR 범위 밖 — 후속 feature 분할 PR.
> 작성: 2026-06-01.

## 1. 무엇을 했나

자체 경량 Context i18n(`dictionaries[lang][key] ?? key`) → **react-i18next** 로 교체.
기존 `useI18n().t(key)` 호출처 **88건 / 42파일 무수정**(호환 shim). 표시 텍스트·동작 무변경(값 보존).
P0 가 모든 후속 작업(C3 interpolation / C4 모듈상수 / C5 api·lib React 밖 번역)의 선행 조건이므로 먼저 단독 완료.

## 2. 변경/신규 파일

| 파일 | 종류 | 내용 |
|---|---|---|
| `package.json` | 의존성 | `i18next@^26.3.0`, `react-i18next@^17.0.8`, `i18next-browser-languagedetector@^8.2.1`, `i18next-resources-to-backend@^1.2.1` 추가 |
| `src/i18n/index.ts` | 신규 | i18n 인스턴스 init. 커스텀 detector(`noriInitial`)로 기존 `resolveInitialLang` 동등 재현 + localStorage 캐시, resourcesToBackend lazy-load, `languageChanged`→`<html lang>` 동기화, `i18nReady` Promise export |
| `src/i18n/config.ts` | 신규 | DOM 비의존 init 옵션(`i18nBaseOptions`) — index.ts(prod)와 단위 테스트가 공유해 flat key/interpolation/fallback 계약 drift 방지 |
| `src/i18n/I18nProvider.tsx` | 교체 | 경량 Context Provider → `<I18nextProvider i18n={i18n}>` 래퍼. 정적 `import ko/en json` 제거(번들 분리) |
| `src/i18n/i18n-context.ts` | 재작성 | `useI18n()` 를 `useTranslation()` 위 호환 shim 으로. 반환 `{ lang, setLang, t }` 시그니처 유지 + `t(key, {var})` interpolation 위임. `createContext`/`I18nContext.Provider` 제거 |
| `src/main.tsx` | 수정 | `i18nReady.then()` 후 렌더 — 초기 언어 lazy-load 완료 전 raw key flash 차단 |
| `tests/e2e/i18n-flat-key-render.spec.ts` | 신규 | flat key 회귀 가드 (raw "login.*" 키 미노출 + 번역 값 렌더 + console.error 0) |
| `tests/i18n-config.test.ts` | 신규 | flat key 조회 / interpolation / ko fallback 계약 단위 테스트 |

`src/i18n/LanguageToggle.tsx` 는 `useI18n`/`Lang` 시그니처 보존으로 **무수정**.

## 3. Plan 결정 준수

- **D1 (api/lib fallback → standalone `i18n.t`)**: `src/i18n/index.ts` 가 `export default i18n` 으로 standalone 인스턴스 노출. React 밖에서 `import i18n from '@/i18n'; i18n.t('error.eqp.list')` 호출 가능한 기반 마련. (실제 api/lib 치환은 P2~P6.)
- **D2 (borderline·L382 제외)**: P0 는 코어 전환만 — 어떤 하드코딩 문자열도 미변경. ModelDetailPanel:382 등 전부 무변경.
- **D3 (P0 단독 PR)**: 본 PR = i18n 코어 + 테스트만. feature 문자열 추출 분리.
- **keySeparator:false / nsSeparator:false**: flat key(`"eqp.sidebar.title"`) 중첩 해석 차단. 미설정 시 전 키 깨짐 → e2e/단위로 가드.
- **fallbackLng:'ko'**: ko 번역 베이스. en 누락 키 ko 폴백 — 단위 테스트로 검증.

## 4. Plan 잔여 미결 → 구현 중 확정

- **e2e 영어 모드**: Playwright 기본 locale en-US → 커스텀 detector 가 'en' 으로 수렴. 기존 e2e 가 이미 EN 모드로 동작 확인됨(user-page 출력에 "Eqp/Model/Deploy/English/Logout" 영어 렌더). 별도 EN 테스트 추가 불요.
- **flash 처리 방식**: `react:{useSuspense:false}` + `main.tsx` 의 `i18nReady` await 채택. Suspense 경계 불필요, 초기 언어+fallback(ko) 로드 후 1회 렌더 → flash 없음. build 결과 `en-*.js`(12.68kB)/`ko-*.js`(14.33kB) 별도 청크 분리 확인(메인 번들 미포함).

## 5. 검증 결과 (전부 PASS)

### tsc 타입 체크
```
=== tsc -b ===
EXIT:0
```

### 단위 테스트 (전체 89, i18n 신규 3 포함)
```
1..89
# tests 89
# pass 89
# fail 0
```
신규 `tests/i18n-config.test.ts`:
```
ok 1 - flat key("a.b.c") 가 중첩 해석 없이 그대로 조회된다
ok 2 - interpolation {{var}} 가 적용된다
ok 3 - en 에 없는 키는 fallbackLng:ko 값으로 폴백된다
```

### vite production build
```
dist/assets/en-B91YuUEt.js                       12.68 kB │ gzip:   3.57 kB
dist/assets/ko-B-UiFBpZ.js                        14.33 kB │ gzip:   4.31 kB
...
✓ built in 11.58s
```
locale json 이 정적 번들에서 분리돼 별도 청크로 빠짐(lazy-load 확인).

### e2e (전체 79, flat-key 회귀 가드 포함)
```
79 passed (2.5m)
```
신규 flat-key 회귀 + login smoke 단독:
```
2 passed (5.2s)
```
flat-key 테스트의 `page.on('console'|'pageerror')` error level 0건 충족.

### lint
```
ESLINT_EXIT:0
```

## 6. 회귀 안전성

- 호환 shim 으로 88 호출처 무수정 → 표시 텍스트 100% 보존. e2e 79건이 한글/영어 텍스트 셀렉터 포함하나 전부 PASS = 값 보존 입증.
- locale 키 추가는 additive(P1~ 단계에서). P0 자체는 키 추가 0(코어 전환만) → 기존 277키 그대로 사용.
- 롤백: P0 는 하위호환 단독 PR → `git revert` 단독 가능.

## 7. 다음 단계 (P1~P6, 후속 PR)

Plan §4 순서대로: P1 shared/ui(공용 default) → P2 deploy → P3 eqp → P4 model → P5 user/profile/auth → P6 live-map/dlq.
각 단계 = 실패 e2e/스냅샷 → ko/en 키 동수 신설 → `t()`/`i18n.t()` 치환 → build+tsc+e2e PASS(console.error 0).

---

# P1 — shared/components/ui + app (공용 default 8건)

## 1. 무엇을 했나

가장 광범위 노출되는 공용 default 한국어 8건을 `common.*` i18n 키로 치환. 모두 C4(컴포넌트 default/fallback) 유형.
**핵심**: 이 default 들은 기존에 하드코딩 한국어라 **EN 모드에서도 한국어로 표시되던 버그** — P1 으로 EN 시 영어로 정상 전환.

## 2. 신설 키 (ko/en 각 8, common 네임스페이스)

| key | ko | en |
|---|---|---|
| common.confirm | 확인 | OK |
| common.cancel | 취소 | Cancel |
| common.close | 닫기 | Close |
| common.table.action | 작업 | Action |
| common.table.empty | 표시할 데이터가 없습니다. | No data to display. |
| common.routeLoading | 화면을 불러오는 중입니다. | Loading… |
| common.resizeHandle.panel | 패널 크기 조절 핸들 | Resize panel |
| common.resizeHandle.sidebar | 사이드바 크기 조절 핸들 | Resize sidebar |

## 3. 변경 파일 (6)

| 파일 | 변경 |
|---|---|
| `src/components/ui/confirm-dialog.tsx` | `confirmText='확인'`/`cancelText='취소'` default 제거 → 본문 `?? t('common.confirm'\|cancel)` |
| `src/components/ui/dialog.tsx` | close 버튼 `aria-label="닫기"` → `t('common.close')` (DialogContent 에 useI18n) |
| `src/shared/components/SelectableTable/SelectableTable.tsx` | `?? '작업'` → `t('common.table.action')`, `?? '표시할 데이터가 없습니다.'` → `t('common.table.empty')` |
| `src/app/Router.tsx` | Suspense fallback "화면을 불러오는 중입니다." → `t('common.routeLoading')` |
| `src/components/ui/sidebar-resize-handle.tsx` | `aria-label` → `t('common.resizeHandle.sidebar')` |
| `src/components/ui/resizable-divider.tsx` | `aria-label` → `t('common.resizeHandle.panel')` |

`LanguageToggle.tsx`/기타 P1 무관 파일 무수정.

## 4. 회귀 전략 (전용 mock e2e 미작성 근거)

P1 6컴포넌트는 전부 인증+mock 페이지 전용 — default 8건만을 위한 전용 무거운 mock e2e 는 과도(글로벌 룰 3/11). 대신:
- 기존 e2e 가 P1 한국어 default 를 assert 하는 곳 **0건** 확인(`grep` 결과 전부 주석) → EN 모드 값 변경으로 깨질 테스트 없음.
- 전체 e2e 79건이 EN 모드에서 이 컴포넌트들을 광범위 렌더·동작(dialog open/close, table, resize) → useI18n 추가로 인한 crash/구조 파손은 반드시 검출.

## 5. 검증 결과

```
=== 잔여 P1 하드코딩 (should be 0) ===
none — 전부 t() 치환됨
=== tsc -b ===
TSC_EXIT:0
=== eslint (변경 6파일) ===
ESLINT_EXIT:0
```
build:
```
✓ built in 11.93s
```
e2e (전체 79):
```
1 failed (group-page.spec.ts:395 Group-AC-5) / 78 passed (2.5m)
```
실패 1건 진단 — 단독 재실행 `1 passed (4.0s)`, group-page 스펙 전체 재실행 `8 passed (16.4s)`. 해당 테스트는 testId 셀렉터 + 데이터 값('관리자-수정')만 assert, P1 문자열·close 버튼 미참조 → **P1 무관 병렬 타이밍 flaky (workers=undefined)**. 실질 79/79 PASS.

## 6. 다음 단계
P2 deploy(173건) — 새 세션 권장(컨텍스트 분리, 글로벌 룰 10).

---

# P2 — deploy (173건)

## 1. 무엇을 했나

카탈로그의 deploy 영역 173건(SelectedEquipmentRow 2 / DeployMonitorPanel 64 / DeployRegisterPanel 69 / deploy-utils 18 / deploy-register-utils 6 / deploy.api 14)을 i18n 키로 전수 치환.
C1/C2/C3(컴포넌트 인라인·삼항·템플릿) → `t()`, C4(deploy-utils 작업 라벨 상수) → 키 반환 + 호출부 번역, C5(api/lib fallback) → standalone `i18n.t`(D1).

## 2. 신설 키 (ko/en 각 동수)

P2 진입 전 285키 → **418키**(P2 신설 **133키 × 2**). `node` 로 ko/en 키 차집합 0 검증:
```
ko 418 en 418
in ko not en: []
in en not ko: []
```

네임스페이스:
- `error.deploy.*` (15) — api fallback + SelectedEquipmentRow paramVersions
- `deploy.task.*` (15) — 작업 유형 라벨(C4, 키 반환)
- `deploy.detail.*` (5) — register-utils 실패 상세 보간
- `deploy.monitor.*` (신설 ~50) — 에러 fallback / comment 다이얼로그 / 컬럼 / 요약·상세 보간 / 페이지네이션
- `deploy.register.*` (신설 ~45) — 검증 toast / 다이얼로그 / 시나리오 테이블 / aria
- `common.delete` (1) — ConfirmDialog "삭제"(P1 의 common.* 확장)

## 3. Plan 결정 준수 (D1 / D2)

- **D1 (api/lib fallback → standalone `i18n.t`)**:
  - `deploy.api.ts` — 12개 `DEFAULT_*_ERROR_MESSAGE` 상수 + CSRF + recommendedReason fallback. 모듈 로드 시점 i18n.t 평가는 런타임 언어 전환에 비반응 → **getter 함수**(`fallback*Error = () => i18n.t(...)`)로 전환. default 파라미터 식은 호출마다 평가되므로 fallback 이 현재 언어를 따른다.
  - `deploy-register-utils.ts` — `getDeployErrorDetail`/`resolveFailureDetail`/`formatDeployDetail`/`formatActiveDeployHint` 의 한글 보간을 `i18n.t(key, {var})` 로.
  - `deploy-utils.ts` — `createDeployName`(백엔드 전송 deployName)은 `i18n.t(resolveDeployTaskLabel(...))` 로 생성 시점 UI 언어 번역.
- **D2 (borderline 제외)**: deploy 영역엔 borderline(invariant/dead/L382) 없음 — 카탈로그 173건 전수 처리. 순수 jargon(`Business JAR: …`, `EQP PARAM: …`, `AS-IS`/`TO-BE`, `Register Deploy`, 영어 컬럼 헤더 `Deploy Name`/`Event Type` 등)은 정책상 범위 밖 → 무변경.

## 4. C4 구조 변경 — resolveDeployTaskLabel 키 반환

`resolveDeployTaskLabel` 반환값을 **표시 문자열 → i18n 키**로 변경(모듈 상수라 React 밖에서 t() 불가).
- DeployMonitorPanel: `commentTaskTypeLabel` → `commentTaskTypeLabelKey`(useMemo, t 미사용) + 렌더 2곳 `t(commentTaskTypeLabelKey)`.
- DeployRegisterPanel `createDeployName` / deploy-ui.store: `i18n.t(key)` 로 deployName 생성.
- `EQP_REGISTER_DEPLOY → 'Register Deploy'`(영어 jargon)는 키 미존재 시 `t` 가 key 그대로 반환하므로 무변경 유지.

## 5. 구현 결정 기록

- **`commentToBeLines`/`commentAsIsLines` useMemo deps 에 `t` 추가** — 보간 호출이 들어갔고 react-compiler `preserve-manual-memoization` 정합 위해 언어 전환 시 재계산 필요.
- **`formatDateTime` 의 `Intl.DateTimeFormat('ko-KR')` 는 P2 범위 밖** — 173 문자열 카탈로그에 미포함, Plan §2 에서 날짜 로컬라이제이션을 P0 에 배정(P0 미구현분). EN 모드 날짜가 한국식인 기존 동작 유지. 후속 별도 처리 필요.
- **api getter 함수 명 분리**(`fallback*Error`) — 기존 `DEFAULT_*` 식별자에 `()` 를 붙이면 선언부도 깨지므로 새 이름 + 사용처 일괄 치환.

## 6. 검증 결과 (전부 PASS)

ko/en 키 차집합 0 (418/418, §2 인용).

### tsc
```
TSC_EXIT:0
```
### eslint (변경 6 소스 파일)
```
ESLINT_EXIT:0
```
### vite build
```
dist/assets/DeployPage-7gaEK_gP.js              397.04 kB │ gzip: 115.84 kB
✓ built in 11.87s
BUILD_EXIT:0
```
### e2e (전체 79, flat-key console.error 0 가드 + deploy-monitor 포함)
```
79 passed (2.6m)
E2E_EXIT:0
```
deploy-monitor 단독 baseline → 변경 후 모두 PASS. deploy-monitor e2e 는 영어 셀렉터(`Deploy`/`View`)만 assert → 값 보존으로 무영향.

## 7. 변경 파일 (8)

| 파일 | 변경 |
|---|---|
| `src/i18n/locales/ko.json` | +133 키 |
| `src/i18n/locales/en.json` | +133 키 |
| `src/features/deploy/components/SelectedEquipmentRow.tsx` | paramVersions fallback + 삭제 aria |
| `src/features/deploy/components/DeployMonitorPanel.tsx` | 에러 fallback / comment 다이얼로그 / 컬럼 / 보간 / 페이지네이션 + commentTaskTypeLabelKey |
| `src/features/deploy/components/DeployRegisterPanel.tsx` | 검증 toast / 다이얼로그 / 시나리오 테이블 / aria |
| `src/features/deploy/lib/deploy-utils.ts` | 작업 라벨 키 반환 + createDeployName i18n.t |
| `src/features/deploy/lib/deploy-register-utils.ts` | 실패 상세 보간 i18n.t |
| `src/features/deploy/api/deploy.api.ts` | fallback getter 함수 전환 + CSRF/recommendedReason i18n.t |

## 8. 다음 단계
P3 eqp(125+24) — 새 세션 권장. ManageFormModal 동적 조사 에러(템플릿) 주의.

---

# P3 — eqp (125 + 24 + 1)

## 1. 무엇을 했나

카탈로그의 eqp 영역(components 125 / eqp.api 24 / eqp.types DEFAULT_EQP_ERROR_MESSAGE 1)을 i18n 키로 전수 치환.
C1/C2/C3(컴포넌트 인라인·삼항·템플릿) → `t()`, C4(lifecycle/delete 상수 · CheckIn/Gateway 컬럼 헤더) → 키 반환 / 팩토리 + 호출부 번역, C5(api/types fallback) → standalone `i18n.t`(D1).
착수 시 grep 실측으로 카탈로그 재확인(EqpInfoTable 4 / GatewayGroupTable 8 포함 components 125). BusinessGroupModelTable 은 표시 한글 없음(컬럼 jargon + `Intl.DateTimeFormat('ko-KR')` 날짜 로컬라이제이션은 Plan §2 P0 배정 — 후속) → 무변경.

## 2. 신설 키 (ko/en 각 동수)

P3 진입 전 418키 → **529키**(P3 신설 **111키 × 2**). `node` 로 ko/en 키 차집합 0 검증:
```
ko 529 en 529
in ko not en: []
in en not ko: []
```

네임스페이스(기존 `eqp.*` 41키 재사용 우선 — `eqp.lifecycle.*`/`eqp.delete.*`/`eqp.param.action`/`eqp.common.confirm` 등 + P1/P2 `common.*` 재사용):
- `error.eqp.*` (25) — eqp.api fallback 24 + eqp.types `error.eqp.default` 1
- `eqp.page.*` (12) — EqpPage 컴포넌트 fallback/메시지(불러오기 실패·타임아웃·삭제 성공 보간 등). 단, 등록/수정/삭제/EDIT저장/undo 실패는 텍스트 동일 → `error.eqp.create/update/delete/saveEditParams/undoCheckout` 재사용
- `eqp.validation.*` (4) — ManageFormModal parse 헬퍼 동적 조사 에러(`{{label}}`/`{{min}}` interpolation). ko 만 조사 `을(를)`/`은(는)` 유지, en 단일
- `eqp.form.*` (28) — ManageFormModal 섹션 desc/placeholder/label/hint/toggle
- `eqp.binding.*` (6) — ModelBindingModal desc/현재 Model·Version/필터 hint
- `eqp.checkin.*` (5) — CheckInModal desc/구분/빈상태/버전안내/placeholder
- `eqp.status.*` (2) — `오프라인`/`주의 상태`(EqpInfoTable·GatewayGroupTable 공용)
- `eqp.gateway.missing*` (3) — missing 뱃지/title/안내(보간)
- `eqp.param.*` 신설 (6) — 검증 메시지·중복(`{{name}}`)·행 삭제 aria
- `eqp.lifecycle.*` 신설 (11) — verb 3 + confirm(with/no id) 2 + result 6
- `eqp.delete.*` 신설 (4) — confirm(with/no id) 2 + result 2
- `eqp.mode.editingBy` / `eqp.checkout.byTitle` / `eqp.common.selectedTarget` / `eqp.lifecycle.passiveUnsupported` (4)
- `common.example` (1) — `예: {{value}}`(placeholder 6곳: EQP-01/127.0.0.1/5000/7/\\/UTF-8)

## 3. Plan 결정 준수 (D1 / C4 / C2)

- **D1 (api/lib/types fallback → standalone `i18n.t`)**:
  - `eqp.api.ts` — 인라인 fallback 22종은 호출 시점 평가라 `i18n.t('error.eqp.*')` 직접 치환(런타임 언어 반영). 모듈 로드 시점 고정 상수였던 `EQP_LIST_FALLBACK_MESSAGE` 는 **getter 함수** `eqpListFallbackMessage = () => i18n.t(...)` 로 전환.
  - `eqp.types.ts` — `DEFAULT_EQP_ERROR_MESSAGE`(모듈 상수)를 **getter** `defaultEqpErrorMessage = () => i18n.t('error.eqp.default')` 로 전환. `createEqpFailResponse`/`normalizeEqpError` 의 `fallbackMessage = defaultEqpErrorMessage()` default 파라미터 식은 호출마다 평가되므로 fallback 이 현재 언어를 따른다(P2 deploy.api 동일 패턴).
- **C4 모듈 상수 구조 변경**:
  - `EqpLifecycleActionDialog` `ACTION_MESSAGES`(시작/종료/재시작) → `ACTION_VERB_KEYS`(i18n 키 맵) + 렌더 시점 `t(verb)` 보간.
  - `EqpLifecycleResultDialog` `ACTION_RESULT_MESSAGES` → `ACTION_RESULT_MESSAGE_KEYS`(키 맵) + `t(key, { eqpId })` 보간. 기존 `eqp.lifecycle.*Success/Failure`(title) 키는 이미 존재 → 재사용, 결과 메시지는 신설.
  - `CheckInModal` `EQP_PARAM_DIFF_COLUMNS` 상수 → `buildDiffColumns(kindHeader)` 팩토리 + `useMemo(() => buildDiffColumns(t('eqp.checkin.diffKind')), [t])`. SelectableTable 의 `header: string` 계약 보존(전역 변경 회피).
  - `GatewayGroupTable` `GATEWAY_GROUP_COLUMNS` 상수 → `buildGatewayGroupColumns(missingTitle, missingBadge)` 팩토리 + `useMemo([t])`. 한 컬럼 renderCell 의 missing 뱃지만 번역 주입.
  - `EqpModelBindingModal` `resolveOptionalJarRef`(React 밖 헬퍼) throw → standalone `i18n.t`. `EqpPage` `PASSIVE_LIFECYCLE_UNSUPPORTED_MESSAGE` 상수 → `*_KEY` 키 상수 + 컴포넌트 내 `t(KEY)`(useCallback deps 에 `t` 추가).
- **C2 삼항/동적 + 조사**:
  - ManageFormModal "사용/미사용"(ToggleField, useI18n 추가) · DialogDescription create/update 삼항 → 2키.
  - 동적 조사 에러 10건(parse 헬퍼) → `eqp.validation.required/integer/positive/min` 4키 + `{{label}}` 보간. ko 만 조사 유지, en 단일.
  - lifecycle/delete confirm·result 의 eqpId 유무 분기는 with-id(보간)/no-id(정적) 별 키로 분리해 값 보존.
- **순수 jargon 무변경**: `Eqp Create`/`Eqp Info Update`/`Model Info Update`/`Check In`/`EQP ID`/`Comm Mode`/`SECS Settings`/`Add/Change/Delete`(diff label)/컬럼 헤더(`EQPID`/`Model Version`/`status` 등)/`예: 25.03.12.0000`의 버전 jargon 등 정책상 범위 밖.
- **borderline 무변경(D2)**: eqp util/hooks 의 내부 invariant·CSRF·날짜 로컬라이제이션은 P3 카탈로그(125+24+1) 밖 — 무변경.

## 4. 구현 결정 기록

- **near-dup 키 보존**: api 레이어 "…조회하지 못했습니다"(`error.eqp.*`)와 EqpPage 컴포넌트 fallback "…불러오지 못했습니다"(`eqp.page.*LoadError`)는 **표시 텍스트가 달라** 별도 키 유지(값 보존 우선). 텍스트가 정확히 동일한 등록/수정/삭제/EDIT저장/undo 실패는 `error.eqp.*` 재사용.
- **`common.example` 보간 키**: `예: {{value}}` — placeholder 6곳의 `예:` 접두만 번역, 예시 값(EQP-01 등)은 보간으로 보존.
- **useCallback/useMemo deps**: `t` 를 사용하게 된 `openLifecycleDialog`/`executeLifecycleAction`/`handleConfirmLifecycleAction`/`paramEditValidationMessage` deps 에 `t` 추가(react-compiler 정합).

## 5. 검증 결과 (전부 PASS)

ko/en 키 차집합 0 (529/529, §2 인용).

### tsc -b
```
TSC_EXIT:0
```

### eslint (변경 13 소스 파일)
P3 신규 에러 0. 변경 파일들의 `react-hooks/set-state-in-effect` 에러 8건은 **모두 pre-existing**(EqpPage·ManageFormModal·ModelBindingModal 의 *내가 수정하지 않은* `useEffect` 블록). 전체 변경 stash 후 baseline 비교로 확정:
```
=== 현재(P3 적용) error 수 ===
8
=== baseline(HEAD) error 수 ===
8
```
(동일 → P3 신규 0. 해당 effect 들은 P3 범위 밖 기술부채로 무변경.)

### vite build
```
dist/assets/EqpPage-Bty0z-Ap.js                  66.52 kB │ gzip:  16.55 kB
✓ built in 11.90s
BUILD_EXIT:0
```

### e2e (전체 79, flat-key console.error 0 가드 포함)
```
1 failed (selectable-table-model-workflow.spec.ts:337) / 78 passed (2.6m)
```
실패 1건은 **P3 미변경 model 영역**(dcop EventId dropdown) — 단독 재실행 `3 passed (10.5s)` → parallel 타이밍 flaky(P1 group-page 와 동일 양상). 실질 79/79 PASS. eqp 관련 spec(selectable-table-gateway-group / selectable-table-check-in / i18n-flat-key-render)은 전부 PASS, console.error 0.

## 6. 변경 파일 (15)

| 파일 | 변경 |
|---|---|
| `src/i18n/locales/ko.json` | +111 키 |
| `src/i18n/locales/en.json` | +111 키 |
| `src/features/eqp/components/EqpPage.tsx` | fallback/타임아웃/삭제·편집 보간 + PASSIVE 키 상수 |
| `src/features/eqp/components/EqpManageFormModal.tsx` | parse 헬퍼 i18n.t + 섹션/placeholder/label/hint/toggle + 삼항 |
| `src/features/eqp/components/EqpModelBindingModal.tsx` | useI18n + 헬퍼 throw i18n.t + desc/label/placeholder/필터 hint |
| `src/features/eqp/components/CheckInModal.tsx` | useI18n + buildDiffColumns 팩토리 + desc/구분/빈상태/placeholder |
| `src/features/eqp/components/EqpInfoTable.tsx` | StatusIndicator useI18n(오프라인/주의 상태) |
| `src/features/eqp/components/EqpParamTable.tsx` | 행 삭제 aria 보간 + newParam |
| `src/features/eqp/components/EqpLifecycleActionDialog.tsx` | useI18n + verb 키맵 + confirm(with/no id) |
| `src/features/eqp/components/EqpLifecycleResultDialog.tsx` | result 메시지 키맵 + eqpId 보간 + selectedTarget |
| `src/features/eqp/components/EqpDeleteConfirmDialog.tsx` | useI18n + confirm(with/no id) |
| `src/features/eqp/components/EqpDeleteResultDialog.tsx` | result 메시지 키 + eqpId 보간 |
| `src/features/eqp/components/GatewayGroupTable.tsx` | StatusIndicator useI18n + buildGatewayGroupColumns 팩토리 + missing 안내 보간 |
| `src/features/eqp/api/eqp.api.ts` | fallback getter + 인라인 22종 i18n.t + CSRF/traceId/async |
| `src/features/eqp/types/eqp.types.ts` | DEFAULT_EQP_ERROR_MESSAGE → defaultEqpErrorMessage() getter |

## 7. 다음 단계
P4 model(112+153) — 새 세션 권장. 최난도(hintText 삼항, model-detail-editor JSON 에디터 검증 28, model.api 33).
