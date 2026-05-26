---
name: ui-front-refactor
description: nori-tc-ui-front (React + Vite + TanStack Query + Zustand) measurement-first 리팩토링. 정적 측정(LOC/useState/useEffect) + 런타임 baseline 후 분할 적용 → 정적 개선 확인 + 런타임 regression 검증 → regression 있으면 롤백. "측정 안 한 분할" 금지.
allowed-tools: [AskUserQuestion, Read, Glob, Grep, Bash, Write, Edit]
---

# nori-tc-ui-front Refactor — Measurement-First

## WHY (이 skill 의 존재 이유)

과거 버전은 "정적 측정 → 보고서 → 사용자가 별 세션에서 분할 적용" 이었다. 그 결과:
- 분할 후 **regression 검증 없음** — 분할 자체가 응답 시간 / 청크 분포 / 기능 동작에 영향 주는데 측정 안 됨
- 분할 가치 (LOC ↓ / 가독성 ↑) 가 측정되지 않으면 "필요 없는 분할" 양산 위험

본 skill 은 **정적 baseline + 런타임 baseline → 분할 → 정적 개선 확인 + 런타임 regression 검증** 사이클을 강제한다.

리팩토링의 주 가치는 **정적** (LOC / 응집도). 런타임 측정은 **regression 차단** 용도.

## 사용자 인자

- `$1` = 타깃 경로. 예: `features/model` / `features/eqp` / `shared`
- `$2` = 모드 (선택). 기본 `audit-full`. 옵션:
  - `audit-full` — 정적 + 런타임 baseline 모두
  - `audit-static` — 정적만 (서버 안 띄움)
  - `verify` — 직전 변경의 정적 + 런타임 regression 검증만

`$1` 비어있으면 AskUserQuestion 으로 타깃 받음.

## Step 0 — 서버 가동 사전 점검 (audit-full / verify 만)

audit-static 모드면 skip. 그 외:
```bash
curl -s -o /dev/null -w "backend HTTP %{http_code}\n" http://localhost:8080/actuator/health
curl -s -o /dev/null -w "front HTTP %{http_code}\n" http://localhost:3000/
```

backend HTTP 401 + front HTTP 200 정상. 미가동 시 명령 안내 후 중단:
```
C:\workspace_nori\nori-tc-exec\exec\windows\build-trace-apps.bat ui-backend
C:\workspace_nori\nori-tc-exec\exec\windows\run-trace-tc-ui-backend-app.bat
C:\workspace_nori\nori-tc-exec\exec\windows\run-trace-tc-ui-front-app.bat
```

## Step 1 — Baseline 측정

### 1-1. 정적 측정 (감사 본질)

각 측정은 출처 file:line 명시. 추측 금지.

**LOC 분포** (`$1` 디렉터리):
```bash
find <target> -type f \( -name "*.ts" -o -name "*.tsx" \) -exec wc -l {} + | sort -rn | head -20
```

**컴포넌트 복잡도** (`<target>/**/components/**/*.tsx`):
각 파일별:
- `useState` 호출 수 (Grep `useState(`)
- `useReducer` 호출 수
- `useEffect` 호출 수
- `useMemo` / `useCallback` 호출 수
- `export function` 수
- LOC

**API / Store 비대화**:
- `<target>/**/api/*.api.ts` LOC
- `<target>/**/stores/*.store.ts` LOC

**안티패턴 탐지**:
- `key={index}` / `key={i}` / `key={idx}` (Grep)
- inline-object/inline-array prop — Grep multiline `<\w+ \w+={\{`
  - 주의: 정상 객체 리터럴 prop / 정상 사용 케이스가 다수 매치되어 **false positive 높음**
  - 결과는 report 에만 기록하고 **PASS/FAIL 판정에서 제외** (refactor 3 종 SKILL 의 중첩 깊이
    heuristic 과 동일 정책)
  - 임계값 표 (Step 2) 에서 inline-prop 항목은 분리 표기 — P3 (기록만) 카테고리로 한정

### 1-2. 런타임 baseline (audit-full)
```bash
TS=$(date -u +%Y-%m-%dT%H%M)
OUTPUT_PATH=".claude/perf/measurements/refactor-baseline-${TS}.json" \
  node tests/e2e/_perf_measure.mjs 2>&1 | tail -10
```

분할 후 **regression 검증** 용도. 분할 자체로 응답 시간 / 청크 분포가 의도치 않게 바뀌면 안 됨.

