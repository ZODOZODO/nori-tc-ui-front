# SPEC: role-landing — 로그인 직후 진입 경로를 보유 권한으로 결정

> wm-parity 트랙(`wm-parity-foundation.md` / `wm-parity-sidebar.md`)의 Out of Scope 이관 항목
> **#11** 이다. 두 SPEC 이 "tc 권한 모델에 wm 식 역할 축이 있는지 확인 후 별도 SPEC" 으로
> 남긴 것을 여기서 확인하고 결론냈다.
>
> **확인 결과: tc 에 역할 축은 없다.** 그래서 wm 의 역할 기반 랜딩을 그대로 이식하지 않고,
> **권한 기반 랜딩**으로 같은 문제를 해결한다(2026-08-21 사용자 결정 — 대안 A).
>
> 아래 모든 수치/경로는 2026-08-21 실측이다(라이브 DB 읽기 전용 조회 + 3 레포 코드 대조).

## Why

### 결함 — 로그인 직후 권한없음 화면에 떨어질 수 있다

로그인 성공 시 진입 경로가 상수로 고정돼 있다:

- `src/features/auth/hooks/useLogin.ts:41` `LOGIN_ENTRY_ROUTE = '/live-map'`
- 같은 파일 `:63` `navigate(LOGIN_ENTRY_ROUTE, { replace: true })`

그런데 `/live-map` 은 권한 게이트 하위다 — `src/app/Router.tsx:85-87` 의
`RequirePermission permissionCode={DASH_READ_PERMISSION}`, 그 값은
`src/shared/lib/permission.ts:5` 에서 `'LIVE_MAP_READ'` 다.

따라서 **`LIVE_MAP_READ` 미보유 사용자는 로그인 직후 `AccessDeniedNotice` 를 본다**
(`src/app/RequirePermission.tsx:68-74`). 다른 화면 권한은 멀쩡히 갖고 있어도 첫 화면이
막힌 채로 시작한다.

### 지금 라이브에서 터지고 있지는 않다 (실측)

라이브 DB(`192.168.0.150:16432/nori_tc`) 읽기 전용 조회, 2026-08-21:

```
 group_code | is_active | perm_cnt | has_live_map_read
------------+-----------+----------+-------------------
 ADMIN      | t         |       32 | t
 DEVELOPER  | t         |       24 | t
 OPERATOR   | t         |       12 | t
(3 rows)
```

```
  user_id  |  status  |  groups
-----------+----------+-----------
 admin     | ACTIVE   | ADMIN
 demo      | ACTIVE   | ADMIN
 developer | DISABLED | DEVELOPER
 nori      | ACTIVE   | DEVELOPER
 operator  | DISABLED | OPERATOR
(5 rows)
```

3 그룹 모두 `LIVE_MAP_READ` 를 갖고 있고 ACTIVE 계정 3개가 전부 그 그룹 소속이다.
**즉 현재 계정으로는 재현되지 않는다.** 이 SPEC 은 "지금 깨진 화면 고치기" 가 아니라
**두 개의 실재하는 발생 경로를 막는 것**이다.

### 발생 경로 1 — git 시드로 신규 환경을 부트스트랩하면 재현된다

- `nori-tc-exec/docs/db_table/sample_data/postgres_insert_user_ui_sample_data.sql:135-156`
  의 OPERATOR grant 는 **명시 목록**(`AUTH_ME_PERM` … `DEPLOY_DELETE`)이고 그 안에
  `LIVE_MAP_READ` 가 없다. (ADMIN 은 `p.is_active = TRUE` 전체, DEVELOPER 는
  `resource_type = 'API'` 전체라 자동으로 받는다.)
- `LIVE_MAP_READ` 를 뿌린 패치도 ADMIN 전용이다 —
  `nori-tc-exec/docs/db_table/patch/postgres_2026_04_07_add_live_map_api_permission.sql:55-57`
  의 `WHERE g.group_code = 'ADMIN'`.

→ **git 시드가 진실 원천인 신규 환경에서 OPERATOR 계정은 로그인 직후 권한없음 화면을 본다.**
라이브는 out-of-band grant 로 우연히 회피 중이고, 이 drift 는 이미 기록된 성질이다
(라이브 grant 가 sample seed 와 drift, seed 는 파괴적 재실행 금지).

### 발생 경로 2 — 관리자가 UI 에서 권한을 회수하면 코드 변경 없이 재현된다

