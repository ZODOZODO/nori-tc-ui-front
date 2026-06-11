/**
 * DLQ 라인 스코프 필터 모델입니다.
 *
 * DLQ 항목(gateway/business/quarantine/repair-task)에는 라인 정보가 없고
 * 설비 식별자(eqpId)만 있으므로, 설비 목록(GET /api/eqp)의 lineKey 매핑으로
 * 선택 라인 소속 여부를 분류합니다.
 */
export interface DlqLineScope {
  /** 선택 라인 lineKey — 라인 목록 로딩/선택 시드 전이면 null */
  selectedLineKey: number | null
  /** eqpId → lineKey 매핑 (설비 목록 기준) */
  lineKeyByEqpId: ReadonlyMap<string, number>
}

/**
 * DLQ 항목을 선택 라인 기준으로 필터링합니다.
 *
 * - selectedLineKey 미해석(null)이면 빈 목록을 반환합니다(로딩 단계).
 * - eqpId 가 없거나(식별 불가) 설비 목록에 없는(삭제된 설비 등) 항목은
 *   어느 라인에서도 숨겨져 유실되지 않도록 항상 표시합니다.
 */
export const filterDlqEntriesByLine = <T>(
  entries: readonly T[],
  resolveEqpId: (entry: T) => string | null,
  scope: DlqLineScope,
): T[] => {
  if (scope.selectedLineKey === null) {
    return []
  }

  return entries.filter((entry) => {
    const eqpId = resolveEqpId(entry)
    if (!eqpId) {
      return true
    }
    const lineKey = scope.lineKeyByEqpId.get(eqpId)
    return lineKey === undefined || lineKey === scope.selectedLineKey
  })
}
