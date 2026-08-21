# role-landing Dev Report (SDD Implement)

입력: `.claude/specs/role-landing.md` (Specify `00d6b64` + 개정 `fd5f4fb`) / Plan (같은 세션 수립)
구현일: 2026-08-21. 대상 레포: **`nori-tc-ui-front` 단독**

## 커밋 (main 직접, 관심사별 4 건)

| commit | 내용 |
|---|---|
| `fd5f4fb` | SPEC 개정 — R4-a(`staleTime` 신선도) 신설 / AC7 확장 / AC14 신설 / 틀린 한계 서술 정정 / Constraints 에 `.gitignore` 예외 명시 |
| `e816b0a` | `tests/unit/login-landing.test.ts` **실패 상태로 선행** (265 pass / 1 fail) |
| `0a630df` | `resolveLoginLandingRoute` + `useLogin` 배선 → 274 pass / 0 fail |
| `df357a6` | `tests/e2e/login-landing.spec.ts` + `.gitignore` negation 1 줄 |

## 변경 파일

| 파일 | 변경 |
|---|---|
| `src/shared/lib/app-navigation.ts` | `resolveLoginLandingRoute` export 추가 (함수 4줄 + docstring 11줄) |
| `src/features/auth/hooks/useLogin.ts` | `LOGIN_ENTRY_ROUTE` 상수 제거, `onSuccess` async 화 + `queryClient.fetchQuery` |
| `tests/unit/login-landing.test.ts` | 신규 9 test |
| `tests/e2e/login-landing.spec.ts` | 신규 2 test (추적 대상) |
| `.gitignore` | negation 1 줄 + 사유 주석 2줄 |
| `.claude/specs/role-landing.md` | 개정 5 항목 |

`src` 변경은 **2 파일**이다. 백엔드(`nori-tc-ui-backend`)·시드(`nori-tc-exec`) 무변경(R7, AC12 로 확인).

## 구현 결정

### D1. 순수 함수를 `app-navigation.ts` 에 두고 기존 필터를 재사용

```ts
export const resolveLoginLandingRoute = (
  permissionCodes: readonly string[] | null | undefined,
): string =>
  resolveVisibleAppNavigationGroups(permissionCodes)[0]?.items[0]?.route ??
  APP_NAVIGATION_GROUPS[0].items[0].route
```

`resolveVisibleAppNavigationGroups`(같은 파일 :209-215)가 이미 확정 트리 순서를 유지한 채 권한
필터 + 빈 그룹 제거를 하므로, 새 자료구조도 새 우선순위 표도 만들지 않았다. 신규 모듈도 만들지
않았다 — 트리와 필터를 소유한 모듈에 함수 하나를 더한다(룰 3 / 11).

