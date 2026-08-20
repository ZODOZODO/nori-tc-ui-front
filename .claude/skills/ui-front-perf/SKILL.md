---
name: ui-front-perf
description: nori-tc-ui-front (React 19 + Vite 7 + TanStack Query 5) 성능 개선 measurement-first 워크플로우. dev server 가동 + Playwright 실측 → 측정값 기반 우선순위 → 변경마다 사용자 승인 → after 측정 → 효과 없으면 롤백. "측정 안 한 추정 개선" 금지.
allowed-tools: [AskUserQuestion, Read, Glob, Grep, Bash, Write, Edit]
---

# nori-tc-ui-front Performance — Measurement-First

> **두 측면을 모두 다룬다** (도구 2개):
> 1. **런타임 성능** — 정상 사용 중 페이지별 `/api/*` 응답시간·`tbody tr` row 수·청크 크기·폴링/staleTime/prefetch ([_perf_measure.mjs](tests/e2e/_perf_measure.mjs)).
> 2. **첫 로딩/진입 체감 시간** — "로그인/콜드 진입이 N초" 류를 백엔드 vs 프론트 모듈(dev=Vite 워터폴 / prod=번들 파싱·실행) vs 렌더로 분해, dev vs prod-preview 교차검증 ([_load_trace.mjs](tests/e2e/_load_trace.mjs), Step 1-4).

## WHY (이 skill 의 존재 이유)

과거 버전은 "정적 검사 → 보고서 → 사용자가 별 세션에서 추정 기반 개선" 이었다. 그 결과:
- React.memo / useDeferredValue 같은 변경이 **빌드만 통과하고 실제 효과는 검증 안 됨**
- 진짜 병목 (`/api/live-map` 6초) 은 빌드 청크만 봐선 안 보임 → 정적 검사가 놓침

본 skill 은 **측정 → 변경 → 재측정 → 효과 없으면 롤백** 사이클을 강제한다. "측정 안 한 추정 개선" 금지.

## 사용자 인자

- `$1` = 감사 모드 (선택). 기본 `audit-full`. 옵션:
  - `audit-full` — 5 페이지 전체 측정 + 5 축 정적 검사
  - `audit-page` — 특정 페이지만 (`$2` 로 페이지명: EqpPage / ModelPage / DeployPage / DlqPage / LiveMapPage)
  - `verify` — 직전 변경의 after 측정만 (변경 직후 빠른 검증용)

`$1` 비어있으면 AskUserQuestion 으로 모드 선택받음.

## Step 0 — 서버 가동 사전 점검

backend + front 가 가동 중인지 확인. 측정은 둘 다 떠 있어야 의미 있다.

```bash
curl -s -o /dev/null -w "backend HTTP %{http_code}\n" http://localhost:8080/actuator/health
curl -s -o /dev/null -w "front HTTP %{http_code}\n" http://localhost:3000/
```

- backend: HTTP 401 (auth required) = 정상. 비응답이면 미가동.
- front: HTTP 200 = 정상.

미가동 시 사용자에게 명령 안내 후 중단 (자동 실행 안 함 — 사용자 환경마다 DB/Redis 의존 다름):
```
C:\workspace_nori\nori-tc-exec\exec\windows\build-trace-apps.bat ui-backend
C:\workspace_nori\nori-tc-exec\exec\windows\run-trace-tc-ui-backend-app.bat
C:\workspace_nori\nori-tc-exec\exec\windows\run-trace-tc-ui-front-app.bat
```

backend bootJar 가 stale 의심되면 build 먼저 재실행 권장.

## Step 1 — Baseline 측정

### 1-1. 빌드 청크 baseline
```bash
npm run build 2>&1 | tail -25
```
**출력 마지막 5~10줄 코드블록 인용 필수**. PASS / FAIL 명시. 청크 크기 + 빌드 시간 캡처.

### 1-2. 런타임 baseline (Playwright)
타임스탬프 기반 파일명으로 저장:
```bash
TS=$(date -u +%Y-%m-%dT%H%M)
OUTPUT_PATH=".claude/perf/measurements/baseline-${TS}.json" \
  node tests/e2e/_perf_measure.mjs 2>&1 | tail -10
```

이 스크립트는:
- 로그인 — 자격은 `tests/e2e/perf-login.local.json`(git 미추적, `{"userId":"...","password":"..."}`,
  tc-db.local.properties 와 같은 로컬 시크릿 관례) 에서 읽고, `TEST_USER`/`TEST_PASS` env 로
  오버라이드 가능. 계정은 tc_user_info 의 ACTIVE 계정이어야 한다. 평문 비밀번호는 문서/git 기록 금지.
