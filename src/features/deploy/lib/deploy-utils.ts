import type {
  DeployEventType,
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

const REGISTER_SCENARIO_TASK_LABELS: Record<string, string> = {
  REGISTER_MODEL_ONLY: '모델 변경',
  REGISTER_BUSINESS_JAR_ONLY: 'Business JAR 변경',
  REGISTER_EQP_PARAM_ONLY: 'EQP PARAM 변경',
  REGISTER_MODEL_EQP_PARAM: '모델 + EQP PARAM 변경',
  REGISTER_MODEL_BUSINESS_JAR: '모델 + Business JAR 변경',
  REGISTER_MODEL_BUSINESS_JAR_EQP_PARAM: '모델 + Business JAR + EQP PARAM 변경',
}

export const resolveDeployTaskLabel = (
  resolvedScenarioCode?: string | null,
  eventType?: DeployEventType | string | null,
): string => {
  const normalizedScenarioCode = resolvedScenarioCode?.trim().toUpperCase()
  if (normalizedScenarioCode && REGISTER_SCENARIO_TASK_LABELS[normalizedScenarioCode]) {
    return REGISTER_SCENARIO_TASK_LABELS[normalizedScenarioCode]
  }

  switch (eventType?.trim().toUpperCase()) {
    case 'EQP_MODEL_UPDATE':
      return '모델 변경'
    case 'EQP_PARAMETER_UPDATE':
      return 'EQP PARAM 변경'
    case 'EQP_BUSINESS_JARFILE_UPDATE':
      return 'Business JAR 변경'
    case 'EQP_GATEWAY_JARFILE_UPDATE':
      return 'Gateway JAR 변경'
    case 'EQP_UPDATE':
      return '설비 설정 변경'
    case 'EQP_CREATE':
      return '설비 등록'
    case 'EQP_DELETE':
      return '설비 삭제'
    case 'EQP_RECONNECT':
      return '설비 재연결'
    case 'EQP_START':
      return '설비 시작'
    case 'EQP_END':
      return '설비 종료'
    case 'EQP_SEND_MESSAGE':
      return '메시지 전송'
    case 'EQP_REGISTER_DEPLOY':
      return 'Register Deploy'
    default:
      return 'Deploy 작업'
  }
}

export const createDeployName = (input: {
  resolvedScenarioCode?: string | null
  eventType?: DeployEventType | string | null
}): string => {
  return resolveDeployTaskLabel(input.resolvedScenarioCode, input.eventType)
}
