import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  APP_NAVIGATION_GROUPS,
  resolveLoginLandingRoute,
} from '@/shared/lib/app-navigation.ts'

/**
 * SPEC .claude/specs/role-landing.md — 로그인 직후 진입 경로를 보유 권한으로 결정하는 게이트.
 *
 * 착수 전에는 진입 경로가 `useLogin.ts` 의 상수(`LOGIN_ENTRY_ROUTE = '/live-map'`)로 고정돼
 * 있었고, `/live-map` 은 `LIVE_MAP_READ` 권한 게이트 하위(`Router.tsx:85-87`)다. 그래서 그
 * 권한만 없는 사용자는 다른 화면 권한을 멀쩡히 갖고도 **로그인 직후 권한없음 화면**을 봤다.
 *
 * 이 상태는 라이브 3 그룹이 우연히 전부 `LIVE_MAP_READ` 를 갖고 있어 재현되지 않았을 뿐이고,
 * git 시드의 OPERATOR grant 누락과 `GroupPermissionsModal` 의 self-serve 권한 회수 두 경로로
 * 언제든 되살아난다. 그래서 게이트가 필요하다.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const readSource = (relativePath: string) => readFileSync(join(ROOT, relativePath), 'utf8')

/** 확정 메뉴 트리(SPEC 표)의 권한 문자열 전건 — 상수명이 아니라 값 기준이다. */
const ALL_PERMISSIONS = [
  'LIVE_MAP_READ',
  'DLQ_READ',
  'EQP_READ',
  'MODEL_READ',
  'DEPLOY_READ',
  'USER_READ',
]

/**
 * 트리의 첫 라우트입니다 — 접근 가능 항목이 0 일 때의 목적지이기도 하다.
 *
 * 이 값으로 **fallback 목적지를 단언하지 않는다.** 구현이 같은 식을 쓰므로 양변이 함께 움직여
 * 어떤 fallback 이든 통과한다(고정 반환 구현에서도 통과하는 것을 실측했다). 아래 두 test 는
 * 목적지를 리터럴로 못 박고, 이 상수는 "그 리터럴이 곧 트리 첫 항목" 이라는 **별개 성질**을
 * 확인하는 데만 쓴다.
 */
const TREE_FIRST_ROUTE = APP_NAVIGATION_GROUPS[0].items[0].route

test('전 권한 보유자는 트리 첫 항목(Live-Map)으로 진입한다', () => {
  assert.equal(resolveLoginLandingRoute(ALL_PERMISSIONS), '/live-map')
})

test('LIVE_MAP_READ 만 없으면 다음 접근 가능 그룹의 첫 항목으로 진입한다', () => {
  // 착수 전 결함의 정확한 재현 조건 — 이 조합이 '/live-map' 을 받으면 권한없음 화면이 첫 화면이 된다.
  assert.equal(resolveLoginLandingRoute(['DLQ_READ', 'EQP_READ']), '/dlq/dashboard')
})

test('단일 권한 보유자는 그 그룹의 첫 항목으로 진입한다', () => {
  assert.equal(resolveLoginLandingRoute(['EQP_READ']), '/eqp/business')
  assert.equal(resolveLoginLandingRoute(['DEPLOY_READ']), '/deploy/register')
  assert.equal(resolveLoginLandingRoute(['USER_READ']), '/user/users')
})

test('접근 가능 항목이 0 이면 /live-map 으로 보내 그 자리에서 안내가 렌더된다', () => {
  // 조용한 /login 튕김을 하지 않는다는 뜻이다 — 목적지의 RequirePermission 이
  // AccessDeniedNotice 를 렌더한다(RequirePermission.tsx:68-74). 전용 라우트를 새로 만들지 않는다.
  //
  // 목적지를 리터럴로 못 박는다. 트리에서 읽은 값과 비교하면 구현이 같은 식을 쓰는 탓에
  // 양변이 함께 움직여 어떤 fallback 이든 통과한다 — 판별력이 0 이 된다.
  assert.equal(resolveLoginLandingRoute([]), '/live-map')
  assert.equal(resolveLoginLandingRoute(null), '/live-map')
  assert.equal(resolveLoginLandingRoute(undefined), '/live-map')
  // 트리 권한이 하나도 아닌 코드만 가진 경우도 같다.
  assert.equal(resolveLoginLandingRoute(['AUTH_ME_PERM']), '/live-map')
})

