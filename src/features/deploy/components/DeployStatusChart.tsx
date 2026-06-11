import { useMemo } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { useI18n } from '@/i18n/i18n-context'

export interface DeployStatusAggregate {
  total: number
  completed: number
  running: number
  pending: number
  failed: number
  canceled: number
}

/**
 * Deploy 대상 상태 분포 도넛 차트 (R3 D-CHART — recharts@^3).
 *
 * 배포 상태는 본질적으로 semantic(완료=성공 / 실패=위험 / 진행=활성 / 대기·취소=중립)이므로
 * brand coral 단색으로 치환하지 않고, semantic 토큰(`--success`/`--danger`)과 차트 토큰
 * (`--chart-1`=진행 coral / `--chart-5`=중립)을 함께 매핑한다 (SPEC R5.0 (5) status/chart
 * semantic 보존). shadcn 차트 패턴(선언적 SVG + 디자인 토큰)을 단일 용도로 직접 사용.
 */
const SEGMENT_CONFIG: ReadonlyArray<{
  key: keyof Omit<DeployStatusAggregate, 'total'>
  labelKey: string
  color: string
}> = [
  { key: 'completed', labelKey: 'deploy.chart.completed', color: 'var(--success)' },
  { key: 'running', labelKey: 'deploy.chart.running', color: 'var(--chart-1)' },
  { key: 'pending', labelKey: 'deploy.chart.pending', color: 'var(--chart-5)' },
  { key: 'failed', labelKey: 'deploy.chart.failed', color: 'var(--danger)' },
  { key: 'canceled', labelKey: 'deploy.chart.canceled', color: 'var(--muted-foreground)' },
]

export function DeployStatusChart({ aggregate }: { aggregate: DeployStatusAggregate }) {
  const { t } = useI18n()

  const segments = useMemo(
    () =>
      SEGMENT_CONFIG.map((config) => ({
        key: config.key,
        label: t(config.labelKey),
        value: aggregate[config.key],
        color: config.color,
      })).filter((segment) => segment.value > 0),
    [aggregate, t],
  )

  if (segments.length === 0) {
    return (
      <div className="flex h-45 items-center justify-center text-sm text-muted-foreground">
        {t('deploy.chart.empty')}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="relative h-45 w-45 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={segments}
              dataKey="value"
              nameKey="label"
              innerRadius={56}
              outerRadius={82}
              paddingAngle={segments.length > 1 ? 2 : 0}
              strokeWidth={0}
              isAnimationActive={false}
            >
              {segments.map((segment) => (
                <Cell key={segment.key} fill={segment.color} />
              ))}
            </Pie>
            <Tooltip
              cursor={false}
              contentStyle={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                color: 'var(--foreground)',
                fontSize: '12px',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-foreground">{aggregate.total}</span>
          <span className="text-xs text-muted-foreground">{t('deploy.chart.totalTargets')}</span>
        </div>
      </div>

      <ul className="flex min-w-0 flex-1 flex-col gap-2">
        {segments.map((segment) => (
          <li key={segment.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2 text-muted-foreground">
              <span
                className="inline-block size-2.5 shrink-0 rounded-sm"
                style={{ background: segment.color }}
                aria-hidden="true"
              />
              {segment.label}
            </span>
            <span className="font-semibold text-foreground">{segment.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
