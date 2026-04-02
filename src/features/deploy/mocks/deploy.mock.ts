import type {
  DeployExecutionPolicy,
  DeployHistoryItem,
  DeployJarOption,
  DeployModelOption,
  DeployModelVersionOption,
  DeployRegisterEqpItem,
  DeployTargetItem,
  DeployTargetStatus,
} from '../types/deploy.types'
import {
  createDeployName,
  createDeployTargetSummary,
  isTerminalDeployStatus,
  resolveDeployStatusFromTargets,
} from '../lib/deploy-utils'

export const DEPLOY_CURRENT_USER = {
  userId: 'front.user',
  userName: 'Frontend User',
}

export const DEPLOY_REGISTER_EQP_ITEMS: DeployRegisterEqpItem[] = [
  {
    eqpId: 'PHOTO-01',
    modelName: 'PhotoCell-A',
    modelVersion: 'v2.4',
    modelVersionKey: 2401,
    businessJarFileName: 'photo-business-v2.jar',
    eqpParamVersion: 'p2.4.1',
    eqpParamVersionOptions: ['p2.4.1', 'p2.4.2', 'p2.5.0'],
    commInterface: 'SOCKET',
    status: 'OPERATE',
  },
  {
    eqpId: 'PHOTO-02',
    modelName: 'PhotoCell-A',
    modelVersion: 'v2.4',
    modelVersionKey: 2401,
    businessJarFileName: 'photo-business-v2.jar',
    eqpParamVersion: 'p2.4.0',
    eqpParamVersionOptions: ['p2.4.0', 'p2.4.1', 'p2.5.0'],
    commInterface: 'SOCKET',
    status: 'OPERATE',
  },
  {
    eqpId: 'PHOTO-03',
    modelName: 'PhotoCell-A',
    modelVersion: 'v2.3',
    modelVersionKey: 2400,
    businessJarFileName: 'photo-business-next.jar',
    eqpParamVersion: 'p2.3.4',
    eqpParamVersionOptions: ['p2.3.4', 'p2.4.0', 'p2.4.1'],
    commInterface: 'SOCKET',
    status: 'DEVELOP',
  },
  {
    eqpId: 'ETCH-01',
    modelName: 'EtchLine-X',
    modelVersion: 'v1.8',
    modelVersionKey: 1801,
    businessJarFileName: 'etch-business-v1.jar',
    eqpParamVersion: 'e1.8.3',
    eqpParamVersionOptions: ['e1.8.3', 'e1.8.4', 'e1.9.0'],
    commInterface: 'SECS',
    status: 'OPERATE',
  },
  {
    eqpId: 'ETCH-02',
    modelName: 'EtchLine-X',
    modelVersion: 'v1.7',
    modelVersionKey: 1800,
    businessJarFileName: 'etch-business-v1.jar',
    eqpParamVersion: 'e1.7.9',
    eqpParamVersionOptions: ['e1.7.9', 'e1.8.0', 'e1.8.4'],
    commInterface: 'SECS',
    status: 'OPERATE',
  },
  {
    eqpId: 'CLEAN-01',
    modelName: 'CleanFlow-M',
    modelVersion: 'v3.1',
    modelVersionKey: 3101,
    businessJarFileName: 'photo-business-next.jar',
    eqpParamVersion: 'c3.1.2',
    eqpParamVersionOptions: ['c3.1.2', 'c3.1.3', 'c3.2.0'],
    commInterface: 'SOCKET',
    status: 'OPERATE',
  },
]

export const DEPLOY_MODEL_OPTIONS: DeployModelOption[] = [
  { modelName: 'PhotoCell-A', interfaceType: 'SOCKET' },
  { modelName: 'EtchLine-X', interfaceType: 'SECS' },
  { modelName: 'CleanFlow-M', interfaceType: 'SOCKET' },
]

export const DEPLOY_MODEL_VERSION_OPTIONS: DeployModelVersionOption[] = [
  {
    modelVersionKey: 2400,
    modelName: 'PhotoCell-A',
    modelVersion: 'v2.3',
    status: 'DEVELOP',
    interfaceType: 'SOCKET',
  },
  {
    modelVersionKey: 2401,
    modelName: 'PhotoCell-A',
    modelVersion: 'v2.4',
    status: 'OPERATE',
    interfaceType: 'SOCKET',
  },
  {
    modelVersionKey: 2402,
    modelName: 'PhotoCell-A',
    modelVersion: 'v2.5',
    status: 'DEVELOP',
    interfaceType: 'SOCKET',
  },
  {
    modelVersionKey: 1800,
    modelName: 'EtchLine-X',
    modelVersion: 'v1.7',
    status: 'OPERATE',
    interfaceType: 'SECS',
  },
  {
    modelVersionKey: 1801,
    modelName: 'EtchLine-X',
    modelVersion: 'v1.8',
    status: 'OPERATE',
    interfaceType: 'SECS',
  },
  {
    modelVersionKey: 1802,
    modelName: 'EtchLine-X',
    modelVersion: 'v1.9',
    status: 'DEVELOP',
    interfaceType: 'SECS',
  },
  {
    modelVersionKey: 3101,
    modelName: 'CleanFlow-M',
    modelVersion: 'v3.1',
    status: 'OPERATE',
    interfaceType: 'SOCKET',
  },
  {
    modelVersionKey: 3102,
    modelName: 'CleanFlow-M',
    modelVersion: 'v3.2',
    status: 'DEVELOP',
    interfaceType: 'SOCKET',
  },
]

