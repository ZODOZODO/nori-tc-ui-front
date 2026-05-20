/**
 * Group 도메인 query key 규약입니다. user-query-keys.ts 와 동일한 패턴입니다.
 */
export const groupQueryKeys = {
  all: ['group'] as const,
  list: (offset: number, limit: number) => ['group', 'list', offset, limit] as const,
  detail: (groupId: number) => ['group', 'detail', groupId] as const,
  members: (groupId: number) => ['group', 'members', groupId] as const,
} as const
