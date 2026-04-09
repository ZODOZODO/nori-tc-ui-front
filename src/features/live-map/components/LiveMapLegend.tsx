import { LIVE_MAP_STATUS_THEME } from '../lib/live-map-status-theme'

const LEGEND_ITEMS = [
  { label: 'RUN', theme: LIVE_MAP_STATUS_THEME.RUN },
  { label: 'IDLE', theme: LIVE_MAP_STATUS_THEME.IDLE },
  { label: 'ERROR', theme: LIVE_MAP_STATUS_THEME.ERROR },
  { label: 'DOWN', theme: LIVE_MAP_STATUS_THEME.DOWN },
] as const

export function LiveMapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {LEGEND_ITEMS.map((item) => (
        <div
          key={item.label}
          className="inline-flex h-[26px] items-center gap-2 rounded-[13px] border px-3 text-[11px] font-bold"
          style={{
            backgroundColor: item.theme.legendBackground,
            borderColor: item.theme.legendBorder,
            color: item.theme.legendText,
          }}
        >
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: item.theme.legendDot }}
          />
          {item.label}
        </div>
      ))}
    </div>
  )
}
