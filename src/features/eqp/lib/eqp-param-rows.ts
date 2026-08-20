import type { EqpParamDiffRow, EqpParamRow } from '../types/eqp.types'

/** 편집 중에만 존재하는 행 식별자를 얹은 파라미터 행. */
export type EditableEqpParamRow = EqpParamRow & { rowId: string }

/**
 * 편집 중인 파라미터 행을 안정적으로 식별하기 위한 임시 키를 생성합니다.
 * paramName은 사용자가 수정할 수 있으므로 React key와 수정 대상 식별자로 사용할 수 없습니다.
 */
export const createEditableParamRowId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `eqp-param-row-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/**
 * API 파라미터 행을 편집 가능한 로컬 행 모델로 변환합니다.
 */
export const toEditableParamRow = (row: EqpParamRow): EditableEqpParamRow => ({
  rowId: createEditableParamRowId(),
  ...row,
})

const normalizeParamText = (value: string | null | undefined): string => value ?? ''

/**
 * 편집 중인 행(branch)과 기준 버전 행(parent)의 차이를 Check In 모달용 diff 로 계산합니다.
 *
 * paramName 은 trim 후 비교한다 — 사용자가 넣은 공백만으로 added/deleted 가 생기면 안 된다.
 * 정렬은 added → changed → deleted, 같은 상태 안에서는 paramName 순이다.
 */
export const computeEqpParamDiffRows = (
  branchRows: readonly EqpParamRow[],
  parentRows: readonly EqpParamRow[],
): EqpParamDiffRow[] => {
  const parentByName = new Map<string, EqpParamRow>()
  const branchByName = new Map<string, EqpParamRow>()

  parentRows.forEach((row) => {
    const paramName = row.paramName.trim()
    if (paramName) {
      parentByName.set(paramName, {
        ...row,
        paramName,
        paramValue: normalizeParamText(row.paramValue),
        description: normalizeParamText(row.description),
      })
    }
  })

  branchRows.forEach((row) => {
    const paramName = row.paramName.trim()
    if (paramName) {
      branchByName.set(paramName, {
        ...row,
        paramName,
        paramValue: normalizeParamText(row.paramValue),
        description: normalizeParamText(row.description),
      })
    }
  })

  const diffRows: EqpParamDiffRow[] = []

  branchByName.forEach((branchRow, paramName) => {
    const parentRow = parentByName.get(paramName)

    if (!parentRow) {
      diffRows.push({
        status: 'added',
        paramName,
        parentValue: '',
        branchValue: branchRow.paramValue,
        parentDescription: '',
        branchDescription: branchRow.description,
      })
      return
    }

    if (
      parentRow.paramValue !== branchRow.paramValue ||
      parentRow.description !== branchRow.description
    ) {
      diffRows.push({
        status: 'changed',
        paramName,
        parentValue: parentRow.paramValue,
        branchValue: branchRow.paramValue,
        parentDescription: parentRow.description,
        branchDescription: branchRow.description,
      })
    }
  })

  parentByName.forEach((parentRow, paramName) => {
    if (branchByName.has(paramName)) {
      return
    }

    diffRows.push({
      status: 'deleted',
      paramName,
      parentValue: parentRow.paramValue,
      branchValue: '',
      parentDescription: parentRow.description,
      branchDescription: '',
    })
  })

  const statusOrder: Record<EqpParamDiffRow['status'], number> = {
    added: 0,
    changed: 1,
    deleted: 2,
  }

  return diffRows.sort((left, right) => {
    const statusCompare = statusOrder[left.status] - statusOrder[right.status]
    return statusCompare === 0 ? left.paramName.localeCompare(right.paramName) : statusCompare
  })
}
