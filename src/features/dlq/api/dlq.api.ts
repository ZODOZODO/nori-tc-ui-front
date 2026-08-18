import i18n from '@/i18n'
import { apiClient } from '@/shared/lib/api-client'
import { isApiResponse, type ApiResponse } from '@/shared/types/api.types'
import type {
  BusinessDlqEntry,
  GatewayDlqEntry,
  QuarantineEntry,
  RepairTaskEntry,
} from '../types/dlq.types'

/**
 * `success=true` + `data` 가 배열인 케이스만 허용. 그 외는 던져서 react-query 가 error 상태로 전이.
 */
const unwrapArrayPayload = <TItem>(payload: unknown, fallbackMessage: string): TItem[] => {
  if (!isApiResponse<TItem[]>(payload) || payload.success !== true) {
    throw new Error(
      isApiResponse<unknown>(payload) && payload.errorMsg
        ? payload.errorMsg
        : fallbackMessage,
    )
  }

  if (!Array.isArray(payload.data)) {
    return []
  }

  return payload.data
}

const fetchDlqList = async <TItem>(path: string, fallbackMessage: string): Promise<TItem[]> => {
  const response = await apiClient.get<ApiResponse<TItem[]>>(path, { withCredentials: true })
  return unwrapArrayPayload<TItem>(response.data, fallbackMessage)
}

export const dlqApi = {
  /**
   * Gateway DLQ 항목 전체 조회.
   */
  fetchGatewayDlq: (): Promise<GatewayDlqEntry[]> =>
    fetchDlqList<GatewayDlqEntry>('/dlq/gateway', i18n.t('error.dlq.gateway')),

  /**
   * Business DLQ 항목 전체 조회.
   */
  fetchBusinessDlq: (): Promise<BusinessDlqEntry[]> =>
    fetchDlqList<BusinessDlqEntry>('/dlq/business', i18n.t('error.dlq.business')),

  /**
   * 격리 설비 항목 전체 조회.
   */
  fetchQuarantine: (): Promise<QuarantineEntry[]> =>
    fetchDlqList<QuarantineEntry>('/dlq/quarantine', i18n.t('error.dlq.quarantine')),

  /**
   * Repair Task 항목 전체 조회.
   */
  fetchRepairTasks: (): Promise<RepairTaskEntry[]> =>
    fetchDlqList<RepairTaskEntry>('/dlq/repair-task', i18n.t('error.dlq.repairTask')),
}