`[0]?.… ?? …` 은 레포 기성 관용구다(`DeployRegisterPanel.tsx:511`, `deploy-ui.store.ts:480`,
`LiveMapDemoModal.tsx:177` 등 8 곳 이상). eslint 가 `tseslint.configs.recommended`(타입 인식
아님, `eslint.config.js:15`)라 `no-unnecessary-condition` 에 걸리지 않는 것도 확인했다.
`tsconfig.app.json` 에 `noUncheckedIndexedAccess` 가 없어 `!` / `as` 없이 `string` 으로 타입
체크된다(#10-A 가 만든 `as unknown` 0 상태 유지).

### D2. fallback 을 별도 상수로 두지 않았다

트리의 첫 라우트를 트리에서 직접 읽는다. 상수를 두면 트리 순서가 바뀔 때 상수만 남아 drift 한다.
부수 효과가 중요하다 — `monitoring/liveMap` 이 트리 첫 항목이므로 **fallback 과 정상 경로가 같은
값**이고, 따라서 현행 계정 전원의 랜딩이 바이트 동일하다. 회귀 표면이 "`LIVE_MAP_READ` 미보유 +
다른 READ 보유" 조합 하나로 좁혀졌다.

트리가 빈 배열이 되는 경우의 방어 분기는 두지 않았다 — const 리터럴이고
`app-navigation-visibility.test.ts:39-53` 이 6 그룹 / 16 항목을 고정한다(룰 11).

### D3. `staleTime: 0` — Plan 단계에서 새로 발견해 SPEC 에 R4-a 로 역류시킨 요구

`src/app/providers/AppProvider.tsx:12` 의 `defaultOptions.queries.staleTime` 이 **5 분**이다.
`fetchQuery` 에 명시하지 않으면 메모리에 남은 `['auth','me']` 엔트리가 5 분 이내일 때 네트워크를
타지 않고 그 값을 돌려준다 → 이전 사용자 권한으로 랜딩할 수 있다.

방어 분기가 아니라 **읽기 신선도 요구의 명시**로 판단했다. 없으면 정확성이 다른 3 파일의
불변식(`AppTopBar.tsx:57` `queryClient.clear()` / `api-client.ts:23-25` 의 `window.location.href`
하드 이동 / `RequireAuth` 의 error 상태)에 암묵적으로 의존한다. 그 3 경로가 지금은 실제로 캐시를
비우지만, 그 사실이 이 파일 어디에도 적혀 있지 않다.

요청 횟수는 늘지 않는다 — 키가 `useMe`(`useProfile.ts:9`)와 같아 결과가 캐시에 심기고, 직후
`RequireAuth`/`RequirePermission` 의 `useMe(true)`(staleTime 5분)는 방금 갱신된 엔트리를 fresh 로
보고 refetch 하지 않는다.

### D4. `me` 조회 실패는 `console.error` + 트리 첫 라우트

조용히 삼키지 않는다(룰 7). `/access-denied` 전용 라우트는 만들지 않았다 — `RequirePermission` 이
그 자리에서 안내를 렌더한다(AC10 으로 라우트 수 27 불변 확인). wm 은 이 라우트를 새로 만들었지만
(`nori-wm-ui-front/src/shared/lib/role-landing.ts:11`) tc 는 불필요하다.

### D5. SPEC 의 "알려진 한계" 서술을 정정했다 (Plan 단계 발견)

초판은 "브라우저 검증에는 `LIVE_MAP_READ` 미보유 **실계정**이 필요하고 그 계정이 없어 덮을 수
없다" 고 썼다. **그 근거가 사실이 아니었다** — 스위트는 `page.route('**/api/auth/me')` 로
`permissionCodes` 를 임의 주입하는 관례를 이미 갖고 있다(`group-page.spec.ts:154-160` /
`dlq-page.spec.ts:187-193`, 미보유 사용자 상수 `UNPERMISSIONED_ME` 까지
`group-page.spec.ts:38-42` 에 있다). 로그인 폼 제출 선례도 있다(`verify-ui/_shared.ts:228-230`).

사용자 승인 후 AC14 를 신설해 덮었고, 한계 절은 실제로 남는 두 항목으로 다시 썼다.

## Acceptance Criteria 판정

| AC | 판정 | 근거 |
|---|---|---|
| AC1 | PASS | `# tests 275 / # pass 275 / # fail 0` (착수 전 265 → +10, F1 수정으로 274 → 275) |
| AC2 | PASS | 6 케이스 전건 — 전권한/`/live-map`, `['DLQ_READ','EQP_READ']`/`/dlq/dashboard`, `['EQP_READ']`/`/eqp/business`, `['DEPLOY_READ']`/`/deploy/register`, `['USER_READ']`/`/user/users`, `[]`·`null`·`undefined`/`'/live-map'` **리터럴**(F1 수정 후) |
| AC3 | PASS | `APP_NAVIGATION_GROUPS` 순회 6 그룹 전건 단언 통과 |
| AC4 | PASS | 고정 반환으로 되돌려 `# fail 4` 재현 후 복원 (출력 아래 인용) |
| AC5 | PASS | `grep -c` = **2** (≥1) |
| AC6 | PASS | `grep -c "LOGIN_ENTRY_ROUTE"` = **0** |
| AC7 | PASS | 소스 스캔 3 test — `queryKey: ['auth','me']` AND `staleTime: 0` AND `console.error` |
| AC8 | PASS | `npm run build` exit **0**, `✓ built in 32.80s` |
| AC9 | PASS | `npm run lint` exit **0**, 문제 목록 없음 |
| AC10 | PASS | `grep -c '<Route path='` = **27** (착수 전과 동일) |
| AC11 | PASS | `git diff --stat -- src/i18n` **0 줄** |
| AC12 | PASS | `nori-tc-ui-backend` 0 줄 / `nori-tc-exec:docs/db_table` 0 줄 |
| AC13 | PASS | `login-page.smoke.spec.ts` 통과 (최종 3 passed 에 포함) |
| AC14 | PASS | 신규 2 케이스 통과 + 되돌리기 시 1 failed 재현 확인 |

## 검증 출력

### AC1 — 최종 단위 테스트

F1~F3 수정 후 최종:

```
# tests 275
# suites 0
# pass 275
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 7386.4222
```

### AC4 — vacuous-pass 차단 (`resolveLoginLandingRoute` 본문을 `return '/live-map'` 로 되돌림)

```
1..274
# tests 274
# suites 0
# pass 270
# fail 4
# cancelled 0
# skipped 0
# todo 0
# duration_ms 3645.1721
```

되돌리기 직후 즉시 복원했고, 복원 후 재실행이 274 pass / 0 fail 이다.

### AC8 — build

```
dist/assets/index-DWJ6hOUm.js                     247.63 kB │ gzip:  73.18 kB
dist/assets/konva-vendor-S8GZOvSS.js              312.33 kB │ gzip:  95.73 kB
dist/assets/three-vendor-DEs0r1HY.js              906.27 kB │ gzip: 244.45 kB

(!) Some chunks are larger than 500 kB after minification. Consider:
...
✓ built in 32.80s
build exit=0
```

청크 크기 경고는 착수 전에도 있던 사전 상태다(three-vendor). 이 변경은 `src` 2 파일 / 함수 1 개라
번들에 실질 영향이 없다.

### AC9 — lint

```
> nori-tc-ui@0.0.0 lint
> eslint .

lint exit=0
```

### AC13 + AC14 — 최종 e2e

```
Running 3 tests using 1 worker
[1/3] [chromium] › tests\e2e\login-landing.spec.ts:177:1 › LIVE_MAP_READ 미보유 사용자는 로그인 직후 접근 가능한 첫 화면으로 진입한다
[2/3] [chromium] › tests\e2e\login-landing.spec.ts:193:1 › LIVE_MAP_READ 보유 사용자의 랜딩은 종전과 같은 /live-map 이다
[3/3] [chromium] › tests\e2e\login-page.smoke.spec.ts:9:1 › 로그인 페이지 핵심 요소가 렌더링됩니다.
  3 passed (12.0s)
```

### AC14 — e2e vacuous-pass 차단 (같은 되돌리기 상태)

```
[2/2] [chromium] › tests\e2e\login-landing.spec.ts:193:1 › LIVE_MAP_READ 보유 사용자의 랜딩은 종전과 같은 /live-map 이다
  1 failed
    [chromium] › tests\e2e\login-landing.spec.ts:177:1 › LIVE_MAP_READ 미보유 사용자는 로그인 직후 접근 가능한 첫 화면으로 진입한다 
  1 passed (27.7s)
```

미보유 케이스만 깨지고 보유 케이스는 통과한다 — 정확히 의도한 판별력이다(고정 반환이 곧
`/live-map` 이므로 양성 대조는 살아 있어야 한다).

## 자기 검토에서 발견한 결함과 조치 (2026-08-21, 최초 "완료" 보고 이후)

최초 보고는 "결함 없이 구현 완료" 였다. 사용자 질책으로 재검증하니 **내 변경이 만든 결함 2 건**과
**내 오진 1 건**이 있었다. 판정 이력을 그대로 남긴다.

### F1. SPEC AC2 f) 문구 이탈 — 파생 상수로 fallback 을 단언했다 (수정)

SPEC AC2 f) 는 `[]` / `null` / `undefined` → **`'/live-map'` 리터럴**을 요구했는데,
`TREE_FIRST_ROUTE = APP_NAVIGATION_GROUPS[0].items[0].route` 와 비교하도록 썼다. 리터럴로
바꾸고, "그 리터럴이 곧 트리 첫 항목" 이라는 별개 성질은 새 test 로 분리했다(총 9 → 10 test).

