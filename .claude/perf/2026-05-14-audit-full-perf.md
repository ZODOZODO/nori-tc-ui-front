# audit-full 보고서 — 2026-05-14

> 모드: audit-full (`/ui-front-perf`)
> baseline: `.claude/perf/measurements/baseline-2026-05-14T1100.json` (재사용, 측정 시각 11:14)
> build baseline: 2026-05-14 (이 보고서 작성 시점 fresh)

## 1. 빌드 baseline (출력 마지막 6줄)

```
dist/assets/EqpPage-DVG4zTQK.js             65.58 kB │ gzip: 16.90 kB
dist/assets/DeployPage-DVnc2gMt.js          70.88 kB │ gzip: 17.55 kB
dist/assets/select-C-5jo5pj.js              72.83 kB │ gzip: 25.75 kB
dist/assets/form-vendor-CnJdkdIy.js         86.30 kB │ gzip: 25.84 kB
dist/assets/index-DL30QKAk.js              184.62 kB │ gzip: 58.48 kB
✓ built in 9.44s
```
PASS. 단일 청크 200KB 초과 없음. modules 2239.

## 2. 런타임 baseline — Top 슬로우 endpoint

| Page | Phase | Endpoint | ms |
|---|---|---|---|
| LiveMapPage | cold | `/api/live-map` | **9417** |
| LiveMapPage | warm | `/api/live-map` | **5096** |
| DlqPage | cold | `/api/dlq/gateway` | 279 |
| EqpPage | afterSidebar | `/api/eqp/CMP_001/param-versions` | 190 |
| EqpPage | afterSidebar | `/api/eqp/CMP_001/manage` | 190 |
| EqpPage | afterSidebar | `/api/eqp/CMP_001/runtime-state` | 189 |
| EqpPage | afterSidebar | `/api/eqp/CMP_001/checkout-status` | 189 |
| DlqPage | warm | `/api/dlq/gateway` | 184 |
| EqpPage | cold | `/api/auth/me` | 153 |
| EqpPage | cold | `/api/model?(...)` | 153 |

테이블 행 수: 모든 페이지 `rowCount: 1` (테스트 데이터). 가상화 도입 의미 없음.

## 3. 정적 검사 (보조 신호)

| 항목 | 현재 상태 | 평가 |
|---|---|---|
| `React.memo` | 8 파일 적용 (commit `6c7eb20`) | ✓ |
| `useDeferredValue` | ModelSidebar/EqpSidebar/LiveMapPage 3곳 | ✓ |
| `useTransition` / `useOptimistic` | 0건 | 사용처 미발견, 필요 시점 미도래 |
| `refetchInterval` | 6 hook (LiveMap 3 + Deploy 3) | 위상 분산 — P1-3 R1 후보 |
| `staleTime` 명시 | 거의 모든 useQuery 에 명시 (default 5분, hook 별 0~5분) | ✓ |
| `placeholderData: keepPreviousData` | 4 hook (Users/DeployRegisterTargets/DeployHistoryList/Groups) | ✓ |
| `manualChunks` (vite.config.ts) | 5 vendor 분리 | ✓ |
| 가상화 라이브러리 | 미설치 | row 1 → premature |
| `persistQueryClient` | 적용됨 (commit `e430858`) | ✓ |
| 메뉴 hover prefetch | 5 메뉴 적용 (commit `99c1c24`) | ✓ |
| 모달 lazy 분할 | 3 모달 적용 (commit `a9791b5`) | ✓ |
| Skeleton UI | 13 테이블 적용 (commit `73afeb2`) | ✓ |

## 4. 분류

### P1 (백엔드 SPEC 필수 — UI 변경 금지)

- **LiveMapPage `/api/live-map` 9.4초 / 5초** — UI cache 로 해결 불가. `nori-tc-ui-backend` 의 별 SPEC 필요. [`p0-5-backend-response-time.md`](../progress/p0-5-backend-response-time.md) 참조.
- **EqpPage sidebar click 4 endpoint ~190ms 병렬** — `/api/eqp/{id}/param-versions` + `/manage` + `/runtime-state` + `/checkout-status`. batch endpoint 통합 후보. `nori-tc-ui-backend` 협업 SPEC.
- **DlqPage `/api/dlq/gateway` 279/184ms** — 단일 endpoint 느림. 페이지의 9 endpoint 중 1개만 느림 → fan-out 아닌 단일 endpoint 최적화 후보.

### P2 (UI 변경 가능 — 측정 검증 가능)

- **P1-3 R1: LiveMap 폴링 위상 정렬** — [SPEC p1-3](../specs/p1-3-polling-consolidation.md) 의 R1 (프론트 단독 변경).
  - 현재: `useLiveMap 5_000` / `useCommLog 10_000` / `useLiveMapDemoJobs 2_000`
  - 권장: B안 — `useLiveMapDemoJobs 2_000 → 5_000`, 나머지 유지
  - 근거: SPEC 결정. demo jobs 2초는 데모 진행률 표시용, mutation response 로 즉시 결과 처리되므로 5초로도 UX 허용.
  - 측정 가능: ✓ (Playwright Network 빈도 카운트 — 30초 윈도우에서 demo jobs 호출 수 15회 → 6회)

### P3 (보류)

- P3-2 가상화 — baseline row 1, 운영 데이터 (≥500 row) 측정 후 결정
- P0-5 백엔드 응답 시간 측정 (운영 배포 후)

## 5. 결정 분기

- **UI 변경 가능한 P2 후보 1건**: P1-3 R1 (폴링 위상 정렬)
- **백엔드 SPEC 필수 P1 후보 3건**: `/api/live-map` / EqpPage sidebar fan-out / `/api/dlq/gateway`
- 그 외 모든 UI 최적화는 이미 적용됨 (commit 13건)

## 6. 권장 다음 단계

1. **이번 sprint**: P1-3 R1 적용 (프론트 단독, 측정 가능)
2. **별 SPEC**: `nori-tc-ui-backend` 의 `/api/live-map` 응답 시간 측정 + 개선 SPEC 작성
3. **별 SPEC**: EqpPage sidebar batch endpoint (`GET /api/eqp/{id}/detail-bundle`) 설계
