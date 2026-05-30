import { memo, useMemo } from 'react'
import { Badge } from '@/components/ui/badge'
import { useI18n } from '@/i18n/i18n-context'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SelectableTable } from '@/shared/components/SelectableTable'
import type { ColumnDef } from '@/shared/components/SelectableTable'
import type { EqpInfo, EqpModelInfo, EqpRuntimeState } from '../types/eqp.types'
import { resolveBusinessAppName } from '../utils/eqp-group.util'
import {
  type EquipmentVisualState,
  resolveEquipmentVisualState,
  resolveLifecycleCommandVisibility,
} from '../utils/eqp-runtime-state.util'

const EQP_INFO_COLUMN_COUNT = 12

type EqpLifecycleAction = 'start' | 'end' | 'restart'

interface EqpInfoTableProps {
  eqp: EqpInfo | null
  modelInfo: EqpModelInfo | null
  runtimeState: EqpRuntimeState | null
  isLoading: boolean
  isFetching: boolean
  isLifecyclePending?: boolean
  onLifecycleAction?: (eqp: EqpInfo, action: EqpLifecycleAction) => void
}

/**
 * 상태를 원형 네온 점 아이콘으로 렌더링합니다.
 */
function EquipmentStatusIndicator({ status }: { status: EquipmentVisualState }) {
  if (status === 'offline') {
    return (
      <span
        className="relative inline-flex size-4 items-center justify-center rounded-full bg-slate-100 ring-2 ring-slate-300/80"
        title="오프라인"
        aria-label="오프라인"
      >
        <span className="inline-flex size-2 rounded-full bg-slate-500" />
      </span>
    )
  }

  if (status === 'run') {
    return (
      <span
        className="relative inline-flex size-4 items-center justify-center rounded-full bg-emerald-100/90 ring-2 ring-emerald-300/80 shadow-[0_0_10px_rgba(16,185,129,0.35)]"
        title="RUN"
        aria-label="RUN"
      >
        <span className="absolute inline-flex size-4 rounded-full bg-emerald-300/35 motion-safe:animate-ping" />
        <span className="relative inline-flex size-2 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500" />
      </span>
    )
  }

  if (status === 'idle') {
    return (
      <span
        className="relative inline-flex size-4 items-center justify-center rounded-full bg-sky-100/90 ring-2 ring-sky-300/80 shadow-[0_0_10px_rgba(14,165,233,0.3)]"
        title="IDLE"
        aria-label="IDLE"
      >
        <span className="relative inline-flex size-2 rounded-full bg-gradient-to-br from-sky-400 to-blue-500" />
      </span>
    )
  }

  return (
    <span
      className="relative inline-flex size-4 items-center justify-center rounded-full bg-amber-100/90 ring-2 ring-amber-300/80 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
      title="주의 상태"
      aria-label="주의 상태"
    >
      <span className="absolute inline-flex size-4 rounded-full bg-amber-300/30 motion-safe:animate-ping" />
      <span className="relative inline-flex size-2 rounded-full bg-gradient-to-br from-amber-400 to-orange-500" />
    </span>
  )
}

interface EqpInfoRow {
  eqp: EqpInfo
  modelInfo: EqpModelInfo | null
  runtimeState: EqpRuntimeState | null
}

const EQP_INFO_COLUMNS: ReadonlyArray<ColumnDef<EqpInfoRow>> = [
  { key: 'eqpId', header: 'EQPID', accessor: (row) => row.eqp.eqpId },
  {
    key: 'businessApp',
    header: 'Business App',
    accessor: (row) => resolveBusinessAppName(row.eqp.routePartition) ?? '—',
  },
  {
    key: 'commInterface',
    header: 'Comm Interface',
    accessor: (row) => row.eqp.commInterface,
    renderCell: (row) => (
      <Badge variant={row.eqp.commInterface.toUpperCase() === 'SOCKET' ? 'warning' : 'info'}>
        {row.eqp.commInterface}
      </Badge>
    ),
  },
  { key: 'commMode', header: 'Comm Mode', accessor: (row) => row.eqp.commMode },
  {
    key: 'routePartition',
    header: 'Route Partition',
    accessor: (row) => row.eqp.routePartition?.toString() ?? '—',
  },
  { key: 'eqpIp', header: 'IP', accessor: (row) => row.eqp.eqpIp },
  { key: 'eqpPort', header: 'Port', accessor: (row) => row.eqp.eqpPort?.toString() ?? '—' },
  {
    key: 'enabled',
    header: 'Enabled',
    accessor: (row) => resolveEquipmentVisualState(row.runtimeState),
    renderCell: (row) => (
      <EquipmentStatusIndicator status={resolveEquipmentVisualState(row.runtimeState)} />
    ),
  },
  { key: 'modelName', header: 'Model', accessor: (row) => row.modelInfo?.modelName ?? '—' },
  {
    key: 'modelVersion',
    header: 'Model Version',
    accessor: (row) => row.modelInfo?.modelVersion ?? '—',
  },
  { key: 'gatewayJar', header: 'Gateway Jarfile', accessor: () => '—' },
  { key: 'businessJar', header: 'Business Jarfile', accessor: () => '—' },
]

