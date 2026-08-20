# features/eqp 리팩토링 측정 보고서 (2026-08-20)

ui-front-refactor 트랙 #9 의 **2회차**. 1회차(features/deploy) 결과와 운용 지식은
`.claude/progress/refactor-master.md` 및 `.claude/refactor/features-deploy-2026-08-20.md` 참조.

근거: `wm-parity-foundation.md:178-180` (거대 파일 4개 분해 확정).

## 1. 정적 baseline

### 1-1. LOC 분포 (`find src/features/eqp -name "*.ts*" | wc -l`, 8058 total)

| 파일 | LOC | 임계(500) |
|---|---|---|
| `components/EqpPage.tsx` | **1771** | 초과 (레포 최대 단일 파일) |
| `components/EqpManageFormModal.tsx` | **1401** | 초과 |
| `api/eqp.api.ts` | **784** | 초과 (api 임계 400) |
| `types/eqp.types.ts` | 497 | 미달 |
| `components/GatewayGroupTable.tsx` | 459 | 미달 |
| `components/EqpModelBindingModal.tsx` | 397 | 미달 |
| `components/CheckInModal.tsx` | 350 | 미달 |
| `components/EqpSidebar.tsx` | 331 | 미달 |
| `components/EqpInfoTable.tsx` | 281 | 미달 |
| `stores/eqp-ui.store.ts` | 133 | 미달 (store 임계 400) |

### 1-2. 컴포넌트 복잡도 (`grep -c 'useState[<(]'` — 1회차 교훈 #3 의 정정된 패턴)

| 파일 | LOC | useState | useEffect | useMemo | useCallback | export fn |
|---|---|---|---|---|---|---|
| EqpPage.tsx | 1771 | **14** | 3 | **22** | **24** | 1 |
| EqpManageFormModal.tsx | 1401 | 3 | 0 | 6 | 0 | 1 |
| EqpSidebar.tsx | 331 | 2 | 0 | 2 | 0 | 0 |
| eqp.api.ts | 784 | — | — | — | — | — |
| eqp-ui.store.ts | 133 | — | — | — | — | — |

EqpPage 의 useState 14 는 임계 8 초과, useEffect 3 은 임계 4 미달.
`useMemo` 22 + `useCallback` 24 = 파생 상태/핸들러 46 건이 한 함수 본문에 있다.

### 1-3. 안티패턴

- `key={index}` / `key={i}` / `key={idx}`: **features/eqp 전체 0건** (수정 대상 없음)
- inline-object prop (`={{`): EqpSidebar 2 / EqpPage 2 / CheckInModal 1
  → **P3 기록만.** SKILL 정책대로 PASS/FAIL 판정에서 제외 (false positive 높음)

### 1-4. EqpPage.tsx 구조 실측 (file:line)

| 구간 | 줄 범위 | LOC | 성격 |
|---|---|---|---|
| import | 1-70 | 70 | `EqpManageFormModal` 은 이미 lazy (32-34) |
| 상수 / 타입 | 71-131 | 61 | dialog state 타입 4 + EMPTY 상수 4 + async 폴링 상수 3 |
| **순수 헬퍼** | 132-284 | **153** | `createEditableParamRowId` / `toEditableParamRow` / `resolveErrorMessage` / `isEqpInfoItem` / `resolveEqpItems` / `normalizeParamText` / `computeEqpParamDiffRows` |
| props / docstring | 286-309 | 24 | |
| 컴포넌트 본문 (hooks·핸들러·파생) | 310-1394 | **1085** | |
| JSX render | 1395-1771 | **377** | |

JSX 세부:
- `EqpSidebar` 호출 1405-1427 (23)
- 가운데 분기 1433-1653 (221) — none / gateway / business / **개별 설비 상세 1461-1652 (192)**
  - 그중 하단 파라미터·Checkout 패널 1499-1651 (**153**)
- 모달 7 개 1658-1767 (**110**)

### 1-5. 순수 헬퍼 재사용 여부 (Grep 실측)

