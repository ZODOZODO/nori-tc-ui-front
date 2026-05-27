---
name: ui-front-quality
description: nori-tc-ui-front (React 19 + Vite 7 + TS 5.9 strict) 코드 품질 measurement-first 워크플로우. 4 축 — 타입 안전성(tsc + any/unknown/as) / lint(eslint, biome) / 테스트(unit + e2e 회귀 + 커버 범위) / a11y — baseline 측정 → 우선순위 → 변경마다 사용자 승인 → 재측정 + 테스트 회귀 차단 → 효과 없으면 롤백. 툴 없는 축(커버리지/a11y)은 발명 금지, 사용자 결정 게이트. "측정 안 한 추정 개선" 금지.
allowed-tools: [AskUserQuestion, Read, Glob, Grep, Bash, Write, Edit]
---

# nori-tc-ui-front Quality — Measurement-First

## WHY (이 skill 의 존재 이유)

refactor(구조) / perf(런타임) skill 은 **코드 품질** 축을 다루지 않는다. 타입 안전성 / lint 청결도 / 테스트 커버 범위 / 접근성(a11y) 은 별도 트랙이 필요하다. 측정 없이 "any 줄이기", "테스트 추가", "eslint 고치기" 를 무차별 적용하면:
- 진짜 회귀(타입 에러 / 깨진 테스트) 는 못 잡고 표면만 손댐
- 커버리지 / a11y 는 **측정 도구 자체가 없는데** 추측으로 "개선됐다" 보고 위험
- any 113 건 같은 큰 숫자를 한 번에 손대 compound diff → 회귀 원인 분리 불가

본 skill 은 **4 축 baseline 측정 → 한 번에 한 변경 → 재측정 + 테스트 회귀 차단** 사이클을 강제한다. 품질의 주 가치는 **정적**(타입/lint/커버). 테스트 suite + build 통과는 **회귀 차단** 게이트.

refactor 와의 경계: god component 분할 = refactor. `any` 제거 / 테스트 추가 / a11y 속성 = quality. 둘이 겹치면 refactor 를 먼저 (구조 안정화 후 품질 측정이 오염 안 됨).

## 사용자 인자

- `$1` = 축 (선택). 기본 `all`. 옵션:
  - `all` — 4 축 baseline 모두
  - `type` — 타입 안전성만 (tsc + any/unknown/as/@ts-ignore)
  - `lint` — eslint + biome 상태만
  - `test` — unit + e2e 회귀 + 커버 범위만
  - `a11y` — 접근성만 (툴 presence 우선)
  - `verify` — 직전 변경의 재측정 + 테스트 회귀만

`$1` 비어있으면 AskUserQuestion 으로 축 선택받음.

