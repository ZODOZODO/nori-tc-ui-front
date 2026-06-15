/**
 * 권한 코드를 "페이지/기능 카테고리"로 분류하는 규약입니다.
 *
 * 권한 편집 UI 는 raw resource URL(예: `/api/admin/deploy-scenarios`) 대신 이 카테고리로
 * 묶어 가독성을 높인다. permCode 접두사로 매칭하므로 resource URL 이 페이지와 어긋나는
 * 권한(예: DEPLOY_ADMIN → `/api/admin/deploy-scenarios`)도 올바른 페이지로 묶인다.
 * 매칭되지 않는 권한은 'etc' 로 떨어진다.
 */
export type PermissionCategoryKey =
  | 'eqp'
  | 'model'
  | 'deploy'
  | 'dlq'
  | 'liveMap'
  | 'userAdmin'
  | 'common'
  | 'etc'

interface CategoryRule {
  key: PermissionCategoryKey
  matches: (permCode: string) => boolean
}

// 평가 순서대로 첫 매칭 카테고리를 사용한다.
const CATEGORY_RULES: readonly CategoryRule[] = [
  { key: 'eqp', matches: (code) => code.startsWith('EQP_') || code.startsWith('COMM_LOG') },
  { key: 'model', matches: (code) => code.startsWith('MODEL_') },
  { key: 'deploy', matches: (code) => code.startsWith('DEPLOY_') },
  { key: 'dlq', matches: (code) => code.startsWith('DLQ_') },
  { key: 'liveMap', matches: (code) => code.startsWith('LIVE_MAP') || code.startsWith('DASH_') },
  {
    key: 'userAdmin',
    matches: (code) =>
      code.startsWith('USER_') || code.startsWith('GROUP_') || code.startsWith('PERMISSION_'),
  },
  {
    key: 'common',
    matches: (code) =>
      code.startsWith('AUTH_') || code.startsWith('ASYNC_') || code.startsWith('LINE_'),
  },
]

/**
 * 카테고리 렌더 순서입니다. 페이지 카테고리 우선, 공통/기타는 뒤로.
 */
export const PERMISSION_CATEGORY_ORDER: readonly PermissionCategoryKey[] = [
  'eqp',
  'model',
  'deploy',
  'dlq',
  'liveMap',
  'userAdmin',
  'common',
  'etc',
]

/**
 * 권한 코드를 카테고리 키로 분류합니다. 미매칭은 'etc'.
 */
export const resolvePermissionCategory = (permCode: string): PermissionCategoryKey => {
  const matched = CATEGORY_RULES.find((rule) => rule.matches(permCode))
  return matched ? matched.key : 'etc'
}