- 5 페이지 cold + warm 측정
- EqpPage / ModelPage 사이드바 첫 클릭 후 추가 측정
- 각 페이지 `/api/*` 응답 시간 + DOM `tbody tr` 카운트
- JSON 저장

저장 파일 경로를 사용자에게 명시.

### 1-3. 정적 검사 (보조 신호)
다음 항목을 Grep 으로 카운트:
- `React.memo` / `= memo(` 사용처 — 0건이면 god component 의 자식 후보
- `useMemo` / `useCallback` 분포
- `useDeferredValue` / `useTransition` / `useOptimistic` 사용처
- `refetchInterval` 사용처 + 같은 페이지 동시 폴링 여부
- `staleTime` 미지정 `useQuery` — Grep `useQuery({` vs `staleTime:` 비교
- 가상화 라이브러리 (`react-virtual` / `@tanstack/react-virtual` / `react-window`) 설치 여부
- `vite.config.ts` 의 `manualChunks` 설정 여부

정적 검사 결과는 보조 신호. **변경 트리거가 아님** — 런타임 측정이 우선.

### 1-4. 첫 로딩 분해 (로그인·콜드 진입이 느릴 때만)

"로그인이 N초 / 페이지 첫 로딩이 느림"이 주제일 때 추가로 실행. 체감 시간을 **백엔드 vs 프론트 모듈 vs 렌더**로 분해한다 — `_perf_measure.mjs` 는 `/api` 만 보므로 모듈 워터폴은 [_load_trace.mjs](tests/e2e/_load_trace.mjs) 로 잰다.

- **cold** = 캐시·Vite 사전변환 빈 첫 진입(Ctrl+Shift+R) / **warm** = 채워진 재방문.
- ROUTE_KEY: `EqpPage|ModelPage|DeployPage|DlqPage|LiveMapPage` (슬래시 경로는 git-bash 가 변환하므로 key 사용).

```bash
# dev
OUTPUT_PATH=".claude/perf/measurements/loadtrace-dev-$(date -u +%Y-%m-%dT%H%M).json" \
  BASE_URL=http://localhost:3000 ROUTE_KEY=LiveMapPage node tests/e2e/_load_trace.mjs 2>&1 | tail -16
# prod-preview — "dev 전용 비용 vs 실제 프로덕션 문제" 판별의 핵심
npm run build 2>&1 | tail -20
(npm run preview > /tmp/preview.log 2>&1 &) ; sleep 4
OUTPUT_PATH=".claude/perf/measurements/loadtrace-prod-$(date -u +%Y-%m-%dT%H%M).json" \
  BASE_URL=http://localhost:4173 ROUTE_KEY=LiveMapPage node tests/e2e/_load_trace.mjs 2>&1 | tail -16
```

- `vite preview`(4173)는 `preview.proxy`([vite.config.ts](vite.config.ts))로 `/api` 프록시. `_load_trace.mjs` 로그인은 **요청(API) 기반**(csrf 쿠키→X-XSRF-TOKEN) — preview 의 CSRF origin 편차에 견고(UI 폼 로그인은 preview 에서 403 날 수 있음). 측정 후 preview 프로세스 종료.
- 해석:
  - dev 모듈 수·시간 ≫ prod (예 258→40건) → **Vite dev 워터폴 = dev 전용**. 실사용 영향 없음. (선택) `server.warmup` 로 무거운 라우트 사전 변환.
  - prod 콜드 벽시계 ≫ 백엔드+모듈 합 → 큰 번들 **파싱·실행 + 렌더**(3D 등) = 실문제 → P1 청크 분할/진입 경량화.
  - 백엔드 `/api` 한 건 > 500ms → backend SPEC (UI 수정 금지).

## Step 2 — 측정 결과 기반 후보 식별

baseline JSON 을 Read 한 뒤 다음 우선순위로 분류:

### P1 (최우선 — 실측 병목)
- **백엔드 응답 시간 > 500ms** 인 endpoint
  - **이 항목은 UI 변경 금지**. `nori-tc-ui-backend` 레포의 별도 SPEC 작성 필요.
  - 보고서에 endpoint + ms + "백엔드 SPEC 필수" 명시.
- **백엔드 100~500ms 의 fan-out** (같은 페이지에서 4+ endpoint 동시 호출)
  - batch endpoint 통합 후보 (`useQueries` → 단일 endpoint). 백엔드 협업 SPEC.
- **빌드 청크 200KB+** 단일 청크
  - manualChunks 분리 / lazy 분할 후보.

