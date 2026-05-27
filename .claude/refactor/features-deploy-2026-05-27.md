# refactor — features/deploy (2026-05-27, audit-full)

측정 도구: ui-front-refactor SKILL. 서버 가동(backend 401 / front 200) 상태에서 정적 + 런타임 + 빌드 baseline 확보.

## 선행 blocker 해소 (commit 410a40f)
refactor 회귀 게이트(`npm run build`)가 기존 FAIL 이었음 — `@tanstack/query-core` 5.100.11/5.100.14 중복(react-query 패밀리 버전 불일치)으로 [AppProvider.tsx:52](../../src/app/providers/AppProvider.tsx#L52) TS2322. 4개 패키지 `^5.100.14` 정렬 → query-core 단일화 → build green 복구.

## Baseline

### 정적 (LOC / hook 분포)
| 파일 | LOC | useState | useEffect | useMemo | 우선순위 |
|---|---|---|---|---|---|
| [DeployRegisterPanel.tsx](../../src/features/deploy/components/DeployRegisterPanel.tsx) | 1650 | 8 | 3 | 19 | **P1** (LOC>1500) |
| [DeployMonitorPanel.tsx](../../src/features/deploy/components/DeployMonitorPanel.tsx) | 1424 | 8 | 4 | 14 | **P2** (800–1500, useEffect 임계) |
| [deploy.api.ts](../../src/features/deploy/api/deploy.api.ts) | 931 | — | — | — | P2 (api>400, 도메인 split 후보) |
| [deploy-ui.store.ts](../../src/features/deploy/stores/deploy-ui.store.ts) | 807 | — | — | — | P2 (store>400, slice 후보) |

deploy 전체 5666 LOC. 안티패턴 `key={index}` **0건**.

### 빌드 baseline (GREEN)
`tsc -b && vite build` PASS, built in 8.52s. DeployPage chunk 71.32 kB (gzip 17.74), index 184.88 kB (gzip 58.58).

### 런타임 baseline (regression anchor)
파일: `.claude/perf/measurements/refactor-baseline-2026-05-27T0430.json`
- DeployPage cold: apiTotalCount **10**, apiSlowestMs 22, rowCounts [table0:1, table1:1]
- dev server 측정이라 ms 는 Vite 모듈 로드 위주(노이즈). **회귀 판정 = rowCounts + apiTotalCount 불변 + ms ±5%**.

## DeployRegisterPanel.tsx 내부 구조 (P1 분할 대상)
- 47–205 (~150 LOC): 모듈 스코프 순수 헬퍼 11개 (file-private)
- 208–308 (~100 LOC): `SelectedEquipmentRow` 내부 컴포넌트 (file-private, 미export)
- 310–1650 (~1340 LOC): `DeployRegisterPanel` god 함수. useState 8(339–350) / useMemo 19 / useEffect 3. JSX return 1037~.

모두 file-private → 추출 시 외부 import 영향 없음.

## 분할 후보 (사용자 선택 — Step 3)
- A. 순수 헬퍼 11개 → `lib/deploy-register-utils.ts` (~150 LOC, 런타임 0 위험, quality 단계 단위테스트 대상화)
- B. `SelectedEquipmentRow` → `components/SelectedEquipmentRow.tsx` (~100 LOC, 컴포넌트 경계 명확)
- C. useState/useMemo/useEffect 군집 → `hooks/useDeployRegisterState.ts` (고가치/고위험, hook 상호의존)

## 진행 로그
- [x] 선행 blocker(tanstack) 해소 + commit 410a40f
- [x] Step 1 baseline (정적/빌드/런타임)
- [x] 분할 #1 — 순수 헬퍼 11개 → `lib/deploy-register-utils.ts`
  - 정적: DeployRegisterPanel 1650 → 1531 LOC (-119, -7.2%). 신규 utils 138 LOC.
  - 빌드: GREEN (7.99s). DeployPage chunk 71.32 kB 동일 (bundle regression 없음).
  - 런타임: rows [1,1] 불변, apiTotalCount +1 = dev 파일 분할 artifact (프로덕션 청크 동일), ms 차이 = 백엔드 run-to-run 변동. **regression 없음**.
  - 판정: 정적 개선 + regression 없음 → commit 대상.
- [ ] 분할 #2 후보: B(SelectedEquipmentRow 추출) / C(useDeployRegisterState 훅) / DeployMonitorPanel(P2) / api·store slice