/**
 * 선택된 설비의 단건 정보를 표시하는 상단 테이블입니다.
 * Check Out/Check In 버튼은 design.pen의 DetailLayout(version section)에서 제어합니다.
 */
export const EqpInfoTable = memo(function EqpInfoTable({
  eqp,
  modelInfo,
  runtimeState,
  isLoading,
  isFetching,
  isLifecyclePending = false,
  onLifecycleAction,
}: EqpInfoTableProps) {
  const { t } = useI18n()
  const lifecycleCommandVisibility = eqp
    ? resolveLifecycleCommandVisibility(eqp, runtimeState)
    : { canStart: false, canEnd: false, canRestart: false }
  const hasLifecycleCommand =
    lifecycleCommandVisibility.canStart
    || lifecycleCommandVisibility.canEnd
    || lifecycleCommandVisibility.canRestart

  const tableRows = useMemo<EqpInfoRow[]>(
    () => (eqp ? [{ eqp, modelInfo, runtimeState }] : []),
    [eqp, modelInfo, runtimeState],
  )

  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold tracking-tight text-foreground">
          {t('eqp.info.title')}
        </h2>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {isLoading ? (
          <Table className="min-w-[1180px]">
            <TableHeader>
              <TableRow className="bg-muted">
                <TableHead>EQPID</TableHead>
                <TableHead>Business App</TableHead>
                <TableHead>Comm Interface</TableHead>
                <TableHead>Comm Mode</TableHead>
                <TableHead>Route Partition</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Port</TableHead>
                <TableHead>Enabled</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Model Version</TableHead>
                <TableHead>Gateway Jarfile</TableHead>
                <TableHead>Business Jarfile</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow data-testid="eqp-info-skeleton">
                {Array.from({ length: EQP_INFO_COLUMN_COUNT }).map((_, cellIndex) => (
                  <TableCell key={cellIndex}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            </TableBody>
          </Table>
        ) : !eqp ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            {t('eqp.info.selectPrompt')}
          </p>
        ) : (
          <SelectableTable<EqpInfoRow>
            testId="selectable-table-eqp-info"
            columns={EQP_INFO_COLUMNS}
            rows={tableRows}
            rowKey={(row) => row.eqp.eqpId}
            tableClassName="min-w-[1180px]"
            wrapRow={(_row, _rowIdx, children) => (
              <ContextMenu>
                <ContextMenuTrigger asChild>
                  <TableRow data-state="selected">{children}</TableRow>
                </ContextMenuTrigger>
                <ContextMenuContent className="w-44">
                  <ContextMenuLabel>{eqp.eqpId}</ContextMenuLabel>
                  {hasLifecycleCommand ? (
                    <>
                      <ContextMenuSeparator />
                      {lifecycleCommandVisibility.canStart ? (
                        <ContextMenuItem
                          disabled={isLifecyclePending}
                          onSelect={() => onLifecycleAction?.(eqp, 'start')}
                        >
                          Eqp Start
                        </ContextMenuItem>
                      ) : null}
                      {lifecycleCommandVisibility.canEnd ? (
                        <ContextMenuItem
                          disabled={isLifecyclePending}
                          onSelect={() => onLifecycleAction?.(eqp, 'end')}
                        >
                          Eqp End
                        </ContextMenuItem>
                      ) : null}
                      {lifecycleCommandVisibility.canRestart ? (
                        <ContextMenuItem
                          disabled={isLifecyclePending}
                          onSelect={() => onLifecycleAction?.(eqp, 'restart')}
                        >
                          Eqp Restart
                        </ContextMenuItem>
                      ) : null}
                    </>
                  ) : null}
                </ContextMenuContent>
              </ContextMenu>
            )}
          />
        )}
      </div>

      {isFetching && !isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">{t('eqp.info.syncing')}</p>
      ) : null}
    </section>
  )
})
