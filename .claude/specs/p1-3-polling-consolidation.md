# SPEC P1-3 — Polling Consolidation (LiveMap / Deploy)

> 출처: `.claude/perf/2026-05-13-src-perf.md` P1-3
> 작성일: 2026-05-14
> 단계: Specify (Plan / Implement / Validate 후속)
> 대상 레포: `nori-tc-ui-front` + `nori-tc-ui-backend` (협업)

## Why

LiveMap 페이지와 Deploy Monitor 페이지에서 동시 폴링 fan-out 이 백엔드 부하 / 네트워크 사용량 / 위상 충돌 위험을 만든다.

현재 상태 — 워크스페이스 grep 으로 확인된 6 hook (`refetchInterval`):

| Hook | 주기 | 조건 | API endpoint |
|---|---|---|---|
| useLiveMap | 5,000 ms | 무조건 | `GET /live-map` |
| useCommLog | 10,000 ms | eqpId 있을 때 | `GET /comm-logs/{eqpId}` |
| useLiveMapDemoJobs | 2,000 ms | enabled | `GET /live-map-demo/jobs` |
| useDeployHistoryList | 3,000 ms | !terminalOnly | `GET /deploys` |
| useDeploySummary | 3,000 ms | RUNNING | `GET /deploys/{deployKey}` |
| useDeployTargets | 3,000 ms | RUNNING | `GET /deploys/{deployKey}/targets` |

**LiveMap 페이지 진입 시 동시 폴링 3건 (주기 2/5/10초 다름)** — 매 10초 동안 5+2+1=8 회 호출.
**Deploy Monitor 페이지에서 active deploy 선택 시 동시 폴링 3건 (3초 동기)** — 매 3초마다 3 회 fan-out.

## Requirements

### R1 (LiveMap 위상 정렬 — 단순)
- LiveMap 3 hook 의 refetchInterval 을 **공통 주기로 정렬**하거나 LCM(10초) 의 멀티플로 정렬 → 백엔드 부하 예측 가능
- 정렬 후보:
  - A안: 모두 5_000ms (demo jobs 는 2 → 5, comm-log 는 10 → 5)
  - B안: useLiveMap 5 / useCommLog 10 / useLiveMapDemoJobs 5 (demo 만 2 → 5 로 조정, comm-log 는 10 유지)
- **권장 = B**. 근거: comm-log 는 사용자 단일 eqp 선택 후 활성, 5초로 줄이면 fan-out 증가. demo jobs 의 2초는 데모 진행률 표시 — 5초로도 UX 허용 (사용자가 데모 액션 즉시 결과는 mutation response 로 처리).
- 이 항목은 **백엔드 변경 불요** — 프론트 hook 의 `refetchInterval` 만 조정.

### R2 (Deploy 3 fan-out → 단일 endpoint 통합 — 백엔드 SPEC)
- Deploy Monitor 에서 active deploy 선택 시 `/deploys/{deployKey}` + `/deploys/{deployKey}/targets` + `/deploys?...` 3 호출.
- 통합 후보:
  - A안: 신규 `GET /deploys/{deployKey}/monitor` 단일 endpoint 가 summary + targets 페이지네이션 응답 (history list 는 별 endpoint 유지)
  - B안: useDeployTargets 는 별 endpoint 유지 (page/size 가 다른 페이지네이션이라 unify 시 응답 크기 큼). summary + history 만 통합.
- **권장 = A**. 근거: summary 와 targets 는 active deploy 선택 후 같은 deployKey 컨텍스트로 매 3초 동시 호출 — 백엔드에서 1 query 로 묶기 자연스럽고, history list 는 filter/pagination 컨텍스트가 달라 별 endpoint 유지가 명확.
- 이 항목은 **nori-tc-ui-backend 협업 필요** — controller / service / domain 변경 동반.

### R3 (페이지 가시성 기반 폴링 일시 중지)
- TanStack Query v5 의 `refetchIntervalInBackground: false` (default) 가 이미 적용됨 — 별 변경 불요 (background tab 시 자동 정지).
- 사용자 명시적 페이지 이탈 (`useNavigate` 등) 시 hook unmount 로 자연스럽게 정지 — 이미 정상.
- **이 SPEC 의 변경 대상 아님**. 검증만.

## Constraints

- **운영 데이터 의존**: P0-5 (백엔드 응답 시간 측정) 결과 보고 우선순위 결정. 응답 시간 큰 endpoint (>500ms) 가 폴링 통합 우선순위 최고.
- **백엔드 SPEC 동기화**: R2 는 `nori-tc-ui-backend` 의 controller 변경 동반. 두 레포 PR 페어 필요.
- **TanStack Query keyManager 컨벤션 유지**: 새 endpoint 추가 시 `deployQueryKeys` 에 `monitor(deployKey)` 키 추가.
- **하위 호환**: 기존 endpoint 는 즉시 삭제 안 함 — deprecation 후 일정 기간 유지 (다른 호출처가 있을 수 있음, 워크스페이스 전체 grep 필요).

