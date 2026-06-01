import { memo, useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { PagePagination } from '@/shared/layout/PagePagination'
import { TableSectionHeader } from '@/shared/layout/TableSectionHeader'
import { useI18n } from '@/i18n/i18n-context'
import { eqpApi } from '../api/eqp.api'
import { eqpQueryKeys } from '../lib/eqp-query-keys'
import type { EqpInfo, EqpManageDetail } from '../types/eqp.types'
import { resolveBusinessAppName } from '../utils/eqp-group.util'
import {
  type EquipmentVisualState,
  resolveEquipmentVisualState,
  resolveLifecycleCommandVisibility,
} from '../utils/eqp-runtime-state.util'

type EqpLifecycleAction = 'start' | 'end' | 'restart'

const GATEWAY_GROUP_COLUMN_COUNT = 13
const GATEWAY_GROUP_SKELETON_ROW_COUNT = 8
const GATEWAY_GROUP_DEFAULT_PAGE_SIZE = 25

interface GatewayGroupTableProps {
  /** 표시할 그룹의 설비 목록 */
  eqpItems: EqpInfo[]
  /** 그룹명 (예: gateway_app1) */
  groupName: string
  isLifecyclePending?: boolean
  onLifecycleAction?: (eqp: EqpInfo, action: EqpLifecycleAction) => void
}

/**
 * 상태를 원형 네온 점 아이콘으로 렌더링합니다.
 * RUN/IDLE/주의/오프라인은 런타임 상태 semantic 색이므로 brand coral 로 치환하지 않습니다.
 */
function EquipmentStatusIndicator({ status }: { status: EquipmentVisualState }) {
  const { t } = useI18n()
  if (status === 'offline') {
    return (
      <span
        className="relative inline-flex size-4 items-center justify-center rounded-full bg-muted ring-2 ring-border"
        title={t('eqp.status.offline')}
        aria-label={t('eqp.status.offline')}
      >
        <span className="inline-flex size-2 rounded-full bg-muted-foreground" />
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
      title={t('eqp.status.warning')}
      aria-label={t('eqp.status.warning')}
    >
      <span className="absolute inline-flex size-4 rounded-full bg-amber-300/30 motion-safe:animate-ping" />
      <span className="relative inline-flex size-2 rounded-full bg-gradient-to-br from-amber-400 to-orange-500" />
    </span>
  )
}

interface GatewayGroupRow {
  eqp: EqpInfo
  detail: EqpManageDetail | undefined
  isMissingFromBatch: boolean
}

// missing 뱃지 텍스트만 React 밖 상수라 번역 불가 → 호출부에서 번역 문자열을 주입한다.
const buildGatewayGroupColumns = (
  missingTitle: string,
  missingBadge: string,
): ReadonlyArray<ColumnDef<GatewayGroupRow>> => [
  {
    key: 'eqpId',
    header: 'EQPID',
    accessor: (row) => row.eqp.eqpId,
    renderCell: (row) => (
      <div className="flex items-center gap-2">
        <span>{row.eqp.eqpId}</span>
        {row.isMissingFromBatch ? (
          <Badge variant="warning" title={missingTitle}>
            {missingBadge}
          </Badge>
        ) : null}
      </div>
    ),
  },
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
    key: 'socketProtocol',
    header: 'Socket Protocol',
    accessor: (row) => row.detail?.socketSettings?.socketProtocolType ?? '—',
  },
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
    accessor: (row) => resolveEquipmentVisualState(row.detail?.runtimeState ?? null),
    renderCell: (row) => (
      <EquipmentStatusIndicator status={resolveEquipmentVisualState(row.detail?.runtimeState ?? null)} />
    ),
  },
  { key: 'modelName', header: 'Model', accessor: (row) => row.detail?.modelBinding?.modelName ?? '—' },
  {
    key: 'modelVersion',
    header: 'Model Version',
    accessor: (row) => row.detail?.modelBinding?.modelVersion ?? '—',
  },
  {
    key: 'gatewayJar',
    header: 'Gateway Jarfile',
    accessor: (row) => row.detail?.jars?.gatewayJarFileName ?? '—',
  },
  {
    key: 'businessJar',
    header: 'Business Jarfile',
    accessor: (row) => row.detail?.jars?.businessJarFileName ?? '—',
  },
]

