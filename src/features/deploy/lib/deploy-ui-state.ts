import {
  createDeployName,
  createDeployTargetSummary,
  isTerminalDeployStatus,
} from './deploy-utils'
import type {
  DeployEventType,
  DeployHistoryItem,
  DeployMonitorFilters,
  DeployRegisterFilters,
  DeployRegisterTargetItem,
  DeployTargetItem,
} from '../types/deploy.types'

const toDateInputValue = (date: Date): string => {
  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 10)
}

export const EMPTY_REGISTER_FILTERS: DeployRegisterFilters = {
  modelName: '',
  modelVersionKey: null,
  eqpId: '',
}

export const createDefaultMonitorFilters = (): DeployMonitorFilters => {
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(today.getDate() - 7)

  return {
    modelName: '',
    requestedBy: '',
    fromDate: toDateInputValue(weekAgo),
    toDate: toDateInputValue(today),
  }
}

export const createInitialDeployUiDataState = () => ({
  selectedEqpIds: [] as string[],
  selectedEqpTargetsById: {} as Record<string, DeployRegisterTargetItem>,
  selectedEqpParamVersions: {} as Record<string, string>,
  selectedInterfaceType: null as DeployRegisterTargetItem['commInterface'] | null,
  activeDeployKey: null as number | null,
  deployListOffset: 0,
  historyListOffset: 0,
  serverBackedDeployKeys: [] as number[],
  serverBridgeCreatedAtByDeployKey: {} as Record<number, string>,
  localHistory: [] as DeployHistoryItem[],
  localTargetsByDeployKey: {} as Record<number, DeployTargetItem[]>,
  registerFilters: EMPTY_REGISTER_FILTERS,
  hasSubmittedRegisterSearch: false,
  registerSearchRevision: 0,
  deployFilters: createDefaultMonitorFilters(),
  historyFilters: createDefaultMonitorFilters(),
  selectedModelName: null as string | null,
  selectedModelVersionKey: null as number | null,
  selectedBusinessJarRef: null as number | null,
})

export const nextDeployKey = (history: DeployHistoryItem[]): number =>
  history.reduce((maxKey, item) => Math.max(maxKey, item.deployKey), 7100) + 1

export const createBridgeTargets = (
  deployKey: number,
  eqpIds: string[],
  selectedEqpTargetsById: Record<string, DeployRegisterTargetItem>,
  deployStatus: DeployHistoryItem['deployStatus'],
): DeployTargetItem[] =>
  eqpIds.map((eqpId, index) => ({
    deployTargetKey: deployKey * 100 + index + 1,
    eqpId,
    modelName: selectedEqpTargetsById[eqpId]?.modelName ?? 'Unknown Model',
    targetStatus: deployStatus === 'RUNNING' && index === 0 ? 'RUNNING' : 'PENDING',
    currentStepOrder: deployStatus === 'RUNNING' && index === 0 ? 10 : 0,
    currentStepCode: deployStatus === 'RUNNING' && index === 0 ? 'PREPARE_REQUEST' : 'QUEUED',
    currentStepStatus: deployStatus === 'RUNNING' && index === 0 ? 'RUNNING' : 'PENDING',
    rollbackRequired: false,
    lastErrorMessage: null,
    updatedAt: new Date().toISOString(),
  }))

export const createPlaceholderTargetSummary = (
  targetCount: number,
  deployStatus: DeployHistoryItem['deployStatus'],
) => {
  if (deployStatus === 'RUNNING') {
    return {
      total: targetCount,
      pending: Math.max(targetCount - 1, 0),
      noChange: 0,
      running: targetCount > 0 ? 1 : 0,
      completed: 0,
      failed: 0,
      rollingBack: 0,
      rolledBack: 0,
      compensationFailed: 0,
      canceled: 0,
    }
  }

  if (deployStatus === 'PLANNING' || deployStatus === 'READY') {
    return {
      total: targetCount,
      pending: targetCount,
      noChange: 0,
      running: 0,
      completed: 0,
      failed: 0,
      rollingBack: 0,
      rolledBack: 0,
      compensationFailed: 0,
      canceled: 0,
    }
  }

  if (deployStatus === 'CANCELED') {
    return {
      total: targetCount,
      pending: 0,
      noChange: 0,
      running: 0,
      completed: 0,
      failed: 0,
      rollingBack: 0,
      rolledBack: 0,
      compensationFailed: 0,
      canceled: targetCount,
    }
  }

  if (deployStatus === 'COMPLETED') {
    return {
      total: targetCount,
      pending: 0,
      noChange: 0,
      running: 0,
      completed: targetCount,
      failed: 0,
      rollingBack: 0,
      rolledBack: 0,
      compensationFailed: 0,
      canceled: 0,
    }
  }

  return {
    total: targetCount,
    pending: 0,
    noChange: 0,
    running: 0,
    completed: 0,
    failed: targetCount,
    rollingBack: 0,
    rolledBack: 0,
    compensationFailed: 0,
    canceled: 0,
  }
}

export const createServerBridgeHistoryItem = (input: {
  deployKey: number
  deployName?: string | null
  deployStatus: DeployHistoryItem['deployStatus']
  requestedBy: string
  selectedModelName: string | null
  selectedModelVersion: string | null
  selectedBusinessJarName: string | null
  eventType: DeployEventType
  interfaceType: DeployRegisterTargetItem['commInterface'] | null
  targets: DeployTargetItem[]
  targetCount: number
}): DeployHistoryItem => {
  const createdAt = new Date().toISOString()

  return {
    deployKey: input.deployKey,
    deployName:
      input.deployName?.trim() || createDeployName({ eventType: input.eventType }),
    eventType: input.eventType,
    deployStatus: input.deployStatus,
    pauseRequested: false,
    executionPolicy: 'BEST_EFFORT',
    requestedBy: input.requestedBy,
    createdAt,
    startedAt:
      input.deployStatus === 'READY' || input.deployStatus === 'PLANNING' ? null : createdAt,
    finishedAt: null,
    terminal: isTerminalDeployStatus(input.deployStatus),
    interfaceType: input.interfaceType,
    selectedModelName: input.selectedModelName,
    selectedModelVersion: input.selectedModelVersion,
    selectedBusinessJarName: input.selectedBusinessJarName,
    targetSummary:
      input.targets.length > 0
        ? createDeployTargetSummary(input.targets)
        : createPlaceholderTargetSummary(input.targetCount, input.deployStatus),
  }
}

export const mergeHistoryItem = (
  history: DeployHistoryItem[],
  nextHistoryItem: DeployHistoryItem,
): DeployHistoryItem[] => {
  const hasExisting = history.some((item) => item.deployKey === nextHistoryItem.deployKey)

  if (!hasExisting) {
    return [nextHistoryItem, ...history]
  }

  return history.map((item) => (item.deployKey === nextHistoryItem.deployKey ? nextHistoryItem : item))
}
