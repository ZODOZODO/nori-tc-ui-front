/**
 * DLQ 패널 공용 — 클라이언트 페이지네이션 페이지 크기.
 */
export const DLQ_PAGE_SIZE = 20

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
