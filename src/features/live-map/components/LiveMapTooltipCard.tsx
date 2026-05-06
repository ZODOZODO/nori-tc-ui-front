import {
  LIVE_MAP_PORT_STATUS_THEME,
  LIVE_MAP_STATUS_THEME,
} from '../lib/live-map-status-theme'
import type { LiveMapEquipmentNode } from '../types/live-map.types'
import { LiveMapCommLogPanel } from './LiveMapCommLogPanel'

interface LiveMapTooltipCardProps {
  equipment: LiveMapEquipmentNode | null
}

export function LiveMapTooltipCard({ equipment }: LiveMapTooltipCardProps) {
  if (!equipment) {
    return (
      <div className="w-full rounded-[20px] border border-[#2B343D] bg-[#11161B] p-4 text-sm text-[#D6E0E8] shadow-[0_14px_28px_rgba(2,4,6,0.5)]">
        선택된 설비가 없습니다.
      </div>
    )
  }

  const statusTone = LIVE_MAP_STATUS_THEME[equipment.status]
  const statusMessage =
    equipment.alertMessage ??
    (equipment.status === 'ERROR'
      ? '점검이 필요한 설비입니다.'
      : equipment.status === 'IDLE'
        ? '대기 상태이며 다음 lot 투입을 기다리고 있습니다.'
        : equipment.status === 'DOWN'
          ? 'Down 상태입니다.'
          : '정상 가동 상태를 유지하고 있습니다.')

  return (
    <div className="flex h-full w-full flex-col rounded-[20px] border border-[#2B343D] bg-[#11161B] p-4 shadow-[0_14px_28px_rgba(2,4,6,0.5)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold tracking-[0.08em] text-[#7E8892]">선택 설비</div>
          <div className="mt-1 truncate text-[20px] font-extrabold text-[#F3F6F9]">
            {equipment.eqpId}
          </div>
        </div>
        <span
          className="inline-flex h-7 shrink-0 items-center self-start whitespace-nowrap rounded-full border px-3 text-[11px] font-bold"
          style={{
            backgroundColor: statusTone.badgeBackground,
            borderColor: statusTone.badgeBorder,
            color: statusTone.badgeText,
          }}
        >
          {equipment.statusLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 rounded-[14px] border border-[#212A32] bg-[#151B20] p-3 xl:grid-cols-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold tracking-[0.08em] text-[#7E8892]">공정</div>
          <div className="mt-1 truncate text-[12px] font-semibold text-[#E1E8EE]">
            {equipment.clusterName}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-bold tracking-[0.08em] text-[#7E8892]">라인</div>
          <div className="mt-1 truncate text-[12px] font-semibold text-[#E1E8EE]">
            {equipment.lineLabel}
          </div>
        </div>
        <div className="min-w-0 col-span-2 xl:col-span-1">
          <div className="text-[10px] font-bold tracking-[0.08em] text-[#7E8892]">웨이퍼 모드</div>
          <div className="mt-1 truncate whitespace-nowrap text-[12px] font-semibold text-[#E1E8EE]">
            {equipment.processingTypeLabel}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-[12px] border border-[#212A32] bg-[#151B20] px-3 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-bold tracking-[0.08em] text-[#7E8892]">PORT 상태</div>
          <div className="text-[10px] font-semibold text-[#91A0AC]">
            총 {equipment.portItems.length}개
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {equipment.portItems.map((portItem) => {
            const portTone = LIVE_MAP_PORT_STATUS_THEME[portItem.status]

            return (
              <div
                key={portItem.id}
                className="rounded-[10px] border px-2.5 py-2"
                style={{
                  backgroundColor: '#11161B',
                  borderColor: '#29323B',
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate text-[10px] font-bold tracking-[0.06em] text-[#D6E0E8]">
                    {portItem.label}
                  </div>
                  <span
                    className="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 text-[10px] font-bold"
                    style={{
                      backgroundColor: portTone.background,
                      borderColor: portTone.border,
                      color: portTone.text,
                    }}
                  >
                    {portItem.statusLabel}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div
        className="mt-3 rounded-[10px] border px-3 py-2 text-[10px] font-bold"
        style={{
          backgroundColor: statusTone.panelBackground,
          borderColor: statusTone.panelBorder,
          color: statusTone.panelText,
        }}
      >
        {statusMessage}
      </div>

      <div className="flex-1 min-h-0">
        <LiveMapCommLogPanel eqpId={equipment.eqpId} />
      </div>
    </div>
  )
}