`src/features/group/components/GroupPermissionsModal.tsx:143-160` 이 그룹별 권한을
임의로 grant/revoke 하는 self-serve UI 다(`addPermissionMutation` / `removePermissionMutation`).
어느 그룹에서 `LIVE_MAP_READ` 를 회수하는 순간, 그 그룹 사용자 전원의 첫 화면이 막힌다.

### 왜 wm 식 역할 축(대안 B)이 아닌가 — 확인 결과

wm 은 역할 상수 기반이다:

- `nori-wm-ui-front/src/shared/lib/permission.ts:119`
  `ROLE_CODES = ['ADMIN','OPERATOR','FLOW_DESIGNER','DEPLOYER']`
- `nori-wm-ui-front/src/shared/lib/role-landing.ts:25-30` `ROLE_LANDINGS` (배열 순서 = 다중 역할 우선순위)
- `nori-wm-ui-front/src/features/auth/hooks/useLogin.ts:60-71` `resolveLandingRoute(me.roleCodes, me.permissionCodes)`

tc 에는 그 축이 없다. 실측:

- `MeInfo = { userPk, userId, permissionCodes: string[] }` — `src/features/profile/types/profile.types.ts:16-20`
- 백엔드도 동일 — `nori-tc-ui-backend/ui/adapter/tc-ui-web-adapter/.../dto/response/MeResponse.java:15-19`
  는 `(long userPk, String userId, Set<String> permissionCodes)` 뿐이고
  `UserPrincipal` (`ui/tc-ui-domain/.../auth/UserPrincipal.java:22-25`) 도 같다.
- 워크스페이스 전체 grep 에서 tc 측 `roleCode` / `ROLE_CODES` 는 0 건.

역할 축을 신설하려면 5 계층을 건드려야 한다 — `UserPrincipal`(record 컴포넌트 추가 → 전
생성 호출처) → `ValidateTokenUseCase.java:119-123` + 신규 포트/Jpa 어댑터 →
`RedisUiSessionEntry` → `MeResponse` + `AuthController.java:234-237` → 프론트 `MeInfo`.
그리고 배포 부작용이 코드에 명시돼 있다 —
`ui/adapter/tc-ui-redis-adapter/.../session/RedisUiSessionEntry.java:17-20`:
"JSON 필드 구조가 변경되면 기존 캐시와 호환되지 않을 수 있습니다. 배포 시 Redis 캐시 flush
또는 키 prefix 버전 분리를 함께 적용해야 안전합니다."

게다가 **의미론적으로 성립하지 않는다.** tc 의 `tc_user_group.group_code` 는 상수가 아니라
사용자 데이터다 — `src/features/group/components/GroupUpsertModal.tsx:143-144` 가 groupCode 를
자유 텍스트 입력으로 받아 그룹을 생성한다. 프론트에 `ROLE_CODES` 를 박으면 관리자가 그룹을
하나 만드는 순간 그 상수는 허구가 된다. wm 은 "시드 그룹 code = 역할 code" 전제
(`nori-wm-ui-front/src/shared/lib/permission.ts:117-118` 주석)가 있지만 tc 엔 없다.

### 왜 대안 A 가 비용이 거의 0 인가 — 재사용 대상이 이미 존재한다

`src/shared/lib/app-navigation.ts:209-215` 의 `resolveVisibleAppNavigationGroups` 가 이미
**확정 트리 순서를 유지한 채 권한 필터 + 빈 그룹 제거**를 수행한다. 즉
"보유 권한으로 접근 가능한 첫 라우트" 는 그 반환값의 `[0].items[0].route` 다. 새 자료구조도
새 권한 매핑도 필요 없다.

## Requirements

- [ ] R1. 로그인 성공 직후 진입 경로를 사용자의 `permissionCodes` 로 결정한다.
      상수 고정(`LOGIN_ENTRY_ROUTE`)을 제거한다.
- [ ] R2. 결정 순서는 **확정 메뉴 트리 순서**를 따른다 — 그룹 순서(`monitoring` → `dlq` →
      `equipment` → `model` → `deploy` → `system`) 안에서 항목 순서. 별도 우선순위 표를
      만들지 않는다(트리가 단일 원천).
