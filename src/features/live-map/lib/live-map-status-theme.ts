import type { LiveMapEqpStatus, LiveMapPortStatus } from '../types/live-map.types'

/**
 * 설비 상태 semantic 색을 테마 반응형(.dark cascade) Tailwind 토큰 className 으로 표현합니다.
 *
 * - RUN→success(green) / ERROR→danger(red) / DOWN→muted(neutral) 는 ui-front semantic 토큰.
 * - IDLE→sky 는 ui-front 토큰계에 blue 가 없어(coral 단일 hue) "대기" semantic 색을 보존하기 위해
 *   Tailwind 기본 sky 팔레트를 유지. dark: 변형으로 양 테마 가독성 확보.
 */
export interface LiveMapStatusVariant {
  /** chip / badge — border + bg + text */
  chip: string
  /** solid status dot/lamp 배경 */
  dot: string
  /** 상태 강조 텍스트 */
  text: string
  /** 옅은 상태 tint 표면 */
  tint: string
}

export const LIVE_MAP_STATUS_CLASS: Record<LiveMapEqpStatus, LiveMapStatusVariant> = {
  RUN: {
    chip: 'border-success/30 bg-success/10 text-success',
    dot: 'bg-success',
    text: 'text-success',
    tint: 'bg-success/10',
  },
  IDLE: {
    chip: 'border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400',
    dot: 'bg-sky-500',
    text: 'text-sky-600 dark:text-sky-400',
    tint: 'bg-sky-500/10',
  },
  ERROR: {
    chip: 'border-danger/30 bg-danger/10 text-danger',
    dot: 'bg-danger',
    text: 'text-danger',
    tint: 'bg-danger/10',
  },
  DOWN: {
    chip: 'border-border bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
    text: 'text-muted-foreground',
    tint: 'bg-muted',
  },
}

export const LIVE_MAP_PORT_STATUS_CLASS: Record<LiveMapPortStatus, LiveMapStatusVariant> = {
  RUN: LIVE_MAP_STATUS_CLASS.RUN,
  IDLE: LIVE_MAP_STATUS_CLASS.IDLE,
  DOWN: LIVE_MAP_STATUS_CLASS.DOWN,
}

/**
 * run/target 상태(RunState/TargetState 문자열) 뱃지 색을 설비 상태 색(LIVE_MAP_STATUS_CLASS)과 단일 출처로 매핑한다.
 *
 * - RUNNING → RUN(초록), COMPLETED/TERMINAL → IDLE(파랑), FAILED/CANCELED → ERROR(빨강).
 * - CANCELED(사용자 명시 종료)도 FAILED 와 동일하게 오류색(빨강)으로 표시한다(미완료 종료를 시각적으로 강조).
 * - STOPPING/CREATED/PENDING 등 그 외는 중립(DOWN). 백엔드 enum 에 없는 'ERRORED' 유령 분기는 제거(Lo3) — 기본 DOWN.
 */
export const resolveRunStateChipClass = (state: string): string => {
  if (state === 'RUNNING') {
    return LIVE_MAP_STATUS_CLASS.RUN.chip
  }
  if (state === 'COMPLETED' || state === 'TERMINAL') {
    return LIVE_MAP_STATUS_CLASS.IDLE.chip
  }
  if (state === 'FAILED' || state === 'CANCELED') {
    return LIVE_MAP_STATUS_CLASS.ERROR.chip
  }
  return LIVE_MAP_STATUS_CLASS.DOWN.chip
}
