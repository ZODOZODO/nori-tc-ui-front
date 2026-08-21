# role-landing 구현 계획 (SDD Plan)

입력: `nori-tc-ui-front/.claude/specs/role-landing.md` (Specify, commit `00d6b64`)
대상 레포: **`nori-tc-ui-front` 단독**

## Context

로그인 성공 시 진입 경로가 상수로 고정돼 있다 — `useLogin.ts:41` `LOGIN_ENTRY_ROUTE = '/live-map'`,
`:63` `navigate(LOGIN_ENTRY_ROUTE)`. 그런데 `/live-map` 은 `Router.tsx:85-87` 에서
`LIVE_MAP_READ` 권한 게이트 하위다. 따라서 그 권한이 없는 사용자는 다른 화면 권한을 멀쩡히
갖고 있어도 **로그인 직후 `AccessDeniedNotice`** 를 본다(`RequirePermission.tsx:68-74`).

라이브 DB 실측으로는 3 그룹 모두 `LIVE_MAP_READ` 를 갖고 있어 현행 계정으론 재현되지 않는다.
그러나 ① git 시드의 OPERATOR grant 에 그 권한이 없어 신규 환경 부트스트랩 시 재현되고,
② `GroupPermissionsModal.tsx:143-160` 의 self-serve 권한 회수로 **코드 변경 없이** 재현된다.

tc 에 wm 식 역할 축은 없다(확인 완료). 그래서 역할 축을 신설하지 않고 `permissionCodes` 로
확정 메뉴 트리의 첫 접근 가능 라우트를 고르는 **권한 기반 랜딩**으로 해결한다(사용자 결정 A).

목표 결과: `LIVE_MAP_READ` 미보유 + 다른 READ 보유 사용자가 로그인 직후 자기가 볼 수 있는
첫 화면으로 들어간다. 그 외 모든 사용자의 랜딩은 **바이트 동일**하게 유지된다.

## 확정 설계

### 1. 순수 함수 — `src/shared/lib/app-navigation.ts` 에 추가

재사용 대상이 이미 있다. `resolveVisibleAppNavigationGroups`(`app-navigation.ts:209-215`)가
**확정 트리 순서를 유지한 채 권한 필터 + 빈 그룹 제거**를 수행한다. 따라서 답은 그 반환값의
첫 그룹 첫 항목이다. 새 자료구조도 새 우선순위 표도 만들지 않는다.

```ts
export const resolveLoginLandingRoute = (
  permissionCodes: readonly string[] | null | undefined,
): string =>
  resolveVisibleAppNavigationGroups(permissionCodes)[0]?.items[0]?.route ??
  APP_NAVIGATION_GROUPS[0].items[0].route
```

- **fallback 을 별도 상수로 두지 않는다** — 트리의 첫 라우트를 트리에서 직접 읽는다. 상수를
  두면 트리 순서 변경 시 drift 가 생긴다.
- `[0]?.… ?? …` 은 레포의 기성 관용구다(`DeployRegisterPanel.tsx:511`,
  `deploy-ui.store.ts:480`, `LiveMapDemoModal.tsx:177` 등 8곳 이상). eslint 는
  `tseslint.configs.recommended`(타입 인식 아님, `eslint.config.js:15`)라
  `no-unnecessary-condition` 이 꺼져 있어 걸리지 않는다.