## Acceptance Criteria

각 기준은 **기계 검증 가능**해야 한다.

### R1 (LiveMap 위상 정렬)
- [x] `useLiveMapDemoJobs` 의 `refetchInterval: 2_000` → `5_000` (2026-05-14 적용, B안 권장값 채택)
- [x] `useCommLog` 의 `refetchInterval` 유지 또는 정렬값으로 변경 (10_000 유지)
- [x] Grep 확인: `Grep "refetchInterval" features/live-map/hooks` 결과가 SPEC 의 결정값과 정확히 일치
- [x] `npm run build` PASS (9.10s, modules 2239)

### R2 (Deploy 통합 endpoint)
- [ ] `nori-tc-ui-backend` 에 `GET /deploys/{deployKey}/monitor` 추가 (응답: `{ summary, targets: { items, total } }`)
- [ ] `nori-tc-ui-front` 의 `useDeployMonitor(deployKey)` 신규 hook 으로 summary + targets 동시 fetch
- [ ] `useDeploySummary` / `useDeployTargets` deprecate (호출처 마이그레이션 완료 후 삭제)
- [ ] DeployMonitorPanel 의 동시 폴링 hook 수 = 2 (history list + monitor)
- [ ] `./gradlew :apps:tc-ui-backend-app:test PASS`
- [ ] `npm run build` PASS

### R3 (가시성 검증)
- [ ] Chrome DevTools Network 탭에서 background tab 전환 시 polling 정지 확인 (`refetchIntervalInBackground: false` 동작)
- [ ] 페이지 이탈 시 hook unmount 확인 (useEffect cleanup 호출됨)

## Out of Scope

- staleTime:0 정책 재검토 (P2-2 — 이미 완료, 변경 없음 결정)
- 가상화 도입 (P3-2 — 별 SPEC)
- WebSocket / SSE 전환 — 폴링 자체 제거는 더 큰 아키텍처 변경, 본 SPEC 범위 밖

## Out of Spec — 향후 검토

- **WebSocket / Server-Sent Events 도입**: Live Map / Deploy progress 같은 real-time 데이터는 SSE 가 정합성 + 효율 모두 우월. 단 백엔드 인프라 변경 큼. 별 SPEC.
- **Hook 그룹 통합 추상화 (e.g. `useGroupedPolling([hookA, hookB], { interval: 5_000 })`)**: 한 곳에만 쓰여 premature abstraction. AI Debt 룰 11.

## Risk

- **R2 의 백엔드 SPEC 미합의 시**: 프론트 변경 진행 불가. 백엔드 협업 일정 선결.
- **deprecation 누락**: 기존 useDeploySummary / useDeployTargets 호출처가 deploy 외 다른 feature 에 있으면 (e.g. EqpPage 가 deploy 상태 참조) 마이그레이션 누락 발생. 워크스페이스 전체 grep 으로 호출처 추적 필수.
- **응답 크기 증가**: R2 의 통합 endpoint 응답이 단일 hook 응답보다 크면 (summary + 100 targets) 첫 fetch 비용 증가. paging 컬럼 옵션 필수 (`?targetPage=0&targetSize=50`).

## 진행 순서

1. **P0-5 측정** 완료 → 응답 시간 큰 endpoint 우선순위 식별
2. **R1 적용** (프론트 단독, 백엔드 무관) — 작은 commit 1건
3. **백엔드 SPEC 협의** (nori-tc-ui-backend 와 R2 controller 설계 합의)
4. **R2 백엔드 구현** → ui-backend 레포 PR
5. **R2 프론트 구현** → ui-front 레포 PR (백엔드 PR merge 후)
6. **R3 검증** (DevTools 시각 확인)
7. **deprecation 처리** — 호출처 마이그레이션 완료 후 구 hook 삭제

## 참조

- 마스터 보고서: `.claude/perf/2026-05-13-src-perf.md` P1-3 섹션
- 진행 노트: `.claude/progress/perf-improvement-master.md`
- 현재 폴링 hook 위치 (Grep 결과):
  - `src/features/live-map/hooks/useLiveMap.ts:9`
  - `src/features/live-map/hooks/useCommLog.ts:10`
  - `src/features/live-map/hooks/useLiveMapDemoJobs.ts:10`
  - `src/features/deploy/hooks/useDeployHistoryList.ts:18`
  - `src/features/deploy/hooks/useDeploySummary.ts:18`
  - `src/features/deploy/hooks/useDeployTargets.ts:25`
