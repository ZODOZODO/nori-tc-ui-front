import type { ModelInfo, ModelStatus, ProtocolType } from '../types/model.types'

export interface ModelTreeNode {
  representative: ModelInfo
  latestStatus: ModelStatus
  branches: ModelTreeNode[]
}

export interface ModelTreeGroups {
  secsRoots: ModelTreeNode[]
  socketRoots: ModelTreeNode[]
  plcRoots: ModelTreeNode[]
}

type InterfaceGroup = 'SECS' | 'Socket' | 'PLC'

/**
 * Model 이름을 숫자 인식 오름차순으로 비교합니다.
 */
const compareModelNameAsc = (firstItem: ModelInfo, secondItem: ModelInfo): number =>
  firstItem.modelName.localeCompare(secondItem.modelName, 'ko-KR', {
    numeric: true,
    sensitivity: 'base',
  })

/**
 * updatedAt 기준 최신 항목이 먼저 오도록 정렬합니다.
 */
const compareUpdatedAtDesc = (firstItem: ModelInfo, secondItem: ModelInfo): number => {
  const secondTime = Date.parse(secondItem.updatedAt)
  const firstTime = Date.parse(firstItem.updatedAt)
  return secondTime - firstTime
}

/**
 * comm_interface 값을 Sidebar 루트 그룹 이름으로 변환합니다.
 */
const resolveInterfaceGroup = (commInterface: ProtocolType): InterfaceGroup => {
  const normalizedInterface = commInterface.toUpperCase()
  if (normalizedInterface === 'SOCKET') {
    return 'Socket'
  }
  if (normalizedInterface === 'PLC') {
    return 'PLC'
  }
  return 'SECS'
}

/**
 * 검색어가 모델명에 포함되는지 확인합니다.
 * 후속 정책상 Sidebar 검색은 버전이 아니라 모델 식별 자체에 집중합니다.
 */
const matchesKeyword = (model: ModelInfo, normalizedKeyword: string): boolean => {
  if (!normalizedKeyword) {
    return true
  }

  return model.modelName.toLowerCase().includes(normalizedKeyword)
}

/**
 * model_name 단위 최신 대표 항목을 추출합니다.
 * Sidebar 트리는 버전별이 아니라 모델명 단위 관리 구조를 보여주므로 최신 버전 1건만 사용합니다.
 */
const buildLatestRepresentativeMap = (modelItems: ModelInfo[]): Map<string, ModelInfo> => {
  const latestRepresentativeByName = new Map<string, ModelInfo>()

  modelItems
    .slice()
    .sort(compareUpdatedAtDesc)
    .forEach((item) => {
      if (!latestRepresentativeByName.has(item.modelName)) {
        latestRepresentativeByName.set(item.modelName, item)
      }
    })

  return latestRepresentativeByName
}

/**
 * 최신 대표 모델 목록을 parent_model 기준 트리로 구성합니다.
 * 검색 시에는 매칭된 branch를 감싸는 parent는 유지하고, parent가 매칭되면 하위 branch를 모두 표시합니다.
 */
const buildInterfaceRoots = (
  representativeMap: Map<string, ModelInfo>,
  interfaceGroup: InterfaceGroup,
  normalizedKeyword: string,
): ModelTreeNode[] => {
  const interfaceModels = [...representativeMap.values()]
    .filter((item) => resolveInterfaceGroup(item.commInterface) === interfaceGroup)
    .sort(compareModelNameAsc)

  const childrenByParentName = new Map<string, ModelInfo[]>()
  interfaceModels.forEach((item) => {
    const parentModelName = item.parentModel?.trim()
    if (!parentModelName) {
      return
    }

    const siblings = childrenByParentName.get(parentModelName) ?? []
    siblings.push(item)
    siblings.sort(compareModelNameAsc)
    childrenByParentName.set(parentModelName, siblings)
  })

  /**
   * 비정상 parent 참조로 순환이 생기더라도 Sidebar 렌더링이 깨지지 않도록 방문 경로를 차단합니다.
   */
  const buildNode = (
    model: ModelInfo,
    ancestorMatched: boolean,
    visitedModelNames: Set<string>,
  ): ModelTreeNode | null => {
    if (visitedModelNames.has(model.modelName)) {
      return null
    }

    const nextVisitedModelNames = new Set(visitedModelNames)
    nextVisitedModelNames.add(model.modelName)

    const modelMatched = matchesKeyword(model, normalizedKeyword)
    const nextAncestorMatched = ancestorMatched || modelMatched
    const childNodes =
      childrenByParentName
        .get(model.modelName)
        ?.map((childModel) => buildNode(childModel, nextAncestorMatched, nextVisitedModelNames))
        .filter((childNode): childNode is ModelTreeNode => childNode !== null) ?? []

    if (!normalizedKeyword || modelMatched || childNodes.length > 0) {
      return {
        representative: model,
        latestStatus: model.status,
        branches: childNodes,
      }
    }

    return null
  }

  return interfaceModels
    .filter((item) => {
      const parentModelName = item.parentModel?.trim()
      return !parentModelName || !representativeMap.has(parentModelName)
    })
    .map((rootModel) => buildNode(rootModel, false, new Set<string>()))
    .filter((rootNode): rootNode is ModelTreeNode => rootNode !== null)
}

/**
 * 모델 전체 목록을 Sidebar용 parent/branch 트리로 정규화합니다.
 */
export const buildModelTreeGroups = (
  modelItems: ModelInfo[],
  searchKeyword: string,
): ModelTreeGroups => {
  const representativeMap = buildLatestRepresentativeMap(modelItems)
  const normalizedKeyword = searchKeyword.trim().toLowerCase()

  return {
    secsRoots: buildInterfaceRoots(representativeMap, 'SECS', normalizedKeyword),
    socketRoots: buildInterfaceRoots(representativeMap, 'Socket', normalizedKeyword),
    plcRoots: buildInterfaceRoots(representativeMap, 'PLC', normalizedKeyword),
  }
}