- [ ] R3. 접근 가능 항목이 하나도 없으면 트리의 첫 라우트(`/live-map`)로 이동한다. 그 자리에서
      기존 `RequirePermission` 이 `AccessDeniedNotice` 를 렌더한다 — 조용한 `/login` 튕김을
      하지 않고, `/access-denied` 같은 신규 라우트도 만들지 않는다.
- [ ] R4. 랜딩 결정에 필요한 `me` 는 `queryClient.fetchQuery({ queryKey: ['auth','me'] })` 로
      읽는다 — `RequireAuth`/`RequirePermission` 이 쓰는 `useMe` 와 같은 키
      (`src/features/profile/hooks/useProfile.ts:9`)라 캐시가 공유되고 `staleTime` 5분이므로
      직후 가드가 같은 요청을 다시 보내지 않는다.
- [ ] R5. `me` 조회 실패는 `console.error` 로 표면화한 뒤 트리 첫 라우트로 이동한다.
      조용히 삼키지 않는다(글로벌 룰 7).
- [ ] R6. 결정 로직은 **순수 함수**로 두어 `tests/unit` 게이트에 넣는다. 훅 안에 인라인하지 않는다.
- [ ] R7. 백엔드(`nori-tc-ui-backend`)와 시드(`nori-tc-exec`) 변경은 0 이다.

## Constraints

- **확정 메뉴 트리(6 그룹 / 16 항목) 변경 금지.** `APP_NAVIGATION_GROUPS`
  (`src/shared/lib/app-navigation.ts:68-201`)는 wm-parity-sidebar SPEC 의 표가 원천이고,
  변경하려면 그 SPEC 재승인이 필요하다. 이 SPEC 은 트리를 **읽기만** 한다.
- **신규 라우트 추가 금지.** 착수 전 `grep -c '<Route path=' src/app/Router.tsx` = **27**.
- **신규 i18n 키 0.** 안내 문구는 기존 `accessDenied.*`
  (`src/shared/components/AccessDeniedNotice.tsx:25-29`)를 그대로 쓴다.
- **신규 파일 최소.** 순수 함수는 트리와 필터를 이미 소유한 `src/shared/lib/app-navigation.ts`
  에 추가한다 — 함수 하나를 위해 새 모듈을 만들지 않는다(글로벌 룰 3 / 11).
- **fallback 을 별도 상수로 두지 않는다.** 트리의 첫 라우트를 트리에서 직접 읽는다
  (`APP_NAVIGATION_GROUPS[0].items[0].route`). 별도 상수는 트리 순서가 바뀔 때 drift 를 만든다.
- **역할 축(`roleCodes`) 도입 금지** — 위 Why 의 근거. `MeInfo` / `MeResponse` /
  `UserPrincipal` / `RedisUiSessionEntry` 무변경.
- **렌더 테스트 인프라가 없다.** `.tsx` 를 import 하는 단위 테스트가 불가하고 jsdom/RTL 도
  없다(`tests/unit/route-auth-guard.test.ts:15-18` 에 기술된 기존 제약). 훅 배선은
  같은 파일이 쓰는 **소스 스캔 단언** 방식으로만 검증한다.

## 동작 명세 — 기존 사용자에게 변화가 없다

`resolveLoginLandingRoute(permissionCodes)` 의 정의상, 랜딩이 실제로 달라지는 사용자는
**`LIVE_MAP_READ` 미보유 + 다른 READ 권한 보유** 조합 하나뿐이다.

| 보유 권한 | 착수 전 랜딩 | 착수 후 랜딩 | 변화 |
|---|---|---|---|
| `LIVE_MAP_READ` 포함(ADMIN / DEVELOPER / OPERATOR 현행) | `/live-map` | `/live-map` | 없음 |
| `LIVE_MAP_READ` 없음 + `DLQ_READ` | `/live-map` → 권한없음 | `/dlq/dashboard` | **해소** |
| `LIVE_MAP_READ` 없음 + `DEPLOY_READ` 만 | `/live-map` → 권한없음 | `/deploy/register` | **해소** |
| 권한 0 | `/live-map` → 권한없음 | `/live-map` → 권한없음 | 없음(의도) |

`monitoring/liveMap` 이 트리 첫 항목이므로 fallback 과 정상 경로가 같은 값이라, 현행
계정 전원의 랜딩은 **바이트 동일**하다. 회귀 표면이 그만큼 좁다.

## Acceptance Criteria