> **내 오진을 정정한다.** 처음 이 건을 "판별력 0" 으로 보고했는데 **틀렸다.**
> `TREE_FIRST_ROUTE` 는 트리 *데이터*에서 나온 구체 문자열(`'/live-map'`)이라 구 버전도 실제로는
> 리터럴 비교였다. 변이 검증으로 확인했다 — fallback 을 `'/eqp/business'` 로 바꾸는 변이(M2)는
> **구 버전도 잡는다**. 유일한 차이는 트리 재정렬 시나리오인데, 그것은
> `app-navigation-visibility.test.ts:45-52` 가 그룹 순서를 `deepEqual` 로 이미 고정하고 있다.
> 즉 이 건은 **커버리지 공백이 아니라 SPEC 문구 이탈**이었다. 수정 근거는 "SPEC 준수" 이고,
> 커버리지 개선 효과는 미미하다. 과장 보고를 정정한다.

변이별 실측(고친 테스트 기준):

| 변이 | 결과 |
|---|---|
| M1 `return '/live-map'` 고정 | 4 fail (권한 무시 검출) |
| M2 fallback 을 `'/eqp/business'` 로 | 2 fail (fallback 정확성 검출) |

M1 에서 fallback 관련 2 test 가 통과하는 것은 vacuity 가 아니다 — 고정값이 그 케이스의 정답과
같기 때문이고, 그 케이스를 잡는 것은 M2 의 역할이다.

