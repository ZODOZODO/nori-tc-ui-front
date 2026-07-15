import { X } from 'lucide-react'
import { useI18n } from '@/i18n/i18n-context'
import {
  LIVE_MAP_PORT_STATUS_CLASS,
  LIVE_MAP_STATUS_CLASS,
} from '../lib/live-map-status-theme'
import type { LiveMapEquipmentNode } from '../types/live-map.types'
import { LiveMapCommLogPanel } from './LiveMapCommLogPanel'

interface LiveMapTooltipCardProps {
  equipment: LiveMapEquipmentNode | null
  onClose: () => void
}

export function LiveMapTooltipCard({ equipment, onClose }: LiveMapTooltipCardProps) {
  const { t } = useI18n()

  if (!equipment) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-[20px] border border-border bg-card p-4 text-sm text-muted-foreground shadow-soft-md">
        {t('livemap.detail.none')}
      </div>
    )
  }

  const statusVariant = LIVE_MAP_STATUS_CLASS[equipment.status]
  const statusMessage =
    equipment.alertMessage ??
    (equipment.status === 'ERROR'
      ? t('livemap.detail.msgError')
      : equipment.status === 'IDLE'
        ? t('livemap.detail.msgIdle')
        : equipment.status === 'DOWN'
          ? t('livemap.detail.msgDown')
          : t('livemap.detail.msgRun'))

  const fields = [
    { label: t('livemap.detail.process'), value: equipment.clusterName },
    { label: t('livemap.detail.line'), value: equipment.lineLabel },
    { label: t('livemap.detail.waferMode'), value: equipment.processingTypeLabel },
  ]

  return (
    <div
      data-testid="live-map-detail-panel"
      className="flex h-full w-full flex-col rounded-[20px] border border-border bg-card p-4 shadow-soft-md"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold tracking-[0.08em] text-muted-foreground">
          {t('livemap.detail.selectedLabel')}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t('livemap.detail.close')}
          className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-1 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`size-2.5 shrink-0 rounded-full ${statusVariant.dot}`} />
          <span className="truncate text-[20px] font-extrabold text-foreground">
            {equipment.eqpId}
          </span>
        </div>
        <span
          className={`inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-pill border px-3 text-[11px] font-bold ${statusVariant.chip}`}
        >
          {equipment.statusLabel}
        </span>
      </div>

      <dl className="mt-3 space-y-2 rounded-[12px] border border-border bg-muted/40 p-3">
        {fields.map((field) => (
          <div key={field.label} className="flex items-center justify-between gap-2 text-[12px]">
            <dt className="shrink-0 text-muted-foreground">{field.label}</dt>
            <dd className="min-w-0 truncate font-semibold text-foreground">{field.value}</dd>
          </div>
        ))}
        <div className="flex items-start justify-between gap-2 border-t border-border pt-2 text-[12px]">
          <dt className="shrink-0 text-muted-foreground">{t('livemap.detail.realtimeStatus')}</dt>
          <dd className={`min-w-0 text-right font-semibold ${statusVariant.text}`}>{statusMessage}</dd>
        </div>
      </dl>

      <div className="mt-3 rounded-[12px] border border-border bg-muted/40 p-3">
        <div className="flex items-center justify-between gap-3">
          <div className="text-[10px] font-bold tracking-[0.08em] text-muted-foreground">
            {t('livemap.detail.portStatus')}
          </div>
          <div className="text-[10px] font-semibold text-muted-foreground">
            <span className="text-success">
              {equipment.portItems.filter((portItem) => portItem.status === 'RUN').length}
            </span>
            {' / '}
            {equipment.portItems.length}
          </div>
        </div>
        <ul className="mt-2 space-y-1.5">
          {equipment.portItems.map((portItem) => {
            const portVariant = LIVE_MAP_PORT_STATUS_CLASS[portItem.status]
            return (
              <li key={portItem.id} className="flex items-center gap-2 text-[12px]">
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {portItem.label}
                </span>
                {portItem.carrierId && (
                  <span className="min-w-0 truncate font-medium text-muted-foreground">
                    {portItem.carrierId}
                  </span>
                )}
                <span
                  className={`inline-flex shrink-0 items-center gap-1.5 text-[11px] font-bold ${portVariant.text}`}
                >
                  <span className={`size-1.5 rounded-full ${portVariant.dot}`} />
                  {portItem.statusLabel}
                </span>
              </li>
            )
          })}
        </ul>
      </div>

      <div className="mt-3 flex min-h-0 flex-1 flex-col">
        <LiveMapCommLogPanel eqpId={equipment.eqpId} />
      </div>
    </div>
  )
}
