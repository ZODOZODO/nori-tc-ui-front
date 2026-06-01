import i18n from '@/i18n'
import { DeployApiError } from '../api/deploy.api'
import type { EqpModelOption } from '@/features/eqp/types/eqp.types'
import type {
  DeployStatus,
  DeploySummary,
  DeployRegisterTargetItem,
  DeployTargetItem,
} from '../types/deploy.types'

export const EMPTY_SELECT_VALUE = '__empty__'

export const getErrorMessage = (error: unknown, fallbackMessage: string): string =>
  error instanceof Error && error.message ? error.message : fallbackMessage

export const getDeployErrorDetail = (error: unknown): string | null => {
  if (!(error instanceof DeployApiError)) {
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

const FAILED_DEPLOY_STATUSES = new Set<DeployStatus>(['FAILED', 'PARTIAL_FAILED', 'CANCELED'])
const FAILED_TARGET_STATUSES = new Set([
  'FAILED',
  'ROLLING_BACK',
  'ROLLED_BACK',
  'COMPENSATION_FAILED',
  'CANCELED',
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