### P2 (UI 변경 가능 + 측정 검증 필수)
- `placeholderData: keepPreviousData` 미적용 + 페이지네이션/필터 동적 queryKey
- `staleTime` 미지정 + 폴링 없음 (전역 default 5분이 의도 맞는지 명시화)
- 메뉴 hover prefetch 미적용 (자주 쓰는 메뉴)
- `persistQueryClient` 미설치

### P3 (정적 신호 — 효과 측정 어려움, 적용 신중)
- `React.memo` 0건 + LOC > 1000 god component 의 자식
  - **효과 측정 불가**: Profiler 자동화 어려움. 빌드/응답시간 영향 0.
  - 적용은 사용자 명시적 요청 시에만. 자동 권장 금지.
- `useDeferredValue` 미적용 + 큰 검색 입력
  - 같음. 적용은 운영 row 수 ≥ 500 확인 후.
- 가상화 도입
  - **row 수 측정 선결**. Case A (< 200) 면 도입 금지 (premature abstraction).

### 보고서 작성
`.claude/perf/<YYYY-MM-DD>-<mode>-perf.md` 에 다음 구조로 기록:
- 빌드 baseline (마지막 5~10줄 인용)
- 런타임 baseline (Top 5 느린 endpoint + row 수)
- P1/P2/P3 분류 + file:line + 변경 패턴
- 결정 분기 (백엔드 SPEC 후보 / UI 변경 후보 / 정적 신호)

## Step 3 — 변경 후보별 사용자 승인 cycle

**한 번에 한 변경만**. compound 변경 금지 (효과 분리 불가).

각 후보에 대해 AskUserQuestion 으로 승인 받기:
```
질문: "<file:line> 의 <변경 내용> 적용할까요?"
옵션 A (권장): 적용 → after 측정 → 효과 확인 후 commit
옵션 B: 건너뛰기 — 다음 후보로
```

질문 본문에 포함:
- file:line
- 변경 코드 미리보기 (before / after)
- 예상 효과 + 측정 가능 여부
- 위험 (prop 안정화 동반 / breaking change 등)

예시:
> useLiveMapDemoJobs.ts:10 의 `refetchInterval: 2_000` → `5_000` 적용할까요?
> 이유: LiveMap 3 hook 의 위상이 2/5/10초 다름. 5초로 통일하면 백엔드 부하 ↓.
> 위험: 데모 진행률 표시가 5초마다 갱신 (현재 2초) — UX 약간 느려짐.
> 측정 가능: ✓ (polling 호출 빈도 / live-map endpoint 응답 시간)

## Step 4 — 변경 적용 + 빌드 검증

1. **Edit** 으로 적용 (Write 는 신규 파일에만)
2. `npm run build 2>&1 | tail -25` — PASS 확인
3. **마지막 5~10줄 코드블록 인용 필수**
4. tsc -b 통과 명시

빌드 FAIL 시 자동 롤백 (Edit 으로 원복) + 사용자 보고.

## Step 5 — After 측정

baseline 과 동일 조건으로 재측정:
```bash
TS=$(date -u +%Y-%m-%dT%H%M)
OUTPUT_PATH=".claude/perf/measurements/after-${TS}.json" \
  node tests/e2e/_perf_measure.mjs 2>&1 | tail -10
```

특정 페이지에만 영향 주는 변경이면 `PAGES=EqpPage` 같이 필터 (빠른 측정).

## Step 6 — diff 비교 + 효과 평가

baseline.json vs after.json 비교:
- **응답 시간 변화**: 같은 endpoint 의 cold/warm ms 차이 (절대 + %)
- **청크 크기 변화**: 같은 chunk file 의 raw / gzip KB 차이
- **row 수 변화**: (refactor 가 아니라면 변화 0 이 정상)

효과 판정:
- **개선 명확** (응답 시간 -20%+ / 청크 -10%+ / 폴링 호출 빈도 ↓): commit
- **효과 미미** (변화 ±5% 내): 사용자에게 판단 요청 — 의도 명확하면 유지, 아니면 롤백
- **악화** (응답 시간 ↑ / 청크 ↑ / 기능 깨짐): **자동 롤백 권장** + 사용자 보고
- **측정 불가** (정적 신호 항목): 사용자 명시적 동의로 진행, "효과 측정 안 됨" 보고서에 기록

판정 결과를 보고서 + commit message 에 인용.

## Step 7 — 반복 / 종료