`computeEqpParamDiffRows` / `resolveEqpItems` / `toEditableParamRow` /
`createEditableParamRowId` / `normalizeParamText` / `EditableEqpParamRow` — EqpPage 밖 사용 **0건**.
`isEqpInfoItem` 은 `api/eqp.api.ts:60` 에 **별개 로컬 사본**이 존재하고, `resolveErrorMessage` 는
`features/model/components/ModelPage.tsx:56` 에 **별개 로컬 사본**이 존재한다.
→ 중복이지만 이번 요청 범위 밖. **언급만 하고 통합하지 않는다** (글로벌 룰 #4 surgical).

## 2. 런타임 baseline (2 샘플 — 1회차 교훈 #2)

`node tests/e2e/_perf_measure.mjs`, 실제 백엔드(localhost:8080) 연결.

| 샘플 | EqpPage cold | select | warm | rows |
|---|---|---|---|---|
| 1 (`refactor-baseline-2026-08-20T0156.json`) | api=6 slowest=**4702ms** | api=3 69ms | api=5 54ms | [25] |
| 2 (`refactor-baseline-2026-08-20T0158-s2.json`) | api=6 slowest=97ms | api=3 85ms | api=5 76ms | [25] |

샘플 1 의 4702ms 는 1회차 교훈 #2 그대로 vite on-demand transform 아티팩트
(같은 run 에서 ModelPage warm 4544ms / LiveMapPage cold 4574ms 도 동반 spike).

> **판정 기준 (1회차 교훈 #4 승계)**: ±5% 시간 게이트는 이 규모에서 노이즈보다 작아 적용하지
> 않는다. **api 호출 수(cold 6 / select 3 / warm 5) + rows=[25] 불변 + 2 샘플 스프레드 겹침**
> 으로 판정하고, 그 사실을 결과에 명시한다.

## 3. 빌드 baseline

```
dist/assets/EqpPage-yx04NNua.js                 70.54 kB │ gzip:  17.62 kB
dist/assets/DeployPage-Ci5FzAvI.js              70.77 kB │ gzip:  16.40 kB
dist/assets/three-vendor-DEs0r1HY.js           906.27 kB │ gzip: 244.45 kB
(!) Some chunks are larger than 500 kB after minification.
✓ built in 22.63s
```
PASS. EqpPage 청크 **70.54 kB / gzip 17.62 kB**.

## 4. 회귀 게이트 (e2e 실측 — 1회차보다 강함)

`grep -rn "goto('/eqp/gateway'|goto('/eqp/business'|goto('/eqp')" tests/e2e/` 결과
EqpPage 라우트를 실제로 여는 스펙 **10 파일**:

| 스펙 | 커버 영역 |
|---|---|
| `plc/plc-eqp-polling-group.spec.ts` (2 test) | 폴링 그룹 Start/End + async PASS |
| `verify-ui/overlays-eqp-result.spec.ts` (3 test) | CheckInModal / DeleteResultDialog / **LifecycleResultDialog** |
| `verify-ui/overlays-eqp.spec.ts` (3 test) | ManageFormModal(create) / Info·Model·Delete / **LifecycleActionDialog** |
| `plc/plc-eqp-form.spec.ts` (2 test) | PLC 폼 오픈 + 제출 body |
| `eqp-line-select.spec.ts` (2 test) | 라인 드롭다운 + 미선택 저장 차단 |
| `selectable-table/selectable-table-gateway-group.spec.ts` | GatewayGroupTable 클릭/드래그 |
| `selectable-table/selectable-table-check-in.spec.ts` | CheckIn 테이블 |
| `modal/modal-visual-sweep-eqp.spec.ts`, `modal/modal-overflow-guard-extra.spec.ts` | 모달 레이아웃 |
| `verify-ui/routes.spec.ts`, `i18n/i18n-language-toggle.spec.ts` | 라우트 렌더 / i18n |

1회차 이월 후보였던 "전용 e2e 없음(회귀 검증 약함)" 문제가 이번 회차에는 없다 —
lifecycle·폴링그룹·모달 전 경로에 전용 assertion 이 있다.

## 5. 우선순위

### P1 (이번 회차 대상)
- `EqpPage.tsx` 1771줄 / useState 14 — 확정 분해 대상

### P2 (기록만 — 분할 확장 여부는 사용자 결정)
- `EqpManageFormModal.tsx` **1401줄**. 확정 4파일 밖. useState 3 / useMemo 6 으로
  hook 군집은 작고 **LOC 대부분이 폼 필드 JSX** 다 (SECS/SOCKET/PLC 3 인터페이스 분기).
  분할 시 인터페이스별 섹션 컴포넌트(`EqpFormSecsSection` 등) 추출이 자연 단위.
  이미 lazy 청크(`EqpManageFormModal-Bx9gTMvK.js` 24.64 kB)라 초기 로드 영향은 없다.
- `api/eqp.api.ts` **784줄** (임계 400 초과). 1회차의 `deploy.api.ts` 811줄과 같은 성격.

### P3 (기록만)
- `types/eqp.types.ts` 497 / `GatewayGroupTable.tsx` 459 — 임계 미달
- inline-object prop 5건 (§1-3)

## 6. 분할 후보 (EqpPage.tsx — 결합도 실측 후)

| # | 후보 | 이동 LOC | EqpPage 예상 | useState | 결합 비용 |
|---|---|---|---|---|---|
| A | 순수 헬퍼 → `lib/eqp-page-params.ts` | ~155 (132-284 + 타입 77) | ~1618 (-8.6%) | 14 유지 | **없음** (외부 사용 0건) |
| B | `useEqpLifecycleCommands` 훅 | ~198 (93-130 / 388-403 / 630-653 / 926-1060) | ~1585 (-10.5%) | **14→11** | mutation 5개를 인자로 전달 |
| C | `useEqpParamEditing` 훅 | ~100 (378 / 1132-1228) | ~1680 (-5.1%) | 14→13 | `setLocalEditRows` 외부 5곳 호출 → 노출 필요, `setCheckInErrorMessage` 콜백 주입 |
| D | `EqpParamCheckoutPanel.tsx` (JSX) | ~153 (1499-1651) | ~1620 (-8.5%) | 14 유지 | **props ~28** |
| E | `EqpPageDialogs.tsx` (JSX) | ~110 (1658-1767) | ~1663 (-6.1%) | 14 유지 | **props ~30** |

## 7. 적용 이력

### 7-1. B — `useEqpLifecycleCommands` 훅 추출 (사용자 선택)

신규 파일:
- `hooks/useEqpLifecycleCommands.ts` (279) — 라이프사이클 4 액션 + PLC 폴링 그룹 명령
- `lib/eqp-error-message.ts` (15) — `resolveErrorMessage` 만 최소 이동.
  EqpPage 와 훅이 함께 쓰는데 훅이 페이지를 import 하면 순환 참조가 되므로
  1회차 교훈 #5 대로 lib 를 공유 지점으로 삼았다. **후보 A 의 나머지 헬퍼는 그대로 뒀다**
  (compound 변경 금지).

정정 파일:
- `tests/unit/async-command-guard.test.ts:101` — 두 pending flag 파생식의 소스 경로를
  EqpPage.tsx → useEqpLifecycleCommands.ts 로 갱신. **이 테스트가 이동을 실제로 잡아냈다**
  (241 중 1 FAIL). guard 배선 회귀망이 무력한 mock 이 아님이 입증된 셈이다.

#### 정적 효과 (측정값)

| 지표 | before | after | 변화 |
|---|---|---|---|
| EqpPage.tsx LOC | 1771 | **1574** | **-197 (-11.1%)** |
| EqpPage useState | 14 | **11** | -3 (임계 8 은 여전히 초과) |
| EqpPage useCallback | 24 | **17** | -7 |
| EqpPage useEffect | 3 | 3 | 불변 |
| EqpPage useMemo | 22 | 22 | 불변 |

부수 정리: `useAsyncCommandGuard` / `eqpApi` / `isActiveEquipment` / `ApiError` import 4 개가
EqpPage 에서 미사용이 되어 제거(내 변경이 만든 미사용 import — 글로벌 룰 #4).

#### 빌드

```
dist/assets/EqpPage-xEX65Gg6.js                 71.31 kB │ gzip:  17.74 kB
dist/assets/konva-vendor-S8GZOvSS.js           312.33 kB │ gzip:  95.73 kB
dist/assets/three-vendor-DEs0r1HY.js           906.27 kB │ gzip: 244.45 kB
(!) Some chunks are larger than 500 kB after minification.
✓ built in 17.80s
```
PASS. EqpPage 청크 70.54 → **71.31 kB (+0.77 kB, +1.1%)**, gzip 17.62 → 17.74 (+0.7%).
±10% 게이트 내. 증가분은 훅의 인터페이스 보일러플레이트(파라미터/반환 타입 + 반환 객체)다 —
**분할로 청크가 줄지는 않았다**는 사실을 그대로 기록한다.

#### lint / unit

```
> eslint .
```
경고 0 / 오류 0.

```
1..241
# tests 241
# pass 241
# fail 0
# duration_ms 3227.6353
```

#### e2e — clean HEAD 대조 실행

serial mode(`overlays-eqp.spec.ts:25` / `overlays-eqp-result.spec.ts:31`) 때문에 파일 통째
실행 시 선행 테스트 실패가 **lifecycle 테스트를 skip 시킨다**(`did not run`). 그래서 핵심
테스트를 라인 지정으로 격리해 clean HEAD(`git stash`) 와 변경 후를 각각 측정했다.

| 상태 | 결과 | 실패 목록 |
|---|---|---|
| clean HEAD | 6 passed / 4 failed | selectable-table-check-in:307, :340 / selectable-table-gateway-group:195, :247 |
| 변경 후 | **6 passed / 4 failed** | **동일 4건** |

PASS 6 건 = `plc-eqp-polling-group.spec.ts:228`(Start → EQP_PLC_GROUP_START + async PASS) /
`:251`(End → EQP_PLC_GROUP_END) / `overlays-eqp.spec.ts:94`(EqpLifecycleActionDialog) /
`overlays-eqp-result.spec.ts:165`(EqpLifecycleResultDialog — lifecycle 명령 실행 후) /
`modal-visual-sweep-eqp.spec.ts:89`, `:114`.
→ **추출한 로직의 전 경로가 실제 백엔드 대상 e2e 로 커버되고 통과**했다.

FAIL 4 건은 clipboard(Ctrl+C → TSV) / ContextMenu 계열로 **clean HEAD 에서 동일하게 실패**한다.
이 회차 변경과 무관하다.

##### 사전 실패로 이번 회차에 검증 불가한 경로 (숨기지 않고 기록)

`git stash` 대조에서 clean HEAD 에서도 실패하는 스펙 — 전부 `/login` 리다이렉트로
`eqp-sidebar-gateway-tree` 대기 타임아웃:
`eqp-line-select.spec.ts:126`, `:144` / `plc-eqp-form.spec.ts:127`, `:149` /
`overlays-eqp.spec.ts:45` / `overlays-eqp-result.spec.ts:82`.
모두 **EqpManageFormModal(create) 진입 경로**다. 이번 분할은 이 경로를 건드리지 않았지만,
**게이트가 사전 실패로 비어 있다는 사실 자체는 남는다.** 3회차 이전에 이 로컬 세션 실패
원인을 따로 잡는 편이 좋다.

#### 런타임

| 샘플 | EqpPage cold | select | warm | rows |
|---|---|---|---|---|
| baseline 1 | api=6 4702ms | api=3 69ms | api=5 54ms | [25] |
| baseline 2 | api=6 97ms | api=3 85ms | api=5 76ms | [25] |
| after 1 | api=6 286ms | api=3 4635ms | api=5 4642ms | [25] |
| after 2 | api=6 112ms | api=3 64ms | api=5 4547ms | [25] |
| after 3 | api=6 172ms | api=3 65ms | api=5 4617ms | [25] |

**api 호출 수(6 / 3 / 5)와 rows=[25] 가 5 샘플 전부 동일** → 배선 회귀 없음.

시간축의 ~4.6s spike 는 이 변경 탓이 아니다. JSON 을 열어 >1000ms 호출을 전수 뽑으면
baseline 에도 3 건 있고(`EqpPage/cold /api/eqp/manage-batch 4702ms`,
`ModelPage/warm /api/model 4544ms`, `LiveMapPage/cold /api/live-map/layout 4574ms`),
after 에도 **내가 손대지 않은 페이지**에 같은 크기로 찍힌다(`DlqPage/cold /api/line 4604ms`,
`LiveMapPage/cold /api/live-map 4549ms`, `DlqPage/warm /api/eqp 4602ms`).
전부 status 200 이고 값이 4.55~4.70s 로 균일 — 프론트 코드 경로와 무관한 **백엔드/환경 stall**
이다. 1회차 교훈 #4 대로 **"±5% 이내라 PASS" 라고 쓰지 않는다.**

#### 판정

정적 개선(-11.1% / useState -3) + 기능 게이트 PASS + 배선 불변 → **commit**.
단, 청크는 +1.1% 증가했고 런타임 시간축은 환경 stall 로 판정 불가다.

### 7-2. 미적용 (다음 회차 이월)

| 후보 | 이유 |
|---|---|
| A 순수 헬퍼 → lib | `resolveErrorMessage` 만 선이동. 나머지(computeEqpParamDiffRows 89줄 등) 미착수 |
| C `useEqpParamEditing` 훅 | 미착수 |
| D `EqpParamCheckoutPanel` JSX | 미착수. props ~28 부채 재검토 필요 |
| E `EqpPageDialogs` JSX | 미착수. lazy Suspense 경계 이동 위험 |

EqpPage 는 1574 로 여전히 임계 500 의 3.1 배, useState 11 로 임계 8 초과다 —
**이번 회차 1 건으로 임계 달성은 못 했다.**