- `tsconfig.app.json` 에 `noUncheckedIndexedAccess` 가 없으므로 `!` / `as` 없이 `string` 으로
  타입 체크된다(#10-A 가 `as unknown` 을 0 으로 만든 상태를 유지).
- 트리가 빈 배열이 되는 경우의 방어 분기는 두지 않는다 — `APP_NAVIGATION_GROUPS` 는 const
  리터럴이고 `app-navigation-visibility.test.ts:39-53` 이 6 그룹 / 16 항목을 고정한다(룰 11).

동작 결과 — `monitoring/liveMap` 이 트리 첫 항목이라 **fallback 과 정상 경로가 같은 값**이다:

| 보유 권한 | 착수 전 | 착수 후 | 변화 |
|---|---|---|---|
| `LIVE_MAP_READ` 포함(현행 3 그룹 전부) | `/live-map` | `/live-map` | 없음 |
| `LIVE_MAP_READ` 없음 + `DLQ_READ` | `/live-map` → 권한없음 | `/dlq/dashboard` | 해소 |
| 권한 0 | `/live-map` → 권한없음 | `/live-map` → 권한없음 | 없음(의도) |

### 2. 훅 배선 — `src/features/auth/hooks/useLogin.ts`

`LOGIN_ENTRY_ROUTE` 상수(:36-41)를 제거하고 `onSuccess` 를 async 로 바꿔 `me` 를 읽는다.

```ts
const queryClient = useQueryClient()   // @tanstack/react-query — 레포 기성 패턴
...
onSuccess: async (result) => {
  console.info('[useLogin] login flow completed', { userPk: result.data.userPk })
  let permissionCodes: readonly string[] | null = null
  try {
    const me = await queryClient.fetchQuery({
      queryKey: ['auth', 'me'],
      queryFn: () => profileApi.getMe(),
      staleTime: 0,
    })
    permissionCodes = me.permissionCodes
  } catch (error) {
    console.error('[useLogin] failed to resolve landing route from /auth/me', error)
  }
  navigate(resolveLoginLandingRoute(permissionCodes), { replace: true })
},
```

결정 근거:

- **`queryKey: ['auth', 'me']`** — `useMe` 와 같은 키(`useProfile.ts:9`)라 결과가 캐시에 심기고
  직후 `RequireAuth`/`RequirePermission` 의 `useMe(true)` 가 같은 엔트리를 재사용한다
  (네트워크 요청 총 1회). `getMe(): Promise<MeInfo>` 는 봉투가 벗겨진 payload 를 준다
  (`profile.api.ts:13-25`).
- **`staleTime: 0` 이 필요하다** — `AppProvider.tsx:12` 의 `defaultOptions.queries.staleTime`
  이 **5분**이라, 명시하지 않으면 메모리에 남은 `['auth','me']` 엔트리가 5분 이내면
  `fetchQuery` 가 네트워크를 타지 않고 그 값을 돌려준다. 랜딩은 *방금 로그인한 계정*의
  권한을 반영해야 하므로 이건 방어 분기가 아니라 **읽기 신선도 요구의 명시**다. 없으면
  정확성이 다른 3 파일의 불변식(`AppTopBar.tsx:57` `queryClient.clear()`,
  `api-client.ts:23-25` 의 `window.location.href` 하드 이동, `RequireAuth` 의 error 상태)에
  암묵적으로 의존한다.
- **실패 시 `console.error` + 트리 첫 라우트** — 조용히 삼키지 않는다(룰 7). `/access-denied`
  전용 라우트는 만들지 않는다 — `RequirePermission` 이 그 자리에서 안내를 렌더한다(R3).
  wm 은 이 라우트를 새로 만들었지만(`nori-wm-ui-front/src/shared/lib/role-landing.ts:11`) tc 는
  불필요하다.
- `onSuccess` 를 async 로 바꿔도 경합이 없다 — `onSubmit` 이 `await mutateAsync`(:76-79) 라
  TanStack Query 가 `onSuccess` 완료 후 resolve 한다. wm 이 같은 구조다
  (`nori-wm-ui-front/src/features/auth/hooks/useLogin.ts:57-71`).

### 3. 게이트 — 단위 테스트 신규 `tests/unit/login-landing.test.ts`

`node --test --experimental-strip-types` + `tests/alias-hooks.mjs` 의 `@/` resolve hook
(`package.json:9`). `app-navigation.ts` 는 `./permission` 만 import 하는 순수 모듈이라 직접
import 가 된다(`app-navigation-visibility.test.ts` 가 이미 그렇게 한다).

- `resolveLoginLandingRoute` 직접 호출 6 케이스 (SPEC AC2)
- `APP_NAVIGATION_GROUPS` 를 순회해 6 그룹 전건 단언 — 트리 하드코딩 금지 고정 (SPEC AC3)
- `useLogin.ts` **소스 스캔** — `queryKey: ['auth', 'me']` / `staleTime` / `console.error` /
  `LOGIN_ENTRY_ROUTE` 부재. `.tsx` 는 아니지만 react-hook-form 등을 import 해 node 로 못
  불러오므로 `route-auth-guard.test.ts:15-18` 이 기술한 소스 단언 방식을 따른다 (SPEC AC6/AC7)

### 4. 게이트 — e2e 신규 `tests/e2e/login-landing.spec.ts` + `.gitignore` 추적 예외

**SPEC 의 "알려진 한계" 서술이 틀렸다. 이 Plan 에서 정정한다.** SPEC 은 브라우저 검증에
`LIVE_MAP_READ` 미보유 실계정이 필요하다고 썼지만, 스위트에 mock 선례가 있어 계정도 DB 변경도
필요 없다:

- `group-page.spec.ts:154-160` / `dlq-page.spec.ts:187-193` — `page.route('**/api/auth/me')` 로
  `permissionCodes` 임의 주입 (`UNPERMISSIONED_ME` 상수 관례까지 있다, `group-page.spec.ts:38-42`)
- `dlq-page.spec.ts:159-231` — `/api/auth/csrf` + `/api/line` + dlq 4 엔드포인트 mock 일괄.
  **이 블록을 그대로 재사용한다** (목적지 `/dlq/dashboard` 가 필요한 mock 이 여기 다 있다)
- 로그인 폼 제출 선례 — `verify-ui/_shared.ts:228-230`, `demo-matrix.harness.spec.ts:69-71`

추가로 mock 할 것은 `POST /api/auth/login` 하나뿐이다.

시나리오: me = `permissionCodes: ['DLQ_READ']` → 폼 제출 → `expect(page).toHaveURL(/\/dlq\/dashboard$/)`.
대조로 me = `['LIVE_MAP_READ','DLQ_READ']` → `/live-map` (무회귀 양성 대조).

주의 2 가지:
- `/api/line` mock 은 **배열**이어야 한다 — 객체면 공유 topbar `LineScopeSelector` 가
  크래시해 빈 화면이 되고 인증 문제로 오진하게 된다(`dlq-page.spec.ts:168` 주석에 명시).
- Playwright 는 **나중에 등록된 route 가 우선**한다. 구체 라우트를 뒤에 등록하고, 순서 가정을
  코드가 아니라 실행 결과로 확인한다.

`.gitignore` — `/tests/e2e/*` 아래 negation 1 줄 추가(`!/tests/e2e/login-landing.spec.ts`).
선례는 같은 파일 :8-16 의 `deploy-error-surface.spec.ts` 로, 사유가 동일하다: jsdom/RTL 이
없어 이 계약을 `tests/unit` 으로 옮길 수 없고, 로컬 전용으로 두면 유실 시 아무도 검증하지 않는
상태로 되돌아간다.

## 변경 파일

| # | 파일 | 성격 |
|---|---|---|
| 1 | `src/shared/lib/app-navigation.ts` | `resolveLoginLandingRoute` 추가 (약 8줄 + docstring) |
| 2 | `src/features/auth/hooks/useLogin.ts` | `LOGIN_ENTRY_ROUTE` 제거, `onSuccess` async 화 |
| 3 | `tests/unit/login-landing.test.ts` | 신규 |
| 4 | `tests/e2e/login-landing.spec.ts` | 신규 |
| 5 | `.gitignore` | negation 1 줄 |
| 6 | `.claude/specs/role-landing.md` | SPEC 개정 (아래) |

`src` 변경은 2 파일뿐이다. 백엔드(`nori-tc-ui-backend`)와 시드(`nori-tc-exec`)는 **무변경**(R7).

## SPEC 개정 (Implement 전에 먼저 커밋)

1. **AC7 확장** — `staleTime` 단언 추가 (위 결정 2).
2. **AC14 신설** — e2e 랜딩 스펙: `npx playwright test tests/e2e/login-landing.spec.ts` 2 케이스
   PASS AND console error 0 AND pageerror 0.
3. **"AC 의 알려진 한계" 정정** — "실계정이 필요하다" 는 틀린 서술을 삭제하고, 실제로 남는
   한계만 남긴다: (a) `tests/e2e` 는 브라우저가 필요해 self-hosted CI 에서 안 돈다
   (`.gitignore:4-5`) → e2e 는 로컬 게이트다, (b) 실제 백엔드·실계정 대조는 하지 않는다.
4. **Constraints 에 추가** — `.gitignore` 추적 예외 1 건을 명시(현재 SPEC 은 침묵).
5. **R4 문구 보강** — 신선도 요구(`staleTime: 0`)를 요구사항 본문에 넣는다.

## 커밋 슬라이스 (main 직접, 1 관심사당 1 커밋)

1. `docs(specs)`: SPEC 개정 5 항목
2. `test(unit)`: `login-landing.test.ts` 신규 — **실패 상태로 먼저** (SPEC 이 요구하는 AC 당
   실패 테스트 우선)
3. `feat`: `resolveLoginLandingRoute` + `useLogin` 배선 → 2번 테스트 green
4. `test(e2e)`: `login-landing.spec.ts` + `.gitignore` negation

## 검증

착수 전 baseline (이미 실측, SPEC 에 박혀 있음): `test:unit` **265 pass / 0 fail**,
`lint` 출력 없음, `grep -c '<Route path=' src/app/Router.tsx` = **27**,
`nori-tc-ui-backend` / `nori-tc-exec:docs/db_table` git status 각 **0 줄**.

슬라이스 3·4 후 전건 실행:

1. `npm run test:unit` → `# fail 0`, `# pass` > 265 (AC1~AC3, AC7)
2. **vacuous-pass 차단 (AC4)** — `resolveLoginLandingRoute` 본문을 `return '/live-map'` 고정으로
   되돌려 `npm run test:unit` 이 `# fail` ≥ 1 인지 확인 후 즉시 복원. 출력을 dev-report 에 인용
3. `grep -c "resolveLoginLandingRoute" src/features/auth/hooks/useLogin.ts` ≥ 1 (AC5)
4. `grep -c "LOGIN_ENTRY_ROUTE" src/features/auth/hooks/useLogin.ts` = 0 (AC6)
5. `npm run build` exit 0 (AC8) / `npm run lint` exit 0 (AC9)
6. `grep -c '<Route path=' src/app/Router.tsx` = 27 (AC10)
7. `git diff --stat -- src/i18n` 0 줄 (AC11) / 두 외부 레포 git status 0 줄 (AC12)
8. `npx playwright test tests/e2e/login-page.smoke.spec.ts` PASS (AC13)
9. `npx playwright test tests/e2e/login-landing.spec.ts` 2 PASS + console error 0 (AC14)

보고 시 각 명령의 마지막 5~10줄을 코드블록으로 인용한다. e2e 는 dev 서버 stale 함정이 있으므로
실행 전 `curl -s localhost:3000/src/shared/lib/app-navigation.ts | grep -c resolveLoginLandingRoute`
로 HMR 반영을 먼저 확인한다(refactor-master.md 3회차 운용 지식 #4).

산출물: `.claude/specs/role-landing-dev-report.md` (변경 파일 / 테스트 출력 / 결정 기록).

## 위험 / 롤백

| 위험 | 완화 |
|---|---|
| `staleTime` 누락으로 이전 사용자 권한으로 랜딩 | `staleTime: 0` 명시 + 소스 스캔 단언(AC7) |
| `onSuccess` async 화로 로그인 완료 타이밍 변화 | `mutateAsync` 가 await 하므로 경합 없음. wm 동일 구조. AC13/AC14 로 확인 |
| e2e mock 순서 / `/api/line` 배열 함정 | `dlq-page.spec.ts` 블록 재사용 + 실행 결과로 확인 |
| 기존 로그인 e2e·하네스 회귀 | 현행 계정 랜딩이 바이트 동일(`/live-map`)이라 `demo-matrix.harness` / `verify-ui/_shared` 의 로그인 경로 영향 없음 |

롤백: 커밋 단위가 관심사별로 갈려 있어 `git revert <sha>` 로 슬라이스별 되돌리기가 된다.
`src` 변경이 2 파일이고 신규 export 1 개뿐이라 되돌림 표면이 좁다.
