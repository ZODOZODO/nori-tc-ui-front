import { useI18n } from '@/i18n/i18n-context'
import {
  LIVE_MAP_PORT_STATUS_CLASS,
  LIVE_MAP_STATUS_CLASS,
} from '../lib/live-map-status-theme'
import type { LiveMapEqpStatus, LiveMapEquipmentPortItem } from '../types/live-map.types'

interface LiveMapMachineNodeProps {
  eqpId: string
  status: LiveMapEqpStatus
  portItems: readonly LiveMapEquipmentPortItem[]
  selected: boolean
  dimmed: boolean
  onSelect: (eqpId: string) => void
}

/**
 * 공정 카드 그리드 안의 설비 노드 타일입니다.
 * 윗줄 = 상태 dot + Eqp ID, 아랫줄 = 포트 상태 dot 행. 선택 동작만 주입됩니다.
 */
export function LiveMapMachineNode({
  eqpId,
  status,
  portItems,
  selected,
  dimmed,
  onSelect,
}: LiveMapMachineNodeProps) {
  const { t } = useI18n()
  const variant = LIVE_MAP_STATUS_CLASS[status]

  return (
    <button
      type="button"
      onClick={() => onSelect(eqpId)}
      aria-label={`${eqpId} ${t('livemap.node.selectSuffix')}`}
      aria-pressed={selected}
      disabled={dimmed}
      className={`flex min-w-0 flex-col gap-1 rounded-[8px] border bg-card px-2 py-1.5 text-left transition-colors ${
        selected
          ? 'border-brand-primary ring-2 ring-brand-primary/20'
          : 'border-border hover:border-brand-primary/40'
      } ${dimmed ? 'opacity-30' : ''}`}
    >
      <div className="flex items-center gap-1.5">
        <span className={`size-2 shrink-0 rounded-full ${variant.dot}`} />
        <span className="truncate text-[11px] font-bold text-foreground">{eqpId}</span>
      </div>
      <div className="flex items-center gap-[3px]">
        {portItems.slice(0, 6).map((portItem) => (
          <span
            key={portItem.id}
            className={`size-1.5 rounded-full ${LIVE_MAP_PORT_STATUS_CLASS[portItem.status].dot}`}
          />
        ))}
      </div>
    </button>
  )
}
