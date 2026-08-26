import { useMemo } from 'react'
import { useBusinessDlq } from './useBusinessDlq'
import { useDlqLineScope } from './useDlqLineScope'
import { useGatewayDlq } from './useGatewayDlq'
import { useQuarantine } from './useQuarantine'
import { useRepairTasks } from './useRepairTasks'
import { filterDlqEntriesByLine } from '../lib/dlq-line-scope'
import type {
  BusinessDlqEntry,
  GatewayDlqEntry,
  QuarantineEntry,
  RepairTaskEntry,
} from '../types/dlq.types'

export interface DlqCategoryEntries {
  gateway: GatewayDlqEntry[]
  business: BusinessDlqEntry[]
  quarantine: QuarantineEntry[]
  repairTask: RepairTaskEntry[]
  /** 4 조회 + 라인 스코프 해석이 모두 끝났는지. 끝나기 전 건수는 아직 0 이 아니라 미확정이다. */
  isSettled: boolean
  isFetching: boolean
  isError: boolean
  refetchAll: () => void
}

/**
 * 4 카테고리 목록을 현재 라인 스코프로 걸러 함께 돌려줍니다.
 *
 * <p>통합 페이지의 현황 카드(건수)와 대시보드 피드가 같은 값을 봐야 하므로 한곳에서 만든다 —
 * 각자 걸러 쓰면 카드가 말하는 수와 피드에 실린 행이 어긋난다. 4 조회는 각 목록 패널도 같은
 * query key 로 부르므로 react-query 캐시에서 합쳐지고 요청이 늘지 않는다.</p>
 */
export function useDlqCategoryEntries(): DlqCategoryEntries {
  const gatewayQuery = useGatewayDlq()
  const businessQuery = useBusinessDlq()
  const quarantineQuery = useQuarantine()
  const repairQuery = useRepairTasks()
  const lineScope = useDlqLineScope()

  const gateway = useMemo(
    () => filterDlqEntriesByLine(gatewayQuery.data ?? [], (row) => row.equipmentId, lineScope.scope),
    [gatewayQuery.data, lineScope.scope],
  )
  const business = useMemo(
    () => filterDlqEntriesByLine(businessQuery.data ?? [], (row) => row.eqpId, lineScope.scope),
    [businessQuery.data, lineScope.scope],
  )
  const quarantine = useMemo(
    () =>
      filterDlqEntriesByLine(quarantineQuery.data ?? [], (row) => row.equipmentId, lineScope.scope),
    [quarantineQuery.data, lineScope.scope],
  )
  const repairTask = useMemo(
    () => filterDlqEntriesByLine(repairQuery.data ?? [], (row) => row.eqpId, lineScope.scope),
    [repairQuery.data, lineScope.scope],
  )

  return {
    gateway,
    business,
    quarantine,
    repairTask,
    isSettled:
      !gatewayQuery.isPending &&
      !businessQuery.isPending &&
      !quarantineQuery.isPending &&
      !repairQuery.isPending &&
      !lineScope.isPending,
    isFetching:
      gatewayQuery.isFetching ||
      businessQuery.isFetching ||
      quarantineQuery.isFetching ||
      repairQuery.isFetching,
    isError:
      gatewayQuery.isError ||
      businessQuery.isError ||
      quarantineQuery.isError ||
      repairQuery.isError ||
      lineScope.isError,
    refetchAll: () => {
      void Promise.all([
        gatewayQuery.refetch(),
        businessQuery.refetch(),
        quarantineQuery.refetch(),
        repairQuery.refetch(),
      ])
    },
  }
}