> 판정 규칙: 각 항목은 단일 명령 / 단일 단언이다. OR 표현을 쓰지 않는다.
> `[x]` 는 자연 실행 PASS + 출력 인용 + 본래 의도 충족을 **동시에** 만족할 때만 마킹한다.

- [ ] AC1. `npm run test:unit` 이 `# fail 0` 으로 종료하고 `# pass` 값이 착수 전 **265** 보다 크다.
      (착수 전 실측: `# tests 265 / # pass 265 / # fail 0`)
- [ ] AC2. 신규 `tests/unit/login-landing.test.ts` 가 `resolveLoginLandingRoute` 를 직접 import 해
      아래 6 케이스를 **전부** 단언하고 6 건 모두 pass 한다.
      - a) `['LIVE_MAP_READ','DLQ_READ','EQP_READ','MODEL_READ','DEPLOY_READ','USER_READ']` → `'/live-map'`
      - b) `['DLQ_READ','EQP_READ']` → `'/dlq/dashboard'`
      - c) `['EQP_READ']` → `'/eqp/business'`
      - d) `['DEPLOY_READ']` → `'/deploy/register'`
      - e) `['USER_READ']` → `'/user/users'`
      - f) `[]` → `'/live-map'` AND `null` → `'/live-map'` AND `undefined` → `'/live-map'`
- [ ] AC3. `resolveLoginLandingRoute` 가 트리를 하드코딩하지 않았음을 고정한다 —
      `tests/unit/login-landing.test.ts` 가 `APP_NAVIGATION_GROUPS` 를 순회해
      "각 그룹의 첫 항목 권한 1개만 보유 → 그 그룹 첫 항목 route" 를 6 그룹 전건 단언하고 pass 한다.
- [ ] AC4. vacuous-pass 차단: `src/shared/lib/app-navigation.ts` 의 `resolveLoginLandingRoute`
      본문을 `return '/live-map'` 고정으로 되돌리면 `npm run test:unit` 이 `# fail` 값 1 이상으로
      끝난다(의도적 되돌리기 1회 실행으로 확인하고 즉시 복원, dev-report 에 출력 인용).
- [ ] AC5. `grep -c "resolveLoginLandingRoute" src/features/auth/hooks/useLogin.ts` 결과가 1 이상이다.
- [ ] AC6. `grep -c "LOGIN_ENTRY_ROUTE" src/features/auth/hooks/useLogin.ts` 결과가 **0** 이다.
      (상수 고정 랜딩이 남아 있지 않음)
- [ ] AC7. `tests/unit/login-landing.test.ts` 가 `useLogin.ts` 소스를 읽어
      `queryKey: ['auth', 'me']` 패턴과 `console.error` 존재를 단언하고 pass 한다
      (`route-auth-guard.test.ts` 와 같은 소스 스캔 방식 — R4/R5 의 회귀 게이트).
- [ ] AC8. `npm run build` 가 exit 0 으로 끝난다(`tsc -b && vite build`).
- [ ] AC9. `npm run lint` 이 exit 0 이고 출력에 문제 목록이 없다(착수 전 실측: 출력 없음).
- [ ] AC10. `grep -c '<Route path=' src/app/Router.tsx` 결과가 착수 전과 동일한 **27** 이다.
- [ ] AC11. `git diff --stat -- src/i18n` 출력이 0 줄이다(신규 i18n 키 0).
- [ ] AC12. `cd ../nori-tc-ui-backend && git status --porcelain` 출력이 0 줄이고
      `cd ../nori-tc-exec && git status --porcelain -- docs/db_table` 출력이 0 줄이다(R7).
- [ ] AC13. e2e 회귀 0 — `npx playwright test tests/e2e/login-page.smoke.spec.ts` 가 PASS 하고
      `page.on('console')` / `page.on('pageerror')` 의 error level 0 건이다.

### AC 의 알려진 한계 (Plan/Implement 가 확장 발명하지 말 것)

랜딩 경로가 **실제 브라우저에서** 권한별로 갈리는지는 위 AC 로 덮이지 않는다. 그러려면
`LIVE_MAP_READ` 미보유 계정으로 실제 백엔드에 로그인해야 하고, 라이브/로컬 DB 3 그룹 모두
그 권한을 갖고 있어 그 계정이 존재하지 않는다(위 실측). 시드/DB 를 바꿔 계정을 만드는 것은
이 SPEC 의 Out of Scope 다(R7).

