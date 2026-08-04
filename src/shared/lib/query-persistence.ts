/** TanStack Query dehydrate 캐시의 localStorage 키. persister 구성과 로그아웃 정리가 공유한다. */
export const QUERY_CACHE_STORAGE_KEY = 'nori-tc-ui-cache'

/**
 * localStorage 영속을 **허용**하는 query head 목록.
 *
 * deny-list 였을 때는 목록에 없는 head 가 전부 영속돼, 신규 도메인을 추가하면 기본값이 "영속"이라
 * 업무 데이터(설비 파라미터·모델 정의·DLQ payload)가 조용히 공유 PC 의 localStorage 에 30분 남았다
 * (S09 E-1). allow-list 로 반전해 기본값을 "비영속" 으로 둔다.
 *
 * `line` 만 허용한다 — 라인 코드/이름은 마스터 메타데이터이고 상단바 드롭다운이 전 화면에서 쓴다.
 */
export const PERSISTED_QUERY_HEADS: ReadonlySet<string> = new Set(['line'])

export function isPersistableQueryHead(head: unknown): boolean {
  return typeof head === 'string' && PERSISTED_QUERY_HEADS.has(head)
}

/**
 * 영속된 query 캐시를 즉시 제거한다. 로그아웃 경로에서 호출한다 —
 * `queryClient.clear()` 는 인메모리 캐시만 비우고 localStorage 사본은 남긴다.
 */
export function clearPersistedQueryCache(): void {
  window.localStorage.removeItem(QUERY_CACHE_STORAGE_KEY)
}
