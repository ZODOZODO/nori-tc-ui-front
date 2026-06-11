import { useMemo } from 'react'
import { useEqpList } from '@/features/eqp/hooks/useEqpList'
import { useLineList } from '@/shared/hooks/useLineList'
import { useLineScopeStore } from '@/shared/stores/line-scope.store'
import type { DlqLineScope } from '../lib/dlq-line-scope'

/**
 * 상단 라인 선택을 DLQ 패널 필터 기준(DlqLineScope)으로 해석합니다.
 *
 * 라인 목록으로 선택 lineCode 를 lineKey 로 해석하고, 설비 목록으로
 * eqpId → lineKey 매핑을 구성합니다. 두 조회 중 하나라도 로딩/실패면
 * 패널이 해당 상태를 함께 표시할 수 있도록 isPending/errorMessage 를 노출합니다.
 */
export function useDlqLineScope() {
  const lineListQuery = useLineList()
  const eqpListQuery = useEqpList()
  const selectedLineValue = useLineScopeStore((state) => state.selectedLineValue)

  const selectedLineKey = useMemo(
    () => lineListQuery.data?.find((line) => line.lineCode === selectedLineValue)?.lineKey ?? null,
    [lineListQuery.data, selectedLineValue],
  )

  const lineKeyByEqpId = useMemo(() => {
    const map = new Map<string, number>()
    for (const item of eqpListQuery.data?.items ?? []) {
      map.set(item.eqpId, item.lineKey)
    }
    return map
  }, [eqpListQuery.data?.items])

  const scope = useMemo<DlqLineScope>(
    () => ({ selectedLineKey, lineKeyByEqpId }),
    [selectedLineKey, lineKeyByEqpId],
  )

  const errorMessage =
    lineListQuery.error instanceof Error
      ? lineListQuery.error.message
      : eqpListQuery.error instanceof Error
        ? eqpListQuery.error.message
        : null

  return {
    scope,
    isPending: lineListQuery.isPending || eqpListQuery.isPending,
    isError: lineListQuery.isError || eqpListQuery.isError,
    errorMessage,
  }
}
