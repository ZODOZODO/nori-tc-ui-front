# features/deploy 리팩토링 감사 — 2026-08-20

ui-front-refactor SKILL / audit-full. wm-parity 후속 트랙 #9 의 1/3 회차.
확정 분해 대상 3 건 (wm-parity-foundation.md:178-180, wm-parity-foundation-plan.md:1153).

## 1. 정적 baseline

### 1-1. LOC 분포 (`find src/features/deploy -name "*.ts*" | wc -l`, 2026-08-20 실측)

| 파일 | LOC | 임계 | 판정 |
|---|---|---|---|
| components/DeployRegisterPanel.tsx | 1556 | .tsx > 500 | **P1** |
| components/DeployMonitorPanel.tsx | 1519 | .tsx > 500 | **P1** |
| api/deploy.api.ts | 811 | api > 400 | P2 (이번 회차 대상 아님) |
| stores/deploy-ui.store.ts | 796 | store > 400 | **P1 (확정 대상)** |
| types/deploy.types.ts | 310 | — | PASS |
| lib/deploy-register-utils.ts | 152 | — | PASS |
| lib/deploy-utils.ts | 111 | — | PASS |
| components/SelectedParamVersionCell.tsx | 89 | — | PASS |
| components/DeployPage.tsx | 57 | — | PASS |
| hooks/* (13 파일) | 12~33 | — | PASS |

deploy 합계 5750 LOC.

### 1-2. 컴포넌트 복잡도 (Grep 카운트)

측정 패턴: `grep -c 'useState[<(]'`. SKILL 예시의 `useState(` 만으로는
`useState<string | null>(...)` 형태가 누락되므로 제네릭 인자 형태를 포함해 재측정했다.

| 파일 | LOC | useState | useReducer | useEffect | useMemo | useCallback | export fn |
|---|---|---|---|---|---|---|---|
| DeployRegisterPanel.tsx | 1556 | 8 | 0 | 2 | 20 | 0 | 1 |
| DeployMonitorPanel.tsx | 1519 | 9 | 0 | 4 | 14 | 0 | 1 |
| deploy-ui.store.ts | 796 | — | — | — | — | — | 3 |
| deploy.api.ts | 811 | — | — | — | — | — | 1 |

- `useState` 임계(≥8): **두 패널 모두 초과** — DeployMonitorPanel 9 건(:263-271),
  DeployRegisterPanel 8 건(:113-127).
- 그럼에도 상태 상당량은 zustand store 로 옮겨져 있어 store 가 796 줄로 비대하다.
  store 분리가 두 패널 LOC 와 같은 뿌리.
- `useMemo` 20 / 14 는 임계표에 없는 항목이나, 두 파일 모두 파생 상태 계산이 렌더 함수 안에
  집중되어 있음을 보여준다 → 커스텀 훅 추출의 근거.
- `export function` 각 1 개 = 단일 거대 함수. DeployRegisterPanel 은 83~1556 (1473 줄) 이
  통째로 한 함수 본문이다.

### 1-3. 안티패턴

| 항목 | 결과 |
|---|---|
| `key={index}` / `key={i}` / `key={idx}` | **0 건** (features/deploy 전체 Grep) |
| inline-object prop `<X y={{` | 0 건 (두 패널 모두). false-positive 축이나 실제로도 0 |

즉시 수정 대상 안티패턴 없음. 분할만이 과제.

### 1-4. 런타임 baseline

`.claude/perf/measurements/refactor-baseline-2026-08-20T0048.json`

```
[login] ok (userId=admin)
[EqpPage] cold api=6 slowest=280ms | select api=3 slowest=76ms | warm api=5 slowest=103ms | rows=[25]
[ModelPage] cold api=2 slowest=33ms | select api=1 slowest=37ms | warm api=2 slowest=39ms | rows=[1]
[DeployPage] cold api=3 slowest=29ms | warm api=3 slowest=42ms | rows=[1]
[DlqPage] cold api=7 slowest=53ms | warm api=6 slowest=60ms | rows=[1]
[LiveMapPage] cold api=5 slowest=168ms | warm api=4 slowest=85ms | rows=[]
```

regression anchor: **DeployPage cold slowest=29ms / warm slowest=42ms / rows=1**.

### 1-5. 빌드 baseline — PASS

```
dist/assets/DeployPage-h1znTWd0.js                 70.46 kB │ gzip:  16.11 kB
dist/assets/EqpPage-DwpGSKN6.js                    70.54 kB │ gzip:  17.62 kB
dist/assets/react-vendor-pcWEGqQY.js              228.74 kB │ gzip:  73.28 kB
dist/assets/index-CprJLkqz.js                     247.57 kB │ gzip:  73.13 kB
dist/assets/konva-vendor-S8GZOvSS.js              312.33 kB │ gzip:  95.73 kB
dist/assets/three-vendor-DEs0r1HY.js              906.27 kB │ gzip: 244.45 kB
(!) Some chunks are larger than 500 kB after minification.
✓ built in 33.49s
```

regression anchor: **DeployPage 청크 70.46 kB (gzip 16.11 kB) / 빌드 33.49s**.

## 2. 우선순위

### P1 — 이번 회차 확정 대상

1. **DeployRegisterPanel.tsx 1556** — 단일 함수 1473 줄.
   - 시나리오 선택 모달: 상태 `ScenarioDialogState`(DeployRegisterPanel.tsx:75-79),
     컬럼 `scenarioColumns`(:958-1056), 렌더 `<Dialog>`(:1115-1225) ≈ 175 줄
   - 결과 알림 모달: `DeployDialogState`(:66-73), 렌더(:1060-1113) ≈ 60 줄
   - 검색 카드 렌더(:1227-1375) ≈ 149 줄 / 선택목록 카드(:1377-1423) ≈ 47 줄 /
     배포설정 카드(:1425-1553) ≈ 129 줄
   - 파생 상태 useMemo 20 건(:132-290) ≈ 158 줄 → 커스텀 훅 후보
   - 배포 실행 오케스트레이션 `handleDeploy`/`executeDeploy`(:436-707) ≈ 271 줄
2. **DeployMonitorPanel.tsx 1519**
   - Deploy View 모달 서브시스템이 응집 덩어리: 파생 상태/쿼리(:424-682) +
     `commentTargetColumns`(:885-969) + `<Dialog>` 렌더(:1011-1175) ≈ **509 줄**
   - 나머지: 파일 상단 순수 헬퍼(:67-227, 161 줄), 이력 컬럼(:379-424),
     핸들러(:690-883), 조회/목록 카드 렌더(:1176-1519)
3. **deploy-ui.store.ts 796** — 확정 방향은 **순수함수 분리**
   - 이미 파일 내 순수 헬퍼가 분리 가능 상태로 존재: `toDateInputValue`(:85),
     `createDefaultMonitorFilters`(:96), `createInitialDeployUiDataState`(:110),
     `nextDeployKey`(:132), `createBridgeTargets`(:135-153),
     `createPlaceholderTargetSummary`(:154-231), `createServerBridgeHistoryItem`(:232-271),
     `mergeHistoryItem`(:272-284) ≈ **200 줄** → `lib/deploy-ui-state.ts` 로 이동 시
     store 는 create() 본문(:285-789) 중심으로 축소

### P2 — 기록만 (이번 회차 분할 적용 대상 아님)

| 파일 | LOC | 비고 |
|---|---|---|
| src/features/eqp/components/EqpPage.tsx | 1771 | 2회차 |
| src/features/model/components/ModelPage.tsx | 1504 | 3회차 |
| src/features/live-map/components/LiveMap3DScene.tsx | 1455 | 미배정 |
| src/features/eqp/components/EqpManageFormModal.tsx | 1401 | 2회차 |
| src/features/model/components/ModelDetailPanel.tsx | 1194 | 3회차 |
| src/features/live-map/components/LiveMapDemoModal.tsx | 1011 | 미배정 |
| src/features/live-map/components/LiveMapBoard.tsx | 969 | 미배정 |
| src/features/deploy/api/deploy.api.ts | 811 | deploy 이지만 확정 3 대상 밖 |
| src/features/eqp/api/eqp.api.ts | 784 | 2회차 |

### P3 — 기록만 (500~800)

model/components/modelDetailColumnDefs.tsx 727, model/lib/model-detail-editor.ts 682,
model/components/FlowFilterEditorModal.tsx 644, model/components/ActionDataIndexEditorModal.tsx 640,
model/api/model.api.ts 633, shared/components/SelectableTable/SelectableTable.tsx 605,
model/components/FlowCard.tsx 508.

## 3. 회귀 게이트

- `npm run test:unit` / `npm run lint`
- e2e: `tests/e2e/deploy/` 3 스펙 — deploy-monitor-view-modal.spec.ts /
  deploy-register-bulk-guard.spec.ts / deploy-register-scenario-modal.spec.ts
- 런타임 재측정 DeployPage ±5%, 청크 ±10%

## 4. 적용 이력

### 4-1. Deploy View 모달 추출 (DeployMonitorPanel → DeployMonitorViewModal)

**변경 파일**
- `src/features/deploy/components/DeployMonitorPanel.tsx` (수정)
- `src/features/deploy/components/DeployMonitorViewModal.tsx` (신규)
- `src/features/deploy/lib/deploy-monitor-format.ts` (신규 — 패널/모달 공유 포매터.
  모달이 패널을 import 하면 순환 참조가 되므로 `resolveStatusVariant` / `formatDateTime`
  두 개만 lib 로 이동. 모달 전용인 `resolveTargetResultLabel` / `resolveTargetResultVariant`
  는 모달 파일로 이동)

**경계** — props `deployKey` / `historyItem` / `isServerBacked` / `onClose`.
`localTargetsByDeployKey` 는 모달이 store 를 직접 구독(패널에서는 이 모달만 쓰던
구독이라 제거). `commentHistoryItem` 은 `resolvedHistoryItems` 파생이라 패널에 잔류.
식별자는 모달 안에서 `comment` 접두사를 제거(파일 전체가 그 모달이라 중복).

**정적 효과**

| 항목 | before | after | 변화 |
|---|---|---|---|
| DeployMonitorPanel.tsx LOC | 1519 | 1055 | **-464 (-30.5%)** |
| DeployMonitorViewModal.tsx LOC | — | 463 | 신규 |
| deploy-monitor-format.ts LOC | — | 31 | 신규 |
| 패널 useMemo | 14 | 8 | -6 (모달로 6 이동) |
| 패널 useState | 9 | 9 | 불변 (모달은 useState 0 — props/쿼리 파생) |
| 합계 (3 파일) | 1519 | 1549 | +30 (import/props 경계 비용) |

패널은 여전히 500 초과(1055)로 P1 잔존. 다음 후보는 조회/목록 카드 렌더 분리.

**게이트 — 전부 PASS**

lint:
```
> nori-tc-ui@0.0.0 lint
> eslint .
```
(무출력 = 위반 0. 중간에 `DeployTargetItem` 미사용 1 건 검출 → import 제거로 해소)

unit:
```
1..241
# tests 241
# pass 241
# fail 0
# duration_ms 5194.3156
```

build:
```
dist/assets/DeployPage-CMlpTn3z.js                  70.64 kB │ gzip:  16.31 kB
dist/assets/react-vendor-pcWEGqQY.js               228.74 kB │ gzip:  73.28 kB
dist/assets/konva-vendor-S8GZOvSS.js               312.33 kB │ gzip:  95.73 kB
dist/assets/three-vendor-DEs0r1HY.js               906.27 kB │ gzip: 244.45 kB
✓ built in 20.13s
```
DeployPage 70.46 → 70.64 kB (+0.26%), gzip 16.11 → 16.31 kB (+1.2%) — 임계 ±10% 내 PASS.
모달을 lazy 로 쪼개지 않았으므로 청크 분포 변화 없음(의도대로).

e2e (`tests/e2e/deploy/`):
```
  ok 1 [chromium] › deploy-register-bulk-guard.spec.ts:72:1 › 100+ 설비 전체선택 → 추가 시 가상화 + 개수 가드로 서버 400 을 사전 차단한다 (9.2s)
  ok 3 [chromium] › deploy-monitor-view-modal.spec.ts:96:1 › Deploy View 모달 — 대상별 진행 현황 테이블이 모달 폭 안에 들어온다 (가로 overflow 없음) (10.6s)
  ok 2 [chromium] › deploy-register-scenario-modal.spec.ts:125:1 › 시나리오 선택 모달 — 테이블이 모달 폭 안에 줄바꿈되어 들어온다 (가로 overflow 없음) (11.4s)

  3 passed (14.0s)
```
e2e 직전 vite dev 서버 재시작(포트 3000 taskkill 후 bat 재기동) — Windows stale HMR 서빙으로
옛 코드가 PASS 하는 위양성 차단.

**런타임 regression** — `refactor-after-2026-08-20T0117.json` / `-0119-2.json` (2 회 샘플)

| 지표 | baseline | after #1 | after #2 | 판정 |
|---|---|---|---|---|
| DeployPage cold slowest | 29ms | 32ms | 32ms | PASS (절대차 +3ms, 측정 노이즈 수준) |
| DeployPage warm slowest | 42ms | 34ms | 38ms | PASS |
| DeployPage api 수 | 3 / 3 | 3 / 3 | 3 / 3 | 동일 |
| DeployPage rows | 1 | 1 | 1 | 동일 |

- 상대 %(cold +10.3%)는 임계 ±5% 를 넘지만 **기준값이 29ms 라 1.45ms 가 임계폭**이다.
  2 회 샘플이 32ms 로 동일하고 api 수 / rows 가 불변이므로 노이즈로 판정.
- after #1 의 `LiveMapPage cold 4611ms` 는 dev 서버 재시작 직후 vite 최초 transform
  아티팩트다 — after #2 에서 167ms 로 복귀. deploy 변경과 무관.

**판정: 정적 개선(-30.5%) + 런타임 regression 없음 → commit** (521f706)

### 4-2. 시나리오 선택 모달 추출 (DeployRegisterPanel → DeployRegisterScenarioModal)

**변경 파일**
- `src/features/deploy/components/DeployRegisterPanel.tsx` (수정)
- `src/features/deploy/components/DeployRegisterScenarioModal.tsx` (신규)

**경계 결정 — controlled component** (후보 제시 때의 "selectedScenarioCode 자식 소유"에서 변경).
자식이 소유하려면 `preview.recommendedScenarioCode ?? preview.scenarios[0]?.code ?? ''`
초기화를 자식에서 다시 해야 하고(현재는 부모 handleDeploy 가 preview 수신 시점에 계산),
그 순간 초기화 타이밍이 바뀌어 동작 변경 위험이 생긴다. 그래서 부모가 `scenarioDialogState`
를 그대로 소유하고 자식은 `open` / `preview` / `selectedScenarioCode` / `isDeploying` +
`onSelectScenarioCode` / `onDeploy` / `onClose` 만 받는 controlled 로 두었다 — **동작 변경 0**.

`formatChangeKinds` / `Loader2` / `ScenarioRow` 는 이동 블록 전용이라 부모 import 에서 제거.
`Dialog*` / `TableRow` / `SelectableTable` 은 부모의 결과 알림 모달·검색 테이블이 계속 쓰므로 잔류.

**정적 효과**

| 항목 | before | after | 변화 |
|---|---|---|---|
| DeployRegisterPanel.tsx LOC | 1556 | 1357 | **-199 (-12.8%)** |
| DeployRegisterScenarioModal.tsx LOC | — | 249 | 신규 |
| 패널 useState | 8 | 8 | 불변 (모달 useState 0 — 완전 controlled) |
| 패널 useMemo | 20 | 20 | 불변 (파생 상태는 이번 분할 대상 아님) |

**게이트 — 전부 PASS**

lint:
```
> nori-tc-ui@0.0.0 lint
> eslint .
```
unit:
```
1..241
# tests 241
# pass 241
# fail 0
# duration_ms 3463.9908
```
build:
```
dist/assets/DeployPage-CjSiD32-.js                  70.77 kB │ gzip:  16.40 kB
✓ built in 20.36s
```
DeployPage 70.64 → 70.77 kB (+0.18%, baseline 70.46 대비 누적 +0.44%) — ±10% 내 PASS.

e2e:
```
  ok 1 [chromium] › deploy-register-bulk-guard.spec.ts:72:1 › 100+ 설비 전체선택 → 추가 시 가상화 + 개수 가드로 서버 400 을 사전 차단한다 (9.2s)
  ok 3 [chromium] › deploy-monitor-view-modal.spec.ts:96:1 › Deploy View 모달 — 대상별 진행 현황 테이블이 모달 폭 안에 들어온다 (가로 overflow 없음) (9.4s)
  ok 2 [chromium] › deploy-register-scenario-modal.spec.ts:125:1 › 시나리오 선택 모달 — 테이블이 모달 폭 안에 줄바꿈되어 들어온다 (가로 overflow 없음) (10.2s)

  3 passed (12.2s)
```
(e2e 직전 dev 서버 재시작)

**런타임 regression** — `refactor-after-2026-08-20T0137-scenario.json`

| 지표 | baseline | after | 판정 |
|---|---|---|---|
| DeployPage cold slowest | 29ms | 26ms | PASS |
| DeployPage warm slowest | 42ms | 37ms | PASS |
| DeployPage api 수 / rows | 3 / 3, 1 | 3 / 3, 1 | 동일 |

같은 run 의 `EqpPage warm 4656ms` 는 dev 서버 재시작 직후 vite 최초 transform 아티팩트
(1 회차의 LiveMap 4611ms 와 동일 현상). deploy 변경과 무관.

**판정: 정적 개선(-12.8%) + 런타임 regression 없음 → commit**

### 4-3. deploy-ui.store.ts 순수함수 분리 (→ lib/deploy-ui-state.ts)

방향은 wm-parity-foundation-plan.md:1153 에서 확정된 사항이라 분할 패턴 선택 없이 적용.

**변경 파일**
- `src/features/deploy/stores/deploy-ui.store.ts` (수정)
- `src/features/deploy/lib/deploy-ui-state.ts` (신규)
- `src/features/deploy/components/DeployMonitorPanel.tsx` (import 경로만 변경)

**이동 대상** — set/get 클로저를 쓰지 않는 순수 함수·상수 8 개:
`toDateInputValue`(모듈 내부, 미export) / `EMPTY_REGISTER_FILTERS` /
`createDefaultMonitorFilters` / `createInitialDeployUiDataState` / `nextDeployKey` /
`createBridgeTargets` / `createPlaceholderTargetSummary` / `createServerBridgeHistoryItem` /
`mergeHistoryItem`.

`DEPLOY_UI_STORAGE_KEY` 는 persist 설정과 `clearDeployUiSessionState` 가 쓰므로 store 에 잔류.
`createDefaultMonitorFilters` 는 외부 import 처가 DeployMonitorPanel 1 곳뿐이라(워크스페이스
Grep 확인) store 재export 없이 import 경로를 lib 로 바꿨다.

**정적 효과**

| 항목 | before | after | 변화 |
|---|---|---|---|
| deploy-ui.store.ts LOC | 796 | 607 | **-189 (-23.7%)** |
| deploy-ui-state.ts LOC | — | 212 | 신규 (전부 순수 함수 → 단위테스트 부착 가능) |

store 는 임계(400) 를 여전히 초과(607). create() 본문의 액션 구현이 남은 덩어리다.

**게이트 — 전부 PASS**

lint:
```
> nori-tc-ui@0.0.0 lint
> eslint .
```
unit:
```
1..241
# tests 241
# pass 241
# fail 0
# duration_ms 3416.9677
```
build:
```
dist/assets/DeployPage-Ci5FzAvI.js                  70.77 kB │ gzip:  16.40 kB
✓ built in 22.17s
```
청크 불변(70.77 kB) — 같은 청크 안의 모듈 이동이라 예상대로.

e2e:
```
  ok 3 [chromium] › deploy-register-bulk-guard.spec.ts:72:1 › 100+ 설비 전체선택 → 추가 시 가상화 + 개수 가드로 서버 400 을 사전 차단한다 (9.4s)
  ok 1 [chromium] › deploy-monitor-view-modal.spec.ts:96:1 › Deploy View 모달 — 대상별 진행 현황 테이블이 모달 폭 안에 들어온다 (가로 overflow 없음) (10.0s)
  ok 2 [chromium] › deploy-register-scenario-modal.spec.ts:125:1 › 시나리오 선택 모달 — 테이블이 모달 폭 안에 줄바꿈되어 들어온다 (가로 overflow 없음) (12.3s)

  3 passed (15.9s)
```

**런타임 regression** — 2 회 샘플 (`-store.json` / `-store-2.json`)

| 지표 | baseline | after #1 | after #2 | 판정 |
|---|---|---|---|---|
| DeployPage cold slowest | 29ms | 37ms | 32ms | PASS (아래 주석) |
| DeployPage warm slowest | 42ms | 20ms | 51ms | PASS |
| DeployPage api 수 / rows | 3 / 3, 1 | 3 / 3, 1 | 3 / 3, 1 | 동일 |

## 5. 측정 방법론 한계 (정직하게 기록)

- **±5% 게이트는 이 지표 크기에서 판정 불가**다. DeployPage 응답은 20~51ms 대이고
  ±5% = ±1.5ms 로 측정 노이즈(회차 간 스프레드 ~30ms)보다 훨씬 작다. 그래서 본 회차의
  런타임 판정은 **api 호출 수 / rows 수 불변 + 3 회 변경 전후 스프레드가 baseline 범위와
  겹침** 을 근거로 했다. "±5% 이내라서 PASS" 라고는 주장하지 않는다.
- dev 서버 재시작 직후 첫 run 에 **한 라우트가 4.6s 급 spike** 를 보인다 (1 회차 LiveMap
  4611ms, 2 회차 EqpPage 4656ms, 3 회차 EqpPage 4167/4591ms 그리고 재샘플의 LiveMap
  4597ms). 매번 다른 라우트에서 발생하므로 vite on-demand transform 아티팩트이고
  deploy 변경과 무관하다. 이 때문에 회차마다 2 회 샘플을 떴다.
- e2e 는 매 회차 직전 dev 서버를 재시작하고 실행했다 (Windows stale HMR 서빙으로 옛 코드가
  PASS 하는 위양성 차단).

## 6. 회차 종료 시점 잔존 현황 (features/deploy)

| 파일 | LOC | 임계 | 상태 |
|---|---|---|---|
| DeployRegisterPanel.tsx | 1357 | 500 | P1 잔존 — 다음 후보: 파생 상태 useMemo 20 건 → 커스텀 훅, 결과 알림 모달, 3 개 PageCard |
| DeployMonitorPanel.tsx | 1055 | 500 | P1 잔존 — 다음 후보: 조회 필터 카드, 이력 목록 카드 |
| deploy.api.ts | 811 | 400 | P2 — 이번 회차 확정 3 대상 밖 (스코프 확장은 사용자 결정) |
| deploy-ui.store.ts | 607 | 400 | P1 잔존 — create() 액션 본문이 남은 덩어리 |
| DeployMonitorViewModal.tsx | 463 | 500 | PASS |
| DeployRegisterScenarioModal.tsx | 249 | 500 | PASS |
| deploy-ui-state.ts | 212 | — | PASS |
| deploy-monitor-format.ts | 31 | — | PASS |

deploy 합계 5750 → 5854 LOC (+104, 경계/props/import 비용 — `find src/features/deploy
-name "*.ts*" -exec wc -l {} +` 실측). **거대 파일 3 개는
1556/1519/796 → 1357/1055/607 로 전부 축소**했으나 셋 다 임계는 여전히 초과한다.
