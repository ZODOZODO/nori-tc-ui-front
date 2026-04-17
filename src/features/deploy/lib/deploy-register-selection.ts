import type { DeployRegisterTargetItem } from '../types/deploy.types'

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
