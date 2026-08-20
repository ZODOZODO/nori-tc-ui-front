import type { EqpInfo } from '../types/eqp.types'

/**
 * EQP 목록 항목의 최소 유효성(eqpId 문자열)을 확인합니다.
 */
const isEqpInfoItem = (value: unknown): value is EqpInfo =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as { eqpId?: unknown }).eqpId === 'string' &&
  (value as { eqpId: string }).eqpId.length > 0

/**
 * 목록 payload를 화면에서 안전하게 사용할 수 있는 EQP 배열로 정규화합니다.
 */
export const resolveEqpItems = (payload: unknown): EqpInfo[] => {
  if (!payload) {
    return []
  }

  if (Array.isArray(payload)) {
    return payload.filter(isEqpInfoItem)
  }

  if (typeof payload === 'object' && payload !== null) {
    const items = (payload as { items?: unknown }).items
    if (Array.isArray(items)) {
      return items.filter(isEqpInfoItem)
    }
  }

  return []
}