test('fallback 목적지는 트리 첫 항목과 같다 — 그래서 현행 사용자 랜딩이 바뀌지 않는다', () => {
  // 위 test 가 못 박은 리터럴이 왜 '/live-map' 인지의 근거다. 트리 첫 항목이 다른 것으로
  // 바뀌면 이 test 가 먼저 깨져 "위 리터럴도 같이 고쳐야 한다" 를 알려준다 — 리터럴만 두면
  // 트리 변경 시 무엇이 틀렸는지 알 수 없다.
  assert.equal(TREE_FIRST_ROUTE, '/live-map')
  assert.equal(resolveLoginLandingRoute([]), TREE_FIRST_ROUTE)
})

test('결정은 확정 트리 순서를 따른다 — 6 그룹 전건', () => {
  // 별도 우선순위 표를 두거나 라우트를 하드코딩하면 이 순회가 어긋난다. 트리가 단일 원천이다.
  for (const group of APP_NAVIGATION_GROUPS) {
    const firstItem = group.items[0]
    assert.equal(
      resolveLoginLandingRoute([firstItem.requiredPermission]),
      firstItem.route,
      `${group.key} 그룹의 첫 항목 권한만 보유했을 때 목적지가 그 항목이 아니다`,
    )
  }
})

test('앞 그룹 권한이 있으면 뒤 그룹 권한보다 우선한다', () => {
  // 인자 순서가 아니라 트리 순서가 결정한다 — 배열을 뒤집어도 결과가 같아야 한다.
  assert.equal(resolveLoginLandingRoute(['USER_READ', 'DLQ_READ']), '/dlq/dashboard')
  assert.equal(resolveLoginLandingRoute(['DLQ_READ', 'USER_READ']), '/dlq/dashboard')
})

/**
 * 훅 배선은 소스 단언으로만 검증합니다.
 *
 * `useLogin.ts` 는 react-hook-form / zod / react-router 를 import 해 node --test 로 로드할 수
 * 없고, 이 레포엔 jsdom/RTL 이 없다(`route-auth-guard.test.ts:15-18` 과 같은 제약). 다만 이
 * 변경의 회귀 표면 자체가 **어떤 값으로 어디로 보내는가**라서 소스 단언으로 정확히 덮인다
 * (실제 브라우저 판정은 `tests/e2e/login-landing.spec.ts` 담당).
 */
test('useLogin 이 상수 고정 랜딩을 버리고 권한 기반 결정을 쓴다', () => {
  const source = readSource('src/features/auth/hooks/useLogin.ts')

  assert.match(
    source,
    /resolveLoginLandingRoute\(/,
    '권한 기반 랜딩 결정이 배선되지 않았다',
  )
  assert.doesNotMatch(
    source,
    /LOGIN_ENTRY_ROUTE/,
    '상수 고정 랜딩이 남아 있다 — LIVE_MAP_READ 미보유자가 다시 권한없음 화면으로 간다',
  )
})

test('랜딩 결정이 읽는 me 는 가드와 같은 캐시 키이고 신선도를 명시한다', () => {
  const source = readSource('src/features/auth/hooks/useLogin.ts')

  // 키가 useMe(useProfile.ts:9)와 달라지면 직후 가드가 같은 요청을 한 번 더 보낸다.
  assert.match(
    source,
    /queryKey:\s*\['auth',\s*'me'\]/,
    "랜딩용 me 조회가 가드와 같은 캐시 키(['auth','me'])를 쓰지 않는다",
  )
  // AppProvider.tsx:12 의 기본 staleTime 이 5 분이라, 명시하지 않으면 메모리에 남은 이전
  // 사용자의 me 를 네트워크 없이 돌려받아 그 사람 권한으로 랜딩할 수 있다.
  assert.match(
    source,
    /staleTime:\s*0/,
    '랜딩용 me 조회에 staleTime: 0 이 없다 — 기본 5 분 캐시로 이전 사용자 권한을 읽을 수 있다',
  )
})

test('me 조회 실패를 조용히 삼키지 않는다', () => {
  const source = readSource('src/features/auth/hooks/useLogin.ts')

  assert.match(
    source,
    /console\.error/,
    'me 조회 실패가 표면화되지 않는다 — 랜딩이 왜 기본 경로로 갔는지 진단 불가',
  )
})
