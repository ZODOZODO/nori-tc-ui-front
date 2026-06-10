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
 * 공정 카드 안의 설비 행입니다. 1행: 상태 dot + Eqp ID(전체 표시), 2행: 포트 dot 요약.
 * 1열 리스트로 쌓여 설비 수가 많아도(카드 내부 스크롤) 가독성을 유지합니다. 선택 동작만 주입됩니다.
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
      data-testid={`live-map-node-${eqpId}`}
      aria-label={`${eqpId} ${t('livemap.node.selectSuffix')}`}
      aria-pressed={selected}
      disabled={dimmed}
      title={eqpId}
      className={`flex w-full min-w-0 flex-col gap-1 rounded-[7px] border px-2 py-1.5 text-left transition-colors ${
        selected
          ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary/30'
          : 'border-border bg-card hover:bg-muted/60'
      } ${dimmed ? 'opacity-30' : ''}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className={`size-2 shrink-0 rounded-full ${variant.dot} ${
            status === 'ERROR' ? 'animate-pulse [box-shadow:0_0_8px_var(--danger)]' : ''
          }`}
        />
        <span className="min-w-0 flex-1 break-all text-[11px] font-bold leading-tight text-foreground">
          {eqpId}
        </span>
      </span>
      {portItems.length > 0 ? (
        <span className="flex flex-wrap items-center gap-0.75 pl-3.5">
          {portItems.map((portItem) => (
            <span
              key={portItem.id}
              className={`size-1.5 rounded-full ${LIVE_MAP_PORT_STATUS_CLASS[portItem.status].dot}`}
            />
          ))}
        </span>
      ) : null}
    </button>
  )
}
