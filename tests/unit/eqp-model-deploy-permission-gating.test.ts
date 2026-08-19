import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  DEPLOY_READ_PERMISSION,
  EQP_READ_PERMISSION,
  hasPermission,
  MODEL_READ_PERMISSION,
} from '@/shared/lib/permission.ts'
import { resolveVisibleAppNavigationGroups } from '@/shared/lib/app-navigation.ts'

/**
 * S09 E-2 재현 — eqp·model·deploy 화면에 권한 게이팅이 전무하고 권한 상수 자체가 부재.
 *
 * 백엔드에는 해당 권한이 실재한다 — exec 시드
 * `docs/db_table/sample_data/postgres_insert_user_ui_sample_data.sql:65,66,70,71,80,81`
 * (`EQP_READ`/`EQP_WRITE`/`MODEL_READ`/`MODEL_WRITE`/`DEPLOY_READ`/`DEPLOY_WRITE`) →
 * 의도적 미구현이 아니라 프론트 누락이다. 데이터 경계는 백엔드 closed-by-default 가 지키므로
 * 유출은 아니지만, 권한 없는 사용자에게 배포 UI 와 설비 인벤토리 화면이 노출되고
 * GET 이 403 이라 빈 화면 + 반복 403 이라는 잘못된 UX 를 겪는다.
 *
 * wm-parity-sidebar 이후 게이팅 자리가 바뀌었다: 메뉴 필터는 2단 LNB 트리
 * (`resolveVisibleAppNavigationGroups`)가, 본문 진입 차단은 페이지 자체가 아니라 라우트 가드
 * (`RequirePermission`)가 맡는다. 미보유 시 동작도 `/login` 튕김에서 **AccessDeniedNotice 렌더**로
 * 바뀌었다(튕기면 세션이 끊긴 것으로 오해한다). 아래 단언은 그 새 자리에 게이트가 실재하는지를 본다.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const readSource = (relativePath: string) => readFileSync(join(ROOT, relativePath), 'utf8')

const itemKeys = (permissionCodes: readonly string[]): string[] =>
  resolveVisibleAppNavigationGroups(permissionCodes).flatMap((group) =>
    group.items.map((item) => item.key),
  )

test('권한 상수는 백엔드 시드의 perm_code 문자열과 일치한다', () => {
  assert.equal(EQP_READ_PERMISSION, 'EQP_READ')
  assert.equal(MODEL_READ_PERMISSION, 'MODEL_READ')
  assert.equal(DEPLOY_READ_PERMISSION, 'DEPLOY_READ')
})

test('읽기 권한 없는 사용자에게 eqp·model·deploy 메뉴가 보이지 않는다', () => {
  assert.deepEqual(itemKeys(['AUTH_ME_PERM']), [], '권한 0 인데 노출되는 메뉴가 있다')
})

test('OPERATOR 시드 권한 조합에서는 eqp·model·deploy 메뉴가 보인다', () => {
  // 시드의 OPERATOR 그룹 grant (postgres_insert_user_ui_sample_data.sql:144-153).
  const operator = ['EQP_READ', 'DLQ_READ', 'MODEL_READ', 'DEPLOY_READ', 'DEPLOY_WRITE']
  assert.deepEqual(itemKeys(operator), [
    'dlqDashboard',
    'dlqGateway',
    'dlqBusiness',
    'dlqQuarantine',
    'dlqRepairTask',
    'eqpBusiness',
    'eqpGateway',
    'modelSecs',
    'modelSocket',
    'modelPlc',
    'deployRegister',
    'deployDeploy',
    'deployHistory',
  ])
})

test('부분 권한은 해당 메뉴만 노출한다', () => {
  assert.deepEqual(itemKeys(['EQP_READ']), ['eqpBusiness', 'eqpGateway'])
  assert.deepEqual(itemKeys(['MODEL_READ', 'DEPLOY_READ']), [
    'modelSecs',
    'modelSocket',
    'modelPlc',
    'deployRegister',
    'deployDeploy',
    'deployHistory',
  ])
})

test('hasPermission 은 상수와 함께 정상 판정한다', () => {
  assert.equal(hasPermission(['EQP_READ'], EQP_READ_PERMISSION), true)
  assert.equal(hasPermission(['EQP_WRITE'], EQP_READ_PERMISSION), false)
  assert.equal(hasPermission(null, EQP_READ_PERMISSION), false)
})

/**
 * 배선 회귀망 — 메뉴 숨김만으로는 URL 직접 입력·딥링크를 막지 못한다.
 * eqp·model·deploy 라우트가 각자의 권한 코드로 감싸져 있는지를 소스 수준으로 고정한다.
 */
test('eqp·model·deploy 라우트가 RequirePermission 으로 본문 진입을 게이팅한다', () => {
  const router = readSource('src/app/Router.tsx')

  const groups = [
    ['EQP_READ_PERMISSION', ['/eqp/business', '/eqp/gateway']],
    ['MODEL_READ_PERMISSION', ['/model/secs', '/model/socket', '/model/plc']],
    ['DEPLOY_READ_PERMISSION', ['/deploy/register', '/deploy/deploy', '/deploy/history']],
  ] as const

  for (const [permissionConstant, paths] of groups) {
    const guardOpen = router.indexOf(
      `<Route element={<RequirePermission permissionCode={${permissionConstant}} />}>`,
    )
    assert.notEqual(guardOpen, -1, `E-2 회귀: ${permissionConstant} 권한 가드가 없다`)

    const guardClose = router.indexOf('</Route>', guardOpen)
    assert.notEqual(guardClose, -1, `${permissionConstant} 가드 블록이 닫히지 않았다`)

    for (const path of paths) {
      const at = router.indexOf(`<Route path="${path}"`)
      assert.notEqual(at, -1, `라우트 ${path} 가 사라졌다`)
      assert.equal(
        at > guardOpen && at < guardClose,
        true,
        `E-2 회귀: ${path} 가 ${permissionConstant} 가드 밖에 있다`,
      )
    }
  }
})

test('권한 미보유는 /login 튕김이 아니라 AccessDeniedNotice 로 안내한다', () => {
  const guard = readSource('src/app/RequirePermission.tsx')

  assert.match(guard, /hasPermission\(/, '권한 판정이 사라졌다')
  assert.match(guard, /<AccessDeniedNotice permissionCode=\{permissionCode\} \/>/, '안내 화면이 사라졌다')
  // 튕기면 사용자는 세션이 끊긴 것으로 오해한다 — 되돌아가지 않게 음성 단언한다.
  assert.equal(guard.includes('<Navigate'), false, '권한 가드가 다시 /login 으로 튕긴다')
  // 판정 전에 안내를 띄우면 정상 사용자에게도 잠깐 "권한 없음" 이 보인다.
  assert.match(guard, /meQuery\.isPending/, 'pending 분기가 사라져 판정 전 안내가 렌더된다')
})