그래서 이 SPEC 은 **순수 함수 단위 게이트(AC2/AC3/AC4) + 훅 배선 소스 게이트(AC5/AC6/AC7)**
로 판정한다. 이 한계는 결함이 아니라 명시된 선택이며, Validate 세션은 여기에 추가 AC 를
발명하지 말고 이 한계를 그대로 인정한다.

## Out of Scope

- **역할 축(`roleCodes`) 신설** — 대안 B 기각(위 Why 의 5 계층 비용 + Redis 세션 비호환 +
  `group_code` 가 자유 입력 사용자 데이터라는 의미론적 결함). 재검토가 필요하면 별 SPEC.
- **시드 drift 정정** — `nori-tc-exec` 의 OPERATOR grant 에 `LIVE_MAP_READ` 를 추가하는 일
  (발생 경로 1). 별 레포 변경이라 이 SPEC 범위 밖이다. 이 SPEC 이 적용되면 시드 상태에서도
  OPERATOR 는 `/dlq/dashboard` 로 정상 진입하므로 **결함 자체는 이 SPEC 만으로 해소된다.**
  시드 정정은 "OPERATOR 가 Live-Map 을 볼 수 있어야 하는가" 라는 별개 정책 질문이다.
- **`/access-denied` 전용 라우트 신설** — wm 은 만들었으나 tc 는 `RequirePermission` 이 그
  자리에서 안내를 렌더하므로 불필요(R3).
- **권한 0 사용자의 안내 문구 개선** — 기존 `AccessDeniedNotice` 그대로 쓴다.
- **로그아웃 후 재진입 / 딥링크 복원 시의 랜딩** — 이 SPEC 은 **로그인 성공 직후 1 회**의
  진입 경로만 다룬다. 딥링크는 URL 이 원천이라는 기존 구조(`Router.tsx:65-69`)가 유지된다.
- **jsdom/RTL 렌더 테스트 인프라 도입** — 별 SPEC 사안(refactor-master.md #10-B 후속에서도
  같은 한계가 기록됐다).
- **거대 파일 분해 / LNB 트리 변경** — 각각 `ui-front-refactor` 트랙, wm-parity-sidebar SPEC.

## SDD 진행 상태

- [x] **Specify** — 이 SPEC.md 작성 완료 (산출물: `.claude/specs/role-landing.md`, 2026-08-21).
      선행 조사(라이브 DB 읽기 전용 조회 + wm/tc/ui-backend 3 레포 대조)로 대안 A/B 비교 후
      사용자 결정 = A(권한 기반 랜딩).
- [ ] **Plan** — 별 세션에서 구현 계획 수립 (산출물: `.claude/specs/role-landing-plan.md`)
- [ ] **Implement** — 별 세션에서 Acceptance Criteria 만족하는 구현 (산출물: `.claude/specs/role-landing-dev-report.md`)
- [ ] **Validate** — 별 세션에서 SPEC + Plan + Dev report 셋 다 입력으로 검증, 위 체크박스 업데이트

## 다음 단계 진입 프롬프트

**Plan 진입 (새 세션 + Plan Mode)**:
```
@.claude/specs/role-landing.md 보고 구현 계획 수립.
영향 파일 / 단계 / 위험 / 롤백 방법 포함.
실행 / 코드 수정 금지.
산출물: .claude/specs/role-landing-plan.md 에 저장.
```

**Implement 진입 (새 세션)**:
```
@.claude/specs/role-landing.md @.claude/specs/role-landing-plan.md 둘 다 읽고 구현.
SPEC 의 Acceptance Criteria 모두 만족하도록 각 AC 당 실패 테스트 먼저.
Plan 의 결정 (확장자 / dead path / OR→단일 노드 좁힘) 엄수.
산출물: .claude/specs/role-landing-dev-report.md 에 변경 파일 / 테스트 결과 / 결정 기록.
```

**Validate 진입 (새 세션)**:
```
@.claude/specs/role-landing.md @.claude/specs/role-landing-plan.md @.claude/specs/role-landing-dev-report.md
셋 다 읽고, 구현이 SPEC 의 모든 Acceptance Criteria 와 Plan 의 결정을 만족하는지 검증.
누락 / 위반 발견 시 보고. 통과 항목은 SPEC 의 AC 체크박스 + SDD 진행 상태를 [x] 로 업데이트.
```