export const DEPLOY_JAR_OPTIONS: DeployJarOption[] = [
  {
    jarRef: 9001,
    jarFileName: 'photo-business-v2.jar',
    sourceType: 'DB',
    expectedSha256: 'sha-photo-business-v2',
  },
  {
    jarRef: 9002,
    jarFileName: 'photo-business-next.jar',
    sourceType: 'DB',
    expectedSha256: 'sha-photo-business-next',
  },
  {
    jarRef: 9003,
    jarFileName: 'etch-business-v1.jar',
    sourceType: 'DB',
    expectedSha256: 'sha-etch-business-v1',
  },
]

const createTarget = (
  deployKey: number,
  deployTargetKey: number,
  eqpId: string,
  targetStatus: DeployTargetStatus,
  currentStepCode: string,
  currentStepStatus: DeployTargetItem['currentStepStatus'],
  updatedAt: string,
  lastErrorMessage: string | null = null,
): DeployTargetItem => {
  const eqpItem = DEPLOY_REGISTER_EQP_ITEMS.find((item) => item.eqpId === eqpId)

  return {
    deployTargetKey,
    eqpId,
    modelName: eqpItem?.modelName ?? 'Unknown Model',
    targetStatus,
    currentStepOrder: deployKey % 10 === 0 ? 20 : 10,
    currentStepCode,
    currentStepStatus,
    rollbackRequired: targetStatus === 'FAILED',
    lastErrorMessage,
    updatedAt,
  }
}

export const DEPLOY_SEED_TARGETS_BY_KEY: Record<number, DeployTargetItem[]> = {
  7101: [
    createTarget(7101, 20101, 'PHOTO-01', 'COMPLETED', 'SEND_MESSAGE', 'COMPLETED', '2026-03-31T08:45:00Z'),
    createTarget(7101, 20102, 'PHOTO-02', 'COMPLETED', 'SEND_MESSAGE', 'COMPLETED', '2026-03-31T08:45:30Z'),
  ],
  7102: [
    createTarget(7102, 20201, 'ETCH-01', 'FAILED', 'SEND_MESSAGE', 'FAILED', '2026-03-31T07:15:00Z', '설비 응답 타임아웃이 발생했습니다.'),
    createTarget(7102, 20202, 'ETCH-02', 'COMPLETED', 'SEND_MESSAGE', 'COMPLETED', '2026-03-31T07:14:40Z'),
  ],
  7103: [
    createTarget(7103, 20301, 'CLEAN-01', 'RUNNING', 'SEND_MESSAGE', 'RUNNING', '2026-03-31T09:20:00Z'),
    createTarget(7103, 20302, 'PHOTO-03', 'PENDING', 'PREPARE_REQUEST', 'PENDING', '2026-03-31T09:18:30Z'),
  ],
}

