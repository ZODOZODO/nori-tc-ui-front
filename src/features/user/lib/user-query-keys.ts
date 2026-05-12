/**
 * User 도메인 query key 규약입니다. deploy-query-keys.ts 패턴과 일치합니다.
 */
export const userQueryKeys = {
  all: ['user'] as const,
  list: (offset: number, limit: number) => ['user', 'list', offset, limit] as const,
  allList: ['user', 'list', 'all'] as const,
  detail: (userPk: number) => ['user', 'detail', userPk] as const,
  groups: (userPk: number) => ['user', 'groups', userPk] as const,
} as const
