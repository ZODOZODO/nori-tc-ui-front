import i18n from '@/i18n'
import type { EqpModelOption } from '@/features/eqp/types/eqp.types'
import type {
  DeployStatus,
  DeploySummary,
  DeployRegisterTargetItem,
  DeployTargetItem,
} from '../types/deploy.types'
import { UNKNOWN_SERVER_STATUS } from '../types/deploy.types'
import { ApiError } from '@/shared/lib/api-error'

export const EMPTY_SELECT_VALUE = '__empty__'

export const getDeployErrorDetail = (error: unknown): string | null => {
  if (!(error instanceof ApiError)) {
    return null
  }

  return error.payload.errorCode
    ? i18n.t('deploy.detail.errorCode', { code: error.payload.errorCode })
    : null
}

export const mergeModelOptions = (developModelOptions: EqpModelOption[], operateModelOptions: EqpModelOption[]) => {
  const mergedOptionMap = new Map<number, EqpModelOption>()

  for (const option of [...developModelOptions, ...operateModelOptions]) {
    mergedOptionMap.set(option.modelVersionKey, option)
  }

  return [...mergedOptionMap.values()]
}

const compareModelNames = (left: string, right: string) =>
  left.localeCompare(right, 'en', { numeric: true, sensitivity: 'base' })

export const toUniqueModelOptions = (modelOptions: EqpModelOption[]) => {
  const uniqueModelMap = new Map<string, EqpModelOption>()

  for (const option of modelOptions) {
    if (!uniqueModelMap.has(option.modelName)) {
      uniqueModelMap.set(option.modelName, option)
    }
  }

  return [...uniqueModelMap.values()].sort((left, right) =>
    compareModelNames(left.modelName, right.modelName),
  )
}

const CHANGE_KIND_LABEL: Record<string, string> = {
  MODEL_CHANGED: 'Model',
  BUSINESS_JAR_CHANGED: 'Business Jar',
  EQP_PARAM_CHANGED: 'Eqp Param',
}

export const formatChangeKinds = (changeKinds: string[]) =>
  changeKinds.map((kind) => CHANGE_KIND_LABEL[kind] ?? kind).join(', ')

// REPAIR_REQUIRED / UNKNOWN_SERVER_STATUS 는 "정상 완료" 로 흘려보내면 안 되는 결과다(§14.3) —
// 전자는 운영 확인이 필요한 중단이고, 후자는 결과를 모르는 상태다. 둘 다 성공 화면으로 끝나면
// 운영자가 확인할 기회를 잃으므로 실패 계열 판정에 포함한다.
const FAILED_DEPLOY_STATUSES = new Set<DeployStatus>([
  'FAILED',
  'PARTIAL_FAILED',
  'CANCELED',
  'REPAIR_REQUIRED',
  UNKNOWN_SERVER_STATUS,
])
const FAILED_TARGET_STATUSES = new Set([
  'FAILED',
  'ROLLING_BACK',
  'ROLLED_BACK',
  'COMPENSATION_FAILED',
  'CANCELED',
  'REPAIR_REQUIRED',
  UNKNOWN_SERVER_STATUS,
])

export const delay = (milliseconds: number) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })

export const isFailedDeployOutcome = (summary: DeploySummary, targets: DeployTargetItem[]) =>
  FAILED_DEPLOY_STATUSES.has(summary.deployStatus) ||
  summary.targetSummary.failed > 0 ||
  summary.targetSummary.compensationFailed > 0 ||
  targets.some(
    (target) =>
      FAILED_TARGET_STATUSES.has(target.targetStatus) ||
      Boolean(target.lastErrorMessage) ||
      Boolean(target.lastErrorCode),
  )

export const resolveFailureDetail = (targets: DeployTargetItem[]) => {
  const failedTarget = targets.find(
    (target) =>
      FAILED_TARGET_STATUSES.has(target.targetStatus) ||
      Boolean(target.lastErrorMessage) ||
      Boolean(target.lastErrorCode),
  )

  if (!failedTarget) {
    return null
  }

  if (failedTarget.lastErrorMessage?.trim()) {
    return i18n.t('deploy.detail.eqpMessage', {
      eqpId: failedTarget.eqpId,
      message: failedTarget.lastErrorMessage.trim(),
    })
  }

  if (failedTarget.lastErrorCode?.trim()) {
    return i18n.t('deploy.detail.eqpMessage', {
      eqpId: failedTarget.eqpId,
      message: failedTarget.lastErrorCode.trim(),
    })
  }

  return i18n.t('deploy.detail.eqpStatus', {
    eqpId: failedTarget.eqpId,
    status: failedTarget.targetStatus,
  })
}

export const formatDeployDetail = (
  deployKey: number,
  deployStatus: DeployStatus,
  extraDetail?: string | null,
) => {
  const baseDetail = i18n.t('deploy.detail.deployStatus', { key: deployKey, status: deployStatus })
  return extraDetail ? `${baseDetail}\n${extraDetail}` : baseDetail
}

export const formatActiveDeployHint = (item: DeployRegisterTargetItem) => {
  if (!item.blockedByActiveDeploy) {
    return null
  }

  const detailParts: string[] = []

  if (item.activeDeployKey !== null) {
    detailParts.push(`#${item.activeDeployKey}`)
  }

  if (item.activeDeployStatus) {
    detailParts.push(item.activeDeployStatus)
  }

  if (item.activeDeployName) {
    detailParts.push(item.activeDeployName)
  }

  if (item.activeRequestedBy) {
    detailParts.push(i18n.t('deploy.detail.requestedBy', { user: item.activeRequestedBy }))
  }

  return detailParts.join(' · ')
}