- 다음 후보 있음 → Step 3 으로
- 다음 후보 없음 → 종료 보고:
  - 적용한 변경 목록 (commit hash + before/after diff)
  - 백엔드 SPEC 후보 (별 레포 처리)
  - 측정 불가 항목 (이번 sprint 미적용)
  - 다음 측정 시점 권장 (운영 배포 후 등)

## 산출물

- **baseline / after JSON**: `.claude/perf/measurements/<phase>-<ISO>.json`
- **마스터 보고서**: `.claude/perf/<YYYY-MM-DD>-<mode>-perf.md` (체크리스트 + 결정 로그)
- **마스터 진행 노트**: `.claude/progress/perf-improvement-master.md` (이어받기용, gitignored)
- **백엔드 SPEC 후보 목록**: 별 markdown — `nori-tc-ui-backend` 레포에서 처리

## 절대 금지

- **측정 없이 변경 적용 금지** — Step 1 baseline 없이 Step 4 진입 금지
- **compound 변경 금지** — 한 번에 한 변경. 효과 분리 불가능해짐.
- **추정 효과 보고서 작성 금지** — "N% 감소 예상" 같은 추정값 인용 시 반드시 measurement source 명시. 없으면 "측정 필요" 로만 표기.
- **백엔드 응답 시간 > 500ms endpoint 에 UI 변경 시도 금지** — UI cache 로 해결 불가, 별 백엔드 SPEC 필수.
- **정적 신호 (memo / useDeferredValue) 무차별 적용 금지** — 효과 측정 어려움. 사용자 명시적 요청 시만.

## 검증 규칙 (글로벌 #1 VERIFY BEFORE CLAIMING 준수)

- 모든 빌드 / 측정 실행 시 **출력 마지막 5~10줄 코드블록 인용 필수**
- PASS / FAIL 명시
- 측정값은 file:line 또는 JSON path 출처 명시
- "개선됐다" 주장 전 반드시 before/after diff 출력 인용

## 컨벤션 참조

- 의존: React 19 + Vite 7 + TanStack Query 5 + Zustand 5 + react-hook-form + zod + radix-ui + Tailwind 4 ([package.json](package.json))
- 빌드: `tsc -b && vite build` ([package.json:8](package.json#L8))
- 라우트 lazy 분할: 이미 적용 ([src/app/Router.tsx:4-37](src/app/Router.tsx#L4-L37))
- 전역 Query 정책: [src/app/providers/AppProvider.tsx](src/app/providers/AppProvider.tsx)
- 측정 스크립트: [tests/e2e/_perf_measure.mjs](tests/e2e/_perf_measure.mjs) (5페이지 런타임/API/row), [tests/e2e/_load_trace.mjs](tests/e2e/_load_trace.mjs) (첫 로딩 분해 — 모듈 워터폴/백엔드, dev↔prod)
- 측정 환경변수: `BASE_URL` / `TEST_USER` / `TEST_PASS` / `OUTPUT_PATH` / `PAGES` / `HEADLESS` (_load_trace 는 `ROUTE_KEY` 추가). 로그인 자격 기본 출처는 `tests/e2e/perf-login.local.json` (git 미추적)
- prod-preview: `npm run preview` → :4173, `/api` → 백엔드(`preview.proxy`)

## 측정 가능 / 불가 매트릭스

| 변경 유형 | 측정 가능 | 측정 방법 |
|---|---|---|
| 백엔드 endpoint 응답 시간 변경 | ✅ | Playwright `/api/*` Network |
| 폴링 주기 변경 | ✅ | Playwright Network 빈도 카운트 |
| `placeholderData: keepPreviousData` | ✅ | 페이지 전환 시 UI flash 시간 (수동 시각 / 또는 LCP) |
| `staleTime` 변경 | ✅ | Network 빈도 카운트 |
| persistQueryClient | ✅ | reload 후 첫 fetch 발생 여부 |
| 메뉴 hover prefetch | ✅ | hover → click 사이 응답 시간 |
| `manualChunks` 분리 | ✅ | 빌드 청크 크기 비교 |
| 모달 lazy 분할 | ✅ | 빌드 청크 분포 + 모달 첫 열기 시 청크 다운로드 |
| `React.memo` | ⚠️ | Profiler 수동 (자동화 어려움) — "측정 불가" 명시 |
| `useDeferredValue` | ⚠️ | Profiler 또는 사용자 체감 — "측정 불가" 명시 |
| 가상화 도입 | ✅ | row ≥ N 페이지의 진입 시간 / FPS |
| 컴포넌트 분할 | ⚠️ | 응답 시간 영향 측정 가능. 분할 가독성 자체는 측정 불가. |
