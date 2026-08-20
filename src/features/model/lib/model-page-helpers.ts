import {
  PLC_DETAIL_NODES,
  SECS_DETAIL_NODES,
  SOCKET_DETAIL_NODES,
  type ModelDetailNode,
  type ModelDetailRow,
  type ModelInfo,
  type ProtocolType,
} from '../types/model.types'

/**
 * ModelPage 가 모델 목록 / 상세 노드를 다룰 때 쓰는 순수 헬퍼 모음입니다.
 *
 * `.tsx` 안에 있으면 단위 테스트로 고정할 수 없어 분리했다 — 삭제 파급 수집처럼
 * 화면 조작으로만 닿는 로직이 회귀망 없이 남는 것을 막는다.
 */

/**
 * 상세 데이터 rows를 첫 번째 컬럼 값 기준으로 오름차순 정렬합니다.
 * Model Param, Flow, Dcop Items 등 모든 detail 테이블에 공통 적용됩니다.
 */
export const sortDetailRowsByFirstColumn = (rows: ModelDetailRow[]): ModelDetailRow[] =>
  [...rows].sort((a, b) => (a.values[0] ?? '').localeCompare(b.values[0] ?? ''))

/**
 * updatedAt 기준 최신순으로 모델 목록을 정렬합니다.
 */
export const sortByUpdatedAtDesc = (models: ModelInfo[]): ModelInfo[] =>
  [...models].sort((firstItem, secondItem) => {
    const secondTime = Date.parse(secondItem.updatedAt)
    const firstTime = Date.parse(firstItem.updatedAt)
    return secondTime - firstTime
  })

/**
 * MDF 노드는 XML 비교가 의미 없으므로 diff 대상에서 제외합니다.
 */
export const DIFF_EXCLUDED_NODES: ReadonlySet<ModelDetailNode> = new Set(['mdf'])

/**
 * 인터페이스 타입별 상세 노드 기본 집합을 반환합니다.
 */
export const resolveDetailNodesByInterface = (commInterface: ProtocolType): ModelDetailNode[] => {
  const normalizedInterface = commInterface.toUpperCase()
  if (normalizedInterface === 'SOCKET') {
    return SOCKET_DETAIL_NODES
  }
  if (normalizedInterface === 'PLC') {
    return PLC_DETAIL_NODES
  }
  return SECS_DETAIL_NODES
}

/**
 * 신규 상세 row에 사용할 임시 식별자입니다.
 */
export const createEditableDetailRowId = (): string =>
  `detail-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/**
 * 상태 문자열이 DEPRECATED인지 확인합니다.
 */
export const isDeprecatedStatus = (status: string): boolean =>
  status.trim().toUpperCase() === 'DEPRECATED'

/**
 * 특정 model_name의 최신 대표 항목을 찾습니다.
 */
export const resolveLatestModelByName = (
  modelItems: ModelInfo[],
  modelName: string | null,
): ModelInfo | null => {
  if (!modelName) {
    return null
  }

  return sortByUpdatedAtDesc(modelItems.filter((item) => item.modelName === modelName))[0] ?? null
}

/**
 * 삭제 대상 modelKey 집합에 포함된 모든 version key를 수집합니다.
 */
export const collectModelVersionKeysByModelKeys = (
  modelItems: ModelInfo[],
  modelKeys: number[],
): number[] => {
  const targetModelKeySet = new Set(modelKeys)

  return modelItems
    .filter((item) => targetModelKeySet.has(item.modelKey))
    .map((item) => item.modelVersionKey)
}

/**
 * root model 삭제 시 함께 사라지는 branch version key까지 모두 수집합니다.
 */
export const collectCascadeDeletedVersionKeys = (
  modelItems: ModelInfo[],
  rootModelName: string,
): number[] =>
  modelItems
    .filter((item) => item.modelName === rootModelName || item.parentModel === rootModelName)
    .map((item) => item.modelVersionKey)
