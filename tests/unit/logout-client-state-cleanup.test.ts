import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  isPersistableQueryHead,
  PERSISTED_QUERY_HEADS,
  QUERY_CACHE_STORAGE_KEY,
} from '@/shared/lib/query-persistence.ts'

/**
 * S09 E-1 + E-3 재현 — 감사 §7 묶음 2("둘 다 로그아웃이 클라이언트 상태를 정리하지 않는다").
 *
 * E-1: TanStack Query persist 가 **deny-list** 라 목록에 없는 query head 가 전부 localStorage 에
 *      30분 평문 영속됐다. 실제 누락 head = eqp(설비 목록·상세·파라미터) / model(모델·플로우 전문) /
 *      dlq(메시지 payload) / comm-log / live-map-demo-run*. 신규 도메인은 기본값이 "영속"이라
 *      조용히 확대된다. 로그아웃은 `persister.removeClient()` 를 부르지 않았다(레포 전체 0건).
 * E-3: 로그아웃이 `clearDeployUiSessionState()` 를 부르지 않아 같은 탭 딥링크에서 이전 사용자의
 *      선택 설비 목록·localHistory 가 sessionStorage 에서 복원돼 렌더됐다. 라우트 인증 가드도 0건이라
 *      인증 판정이 401 인터셉터(사후 차단)뿐이었다.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const readSource = (relativePath: string) => readFileSync(join(ROOT, relativePath), 'utf8')

test('업무 데이터 query head 는 영속 대상이 아니다', () => {
  for (const head of [
    'eqp',
    'model',
    'dlq',
    'comm-log',
    'live-map-demo-run',
    'live-map-demo-run-list',
    'live-map-demo-run-scenarios',
    'auth',
    'user',
    'group',
    'deploy',
    'live-map',
    'live-map-layout',
    'live-map-objects',
  ]) {
    assert.equal(isPersistableQueryHead(head), false, `${head} 가 localStorage 에 영속된다`)
  }
})

test('신규 도메인의 기본값은 비영속이다 (allow-list)', () => {
  // deny-list 였을 때는 목록에 없는 신규 head 가 조용히 영속됐다.
  assert.equal(isPersistableQueryHead('some-new-domain'), false)
  assert.equal(isPersistableQueryHead(undefined), false)
  assert.equal(isPersistableQueryHead(42), false)
})

test('영속 허용 목록은 비업무 마스터 데이터로 한정된다', () => {
  assert.deepEqual([...PERSISTED_QUERY_HEADS], ['line'])
  assert.equal(isPersistableQueryHead('line'), true)
})

test('persist 저장 키가 정리 함수와 provider 사이에서 공유된다', () => {
  const provider = readSource('src/app/providers/AppProvider.tsx')
  // 키가 드리프트하면 로그아웃 정리가 다른 키를 지워 캐시가 남는다.
  assert.match(provider, /QUERY_CACHE_STORAGE_KEY/)
  assert.equal(QUERY_CACHE_STORAGE_KEY, 'nori-tc-ui-cache')
})

test('로그아웃이 persist 캐시와 deploy sessionStorage 를 함께 정리한다', () => {
  const topBar = readSource('src/shared/components/AppTopBar.tsx')
  const logout = /const handleLogout = async \(\) => \{[\s\S]*?\r?\n {2}\}\r?\n/.exec(topBar)
  assert.ok(logout, 'handleLogout 을 찾지 못했다')

  assert.match(logout[0], /clearPersistedQueryCache\(\)/, 'E-1 회귀: localStorage 캐시가 남는다')
  assert.match(
    logout[0],
    /clearDeployUiSessionState\(\)/,
    'E-3 회귀: deploy sessionStorage 가 남아 다음 사용자에게 복원된다',
  )
  assert.match(logout[0], /queryClient\.clear\(\)/, '기존 인메모리 정리는 유지돼야 한다')
})

test('보호 라우트가 인증 가드를 경유한다', () => {
  const router = readSource('src/app/Router.tsx')
  // 가드는 layout route 형태다 — 보호 라우트 16 개를 각각 감싸면 누락이 조용히 생긴다.
  assert.match(router, /<Route element=\{<RequireAuth \/>\}>/, 'E-3 회귀: 라우트 인증 가드가 없다')

  // /login 은 가드 밖이어야 한다 — 안에 넣으면 리다이렉트 루프가 된다.
  const loginRoute = /<Route path="\/login"[^\n]*\/>/.exec(router)
  assert.ok(loginRoute)
  const guardStart = router.indexOf('<Route element={<RequireAuth />}>')
  assert.ok(router.indexOf(loginRoute[0]) < guardStart, '/login 이 인증 가드 안에 있다')
})
