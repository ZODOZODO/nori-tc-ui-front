import type {
  DeployHistoryItem,
  DeployStatus,
  DeployTargetItem,
  DeployTargetSummary,
} from '../types/deploy.types'

export const createDeployTargetSummary = (targets: DeployTargetItem[]): DeployTargetSummary => ({
  total: targets.length,
  pending: targets.filter((item) => item.targetStatus === 'PENDING').length,
  noChange: targets.filter((item) => item.targetStatus === 'NO_CHANGE').length,
  running: targets.filter((item) => item.targetStatus === 'RUNNING').length,
  completed: targets.filter((item) => item.targetStatus === 'COMPLETED').length,
  failed: targets.filter((item) => item.targetStatus === 'FAILED').length,
  rollingBack: targets.filter((item) => item.targetStatus === 'ROLLING_BACK').length,
  rolledBack: targets.filter((item) => item.targetStatus === 'ROLLED_BACK').length,
  compensationFailed: targets.filter((item) => item.targetStatus === 'COMPENSATION_FAILED').length,
  canceled: targets.filter((item) => item.targetStatus === 'CANCELED').length,
})

export const resolveDeployStatusFromTargets = (targets: DeployTargetItem[]): DeployStatus => {
  if (targets.length === 0) {
    return 'READY'
  }

  const summary = createDeployTargetSummary(targets)

  if (summary.failed > 0 && summary.completed > 0) {
    return 'PARTIAL_FAILED'
  }

  if (summary.failed === summary.total) {
    return 'FAILED'
  }

  if (summary.completed === summary.total || summary.noChange === summary.total) {
    return 'COMPLETED'
  }

  if (summary.running > 0) {
    return 'RUNNING'
  }

  return 'READY'
}

export const isTerminalDeployStatus = (status: DeployHistoryItem['deployStatus']): boolean =>
  status === 'COMPLETED' ||
  status === 'PARTIAL_FAILED' ||
  status === 'FAILED' ||
  status === 'CANCELED'

export const createDeployName = (modelName: string | null, modelVersion: string | null): string => {
  const safeModelName = modelName?.trim() || 'Register'
  const safeModelVersion = modelVersion?.trim()

  if (!safeModelVersion) {
    return `${safeModelName} Deploy`
  }

  return `${safeModelName} ${safeModelVersion} Deploy`
}
