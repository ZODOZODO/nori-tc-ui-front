import i18n from '@/i18n'
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

// 컴포넌트 밖 모듈 상수라 i18n 키만 담고, 렌더 시점에 호출부가 t(key) 로 번역한다.
const REGISTER_SCENARIO_TASK_LABEL_KEYS: Record<string, string> = {
  REGISTER_MODEL_ONLY: 'deploy.task.modelOnly',
  REGISTER_BUSINESS_JAR_ONLY: 'deploy.task.businessJarOnly',
  REGISTER_EQP_PARAM_ONLY: 'deploy.task.eqpParamOnly',
  REGISTER_MODEL_EQP_PARAM: 'deploy.task.modelEqpParam',
  REGISTER_MODEL_BUSINESS_JAR: 'deploy.task.modelBusinessJar',
  REGISTER_MODEL_BUSINESS_JAR_EQP_PARAM: 'deploy.task.modelBusinessJarEqpParam',
}

/** Deploy 작업 유형의 i18n 키를 반환한다. 표시 시점에 호출부가 t(key) 로 번역한다. */
export const resolveDeployTaskLabel = (
  resolvedScenarioCode?: string | null,
  eventType?: DeployEventType | string | null,
): string => {
  const normalizedScenarioCode = resolvedScenarioCode?.trim().toUpperCase()
  if (normalizedScenarioCode && REGISTER_SCENARIO_TASK_LABEL_KEYS[normalizedScenarioCode]) {
    return REGISTER_SCENARIO_TASK_LABEL_KEYS[normalizedScenarioCode]
  }

  switch (eventType?.trim().toUpperCase()) {
    case 'EQP_MODEL_UPDATE':
      return 'deploy.task.modelOnly'
    case 'EQP_PARAMETER_UPDATE':
      return 'deploy.task.eqpParamOnly'
    case 'EQP_BUSINESS_JARFILE_UPDATE':
      return 'deploy.task.businessJarOnly'
    case 'EQP_GATEWAY_JARFILE_UPDATE':
      return 'deploy.task.gatewayJar'
    case 'EQP_UPDATE':
      return 'deploy.task.eqpConfig'
    case 'EQP_CREATE':
      return 'deploy.task.eqpCreate'
    case 'EQP_DELETE':
      return 'deploy.task.eqpDelete'
    case 'EQP_RECONNECT':
      return 'deploy.task.eqpReconnect'
    case 'EQP_START':
      return 'deploy.task.eqpStart'
    case 'EQP_END':
      return 'deploy.task.eqpEnd'
    case 'EQP_SEND_MESSAGE':
      return 'deploy.task.eqpSendMessage'
    case 'EQP_REGISTER_DEPLOY':
      return 'Register Deploy'
    default:
      return 'deploy.task.fallback'
  }
}

export const createDeployName = (input: {
  resolvedScenarioCode?: string | null
  eventType?: DeployEventType | string | null
}): string => {
  // deployName 은 백엔드에 전송·저장되는 표시 문자열 — 생성 시점 UI 언어로 번역한다.
  return i18n.t(resolveDeployTaskLabel(input.resolvedScenarioCode, input.eventType))
}
