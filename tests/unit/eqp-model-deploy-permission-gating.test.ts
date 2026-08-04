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
import { resolveVisibleAppNavigationItems } from '@/shared/lib/app-navigation.ts'

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
 * 범위는 ledger 난이도 M 이 정한 read 게이팅(상수 + nav + 페이지 가드)이다.
 * write 버튼 게이팅은 감사가 L 로 분류했다.
 */

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const readSource = (relativePath: string) => readFileSync(join(ROOT, relativePath), 'utf8')

test('권한 상수는 백엔드 시드의 perm_code 문자열과 일치한다', () => {
  assert.equal(EQP_READ_PERMISSION, 'EQP_READ')
  assert.equal(MODEL_READ_PERMISSION, 'MODEL_READ')
  assert.equal(DEPLOY_READ_PERMISSION, 'DEPLOY_READ')
})

test('읽기 권한 없는 사용자에게 eqp·model·deploy 메뉴가 보이지 않는다', () => {
  const visible = resolveVisibleAppNavigationItems(['AUTH_ME_PERM']).map((item) => item.key)
  assert.deepEqual(visible, [], '권한 0 인데 노출되는 메뉴가 있다')
})

test('OPERATOR 시드 권한 조합에서는 eqp·model·deploy 메뉴가 보인다', () => {
  // 시드의 OPERATOR 그룹 grant (postgres_insert_user_ui_sample_data.sql:144-153).
  const operator = ['EQP_READ', 'DLQ_READ', 'MODEL_READ', 'DEPLOY_READ', 'DEPLOY_WRITE']
  const visible = resolveVisibleAppNavigationItems(operator).map((item) => item.key)
  assert.deepEqual(visible, ['eqp', 'model', 'deploy', 'dlq'])
})

test('부분 권한은 해당 메뉴만 노출한다', () => {
  assert.deepEqual(
    resolveVisibleAppNavigationItems(['EQP_READ']).map((item) => item.key),
    ['eqp'],
  )
  assert.deepEqual(
    resolveVisibleAppNavigationItems(['MODEL_READ', 'DEPLOY_READ']).map((item) => item.key),
    ['model', 'deploy'],
  )
})

test('hasPermission 은 상수와 함께 정상 판정한다', () => {
  assert.equal(hasPermission(['EQP_READ'], EQP_READ_PERMISSION), true)
  assert.equal(hasPermission(['EQP_WRITE'], EQP_READ_PERMISSION), false)
  assert.equal(hasPermission(null, EQP_READ_PERMISSION), false)
})

/**
 * 배선 회귀망 — 메뉴 숨김만으로는 URL 직접 입력·딥링크를 막지 못한다.
 * 세 페이지가 게이팅이 있는 DlqPage 와 같은 형태로 본문 진입을 막는지 소스 수준으로 고정한다.
 */
test('eqp·model·deploy 페이지가 본문 진입을 게이팅한다', () => {
  const pages = [
    ['src/features/eqp/components/EqpPage.tsx', 'EQP_READ_PERMISSION'],
    ['src/features/model/components/ModelPage.tsx', 'MODEL_READ_PERMISSION'],
    ['src/features/deploy/components/DeployPage.tsx', 'DEPLOY_READ_PERMISSION'],
  ] as const

  for (const [path, permissionConstant] of pages) {
    const source = readSource(path)
    assert.match(source, /hasPermission\(/, `E-2 회귀: ${path} 에 hasPermission 호출이 없다`)
    assert.match(
      source,
      new RegExp(permissionConstant),
      `E-2 회귀: ${path} 가 ${permissionConstant} 를 검사하지 않는다`,
    )
    assert.match(source, /<Navigate to=/, `E-2 회귀: ${path} 가 미권한 사용자를 리다이렉트하지 않는다`)
  }
})