> **패키지 매니저 NOTE**: 레포는 pnpm (pnpm-lock.yaml). 단 CI([.gitlab-ci.yml:43-44](.gitlab-ci.yml#L43-L44)) 와 sibling skill (ui-front-perf / ui-front-refactor) 은 `npm run` 사용. 본 skill 도 일관성 위해 `npm run` 사용. node_modules 미설치 시 `pnpm install` 안내.

## Step 0 — 사전 점검

### 0-1. node_modules + 툴 presence
```bash
cd c:/workspace_nori/nori-tc-ui-front
test -d node_modules && echo "node_modules OK" || echo "node_modules MISSING → pnpm install"
echo "--- 4 축 툴 presence ---"
grep -E '"(lint|test:unit|test:e2e)"' package.json
grep -iE "axe|jsx-a11y|@axe-core|vitest|c8|istanbul|@vitest/coverage" package.json || echo "→ 커버리지 / a11y 전용 툴 미설치 (Step 1-3 / 1-4 결정 게이트)"
```

### 0-2. e2e 회귀가 필요한 변경이면 서버 점검 (type/lint 만이면 skip)
e2e 테스트를 회귀 게이트로 쓰려면 backend + front 가 떠 있어야 한다.
```bash
curl -s -o /dev/null -w "backend HTTP %{http_code}\n" http://localhost:8080/actuator/health
curl -s -o /dev/null -w "front HTTP %{http_code}\n" http://localhost:3000/
```
backend HTTP 401 + front HTTP 200 정상. 미가동 시:
```
C:\workspace_nori\nori-tc-exec\exec\windows\build-trace-apps.bat ui-backend
C:\workspace_nori\nori-tc-exec\exec\windows\run-trace-tc-ui-backend-app.bat
C:\workspace_nori\nori-tc-exec\exec\windows\run-trace-tc-ui-front-app.bat
```
type / lint / unit 만 다루는 세션이면 서버 없이 진행.

## Step 1 — Baseline 측정 (4 축)

> **CRITICAL — exit code 캡처**: `tsc`/`eslint`/`node --test` 출력을 `| tail` 로 자르면 `$?` 는 tail 의 exit code 가 되어 **PASS/FAIL 오판**한다 (2026-05-27 실측 확인: tsc 가 타입 에러를 뱉어도 `tail` 뒤 `$?`=0). 반드시 `${PIPESTATUS[0]}` 로 원 명령 exit code 를 인용한다.

### 1-1. 타입 안전성 (tsc + 정적 카운트)
```bash
npx tsc -b 2>&1 | tail -15; echo "tsc exit: ${PIPESTATUS[0]}"
```
**exit 0 = PASS, 비0 = FAIL. 에러 메시지 + exit code 인용 필수.**

정적 카운트 (Grep, 출처 file:line 명시):
```bash
echo "any/unknown:" && grep -rEn ": any\b|<any>|as any| any\[\]| unknown\b" src --include="*.ts" --include="*.tsx" | wc -l
echo "@ts-ignore/@ts-expect-error/eslint-disable:" && grep -rEn "@ts-ignore|@ts-expect-error|eslint-disable" src --include="*.ts" --include="*.tsx" | wc -l
echo "as 캐스트(대략):" && grep -rEn " as [A-Z]" src --include="*.ts" --include="*.tsx" | wc -l
```

### 1-2. Lint (eslint + biome 상태)
```bash
npx eslint . 2>&1 | tail -20; echo "eslint exit: ${PIPESTATUS[0]}"
```
**마지막 `✖ N problems (E errors, W warnings)` 줄 + exit code 인용 필수.**

biome 상태 확인 (configured-but-unscripted):
- [biome.json](biome.json) 존재 + `@biomejs/biome` devDep 설치됨. 단 **package.json scripts 에 biome 없음** — 설정만 있고 미연결.
- biome 의 lint/format 을 실제 게이트로 쓸지는 **Step 2 결정 항목**. 자동 실행 금지 (eslint 와 규칙 중복 / 충돌 가능). 현재는 `eslint .` 가 유일한 연결된 lint.

### 1-3. 테스트 (unit + e2e 회귀 + 커버 범위)
```bash
npm run test:unit 2>&1 | tail -15; echo "unit exit: ${PIPESTATUS[0]}"
```
e2e 는 서버 가동 시 (Step 0-2 통과) 만:
```bash
npm run test:e2e 2>&1 | tail -15; echo "e2e exit: ${PIPESTATUS[0]}"
```

커버 **범위** (커버리지 % 아님 — 툴 없음):
```bash
echo "src ts/tsx:" && find src \( -name "*.ts" -o -name "*.tsx" \) | wc -l
echo "unit test files:" && ls tests/*.test.ts | wc -l
echo "e2e spec files:" && ls tests/e2e/*.spec.ts | wc -l
echo "--- 테스트 없는 feature 디렉터리 ---" && for d in src/features/*/; do f=$(basename "$d"); c=$(grep -rl "$f" tests/ 2>/dev/null | wc -l); echo "$f: $c test refs"; done
```
> **커버리지 % 측정 도구 없음** (vitest/c8/istanbul 미설치). "커버리지 N%" 주장 금지. 측정 가능한 것은 **테스트 파일 수 / 미커버 feature 디렉터리** 뿐. 커버리지 툴 도입은 **Step 2 결정 게이트** (의존성 추가 = 사용자 승인).

### 1-4. a11y
```bash
echo "img 태그:" && grep -rEn "<img" src --include="*.tsx" | wc -l
echo "onClick on non-button (대략):" && grep -rEn "<div[^>]*onClick" src --include="*.tsx" | wc -l
```
> **a11y 자동 검사 도구 없음** (`@axe-core/playwright` / `eslint-plugin-jsx-a11y` 미설치). radix-ui 가 대부분 aria 를 제공하므로 (2026-05-27: `<img>` 0 건) **수동 grep 은 false positive 높아 PASS/FAIL 게이트에서 제외** (refactor skill 의 inline-prop 정책과 동일 — P3 기록만). a11y 를 실제 게이트로 만들려면 `@axe-core/playwright` 도입이 선결 → **Step 2 결정 게이트**.

### 1-5. 빌드 회귀 anchor
```bash
npm run build 2>&1 | tail -15; echo "build exit: ${PIPESTATUS[0]}"
```
`tsc -b && vite build` ([package.json:8](package.json#L8)). 변경 후 회귀 비교용 anchor. **마지막 5~10줄 + exit code 인용 필수.**

## Step 2 — 임계값 + 우선순위

### 임계값 (2026-05-27 baseline 실측)

| 축 | 항목 | 임계 / 목표 | 2026-05-27 실측 |
|---|---|---|---|
| 타입 | `tsc -b` 에러 | 0 (build-breaking) | **1 (FAIL)** — AppProvider.tsx:52, @tanstack/query-core 5.100.11 / 5.90.20 중복 |
| 타입 | `any`/`unknown` 사용 | 점진 ↓ (P2/P3 신호) | 113 |
| 타입 | `@ts-ignore`/`disable` | 0 권장 | 3 |
| 타입 | `as X` 캐스트 | 점진 ↓ | ~50 |
| lint | `eslint .` errors | 0 | **2 (FAIL)** — react-hooks/set-state-in-effect |
| lint | `eslint .` warnings | 0 권장 | 0 |
| 테스트 | unit suite | PASS | 측정 필요 |
| 테스트 | e2e suite | PASS (서버 가동 시) | 측정 필요 |
| 테스트 | 미커버 feature dir | 0 권장 | 측정 필요 (src 205 / test 33) |
| a11y | axe violations | 툴 도입 후만 | 툴 미설치 |

> 실측값은 **갱신 대상**. 매 baseline 마다 재측정 후 이 표 갱신 (sibling refactor skill 의 2026-05-13 baseline 동일 정책).

### 우선순위 분류

- **P1 (즉시 — build/test breaking)**:
  - `tsc -b` 에러 (현재 1건: tanstack 버전 중복)
  - `eslint .` errors (현재 2건)
  - 실패하는 unit / e2e 테스트
- **P2 (다음 — 측정 가능 품질)**:
  - hot path 의 `any`/`unknown` 제거 (queryFn 반환 / API 응답 타입)
  - 미커버 critical feature 디렉터리 테스트 추가 (model / eqp / deploy 등 핵심)
  - 커버리지 툴 도입 결정 (vitest coverage / c8)
  - biome 연결 결정 (eslint 와 역할 분리 / 통합)
- **P3 (기록만 — false positive / 측정 어려움)**:
  - `as X` 캐스트 (정당한 케이스 다수)
  - a11y 수동 grep (툴 없이는 게이트 불가)
  - `@ts-ignore` (3건, 각각 사유 주석 확인)

### 결정 게이트 (의존성 추가 = 사용자 승인 필수)
다음은 **새 devDependency 추가**라 자동 진행 금지. AskUserQuestion 으로 결정:
- 커버리지 측정: `@vitest/coverage-v8` 또는 `c8` 도입?
- a11y 게이트: `@axe-core/playwright` 도입?
- lint 일원화: biome 를 script 에 연결 vs eslint-only 유지?

### 보고서 작성
`.claude/quality/<YYYY-MM-DD>-<axis>-quality.md`:
- 4 축 baseline (각 명령 출력 마지막 줄 + exit code 인용)
- P1/P2/P3 우선순위 + file:line
- 결정 게이트 목록 (의존성 추가 후보)

## Step 3 — 변경 후보별 사용자 승인 cycle

**한 번에 한 변경만**. compound 금지 (회귀 원인 분리 불가). any 113 건을 한 커밋에 손대지 않는다 — 파일 1개 / 논리 단위 1개씩.

AskUserQuestion 으로 승인:
```
질문: "<file:line> 의 <변경 내용> 적용할까요?"
옵션 A (권장): 적용 → 재측정 + 테스트 회귀 확인 후 commit
옵션 B: 건너뛰기 — 다음 후보로
```

질문 본문에 포함:
- file:line + before/after 코드
- 어느 축 개선인지 (타입 에러 -1 / eslint error -1 / 테스트 +1 / a11y)
- 위험 (타입 좁히면 호출처 깨짐 / 테스트가 mock 으로 항상 통과 위험 — 글로벌 #11)
- 측정 가능 여부 (tsc/eslint 카운트는 ✅, a11y 수동은 ⚠️)

## Step 4 — 변경 적용 + 검증 + 회귀 차단

1. **Edit** 으로 적용 (Write 는 신규 테스트 파일에만)
2. 해당 축 **재측정**: 같은 명령 재실행 → baseline 대비 카운트 변화 인용 (`${PIPESTATUS[0]}` 포함)
3. **회귀 게이트** — 변경이 닿는 범위에 따라:
   - 타입/lint 변경 → `npm run build` PASS 확인
   - 로직/테스트 변경 → `npm run test:unit` PASS + (서버 가동 시) 영향 `npm run test:e2e` PASS
4. **마지막 5~10줄 + exit code 인용 필수**
5. 회귀 FAIL 시 자동 롤백 (Edit 으로 원복) + 사용자 보고

> **mock 회귀 검증 (글로벌 #11)**: 새 테스트 추가 시 "이 테스트가 실제로 어떤 실패 케이스를 재현하는가?" 자문. mock 이 production 과 분리되어 항상 통과하면 무력한 테스트. 최소 1개 진짜 실패 시나리오 포함 확인.

## Step 5 — 재측정 (verify 모드 / 변경 후)

해당 축만 빠르게:
```bash
# 타입 변경이면
npx tsc -b 2>&1 | tail -10; echo "tsc exit: ${PIPESTATUS[0]}"
grep -rEn ": any\b|<any>|as any| unknown\b" src --include="*.ts" --include="*.tsx" | wc -l
# lint 변경이면
npx eslint . 2>&1 | tail -10; echo "eslint exit: ${PIPESTATUS[0]}"
# 테스트 변경이면
npm run test:unit 2>&1 | tail -10; echo "unit exit: ${PIPESTATUS[0]}"
```

## Step 6 — 효과 평가 + 결정

### 정적 측면 (품질의 주 가치)
- tsc 에러 N → M (인용)
- eslint errors N → M (인용)
- any/unknown N → M (인용)
- 테스트 파일 +N / 미커버 feature dir -N (인용)

### 회귀 측면 (차단 게이트)
- `npm run build` PASS 유지 → ✓
- `npm run test:unit` PASS 유지 → ✓
- (서버 가동 시) `npm run test:e2e` PASS 유지 → ✓

판정:
- **정적 개선 + 회귀 없음**: commit
- **정적 개선 + 회귀 있음 (테스트/빌드 깨짐)**: 자동 롤백 + 사용자 보고
- **정적 개선 미미** (any 1~2건 등): 사용자에게 "이 변경이 가치 있는지" 재검토 → 무의미하면 롤백 권장
- **빌드/테스트 FAIL**: 자동 롤백

## Step 7 — 반복 / 종료

- 다음 후보 있음 → Step 3 으로
- 없음 → 종료 보고:
  - 적용한 품질 개선 목록 (commit hash + 축별 before/after 카운트)
  - 결정 게이트 결과 (커버리지/a11y/biome 툴 도입 여부)
  - 미적용 후보 (P3 기록만 / 사용자 거절)
  - 다음 측정 시점 권장

## 산출물

- **마스터 보고서**: `.claude/quality/<YYYY-MM-DD>-<axis>-quality.md` (git tracked)
- **마스터 진행 노트**: `.claude/progress/quality-master.md` (이어받기용, gitignored)

## 절대 금지

- **측정 없이 변경 적용 금지** — Step 1 baseline 없이 Step 3 진입 금지
- **compound 변경 금지** — any 113 건을 한 커밋에 손대지 않는다. 한 번에 한 논리 단위.
- **exit code 오인용 금지** — `| tail` 뒤 `$?` 는 tail 것. 반드시 `${PIPESTATUS[0]}` 인용 (2026-05-27 실측: tsc 에러여도 tail 뒤 `$?`=0)
- **측정 도구 없는 축에서 % 주장 금지** — 커버리지 툴 미설치 → "커버리지 N%" 금지. a11y 툴 미설치 → "a11y 통과" 금지. 측정 가능한 것(파일 수 / 에러 수)만 주장.
- **의존성 자동 추가 금지** — vitest-coverage / axe-core / biome 연결은 사용자 결정 게이트
- **무력한 mock 테스트 추가 금지** — 항상 통과하는 mock 은 production 깨져도 PASS. 진짜 실패 시나리오 1개 이상 (글로벌 #11)
- **타입 좁히기로 호출처 깨고 방치 금지** — `any` 제거 시 영향 호출처 빌드 통과 확인

## 검증 규칙 (글로벌 #1 VERIFY BEFORE CLAIMING 준수)

- 모든 tsc / eslint / test / build 실행 시 **출력 마지막 5~10줄 + `${PIPESTATUS[0]}` exit code 코드블록 인용 필수**
- PASS / FAIL 명시
- 정적 카운트는 Grep / wc 출력 인용, 출처 file:line
- "any N% 감소" 주장 전 before/after 카운트 둘 다 인용

## 컨벤션 참조

- 타입: `tsc -b` strict ([tsconfig.app.json:23-28](tsconfig.app.json#L23-L28) — strict / noUnusedLocals / noUnusedParameters / noFallthroughCasesInSwitch / noUncheckedSideEffectImports). skipLibCheck:true.
- lint: `eslint .` ([eslint.config.js](eslint.config.js) — js.recommended + tseslint.recommended + reactHooks + reactRefresh). biome.json 은 미연결.
- unit test: `node --test --experimental-strip-types tests/*.test.ts` ([package.json:9](package.json#L9))
- e2e: `playwright test` ([playwright.config.ts](playwright.config.ts))
- 빌드: `tsc -b && vite build` ([package.json:8](package.json#L8))
- feature-sliced 구조 (`src/features/<domain>/{api,components,hooks,lib,stores,types}`)
- `@/` alias = `src/` ([vite.config.ts](vite.config.ts))

## 4 축 측정 가능 / 도구 필요 매트릭스

| 축 | 항목 | 측정 가능 | 방법 |
|---|---|---|---|
| 타입 | tsc 에러 수 | ✅ | `npx tsc -b` + `${PIPESTATUS[0]}` |
| 타입 | any/unknown/as 카운트 | ✅ | Grep + wc |
| lint | eslint error/warning 수 | ✅ | `npx eslint .` 마지막 줄 |
| lint | biome 위반 수 | ⚠️ | 미연결 — 도입 결정 후 `npx biome lint` |
| 테스트 | unit/e2e pass/fail | ✅ | `npm run test:unit` / `test:e2e` exit code |
| 테스트 | 테스트 파일 수 / 미커버 dir | ✅ | find + grep |
| 테스트 | 커버리지 % | ❌ | 툴 미설치 — vitest-coverage/c8 도입 선결 |
| a11y | img alt / div onClick | ⚠️ | grep (false positive 높음, P3 기록만) |
| a11y | axe violations | ❌ | 툴 미설치 — @axe-core/playwright 도입 선결 |

## SDD 연동

P1 항목(타입 에러 / eslint error)은 즉시 수정 후보 (테스트 우선이 더 적합 — SDD 비적용). 커버리지/a11y 툴 도입 같은 의존성·인프라 변경은 `/spec-kickoff <feature>-quality` 로 SPEC 작성 권장. 본 skill 은 SPEC 작성 전 측정 + 우선순위 식별 + 결정 게이트 단계.