> **NOTE — baseline 파일명 prefix 컨벤션** (refactor / perf 트랙 분리):
> - refactor 트랙: `refactor-baseline-<TS>.json` / `refactor-after-<TS>.json` (본 SKILL)
> - perf 트랙: `baseline-<TS>.json` / `after-<TS>.json` (ui-front-perf SKILL)
>
> 같은 폴더 `.claude/perf/measurements/` 에 저장되지만 **파일명 prefix 로 분리** 한다.
> cross-reference 시 (예: ui-backend-perf 의 ui-front baseline JSON 인용) perf 트랙
> `baseline-` prefix 만 매치해야 refactor 측정값과 섞이지 않는다.

### 1-3. 빌드 baseline
```bash
npm run build 2>&1 | tail -25
```
**마지막 5~10줄 인용 필수**. 청크 크기 + 빌드 시간 캡처.

## Step 2 — 임계값 + 분할 후보 식별

### 임계값 (nori-tc-ui-front baseline 2026-05-13 기준)

| 항목 | 임계 | 근거 |
|---|---|---|
| `.tsx` LOC | > 500 | god component 분할 명확선 |
| 단일 컴포넌트 `useState` 수 | ≥ 8 | useReducer / 커스텀훅 추출 권장선 |
| 단일 컴포넌트 `useEffect` 수 | ≥ 4 | 라이프사이클 응집도 의심 |
| 단일 `export function` LOC | > 800 | 자식 컴포넌트 추출 임계 |
| `*api.ts` LOC | > 400 | 도메인 분리 권장 |
| `*.store.ts` LOC | > 400 | slice 분리 권장 |
| `key={index}` 사용 | ≥ 1 | 즉시 수정 후보 |

### 우선순위 분류

- **P1 (즉시)**: LOC > 1500 단일 컴포넌트, `useState` ≥ 15, `key={index}` 사용
- **P2 (다음 스프린트)**: LOC 800–1500, `useState` 8–14, api/store 비대화
- **P3 (기록만)**: LOC 500–800, inline-prop 의심 등 false positive 가능

### 분할 패턴 후보 (사용자 선택 필요 — 자동 결정 금지)

거대 컴포넌트:
1. **하위 컴포넌트 추출** — Header / Sidebar / Body / Footer / Modals 가시 영역 단위
2. **커스텀 훅 추출** — `useEqpPageState`, `useEqpLifecycle` 등 useState 군집 단위
3. **Container / Presentational 분리** — 데이터 fetching + 변환 = container, 렌더링 = presentational
4. **useReducer 도입** — useState 8개 이상 시
5. **컨텍스트 기반 분리** — props drilling 3단계 이상 시

API: 도메인별 split (예: `eqp.api.ts` → `eqp-info.api.ts` / `eqp-param.api.ts` / `eqp-lifecycle.api.ts`)
Store: 슬라이스 패턴 (Zustand combine, createSlice 합성)

### 보고서 작성
`.claude/refactor/<target>-<YYYY-MM-DD>.md`:
- 정적 측정 요약 (LOC / hook 분포 / 안티패턴)
- 런타임 baseline (응답 시간 / 청크) — regression 비교용 anchor
- P1/P2/P3 우선순위 + file:line
- 분할 단위 후보 (사용자 선택용)

## Step 3 — 변경 후보별 사용자 승인 cycle

**한 번에 한 변경만**. 한 god component 의 한 부분만 추출 → 검증 → 다음.

AskUserQuestion 으로 분할 단위 선택:
> ModelPage.tsx (2007 LOC, useState 21) 의 분할 방식 선택:
> A. ModelDetailPanel 추출 (가시 영역 단위, 이미 별 파일이지만 더 작은 단위로 쪼개기)
> B. useModelPageState 커스텀 hook 추출 (useState 군집)
> C. ModelEditor 와 ModelViewer 로 Container/Presentational 분리

선택지 본문에 포함:
- 추출 대상 file:line (현재 코드)
- 추출 후 신규 파일 경로 + export 시그니처
- 영향받는 import 처 (Grep 으로 추적 결과)
- 위험 (lazy import 깨짐 / prop 시그니처 변경)
- 분할이 응답 시간 / 청크에 영향 줄 가능성

## Step 4 — 변경 적용 + 정적 + 빌드 검증

