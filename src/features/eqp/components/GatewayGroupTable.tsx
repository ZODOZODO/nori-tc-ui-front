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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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

/**
 * Gateway / gateway_app 선택 시 해당 설비 목록을
 * 설비 정보 테이블과 동일한 컬럼 구조로 다중 행 표시합니다.
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
  const [selectedEqpId, setSelectedEqpId] = useState<string | null>(null)

  // EQPID(첫 번째 열 = 이름) 기준 오름차순 정렬
  const sortedEqpItems = useMemo(
    () => [...eqpItems].sort((a, b) => a.eqpId.localeCompare(b.eqpId)),
    [eqpItems],
  )
  const effectiveSelectedEqpId = selectedEqpId ?? sortedEqpItems[0]?.eqpId ?? null

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

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E4EAE6] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#213028]">{groupName}</h2>
        <span className="text-xs text-[#7A8680]">설비 {eqpItems.length}개</span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <Table className="min-w-[1280px]">
          <TableHeader>
            <TableRow className="bg-[#F6F9F7]">
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
            {sortedEqpItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="py-10 text-center text-sm text-[#647169]">
                  이 그룹에 속한 설비가 없습니다.
                </TableCell>
              </TableRow>
            ) : isInitialLoading ? (
              <TableRow>
                <TableCell colSpan={13} className="py-10 text-center text-sm text-[#647169]">
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    설비 상세 정보를 불러오는 중입니다.
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              sortedEqpItems.map((eqp) => {
                const detail = detailByEqpId.get(eqp.eqpId)
                const runtimeState = detail?.runtimeState ?? null
                const lifecycleCommandVisibility = resolveLifecycleCommandVisibility(eqp, runtimeState)
                const hasLifecycleCommand =
                  lifecycleCommandVisibility.canStart
                  || lifecycleCommandVisibility.canEnd
                  || lifecycleCommandVisibility.canRestart
                const isMissingFromBatch = missingEqpIdSet.has(eqp.eqpId)

                return (
                  <ContextMenu key={eqp.eqpId}>
                    <ContextMenuTrigger asChild>
                      <TableRow
                        data-state={effectiveSelectedEqpId === eqp.eqpId ? 'selected' : undefined}
                        className={isMissingFromBatch ? 'bg-[#FFF7F6]' : undefined}
                        onClick={() => setSelectedEqpId(eqp.eqpId)}
                        onContextMenu={() => setSelectedEqpId(eqp.eqpId)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span>{eqp.eqpId}</span>
                            {isMissingFromBatch ? (
                              <Badge variant="warning" title="DB에서 설비를 찾을 수 없음 (삭제되었을 수 있음)">
                                미확인
                              </Badge>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>{resolveBusinessAppName(eqp.routePartition) ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={eqp.commInterface.toUpperCase() === 'SOCKET' ? 'warning' : 'info'}>
                            {eqp.commInterface}
                          </Badge>
                        </TableCell>
                        <TableCell>{eqp.commMode}</TableCell>
                        <TableCell>{detail?.socketSettings?.socketProtocolType ?? '—'}</TableCell>
                        <TableCell>{eqp.routePartition ?? '—'}</TableCell>
                        <TableCell>{eqp.eqpIp}</TableCell>
                        <TableCell>{eqp.eqpPort}</TableCell>
                        <TableCell>
                          <EquipmentStatusIndicator
                            status={resolveEquipmentVisualState(runtimeState)}
                          />
                        </TableCell>
                        <TableCell>{detail?.modelBinding?.modelName ?? '—'}</TableCell>
                        <TableCell>{detail?.modelBinding?.modelVersion ?? '—'}</TableCell>
                        <TableCell>{detail?.jars?.gatewayJarFileName ?? '—'}</TableCell>
                        <TableCell>{detail?.jars?.businessJarFileName ?? '—'}</TableCell>
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
              })
            )}
          </TableBody>
        </Table>
      </div>

      {isFetching && !isInitialLoading && !hasDetailError ? (
        <p className="mt-2 text-xs text-[#7A8680]">설비 상세 데이터를 동기화 중입니다.</p>
      ) : null}
      {hasDetailError ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-[#F2D3D0] bg-[#FFF7F6] px-3 py-2">
          <p className="text-xs text-[#C5534B]">
            설비 상세 정보를 불러오지 못했습니다. 자동 재시도가 모두 실패했습니다.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={handleRetry}
            className="ml-auto h-7 gap-1 border-[#E0BFBC] bg-white px-2 text-xs text-[#A03A33] hover:bg-[#FFF1EF]"
          >
            {isFetching ? (
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
            ) : (
              <RotateCcw className="size-3" aria-hidden="true" />
            )}
            다시 시도
          </Button>
        </div>
      ) : null}
      {!hasDetailError && missingEqpIds.length > 0 ? (
        <p className="mt-2 text-xs text-[#A66518]">
          DB에서 찾을 수 없는 설비 {missingEqpIds.length}대 ({missingEqpIds.join(', ')})는 빈 값으로 표시되었습니다.
          최근 삭제되었을 수 있으니 새로고침으로 목록을 갱신해 주세요.
        </p>
      ) : null}
    </section>
  )
})
