import type { PointerEvent as ReactPointerEvent } from 'react'
import { LIVE_MAP_STATUS_THEME } from '../lib/live-map-status-theme'
import type { LiveMapEqpStatus } from '../types/live-map.types'

interface LiveMapMachineNodeProps {
  eqpId: string
  status: LiveMapEqpStatus
  x: number
  y: number
  selected: boolean
  dimmed: boolean
  editable: boolean
  dragging: boolean
  onSelect: (eqpId: string) => void
  onDragStart: (eqpId: string, event: ReactPointerEvent<HTMLButtonElement>) => void
}

/**
 * dash_map frame의 machine node 톤을 코드 컴포넌트로 옮긴 표현입니다.
 */
export function LiveMapMachineNode({
  eqpId,
  status,
  x,
  y,
  selected,
  dimmed,
  editable,
  dragging,
  onSelect,
  onDragStart,
}: LiveMapMachineNodeProps) {
  const theme = LIVE_MAP_STATUS_THEME[status]

  return (
    <button
      type="button"
      className={`absolute rounded-[10px] text-left transition-[transform,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E36C7C]/60 ${
        editable
          ? dragging
            ? 'cursor-grabbing shadow-[0_12px_20px_rgba(9,16,24,0.3)]'
            : 'cursor-grab hover:-translate-y-0.5'
          : 'cursor-pointer hover:-translate-y-0.5'
      }`}
      style={{
        left: x,
        top: y,
        opacity: dimmed ? 0.2 : 1,
      }}
      onClick={() => onSelect(eqpId)}
      onPointerDown={(event) => onDragStart(eqpId, event)}
      aria-label={`${eqpId} 설비 선택`}
      disabled={dimmed}
      aria-pressed={selected}
    >
      {selected ? (
        <span className="absolute -inset-1 rounded-[10px] border-2 border-[#E36C7C] shadow-[0_0_0_2px_rgba(227,108,124,0.15)]" />
      ) : null}
      <span className="relative block h-10 w-7 rounded-[6px] border border-[#B7C4D4] bg-[#F1F5FB] shadow-[0_5px_12px_rgba(9,16,24,0.2)]">
        <span
          className="absolute left-1 top-1 h-[7px] w-5 rounded-[3px]"
          style={{ backgroundColor: theme.nodeTop }}
        />
        <span className="absolute right-0 top-[7px] h-6 w-[6px] rounded-r-[4px] bg-[#707A88]" />
        <span
          className="absolute left-[7px] top-4 h-3 w-[14px] rounded-[3px]"
          style={{ backgroundColor: theme.nodeLower }}
        />
        <span
          className="absolute right-1 top-[5px] h-[6px] w-[6px] rounded-full border"
          style={{
            backgroundColor: theme.nodeLamp,
            borderColor: theme.nodeLampBorder,
          }}
        />
        <span className="absolute bottom-0 left-[6px] h-[5px] w-4 rounded-b-[4px] bg-[#BCC7D6]" />
      </span>
    </button>
  )
}
