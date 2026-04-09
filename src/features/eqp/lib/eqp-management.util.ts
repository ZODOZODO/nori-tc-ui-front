import type {
  EqpHsmsSettings,
  EqpLogSettings,
  EqpManageDetail,
  EqpManageOptions,
  EqpModelOption,
  EqpSocketSettings,
  EqpUpdateRequest,
  ModelStatus,
  ProtocolType,
} from '../types/eqp.types'

export const EQP_COMM_MODE_OPTIONS = ['ACTIVE', 'PASSIVE'] as const
export const EQP_LOG_LEVEL_OPTIONS = ['INFO', 'DEBUG', 'TRACE', 'WARN', 'ERROR'] as const
export const EQP_SELECT_NONE_VALUE = '__NONE__'

export const DEFAULT_EQP_LOG_SETTINGS: EqpLogSettings = {
  logLevel: 'INFO',
  logRetentionDays: 7,
  logPath: '\\',
}

export const DEFAULT_SECS_SETTINGS: EqpHsmsSettings = {
  deviceId: null,
  t3Timeout: 45,
  t5Timeout: 10,
  t6Timeout: 5,
  t7Timeout: 10,
  t8Timeout: 5,
  linkTestEnabled: true,
  linkTestInterval: 60,
  maxMsgBytes: 10_485_760,
}

export const DEFAULT_SOCKET_SETTINGS: EqpSocketSettings = {
  socketProtocolType: null,
  charset: 'UTF-8',
  heartbeatEnabled: true,
  heartbeatInterval: 30,
  readTimeout: 0,
  writeTimeout: 0,
  maxFrameSizeBytes: 8192,
  keepAliveEnabled: true,
}

const cloneLogSettings = (logSettings: EqpManageDetail['logPolicy']): EqpLogSettings | null =>
  logSettings
    ? {
        logLevel: logSettings.logLevel,
        logRetentionDays: logSettings.logRetentionDays,
        logPath: logSettings.logPath,
      }
    : null

const cloneHsmsSettings = (hsmsSettings: EqpManageDetail['hsmsSettings']): EqpHsmsSettings | null =>
  hsmsSettings
    ? {
        deviceId: hsmsSettings.deviceId,
        t3Timeout: hsmsSettings.t3Timeout,
        t5Timeout: hsmsSettings.t5Timeout,
        t6Timeout: hsmsSettings.t6Timeout,
        t7Timeout: hsmsSettings.t7Timeout,
        t8Timeout: hsmsSettings.t8Timeout,
        linkTestEnabled: hsmsSettings.linkTestEnabled,
        linkTestInterval: hsmsSettings.linkTestInterval,
        maxMsgBytes: hsmsSettings.maxMsgBytes,
      }
    : null

const cloneSocketSettings = (
  socketSettings: EqpManageDetail['socketSettings'],
): EqpSocketSettings | null =>
  socketSettings
    ? {
        socketProtocolType: socketSettings.socketProtocolType,
        charset: socketSettings.charset,
        heartbeatEnabled: socketSettings.heartbeatEnabled,
        heartbeatInterval: socketSettings.heartbeatInterval,
        readTimeout: socketSettings.readTimeout,
        writeTimeout: socketSettings.writeTimeout,
        maxFrameSizeBytes: socketSettings.maxFrameSizeBytes,
        keepAliveEnabled: socketSettings.keepAliveEnabled,
      }
    : null

/**
 * 현재 EQP 상세를 기준으로 update 요청 DTO를 안전하게 조립합니다.
 * 모달별 변경 필드만 override 하고, 나머지는 최신 관리 상세 값을 그대로 유지합니다.
 */
export const buildEqpUpdateRequest = (
  detail: EqpManageDetail,
  override: Partial<EqpUpdateRequest> = {},
  options: { includeAppliedParamVersion?: boolean } = {},
): EqpUpdateRequest => ({
  commMode: override.commMode ?? detail.commMode,
  isDev: override.isDev ?? detail.isDev,
  routePartition: override.routePartition ?? detail.routePartition ?? 0,
  eqpIp: override.eqpIp ?? detail.eqpIp,
  eqpPort: override.eqpPort ?? detail.eqpPort,
  modelVersionKey: override.modelVersionKey ?? detail.modelBinding?.modelVersionKey ?? 0,
  appliedParamVersion:
    options.includeAppliedParamVersion === false
      ? override.appliedParamVersion
      : override.appliedParamVersion !== undefined
      ? override.appliedParamVersion
      : detail.appliedParamVersion ?? null,
  gatewayJarRef:
    override.gatewayJarRef !== undefined ? override.gatewayJarRef : detail.jars?.gatewayJarRef ?? null,
  businessJarRef:
    override.businessJarRef !== undefined ? override.businessJarRef : detail.jars?.businessJarRef ?? null,
  logSettings: override.logSettings !== undefined ? override.logSettings : cloneLogSettings(detail.logPolicy),
  hsmsSettings:
    override.hsmsSettings !== undefined ? override.hsmsSettings : cloneHsmsSettings(detail.hsmsSettings),
  socketSettings:
    override.socketSettings !== undefined
      ? override.socketSettings
      : cloneSocketSettings(detail.socketSettings),
})

/**
 * isDev와 protocol에 맞는 모델 옵션만 추립니다.
 * UI에서 허용되지 않는 status/interface 조합은 미리 제거합니다.
 */
export const getFilteredEqpModelOptions = (
  options: EqpManageOptions | null | undefined,
  interfaceType: ProtocolType,
  isDev: boolean,
): EqpModelOption[] => {
  if (!options) {
    return []
  }

  const sourceOptions = isDev ? options.developModelOptions : options.operateModelOptions
  return sourceOptions.filter((option) => option.commInterface === interfaceType)
}

/**
 * model name select에 필요한 고유 이름 목록을 반환합니다.
 */
export const getModelNameOptions = (modelOptions: EqpModelOption[]): string[] =>
  Array.from(new Set(modelOptions.map((option) => option.modelName)))

/**
 * 선택한 model name에 연결된 version 목록을 반환합니다.
 */
export const getModelVersionOptions = (
  modelOptions: EqpModelOption[],
  modelName: string,
): EqpModelOption[] => modelOptions.filter((option) => option.modelName === modelName)

export const findEqpModelOptionByVersionKey = (
  modelOptions: EqpModelOption[],
  modelVersionKey: number,
): EqpModelOption | null => modelOptions.find((option) => option.modelVersionKey === modelVersionKey) ?? null

export const resolveAllowedModelStatus = (isDev: boolean): ModelStatus =>
  isDev ? 'DEVELOP' : 'OPERATE'
