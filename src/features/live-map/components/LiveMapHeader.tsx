import { LIVE_MAP_STATUS_THEME } from '../lib/live-map-status-theme'
import type { LiveMapSummary } from '../types/live-map.types'

interface LiveMapHeaderProps {
  summary: LiveMapSummary
}

const SUMMARY_CARDS = [
  {
    key: 'total',
    label: 'TOTAL',
    background: '#FFFFFF',
    border: '#E3E9E4',
    labelColor: '#768179',
    valueColor: '#1B2620',
  },
  {
    key: 'run',
    label: 'RUN',
    background: LIVE_MAP_STATUS_THEME.RUN.summaryBackground,
    border: LIVE_MAP_STATUS_THEME.RUN.summaryBorder,
    labelColor: LIVE_MAP_STATUS_THEME.RUN.summaryLabel,
    valueColor: LIVE_MAP_STATUS_THEME.RUN.summaryValue,
  },
  {
    key: 'idle',
    label: 'IDLE',
    background: LIVE_MAP_STATUS_THEME.IDLE.summaryBackground,
    border: LIVE_MAP_STATUS_THEME.IDLE.summaryBorder,
    labelColor: LIVE_MAP_STATUS_THEME.IDLE.summaryLabel,
    valueColor: LIVE_MAP_STATUS_THEME.IDLE.summaryValue,
  },
  {
    key: 'error',
    label: 'ERROR',
    background: LIVE_MAP_STATUS_THEME.ERROR.summaryBackground,
    border: LIVE_MAP_STATUS_THEME.ERROR.summaryBorder,
    labelColor: LIVE_MAP_STATUS_THEME.ERROR.summaryLabel,
    valueColor: LIVE_MAP_STATUS_THEME.ERROR.summaryValue,
  },
  {
    key: 'down',
    label: 'DOWN',
    background: LIVE_MAP_STATUS_THEME.DOWN.summaryBackground,
    border: LIVE_MAP_STATUS_THEME.DOWN.summaryBorder,
    labelColor: LIVE_MAP_STATUS_THEME.DOWN.summaryLabel,
    valueColor: LIVE_MAP_STATUS_THEME.DOWN.summaryValue,
  },
] as const satisfies readonly {
  key: keyof LiveMapSummary
  label: string
  background: string
  border: string
  labelColor: string
  valueColor: string
}[]

const formatMetricValue = (key: keyof LiveMapSummary, value: number): string =>
  key === 'total' || value >= 10 ? String(value) : String(value).padStart(2, '0')

export function LiveMapHeader({ summary }: LiveMapHeaderProps) {
  return (
    <section className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="space-y-1">
        <h1 className="text-[20px] font-extrabold tracking-[-0.02em] text-[#16211C]">
          설비 Live Map
        </h1>
        <p className="text-sm text-[#6B7670]">
          실시간 상태를 지도 기반으로 탐색하고 이상 설비를 빠르게 식별합니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {SUMMARY_CARDS.map((card) => (
          <div
            key={card.key}
            className="flex min-w-[88px] flex-col justify-center rounded-2xl border px-3 py-2.5 shadow-sm"
            style={{
              backgroundColor: card.background,
              borderColor: card.border,
            }}
          >
            <span
              className="text-[10px] font-bold tracking-[0.16em]"
              style={{ color: card.labelColor }}
            >
              {card.label}
            </span>
            <span className="text-2xl font-extrabold" style={{ color: card.valueColor }}>
              {formatMetricValue(card.key, summary[card.key])}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
