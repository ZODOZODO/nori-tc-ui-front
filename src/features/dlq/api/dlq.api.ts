import { apiClient } from '@/shared/lib/api-client'
import type {
  BusinessDlqEntry,
  GatewayDlqEntry,
  QuarantineEntry,
  RepairTaskEntry,
} from '../types/dlq.types'

/**
 * 백엔드 표준 응답 래퍼.
 * `success=true` + `data` 가 배열인 케이스만 허용. 그 외는 던져서 react-query 가 error 상태로 전이.
 */
interface ApiResponse<TData> {
  success: boolean
  data: TData | null
  errorCode: string | null
  errorMsg: string | null
}

const isApiResponse = <TData>(value: unknown): value is ApiResponse<TData> =>
  typeof value === 'object' &&
  value !== null &&
  'success' in value &&
  typeof (value as { success: unknown }).success === 'boolean'

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
    fetchDlqList<GatewayDlqEntry>('/dlq/gateway', 'Gateway DLQ 목록을 조회하지 못했습니다.'),

  /**
   * Business DLQ 항목 전체 조회.
   */
  fetchBusinessDlq: (): Promise<BusinessDlqEntry[]> =>
    fetchDlqList<BusinessDlqEntry>('/dlq/business', 'Business DLQ 목록을 조회하지 못했습니다.'),

  /**
   * 격리 설비 항목 전체 조회.
   */
  fetchQuarantine: (): Promise<QuarantineEntry[]> =>
    fetchDlqList<QuarantineEntry>('/dlq/quarantine', '격리 설비 목록을 조회하지 못했습니다.'),

  /**
   * Repair Task 항목 전체 조회.
   */
  fetchRepairTasks: (): Promise<RepairTaskEntry[]> =>
    fetchDlqList<RepairTaskEntry>('/dlq/repair-task', 'Repair Task 목록을 조회하지 못했습니다.'),
}
