import type {
  ModelDetailNode,
  ModelDetailRow,
  ModelDiffItem,
  ModelDiffSection,
  ModelNodeDetailData,
} from '../types/model.types'

/**
 * 상세 노드 row 의 diff 식별자(identity)를 노드별 규칙으로 계산합니다.
 *
 * 대부분의 노드는 col0(values[0]) 이 모델 내 고유 이름이라 그것을 그대로 식별자로 쓴다.
 * 단, plc-register 의 col0 은 소속 그룹(Group) 이라 같은 그룹의 레지스터가 전부 같은 값을 가져
 * 충돌한다 — DB UNIQUE (group_key, variable_name) 를 미러해 (Group, Variable Name) 복합키로 식별해야
 * 그룹별 붕괴 없이 레지스터별 diff 가 잡힌다. (row.id 는 버전마다 register_key 가 달라 cross-version
 * 매칭에 못 쓴다.)
 */
const toRowIdentity = (node: ModelDetailNode, row: ModelDetailRow): string => {
  if (node === 'plc-register') {
    const group = (row.values[0] ?? '').trim()
    const variableName = (row.values[2] ?? '').trim()
    const composite = `${group}|${variableName}`
    return composite === '|' ? row.id : composite
  }
  return (row.values[0] ?? '').trim() || row.id
}

/**
 * 두 row 배열을 비교하여 추가/변경/삭제 항목을 도출합니다.
 *
 * branchValues = 현재 EDIT 버전 값, parentValues = 이전 저장 버전 값.
 *
 * @param node         비교 대상 상세 노드(식별자 규칙 결정)
 * @param currentRows  현재 EDIT 버전 rows
 * @param previousRows 이전 버전 rows
 * @returns added / changed / deleted 항목 배열
 */
export const computeNodeDiff = (
  node: ModelDetailNode,
  currentRows: ModelDetailRow[],
  previousRows: ModelDetailRow[],
): Pick<ModelDiffSection, 'added' | 'changed' | 'deleted'> => {
  const currentMap = new Map(currentRows.map((row) => [toRowIdentity(node, row), row]))
  const previousMap = new Map(previousRows.map((row) => [toRowIdentity(node, row), row]))

  const added: ModelDiffItem[] = []
  const changed: ModelDiffItem[] = []
  const deleted: ModelDiffItem[] = []

  for (const [identity, currentRow] of currentMap) {
    const previousRow = previousMap.get(identity)
    if (!previousRow) {
      added.push({ identity, branchValues: currentRow.values, parentValues: [] })
    } else {
      const isChanged = currentRow.values.some((value, index) => value !== previousRow.values[index])
      if (isChanged) {
        changed.push({ identity, branchValues: currentRow.values, parentValues: previousRow.values })
      }
    }
  }

  for (const [identity, previousRow] of previousMap) {
    if (!currentMap.has(identity)) {
      deleted.push({ identity, branchValues: [], parentValues: previousRow.values })
    }
  }

  return { added, changed, deleted }
}

/**
 * check-in diff 모달에 그릴 노드별 섹션을 조립합니다.
 *
 * 컬럼은 현재 버전 것을 쓰되 비어 있으면 이전 버전 것으로 대체한다 — EDIT 버전에서 모든 row 를
 * 지우면 서버가 컬럼을 빈 배열로 주고, 그대로 넘기면 삭제분만 있는 섹션의 표 머리가 사라진다.
 * 변경이 하나도 없는 노드는 모달 노이즈라 걸러낸다.
 */
export const buildCheckInDiffSections = (
  nodeResults: {
    node: ModelDetailNode
    currentData: ModelNodeDetailData
    previousData: ModelNodeDetailData
  }[],
): ModelDiffSection[] =>
  nodeResults
    .map(({ node, currentData, previousData }) => {
      const { added, changed, deleted } = computeNodeDiff(node, currentData.rows, previousData.rows)
      return {
        detailNode: node,
        columns: currentData.columns.length > 0 ? currentData.columns : previousData.columns,
        added,
        changed,
        deleted,
      }
    })
    .filter(
      (section) =>
        section.added.length > 0 || section.changed.length > 0 || section.deleted.length > 0,
    )
