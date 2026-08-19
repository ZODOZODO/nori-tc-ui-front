import { useI18n } from '@/i18n/i18n-context'
import { LIVE_MAP_STATUS_CLASS } from '../lib/live-map-status-theme'
import type { LiveMapSummary } from '../types/live-map.types'

interface LiveMapHeaderProps {
  summary: LiveMapSummary
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

export function LiveMapHeader({ summary }: LiveMapHeaderProps) {
  const { t } = useI18n()

  return (
    <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      {/* 제목 줄은 라우트 헤딩(AppPageHeading)이 그린다 — 여기에 또 두면 h1 이 둘이 되고,
          캔버스가 그만큼 낮아진다. 이 화면은 보드 높이가 fit 스케일을 정하므로 세로 공간을
          한 줄도 더 쓰지 않는다. */}
      <div className="space-y-1.5">
        <p className="text-sm text-muted-foreground">{t('livemap.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <div className="flex min-w-22 flex-col justify-center rounded-2xl border border-border bg-card px-3 py-2.5 shadow-soft-sm">
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
            className={`flex min-w-22 flex-col justify-center rounded-2xl border px-3 py-2.5 shadow-soft-sm ${tile.variant.chip}`}
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
