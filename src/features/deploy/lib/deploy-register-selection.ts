import type { DeployRegisterTargetItem } from '../types/deploy.types'

/**
 * 한 번의 배포 요청에 담을 수 있는 최대 target 수(개수 가드 단일 출처).
 * BE `tc.ui.backend.deploy.max-targets-per-request`(기본값·라이브 config 모두 100)와 동기 필요 —
 * 값이 바뀌면 이 상수도 함께 갱신한다. 초과 시 서버는 raw 400 을 던지므로 프론트가 사전 차단한다.
 */
export const MAX_DEPLOY_TARGETS_PER_REQUEST = 100

/**
 * 이미 선택된 개수에 새로 추가/배포할 개수를 더했을 때 서버 상한을 초과하는지 판정합니다.
 * (배포 진입 검증은 newlyAddedCount=0 으로 현재 선택 개수만 검사)
 */
export const willExceedMaxTargets = (
  currentSelectedCount: number,
  newlyAddedCount: number,
): boolean => currentSelectedCount + newlyAddedCount > MAX_DEPLOY_TARGETS_PER_REQUEST

export const resolveInterfaceType = (
  eqpIds: string[],
  selectedEqpTargetsById: Record<string, DeployRegisterTargetItem>,
): DeployRegisterTargetItem['commInterface'] | null => {
  if (eqpIds.length === 0) {
    return null
  }

  const resolvedInterfaceTypes = eqpIds
    .map((eqpId) => selectedEqpTargetsById[eqpId]?.commInterface)
    .filter(
      (commInterface): commInterface is DeployRegisterTargetItem['commInterface'] =>
        typeof commInterface === 'string',
    )

  const interfaceTypes = [...new Set(resolvedInterfaceTypes)]

  return resolvedInterfaceTypes.length === eqpIds.length && interfaceTypes.length === 1
    ? interfaceTypes[0]
    : null
}