/**
 * Gateway / gateway_app 선택 시 해당 설비 목록을
 * nori-client 리스트 페이지 틀(헤더+총건수 pill / 데이터 테이블 / 페이지네이션)로 표시합니다.
 * eqpId 검색은 좌측 사이드바에서만 제공하므로 콘텐츠 내 검색바는 두지 않습니다.
 *
 * @param eqpItems 해당 그룹에 속한 설비 목록
 * @param groupName 그룹명 (헤더에 표시)
 */
export const GatewayGroupTable = memo(function GatewayGroupTable({
  eqpItems,
  groupName,
  isLifecyclePending = false,
  onLifecycleAction,
}: GatewayGroupTableProps) {
  const { t } = useI18n()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(GATEWAY_GROUP_DEFAULT_PAGE_SIZE)
  const columns = useMemo(
    () => buildGatewayGroupColumns(t('eqp.gateway.missingTitle'), t('eqp.gateway.missingBadge')),
    [t],
  )

  // EQPID(첫 번째 열 = 이름) 기준 오름차순 정렬
  const sortedEqpItems = useMemo(
    () => [...eqpItems].sort((a, b) => a.eqpId.localeCompare(b.eqpId)),
    [eqpItems],
  )

  // 그룹 변경으로 건수가 줄면 page 가 범위를 벗어날 수 있어 slice 시점에 clamp 합니다.
  const pageCount = Math.max(1, Math.ceil(sortedEqpItems.length / pageSize))

  const pagedEqpItems = useMemo(() => {
    const safePage = Math.min(Math.max(page, 1), pageCount)
    const start = (safePage - 1) * pageSize
    return sortedEqpItems.slice(start, start + pageSize)
  }, [sortedEqpItems, page, pageCount, pageSize])

  // 그룹 화면은 N대의 설비 상세를 한 번에 보여줘야 합니다.
  // 과거에는 useQueries로 N개 HTTP 호출을 fan-out 했고, 일부가 일시 실패하면 그 행만 '—'로 박혔습니다.
  // 단일 batch 엔드포인트(GET /eqp/manage?eqpIds=...)로 1회 호출하여 부분 실패 자체를 제거하고,
  // 호출 전체가 실패하면 지수 백오프로 자동 재시도합니다.
  const eqpIdList = useMemo(() => sortedEqpItems.map((eqp) => eqp.eqpId), [sortedEqpItems])

  const detailBatchQuery = useQuery({
    queryKey: eqpQueryKeys.manageBatch(eqpIdList),
    queryFn: () => eqpApi.getEqpManageDetailBatch(eqpIdList),
    enabled: eqpIdList.length > 0,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 5000),
  })

  const detailByEqpId = useMemo(() => {
    const mapped = new Map<string, EqpManageDetail>()
    detailBatchQuery.data?.items.forEach((detail) => {
      mapped.set(detail.eqpId, detail)
    })
    return mapped
  }, [detailBatchQuery.data])

  // 백엔드가 200을 줬지만 일부 eqpId가 DB에 없어 빠진 경우 (정상 응답 + missing 표기).
  // HTTP 에러가 아니므로 사용자에게는 별도 경고가 아닌 "삭제됐을 수 있음" 안내로 다룹니다.
  const missingEqpIdSet = useMemo(
    () => new Set(detailBatchQuery.data?.missingEqpIds ?? []),
    [detailBatchQuery.data?.missingEqpIds],
  )
  const missingEqpIds = useMemo(
    () => detailBatchQuery.data?.missingEqpIds ?? [],
    [detailBatchQuery.data?.missingEqpIds],
  )

  const isInitialLoading = eqpIdList.length > 0 && detailBatchQuery.isLoading
  const isFetching = detailBatchQuery.isFetching
  const hasDetailError = detailBatchQuery.isError

  const handleRetry = useCallback(() => {
    void detailBatchQuery.refetch()
  }, [detailBatchQuery])

  const tableRows = useMemo<GatewayGroupRow[]>(
    () =>
      pagedEqpItems.map((eqp) => ({
        eqp,
        detail: detailByEqpId.get(eqp.eqpId),
        isMissingFromBatch: missingEqpIdSet.has(eqp.eqpId),
      })),
    [pagedEqpItems, detailByEqpId, missingEqpIdSet],
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <TableSectionHeader title={groupName} count={sortedEqpItems.length} />

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card p-4">
        {/* SelectableTable 이 단일 스크롤러가 되도록 redundant overflow 래퍼를 두지 않는다.
            (이중 overflow 는 sticky thead 가 바깥 스크롤에 밀려 고정되지 않게 만든다.) */}
        <div className="flex min-h-0 flex-1 flex-col">
          {sortedEqpItems.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              {t('eqp.gateway.empty')}
            </p>
          ) : isInitialLoading ? (
            <div className="min-h-0 flex-1 overflow-auto">
            <Table className="min-w-[1280px]">
              <TableHeader>
                <TableRow className="bg-muted">
                  <TableHead>EQPID</TableHead>
                  <TableHead>Business App</TableHead>
                  <TableHead>Comm Interface</TableHead>
                  <TableHead>Comm Mode</TableHead>
                  <TableHead>Socket Protocol</TableHead>
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
                {Array.from({ length: GATEWAY_GROUP_SKELETON_ROW_COUNT }).map((_, rowIndex) => (
                  <TableRow
                    key={`gateway-group-skeleton-${rowIndex}`}
                    data-testid="gateway-group-skeleton"
                  >
                    {Array.from({ length: GATEWAY_GROUP_COLUMN_COUNT }).map((_, cellIndex) => (
                      <TableCell key={cellIndex}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          ) : (
            <SelectableTable<GatewayGroupRow>
              testId="selectable-table-gateway-group"
              columns={columns}
              rows={tableRows}
              rowKey={(row) => row.eqp.eqpId}
              tableClassName="min-w-[1280px]"
              wrapRow={(row, _rowIdx, children) => {
                const eqp = row.eqp
                const runtimeState = row.detail?.runtimeState ?? null
                const lifecycleCommandVisibility = resolveLifecycleCommandVisibility(eqp, runtimeState)
                const hasLifecycleCommand =
                  lifecycleCommandVisibility.canStart
                  || lifecycleCommandVisibility.canEnd
                  || lifecycleCommandVisibility.canRestart
                return (
                  <ContextMenu>
                    <ContextMenuTrigger asChild>
                      <TableRow
                        className={row.isMissingFromBatch ? 'bg-danger/5' : undefined}
                      >
                        {children}
                      </TableRow>
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
                )
              }}
            />
          )}
        </div>

        {isFetching && !isInitialLoading && !hasDetailError ? (
          <p className="mt-2 text-xs text-muted-foreground">{t('eqp.gateway.syncing')}</p>
        ) : null}
        {hasDetailError ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2">
            <p className="text-xs text-danger">{t('eqp.gateway.detailError')}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={handleRetry}
              className="ml-auto h-7 gap-1 border-danger/40 bg-card px-2 text-xs text-danger hover:bg-danger/10"
            >
              {isFetching ? (
                <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              ) : (
                <RotateCcw className="size-3" aria-hidden="true" />
              )}
              {t('eqp.gateway.retry')}
            </Button>
          </div>
        ) : null}
        {!hasDetailError && missingEqpIds.length > 0 ? (
          <p className="mt-2 text-xs text-warning">
            {t('eqp.gateway.missingNotice', {
              count: missingEqpIds.length,
              ids: missingEqpIds.join(', '),
            })}
          </p>
        ) : null}
      </section>

      {sortedEqpItems.length > 0 ? (
        <PagePagination
          total={sortedEqpItems.length}
          page={page}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(nextPageSize) => {
            setPageSize(nextPageSize)
            setPage(1)
          }}
        />
      ) : null}
    </div>
  )
})
