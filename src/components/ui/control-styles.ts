/**
 * 폼 컨트롤의 공통 시각 계약입니다.
 *
 * Input·Select·검색형 선택기가 서로 다른 구현이어도 높이, 글자 크기, 테두리와 상태 표현은 같아야
 * 한 화면에서 하나의 제품처럼 보입니다. 호출부의 `className`은 너비와 컴팩트 높이 같은 문맥만 덮습니다.
 */
export const controlBaseClassName =
  'w-full min-w-0 rounded-lg border border-input bg-card text-[0.9375rem] leading-5 text-foreground shadow-xs outline-none transition-[border-color,background-color,box-shadow] duration-150 placeholder:text-muted-foreground/85 hover:border-foreground/20 focus-visible:border-brand-accent focus-visible:bg-background focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted/65 disabled:text-muted-foreground disabled:opacity-70 aria-invalid:border-danger aria-invalid:ring-[3px] aria-invalid:ring-inset aria-invalid:ring-danger/15'

export const controlPopupClassName =
  'overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-soft-md'

export const controlOptionClassName =
  'relative flex min-h-9 w-full cursor-default items-center rounded-md px-2.5 py-2 text-sm leading-5 outline-none select-none data-disabled:pointer-events-none data-disabled:opacity-50'
