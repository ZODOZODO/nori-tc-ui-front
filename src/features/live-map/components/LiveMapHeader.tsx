import { Radar } from 'lucide-react'
import { useI18n } from '@/i18n/i18n-context'
import { LIVE_MAP_STATUS_CLASS } from '../lib/live-map-status-theme'
import type { LiveMapSummary } from '../types/live-map.types'

interface LiveMapHeaderProps {
  summary: LiveMapSummary
  syncLabel: string
}

const KPI_TILES = [
  { key: 'run', label: 'RUN', variant: LIVE_MAP_STATUS_CLASS.RUN },
  { key: 'idle', label: 'IDLE', variant: LIVE_MAP_STATUS_CLASS.IDLE },
  { key: 'error', label: 'ERROR', variant: LIVE_MAP_STATUS_CLASS.ERROR },
  { key: 'down', label: 'DOWN', variant: LIVE_MAP_STATUS_CLASS.DOWN },
] as const satisfies readonly {
  key: keyof LiveMapSummary
  label: string
  variant: { chip: string }
}[]

const formatMetricValue = (key: keyof LiveMapSummary, value: number): string =>
  key === 'total' || value >= 10 ? String(value) : String(value).padStart(2, '0')

export function LiveMapHeader({ summary, syncLabel }: LiveMapHeaderProps) {
  const { t } = useI18n()

  return (
    <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-[20px] font-extrabold tracking-tight text-foreground">
            {t('livemap.title')}
          </h1>
          <span className="inline-flex h-6 items-center gap-1.5 rounded-pill border border-success/30 bg-success/10 px-2.5 text-[11px] font-bold text-success">
            <Radar className="size-3" />
            {t('livemap.realtime')} {syncLabel}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{t('livemap.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="flex min-w-[88px] flex-col justify-center rounded-2xl border border-border bg-card px-3 py-2.5 shadow-soft-sm">
          <span className="text-[10px] font-bold tracking-[0.16em] text-muted-foreground">
            {t('livemap.kpi.total')}
          </span>
          <span className="text-2xl font-extrabold text-foreground">
            {formatMetricValue('total', summary.total)}
          </span>
        </div>

        {KPI_TILES.map((tile) => (
          <div
            key={tile.key}
            className={`flex min-w-[88px] flex-col justify-center rounded-2xl border px-3 py-2.5 shadow-soft-sm ${tile.variant.chip}`}
          >
            <span className="text-[10px] font-bold tracking-[0.16em] opacity-80">{tile.label}</span>
            <span className="text-2xl font-extrabold">
              {formatMetricValue(tile.key, summary[tile.key])}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