export const DEPLOY_SEED_HISTORY: DeployHistoryItem[] = [
  {
    deployKey: 7103,
    deployName: 'CleanFlow-M v3.2 Business Jar Update',
    eventType: 'EQP_BUSINESS_JARFILE_UPDATE',
    deployStatus: 'RUNNING',
    pauseRequested: false,
    executionPolicy: 'BEST_EFFORT',
    requestedBy: 'front.user',
    createdAt: '2026-03-31T09:18:00Z',
    startedAt: '2026-03-31T09:18:20Z',
    finishedAt: null,
    terminal: false,
    interfaceType: 'SOCKET',
    selectedModelName: 'CleanFlow-M',
    selectedModelVersion: 'v3.2',
    selectedBusinessJarName: 'photo-business-next.jar',
    targetSummary: createDeployTargetSummary(DEPLOY_SEED_TARGETS_BY_KEY[7103]),
  },
  {
    deployKey: 7102,
    deployName: 'EtchLine-X v1.9 Business Jar Update',
    eventType: 'EQP_BUSINESS_JARFILE_UPDATE',
    deployStatus: 'PARTIAL_FAILED',
    pauseRequested: false,
    executionPolicy: 'BEST_EFFORT',
    requestedBy: 'qa.user',
    createdAt: '2026-03-31T07:12:00Z',
    startedAt: '2026-03-31T07:12:10Z',
    finishedAt: '2026-03-31T07:15:20Z',
    terminal: true,
    interfaceType: 'SECS',
    selectedModelName: 'EtchLine-X',
    selectedModelVersion: 'v1.9',
    selectedBusinessJarName: 'etch-business-v1.jar',
    targetSummary: createDeployTargetSummary(DEPLOY_SEED_TARGETS_BY_KEY[7102]),
  },
  {
    deployKey: 7101,
    deployName: 'PhotoCell-A v2.5 Business Jar Update',
    eventType: 'EQP_BUSINESS_JARFILE_UPDATE',
    deployStatus: 'COMPLETED',
    pauseRequested: false,
    executionPolicy: 'BEST_EFFORT',
    requestedBy: 'operator01',
    createdAt: '2026-03-31T08:42:00Z',
    startedAt: '2026-03-31T08:42:15Z',
    finishedAt: '2026-03-31T08:45:40Z',
    terminal: true,
    interfaceType: 'SOCKET',
    selectedModelName: 'PhotoCell-A',
    selectedModelVersion: 'v2.5',
    selectedBusinessJarName: 'photo-business-v2.jar',
    targetSummary: createDeployTargetSummary(DEPLOY_SEED_TARGETS_BY_KEY[7101]),
  },
]

export const resolveEqpItemsByIds = (eqpIds: string[]): DeployRegisterEqpItem[] => {
  const selectedEqpIdSet = new Set(eqpIds)
  return DEPLOY_REGISTER_EQP_ITEMS.filter((item) => selectedEqpIdSet.has(item.eqpId))
}

export const resolveModelVersionOption = (modelVersionKey: number | null): DeployModelVersionOption | null =>
  DEPLOY_MODEL_VERSION_OPTIONS.find((option) => option.modelVersionKey === modelVersionKey) ?? null

export const resolveJarOption = (jarRef: number | null): DeployJarOption | null =>
  DEPLOY_JAR_OPTIONS.find((option) => option.jarRef === jarRef) ?? null

export const createLocalDeployTargets = (
  deployKey: number,
  eqpIds: string[],
): DeployTargetItem[] =>
  eqpIds.map((eqpId, index) => {
    const eqpItem = DEPLOY_REGISTER_EQP_ITEMS.find((item) => item.eqpId === eqpId)
    return {
      deployTargetKey: deployKey * 100 + index + 1,
      eqpId,
      modelName: eqpItem?.modelName ?? 'Unknown Model',
      targetStatus: 'PENDING',
      currentStepOrder: 0,
      currentStepCode: 'QUEUED',
      currentStepStatus: 'PENDING',
      rollbackRequired: false,
      lastErrorMessage: null,
      updatedAt: '2026-03-31T10:00:00Z',
    }
  })

export const createLocalDeployHistoryItem = (
  deployKey: number,
  eqpIds: string[],
  modelVersionKey: number | null,
  jarRef: number | null,
  executionPolicy: DeployExecutionPolicy,
  requestedBy: string,
  interfaceType: DeployRegisterEqpItem['commInterface'] | null,
): { historyItem: DeployHistoryItem; targets: DeployTargetItem[] } => {
  const modelVersionOption = resolveModelVersionOption(modelVersionKey)
  const selectedJar = resolveJarOption(jarRef)
  const targets = createLocalDeployTargets(deployKey, eqpIds)
  const deployStatus = resolveDeployStatusFromTargets(targets)
  const deployName = createDeployName(
    modelVersionOption?.modelName ?? null,
    modelVersionOption?.modelVersion ?? null,
  )

  return {
    historyItem: {
      deployKey,
      deployName,
      eventType: 'EQP_BUSINESS_JARFILE_UPDATE',
      deployStatus,
      pauseRequested: false,
      executionPolicy,
      requestedBy,
      createdAt: '2026-03-31T10:00:00Z',
      startedAt: null,
      finishedAt: isTerminalDeployStatus(deployStatus) ? '2026-03-31T10:00:40Z' : null,
      terminal: isTerminalDeployStatus(deployStatus),
      interfaceType,
      selectedModelName: modelVersionOption?.modelName ?? null,
      selectedModelVersion: modelVersionOption?.modelVersion ?? null,
      selectedBusinessJarName: selectedJar?.jarFileName ?? null,
      targetSummary: createDeployTargetSummary(targets),
    },
    targets,
  }
}
