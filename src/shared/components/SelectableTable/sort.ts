/**
 * 열 정렬 비교기입니다.
 *
 * 옵션 없는 `localeCompare` 는 숫자 문자열을 사전순으로 비교해 `"10" < "9"` 가 된다 —
 * 버전·포트·개수처럼 숫자가 문자열로 담기는 컬럼이 뒤집힌다. `numeric: true` 로 자연 정렬한다.
 */
export const SORT_COLLATOR = new Intl.Collator(undefined, { numeric: true })
