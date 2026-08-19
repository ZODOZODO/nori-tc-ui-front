/**
 * 모든 페이지 제목 영역의 공통 크기 계약입니다.
 *
 * 액션 버튼이 있는 제목 줄은 40px, 제목만 있는 줄은 32px이므로 최소 높이를 고정해 페이지마다 본문
 * 시작점이 달라지지 않게 합니다. 번역 문구가 줄바꿈되면 내용이 잘리지 않고 필요한 만큼 늘어납니다.
 */
export const pageHeadingClassName =
  'flex min-h-21 shrink-0 flex-col gap-1.5 border-b border-border pb-4'