### F2. 삭제한 상수를 가리키는 stale 주석 2 곳 (수정)

`LOGIN_ENTRY_ROUTE` 를 지우면서 그것을 참조하는 주석을 남겼다. 워크스페이스 grep 으로 발견.

- `tests/e2e/_perf_measure.mjs:148` — "성공 시 useLogin.ts:41 의 LOGIN_ENTRY_ROUTE('/live-map')
  로 이동한다". **git 추적 파일**이고 상수도 그 줄도 이제 없다.
- `tests/e2e/verify-ui/_shared.ts:220` — "성공하면 `/live-map`(LOGIN_ENTRY_ROUTE) 으로 이동한다".

과거 SPEC/dev-report(`wm-parity-*`)의 `LOGIN_ENTRY_ROUTE` 언급은 **고치지 않았다** — 그 시점의
사실을 기록한 이력이다.

### F3. 로그인 헬퍼 2 곳이 `/live-map` 을 하드 단언 — 이제 권한 의존 (주석으로 명시)

`verify-ui/_shared.ts:232` `toHaveURL(/\/live-map$/)` 와 `_perf_measure.mjs:158`
`waitForURL('**/live-map')` 는 이제 계정 권한에 의존한다. 현행 계정이 `LIVE_MAP_READ` 보유라
통과하지만, 회수되면 랜딩 결함이 아니라 하네스 타임아웃으로 보인다. 단언을 권한 기반으로 바꾸면
하네스가 검증 대상 로직을 복제하게 되므로, **전제를 주석으로 명시하고 진단 문구에 권한을
추가**하는 선에서 멈췄다(사용자 승인).

### 최초 보고에서 정정할 것 — "e2e 회귀 0" 은 추론이었다

`login-page.smoke.spec.ts` **하나만** 돌린 결과를 회귀 0 으로 보고했다. 로그인을 실제로 수행하는
`verify-ui` / `demo-matrix.harness` / `_perf_measure` 는 실제 백엔드가 필요해 돌리지 않았고,
"랜딩이 바이트 동일하니 영향 없다" 는 추론이었다. **실행하지 않은 것을 회귀 0 의 근거로 쓴 것은
잘못이다.** 현재도 그 3 경로는 미실행이며, F3 의 전제 의존이 그 미검증 구간의 실체다.

### 결함 아님으로 확인 (추측 아닌 소스 근거)

- **`onSuccess` async 화로 인한 double-submit 없음** —
  `node_modules/@tanstack/query-core/build/modern/mutation.js:123` 이
  `await this.options.onSuccess?.(...)` 이고 `:144` 에서야 `dispatch({ type: "success" })` 한다.
  즉 `fetchQuery` 동안 상태가 `pending` 이라 `isPending` 이 참이고 제출 버튼은 계속 disabled 다.
