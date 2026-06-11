import { LIVE_MAP_STATUS_CLASS } from '../lib/live-map-status-theme'

const LEGEND_ITEMS = [
  { label: 'RUN', variant: LIVE_MAP_STATUS_CLASS.RUN },
  { label: 'IDLE', variant: LIVE_MAP_STATUS_CLASS.IDLE },
  { label: 'ERROR', variant: LIVE_MAP_STATUS_CLASS.ERROR },
  { label: 'DOWN', variant: LIVE_MAP_STATUS_CLASS.DOWN },
] as const

export function LiveMapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {LEGEND_ITEMS.map((item) => (
        <div
          key={item.label}
          className={`inline-flex h-6.5 items-center gap-2 rounded-pill border px-3 text-[11px] font-bold ${item.variant.chip}`}
        >
          <span className={`size-2 rounded-full ${item.variant.dot}`} />
          {item.label}
        </div>
      ))}
    </div>
  )
}