1. **Edit / Write** 으로 추출 적용
2. import 경로 일관성 확인 (`@/` alias 유지)
3. **정적 재측정**: 같은 Grep 으로 LOC / useState / useEffect 카운트 → baseline 대비 변화 출력
4. `npm run build 2>&1 | tail -25` — PASS 확인, **마지막 5~10줄 인용**
5. 빌드 FAIL 시 자동 롤백 (Edit 으로 원복) + 사용자 보고

## Step 5 — 런타임 regression 측정

```bash
TS=$(date -u +%Y-%m-%dT%H%M)
OUTPUT_PATH=".claude/perf/measurements/refactor-after-${TS}.json" \
  node tests/e2e/_perf_measure.mjs 2>&1 | tail -10
```

분할이 응답 시간 / 청크 / row 수에 영향 줬는지 확인. **분할의 목적은 regression 없이 정적 개선**이므로:
- 응답 시간 ±5% 이내 → regression 없음 ✓
- 응답 시간 5%+ 악화 → regression 가능성 (lazy 분할로 첫 fetch 추가 등). 사용자 보고
- 응답 시간 5%+ 개선 → bonus (예: 모달 lazy 추출이 자연스럽게 청크 감소)

## Step 6 — 효과 평가 + 결정

### 정적 측면 (refactor 의 주 가치)
- LOC 감소 N% — 측정값 인용
- useState 분포 개선 (군집 크기 ↓) — 측정값 인용
- 안티패턴 제거 — `key={index}` 0건 등

### 런타임 측면 (regression 차단)
- 응답 시간 baseline 대비 ±5% 내 → PASS
- 청크 크기 baseline 대비 ±10% 내 → PASS (lazy 분할 시 분포 변화는 정상)
- row 수 동일 → PASS

판정:
- **정적 개선 + 런타임 regression 없음**: commit
- **정적 개선 + 런타임 regression 있음**: 사용자에게 보고 → 롤백 vs 수용 결정
- **정적 개선 미미**: 사용자에게 보고 → "왜 이 분할이 필요했는지" 재검토, 롤백 권장
- **빌드 FAIL**: 자동 롤백

## Step 7 — 반복 / 종료

다음 후보 있음 → Step 3 으로. 없음 → 종료 보고:
- 적용한 분할 목록 (commit hash + 정적 diff + 런타임 diff)
- 미적용 후보 (사용자 결정 거절 등)
- 다음 측정 시점 권장

## 산출물

- **정적 + 런타임 JSON**: `.claude/perf/measurements/refactor-{baseline,after}-<ISO>.json`
- **마스터 보고서**: `.claude/refactor/<target>-<YYYY-MM-DD>.md`
- **마스터 진행 노트**: `.claude/progress/refactor-master.md` (이어받기용, gitignored)

## 절대 금지

- **측정 없이 분할 적용 금지** — Step 1 baseline 없이 Step 4 진입 금지
- **compound 변경 금지** — 한 번에 한 god component 의 한 부분만 추출
- **무차별 동일 분할 패턴 적용 금지** — 컴포넌트마다 선택지 다름
- **런타임 regression 무시 금지** — 응답 시간 5%+ 악화 시 사용자 보고 필수
- **추측 측정값 보고서 작성 금지** — 모든 카운트는 도구로 측정, 출처 file:line 명시

## 검증 규칙 (글로벌 #1 VERIFY BEFORE CLAIMING 준수)

- 모든 빌드 / 측정 실행 시 **출력 마지막 5~10줄 코드블록 인용 필수**
- PASS / FAIL 명시
- 정적 측정값은 Grep / wc 출력 인용
- "LOC N% 감소" 주장 전 before/after 카운트 둘 다 인용

## 컨벤션 참조

- feature-sliced 구조 (`src/features/<domain>/{api,components,hooks,lib,stores,types}`). 분할 결과도 이 구조 유지.
- `@/` alias = `src/` ([vite.config.ts:11-14](vite.config.ts#L11-L14))
- 라우트 lazy: `app/Router.tsx` — 분할 후 export 시그니처 깨지면 lazy 실패
- 측정 스크립트: [tests/e2e/_perf_measure.mjs](tests/e2e/_perf_measure.mjs)
- 측정 환경변수: `BASE_URL` / `TEST_USER` / `TEST_PASS` / `OUTPUT_PATH` / `PAGES` / `HEADLESS`

## SDD 연동

각 P1 항목별로 `/spec-kickoff <feature>-refactor` 호출하여 SPEC 작성 후 Plan/Implement 진행 권장. 본 skill 은 SPEC 작성 전 측정 + 우선순위 식별 단계.