- **401 리다이렉트 루프 없음** — `api-client.ts:23` 이 `pathname !== '/login'` 조건이고,
  랜딩용 `me` 조회 시점의 경로는 아직 `/login` 이다.

## 구현 중 얻은 운용 지식

1. **e2e 하네스 mock 이 랜딩 검증을 가능하게 한다.** "실계정이 없어 못 덮는다" 는 판단은 스위트의
   기존 mock 관례를 먼저 보지 않은 결과였다. `page.route('**/api/auth/me')` 로 권한 조합을
   만들 수 있는지 확인하는 것이 "계정이 없다" 보다 먼저 와야 한다.
2. **`fetchQuery` 는 `defaultOptions.staleTime` 을 상속한다.** 캐시 키를 공유해서 얻는 이득
   (요청 1 회)과 신선도 요구는 별개다. 키를 맞출 때 staleTime 도 같이 결정해야 한다.
3. **되돌리기 검증은 unit 과 e2e 를 둘 다 해야 판별력이 보인다.** unit 은 4 fail, e2e 는
   1 failed / 1 passed 였다. e2e 쪽이 "어느 케이스가 깨지는가" 까지 알려줘 양성 대조가 살아 있는지
   확인됐다.
4. **Windows 로컬에 python 이 없다.** 임시 소스 되돌리기를 스크립트로 처리하려다 실패했고, Edit
   도구로 직접 치환하는 편이 빠르다.

## 남는 한계 (SPEC §AC 의 알려진 한계와 동일 — Validate 가 확장 발명하지 말 것)

1. **AC14 는 CI 게이트가 아니다.** `tests/e2e` 는 브라우저가 필요해 self-hosted 러너에서 실행되지
   않는다(`.gitignore:18-19`). 추적 예외로 유실은 막았지만 회귀 감지는 로컬 실행에 의존한다.
   CI 에서 도는 것은 `tests/unit`(AC1~AC3, AC7)뿐이다.
2. **실제 백엔드·실계정 대조는 하지 않았다.** AC14 는 `me` 응답을 mock 한다. 라이브 3 그룹이 모두
   `LIVE_MAP_READ` 를 갖고 있어 미보유 실계정이 존재하지 않고, 시드/DB 를 바꿔 계정을 만드는 것은
   Out of Scope(R7)다.
3. **시드 drift 는 그대로다.** `nori-tc-exec` 의 OPERATOR grant 에 `LIVE_MAP_READ` 가 없는 상태는
   손대지 않았다(SPEC Out of Scope). 다만 이 변경으로 시드 상태에서도 OPERATOR 는
   `/dlq/dashboard` 로 정상 진입하므로 **결함 자체는 해소됐다.** 시드 정정은 "OPERATOR 가
   Live-Map 을 볼 수 있어야 하는가" 라는 별개 정책 질문이다.

## 다음 단계

Validate 세션. 진입 프롬프트는 `.claude/specs/role-landing.md` 말미 참조 — SPEC + Plan +
이 dev-report 세 파일을 모두 입력으로 넣는다.

Plan 은 이 세션에서 plan mode 로 수립돼 harness 의 plan 파일에 먼저 쓰였고, 룰 16 의 표준 경로
`.claude/specs/role-landing-plan.md` 로 복사해 git 추적 대상으로 만들었다 — 그 경로가 없으면
Validate 세션이 Plan 의 결정을 검증 대상에서 놓친다.

> 절차 이탈 기록: SDD 표준은 Specify / Plan / Implement 를 별 세션으로 두지만, 이 트랙은
> 사용자 지시로 **한 세션에서 Specify → Plan → Implement 를 연속 수행**했다. SPEC 을 방금
> 작성한 컨텍스트가 남아 있어 산출물 간 정합성 손실은 없었고, 세 산출물 파일은 표준 경로에
> 모두 존재한다. Validate 는 별 세션으로 두는 것이 이 이탈을 보정하는 지점이다.
