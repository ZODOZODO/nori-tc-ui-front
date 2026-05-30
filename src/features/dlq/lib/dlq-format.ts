import type { ColumnDef } from '@/shared/components/SelectableTable'

/**
 * DLQ 패널 공용 — 클라이언트 페이지네이션 초기 페이지 크기.
 */
export const DLQ_PAGE_SIZE = 20

/**
 * DLQ 4 패널 공용 — 컬럼 accessor 가 렌더하는 표시 텍스트 전체를 대상으로
 * keyword 부분일치 필터링. 전체 목록이 메모리에 있으므로(클라 페이지네이션)
 * 콘텐츠 검색이 전체 데이터셋을 대상으로 정확히 동작한다.
 * keyword 가 공백이면 원본을 그대로 복사해 반환하는 순수 함수.
 */
export const filterDlqRows = <TRow>(
  rows: readonly TRow[],
  columns: ReadonlyArray<ColumnDef<TRow>>,
  keyword: string,
): TRow[] => {
  const query = keyword.trim().toLowerCase()
  if (query === '') {
    return [...rows]
  }

  return rows.filter((row) =>
    columns.some((column) => column.accessor(row).toLowerCase().includes(query)),
  )
}

/**
 * `YYYY-MM-DD HH:mm:ss` 형식으로 시각을 표시한다.
 * 입력은 epoch milliseconds (number) 또는 ISO-8601 문자열, 또는 null/undefined.
 */
export const formatDlqTime = (value: number | string | null | undefined): string => {
  if (value === null || value === undefined || value === '') {
    return '-'
  }

  const date = typeof value === 'number' ? new Date(value) : new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  const pad = (n: number): string => String(n).padStart(2, '0')
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  )
}
