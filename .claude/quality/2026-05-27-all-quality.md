# quality — all axes (2026-05-27)

측정 도구: ui-front-quality SKILL. 서버 가동(backend 401 / front 200). exit code 는 `${PIPESTATUS[0]}` 로 캡처.

## Baseline (4축)

### 타입 — PASS
- `npx tsc -b` → **exit 0 (PASS)**. (선행 commit 410a40f 의 @tanstack query-core 정렬로 build-breaking 해소됨. skill 초안의 "tsc 1 FAIL" baseline 은 갱신됨.)
- 정적: `any`/`unknown` **113**, `@ts-ignore`/`@ts-expect-error`/`eslint-disable` **3**, `as X` 캐스트 **50**.

### lint — 2 ERRORS (FAIL)
`npx eslint .` → exit 1, `✖ 2 problems (2 errors, 0 warnings)`:
1. [DeployMonitorPanel.tsx:615](../../src/features/deploy/components/DeployMonitorPanel.tsx#L615) — `react-hooks/preserve-manual-memoization` (manual memoization 보존 불가)
2. [GroupAddMembersModal.tsx:51](../../src/features/group/components/GroupAddMembersModal.tsx#L51) — `react-hooks/set-state-in-effect` (effect 내 동기 setState)

biome: [biome.json](../../biome.json) 존재하나 package.json scripts 미연결 → 게이트 아님(결정 보류).

### 테스트 — unit 1 FAIL
- `npm run test:unit` → exit 1. **86 tests, 85 pass, 1 fail**.
  - 실패: [live-map-data.test.ts:47](../../tests/live-map-data.test.ts#L47) "clusterId 기준으로 고정 공정 카드에 자동 배치한다" — `expected 56, actual 58`.
  - **원인: stale 테스트**. 코드 `LIVE_MAP_NODE_OFFSET_X=24`/`GAP_X=52` ([live-map-data.ts:7,11](../../src/features/live-map/lib/live-map-data.ts#L7)) 는 커밋 c522995("demo bug update", 레이아웃 수정)에서 의도 변경. 테스트는 이전 커밋 41f33ad 의 +22/+60 기대값 미갱신. 코드 회귀 아님.
- e2e: 이번 세션 미실행(20 spec, 서버 필요). 런타임 닿는 변경 시에만 회귀 게이트로 실행.
- 커버 범위: src 207 / unit 13 / e2e 20. feature 별 test 참조 — profile **0**, user-management 2, deploy 3, dlq 3 (낮음). model 23 / user 17 / eqp 17 (높음).

### a11y — 게이트 해당 없음
- `<img>` 0, `<div onClick>` 0 (radix-ui aria 제공). 자동 검사 툴(`@axe-core/playwright`/`eslint-plugin-jsx-a11y`) 미설치 → P3/결정 게이트.

### 빌드 anchor — GREEN
`npm run build` GREEN (refactor 세션 8.25s 확인). 회귀 비교 anchor.

## 우선순위

- **P1 (build/test breaking)**:
  1. live-map-data.test.ts stale 단언 (1 unit FAIL) — 기대값 +22/+60 → +24/+76 갱신
  2. eslint DeployMonitorPanel:615 preserve-manual-memoization
  3. eslint GroupAddMembersModal:51 set-state-in-effect
- **P2 (측정 가능 품질)**: hot path any/unknown(113) 점진 제거, profile/deploy 미커버 테스트, 커버리지·biome 툴 결정
- **P3 (기록만)**: as 캐스트 50, @ts-ignore 3, a11y 수동 grep

## 결정 게이트 (의존성 추가 = 승인 필요)
- 커버리지 측정: `@vitest/coverage-v8`/`c8` 도입?
- a11y 게이트: `@axe-core/playwright` 도입?
- lint 일원화: biome script 연결 vs eslint-only?

## 진행 로그
- [x] Step 1 baseline (4축)
- [x] P1 #1 — live-map-data.test.ts stale 단언 갱신 (+22/+60 → +24/+24+52). unit 85→86 PASS (exit 0). 프로덕션 미변경.
- [x] P1 #2 — DeployMonitorPanel:615 useMemo deps 정렬. commentHistoryItem 3개 sub-prop → 전체 객체(React Compiler 추론 일치). 출력 동일 순수함수. eslint 2→1, build GREEN, deploy-monitor e2e 2/2 PASS.
- [ ] P1 #3 — eslint GroupAddMembersModal:51 set-state-in-effect
