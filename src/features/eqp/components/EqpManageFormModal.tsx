import { useEffect, useMemo, useState, type ChangeEvent, type ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  buildEqpUpdateRequest,
  DEFAULT_EQP_LOG_SETTINGS,
  DEFAULT_SECS_SETTINGS,
  DEFAULT_SOCKET_SETTINGS,
  EQP_COMM_MODE_OPTIONS,
  EQP_LOG_LEVEL_OPTIONS,
  EQP_SELECT_NONE_VALUE,
  findEqpModelOptionByVersionKey,
  getFilteredEqpModelOptions,
  getModelNameOptions,
  getModelVersionOptions,
  resolveAllowedModelStatus,
} from '../lib/eqp-management.util'
import type {
  EqpCreateRequest,
  EqpManageDetail,
  EqpManageOptions,
  EqpJarOption,
  EqpUpdateRequest,
  ProtocolType,
} from '../types/eqp.types'
import { useI18n } from '@/i18n/i18n-context'
import i18n from '@/i18n'

type EqpManageFormMode = 'create' | 'update'

interface EqpManageFormModalProps {
  open: boolean
  mode: EqpManageFormMode
  interfaceType: ProtocolType
  detail: EqpManageDetail | null
  options: EqpManageOptions | null
  isLoading: boolean
  isOptionsLoading: boolean
  isPending: boolean
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (request: EqpCreateRequest | EqpUpdateRequest) => void | Promise<void>
}

interface EqpManageFormState {
  eqpId: string
  commMode: string
  isDev: boolean
  routePartition: string
  eqpIp: string
  eqpPort: string
  modelName: string
  modelVersionKey: string
  gatewayJarRef: string
  businessJarRef: string
  logLevel: string
  logRetentionDays: string
  logPath: string
  deviceId: string
  t3Timeout: string
  t5Timeout: string
  t6Timeout: string
  t7Timeout: string
  t8Timeout: string
  linkTestEnabled: boolean
  linkTestInterval: string
  maxMsgBytes: string
  socketProtocolType: string
  charset: string
  heartbeatEnabled: boolean
  heartbeatInterval: string
  readTimeout: string
  writeTimeout: string
  maxFrameSizeBytes: string
  keepAliveEnabled: boolean
}

interface SectionProps {
  title: string
  description?: string | null
  children: ReactNode
}

interface FieldProps {
  label: string
  required?: boolean
  children: ReactNode
  hint?: string | null
}

interface ReadOnlyFieldProps {
  label: string
  value: string
  hint?: string | null
}

interface ToggleFieldProps {
  label: string
  checked: boolean
  disabled: boolean
  hint?: string | null
  onChange: (checked: boolean) => void
}

interface JarSelectOption {
  value: string
  label: string
}

const toFieldString = (value: string | number | null | undefined): string =>
  value === null || value === undefined ? '' : String(value)

const toSelectValue = (value: string): string | undefined => (value ? value : undefined)

const resolveSelectableOption = (value: string | null | undefined): string | null => {
  if (!value) {
    return null
  }

  const normalized = value.trim()
  if (!normalized || normalized === EQP_SELECT_NONE_VALUE) {
    return null
  }

  return normalized
}

const buildSelectOptions = (
  baseOptions: readonly string[],
  ...extraValues: Array<string | null | undefined>
): string[] => {
  const seen = new Set<string>()
  const mergedOptions: string[] = []

  for (const value of [...baseOptions, ...extraValues]) {
    const normalized = resolveSelectableOption(value)
    if (!normalized || seen.has(normalized)) {
      continue
    }

    seen.add(normalized)
    mergedOptions.push(normalized)
  }

  return mergedOptions
}

const formatJarOptionLabel = (jarRef: number, jarFileName: string): string =>
  `${jarFileName} (#${jarRef})`

const buildJarSelectOptions = (
  baseOptions: readonly EqpJarOption[],
  selectedJarRef: number | null | undefined,
  selectedJarFileName: string | null | undefined,
): JarSelectOption[] => {
  const mergedOptions = new Map<number, JarSelectOption>()

  for (const option of baseOptions) {
    mergedOptions.set(option.jarRef, {
      value: String(option.jarRef),
      label: formatJarOptionLabel(option.jarRef, option.jarFileName),
    })
  }

  if (
    selectedJarRef !== null &&
    selectedJarRef !== undefined &&
    selectedJarRef > 0 &&
    selectedJarFileName &&
    !mergedOptions.has(selectedJarRef)
  ) {
    mergedOptions.set(selectedJarRef, {
      value: String(selectedJarRef),
      label: formatJarOptionLabel(selectedJarRef, selectedJarFileName),
    })
  }

  return Array.from(mergedOptions.values())
}

const parseRequiredInteger = (
  value: string,
  label: string,
  options: { min?: number; positive?: boolean } = {},
): number => {
  const normalized = value.trim()
  if (!normalized) {
    throw new Error(i18n.t('eqp.validation.required', { label }))
  }

  const parsed = Number(normalized)
  if (!Number.isInteger(parsed)) {
    throw new Error(i18n.t('eqp.validation.integer', { label }))
  }

  if (options.positive && parsed <= 0) {
    throw new Error(i18n.t('eqp.validation.positive', { label }))
  }

  if (typeof options.min === 'number' && parsed < options.min) {
    throw new Error(i18n.t('eqp.validation.min', { label, min: options.min }))
  }

  return parsed
}

const parseOptionalInteger = (
  value: string,
  label: string,
  options: { min?: number } = {},
): number | null => {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  if (!Number.isInteger(parsed)) {
    throw new Error(i18n.t('eqp.validation.integer', { label }))
  }

  if (typeof options.min === 'number' && parsed < options.min) {
    throw new Error(i18n.t('eqp.validation.min', { label, min: options.min }))
  }

  return parsed
}

const parseOptionalSelectInteger = (
  value: string,
  label: string,
  options: { min?: number } = {},
): number | null => {
  const normalized = resolveSelectableOption(value)
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  if (!Number.isInteger(parsed)) {
    throw new Error(i18n.t('eqp.validation.integer', { label }))
  }

  if (typeof options.min === 'number' && parsed < options.min) {
    throw new Error(i18n.t('eqp.validation.min', { label, min: options.min }))
  }

  return parsed
}

const parseOptionalLong = (
  value: string,
  label: string,
  options: { min?: number } = {},
): number | null => {
  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  if (!Number.isInteger(parsed)) {
    throw new Error(i18n.t('eqp.validation.integer', { label }))
  }

  if (typeof options.min === 'number' && parsed < options.min) {
    throw new Error(i18n.t('eqp.validation.min', { label, min: options.min }))
  }

  return parsed
}

const resolveOptionalText = (value: string): string | null => {
  const normalized = value.trim()
  return normalized ? normalized : null
}

const createInitialFormState = (
  mode: EqpManageFormMode,
  interfaceType: ProtocolType,
  detail: EqpManageDetail | null,
): EqpManageFormState => {
  if (mode === 'create') {
    return {
      eqpId: '',
      commMode: '',
      isDev: false,
      routePartition: '0',
      eqpIp: interfaceType === 'SOCKET' ? '127.0.0.1' : '',
      eqpPort: '',
      modelName: '',
      modelVersionKey: '',
      gatewayJarRef: EQP_SELECT_NONE_VALUE,
      businessJarRef: EQP_SELECT_NONE_VALUE,
      logLevel: DEFAULT_EQP_LOG_SETTINGS.logLevel ?? '',
      logRetentionDays: toFieldString(DEFAULT_EQP_LOG_SETTINGS.logRetentionDays),
      logPath: DEFAULT_EQP_LOG_SETTINGS.logPath ?? '',
      deviceId: toFieldString(DEFAULT_SECS_SETTINGS.deviceId),
      t3Timeout: toFieldString(DEFAULT_SECS_SETTINGS.t3Timeout),
      t5Timeout: toFieldString(DEFAULT_SECS_SETTINGS.t5Timeout),
      t6Timeout: toFieldString(DEFAULT_SECS_SETTINGS.t6Timeout),
      t7Timeout: toFieldString(DEFAULT_SECS_SETTINGS.t7Timeout),
      t8Timeout: toFieldString(DEFAULT_SECS_SETTINGS.t8Timeout),
      linkTestEnabled: DEFAULT_SECS_SETTINGS.linkTestEnabled ?? false,
      linkTestInterval: toFieldString(DEFAULT_SECS_SETTINGS.linkTestInterval),
      maxMsgBytes: toFieldString(DEFAULT_SECS_SETTINGS.maxMsgBytes),
      socketProtocolType: DEFAULT_SOCKET_SETTINGS.socketProtocolType ?? '',
      charset: DEFAULT_SOCKET_SETTINGS.charset ?? '',
      heartbeatEnabled: DEFAULT_SOCKET_SETTINGS.heartbeatEnabled ?? false,
      heartbeatInterval: toFieldString(DEFAULT_SOCKET_SETTINGS.heartbeatInterval),
      readTimeout: toFieldString(DEFAULT_SOCKET_SETTINGS.readTimeout),
      writeTimeout: toFieldString(DEFAULT_SOCKET_SETTINGS.writeTimeout),
      maxFrameSizeBytes: toFieldString(DEFAULT_SOCKET_SETTINGS.maxFrameSizeBytes),
      keepAliveEnabled: DEFAULT_SOCKET_SETTINGS.keepAliveEnabled ?? false,
    }
  }

  return {
    eqpId: detail?.eqpId ?? '',
    commMode: detail?.commMode ?? '',
    isDev: detail?.isDev ?? false,
    routePartition: toFieldString(detail?.routePartition ?? 0),
    eqpIp: detail?.eqpIp ?? '',
    eqpPort: toFieldString(detail?.eqpPort),
    modelName: detail?.modelBinding?.modelName ?? '',
    modelVersionKey: toFieldString(detail?.modelBinding?.modelVersionKey),
    gatewayJarRef: detail?.jars?.gatewayJarRef ? toFieldString(detail.jars.gatewayJarRef) : EQP_SELECT_NONE_VALUE,
    businessJarRef: detail?.jars?.businessJarRef ? toFieldString(detail.jars.businessJarRef) : EQP_SELECT_NONE_VALUE,
    logLevel: detail?.logPolicy?.logLevel ?? '',
    logRetentionDays: toFieldString(detail?.logPolicy?.logRetentionDays),
    logPath: detail?.logPolicy?.logPath ?? '',
    deviceId: toFieldString(detail?.hsmsSettings?.deviceId),
    t3Timeout: toFieldString(detail?.hsmsSettings?.t3Timeout),
    t5Timeout: toFieldString(detail?.hsmsSettings?.t5Timeout),
    t6Timeout: toFieldString(detail?.hsmsSettings?.t6Timeout),
    t7Timeout: toFieldString(detail?.hsmsSettings?.t7Timeout),
    t8Timeout: toFieldString(detail?.hsmsSettings?.t8Timeout),
    linkTestEnabled: detail?.hsmsSettings?.linkTestEnabled ?? false,
    linkTestInterval: toFieldString(detail?.hsmsSettings?.linkTestInterval),
    maxMsgBytes: toFieldString(detail?.hsmsSettings?.maxMsgBytes),
    socketProtocolType: detail?.socketSettings?.socketProtocolType ?? '',
    charset: detail?.socketSettings?.charset ?? '',
    heartbeatEnabled: detail?.socketSettings?.heartbeatEnabled ?? false,
    heartbeatInterval: toFieldString(detail?.socketSettings?.heartbeatInterval),
    readTimeout: toFieldString(detail?.socketSettings?.readTimeout),
    writeTimeout: toFieldString(detail?.socketSettings?.writeTimeout),
    maxFrameSizeBytes: toFieldString(detail?.socketSettings?.maxFrameSizeBytes),
    keepAliveEnabled: detail?.socketSettings?.keepAliveEnabled ?? false,
  }
}

function FormSection({ title, description, children }: SectionProps) {
  return (
    <section className="rounded-2xl border border-border bg-muted/40 p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </section>
  )
}

function Field({ label, required = false, children, hint }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold text-foreground">
        {label}
        {required ? <span className="ml-1 text-danger">*</span> : null}
      </label>
      {children}
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

function ReadOnlyField({ label, value, hint }: ReadOnlyFieldProps) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex h-11 items-center rounded-xl border border-border bg-muted px-3 text-sm text-muted-foreground">
        {value || '-'}
      </div>
    </Field>
  )
}

function ToggleField({ label, checked, disabled, hint, onChange }: ToggleFieldProps) {
  const { t } = useI18n()
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <label
        className={cn(
          'flex min-h-11 items-center justify-between rounded-xl border border-input px-3 transition-colors',
          disabled ? 'bg-muted opacity-70' : 'bg-card',
        )}
      >
        <span className="text-sm text-foreground">{checked ? t('eqp.form.toggleOn') : t('eqp.form.toggleOff')}</span>
        <span
          className={cn(
            'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
            checked ? 'bg-brand-primary' : 'bg-muted-foreground/40',
          )}
        >
          <span
            className={cn(
              'inline-block size-5 rounded-full bg-white transition-transform',
              checked ? 'translate-x-[22px]' : 'translate-x-0.5',
            )}
          />
        </span>
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
      </label>
      {hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

/**
 * EQP 생성/기본 정보 수정 모달입니다.
 * create/update를 공통으로 처리하되, 수정 불가 필드는 모드에 따라 읽기 전용으로 표시합니다.
 */
export function EqpManageFormModal({
  open,
  mode,
  interfaceType,
  detail,
  options,
  isLoading,
  isOptionsLoading,
  isPending,
  errorMessage,
  onOpenChange,
  onSubmit,
}: EqpManageFormModalProps) {
  const { t } = useI18n()
  const [formState, setFormState] = useState<EqpManageFormState>(() =>
    createInitialFormState(mode, interfaceType, detail),
  )
  const [formErrorMessage, setFormErrorMessage] = useState<string | null>(null)

  const resolvedInterfaceType = mode === 'create' ? interfaceType : detail?.commInterface ?? interfaceType
  const isSecsMode = resolvedInterfaceType === 'SECS'
  const filteredModelOptions = useMemo(
    () =>
      mode === 'create'
        ? getFilteredEqpModelOptions(options, resolvedInterfaceType, formState.isDev)
        : [],
    [mode, options, resolvedInterfaceType, formState.isDev],
  )
  const modelNameOptions = useMemo(
    () => getModelNameOptions(filteredModelOptions),
    [filteredModelOptions],
  )
  const modelVersionOptions = useMemo(
    () => getModelVersionOptions(filteredModelOptions, formState.modelName),
    [filteredModelOptions, formState.modelName],
  )
  const gatewayJarOptions = useMemo(
    () =>
      buildJarSelectOptions(
        options?.gatewayJarOptions ?? [],
        detail?.jars?.gatewayJarRef,
        detail?.jars?.gatewayJarFileName,
      ),
    [options?.gatewayJarOptions, detail?.jars?.gatewayJarFileName, detail?.jars?.gatewayJarRef],
  )
  const businessJarOptions = useMemo(
    () =>
      buildJarSelectOptions(
        options?.businessJarOptions ?? [],
        detail?.jars?.businessJarRef,
        detail?.jars?.businessJarFileName,
      ),
    [options?.businessJarOptions, detail?.jars?.businessJarFileName, detail?.jars?.businessJarRef],
  )
  const socketProtocolTypeOptions = useMemo(
    () =>
      buildSelectOptions(
        options?.socketProtocolTypes ?? [],
        detail?.socketSettings?.socketProtocolType,
        formState.socketProtocolType,
      ),
    [
      options?.socketProtocolTypes,
      detail?.socketSettings?.socketProtocolType,
      formState.socketProtocolType,
    ],
  )

  useEffect(() => {
    if (!open) {
      return
    }

    setFormState(createInitialFormState(mode, interfaceType, detail))
    setFormErrorMessage(null)
  }, [open, mode, interfaceType, detail])

  useEffect(() => {
    if (!open || mode !== 'create') {
      return
    }

    setFormState((previous) => {
      if (modelNameOptions.length === 0) {
        if (!previous.modelName && !previous.modelVersionKey) {
          return previous
        }

        return {
          ...previous,
          modelName: '',
          modelVersionKey: '',
        }
      }

      const nextModelName = modelNameOptions.includes(previous.modelName)
        ? previous.modelName
        : modelNameOptions[0]
      const nextVersionOptions = getModelVersionOptions(filteredModelOptions, nextModelName)
      const hasSelectedVersion = nextVersionOptions.some(
        (option) => String(option.modelVersionKey) === previous.modelVersionKey,
      )
      const nextModelVersionKey = hasSelectedVersion
        ? previous.modelVersionKey
        : toFieldString(nextVersionOptions[0]?.modelVersionKey)

      if (
        previous.modelName === nextModelName &&
        previous.modelVersionKey === nextModelVersionKey
      ) {
        return previous
      }

      return {
        ...previous,
        modelName: nextModelName,
        modelVersionKey: nextModelVersionKey,
      }
    })
  }, [open, mode, modelNameOptions, filteredModelOptions])

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isPending) {
      onOpenChange(nextOpen)
    }
  }

  const handleInputChange =
    (fieldName: keyof EqpManageFormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const nextValue =
        event.target instanceof HTMLInputElement && event.target.type === 'checkbox'
          ? event.target.checked
          : event.target.value

      setFormState((previous) => ({
        ...previous,
        [fieldName]: nextValue,
      }))
    }

  const handleSelectChange =
    (fieldName: keyof EqpManageFormState) =>
    (value: string) => {
      setFormState((previous) => ({
        ...previous,
        [fieldName]: value,
      }))
    }

  const saveDisabled =
    isPending ||
    isLoading ||
    isOptionsLoading ||
    (mode === 'update' && !detail)

  const modelSelectionHint =
    mode === 'create'
      ? t('eqp.form.modelSelectionHint', {
          isDev: formState.isDev ? 'true' : 'false',
          status: resolveAllowedModelStatus(formState.isDev),
        })
      : null

  const mergedErrorMessage = formErrorMessage ?? errorMessage

  const handleSave = async () => {
    try {
      setFormErrorMessage(null)

      if (mode === 'create') {
        if (!formState.eqpId.trim()) {
          throw new Error(t('eqp.form.eqpIdRequired'))
        }

        if (!formState.commMode) {
          throw new Error(t('eqp.form.commModeRequired'))
        }

        if (!formState.eqpIp.trim()) {
          throw new Error(t('eqp.form.eqpIpRequired'))
        }

        const selectedModelVersionKey = parseRequiredInteger(
          formState.modelVersionKey,
          'Model Version',
          { positive: true },
        )
        const request: EqpCreateRequest = {
          eqpId: formState.eqpId.trim(),
          interfaceType: resolvedInterfaceType,
          commMode: formState.commMode,
          isDev: formState.isDev,
          routePartition: parseRequiredInteger(formState.routePartition, 'Route Partition', { min: 0 }),
          eqpIp: formState.eqpIp.trim(),
          eqpPort: parseRequiredInteger(formState.eqpPort, 'EQP Port', { positive: true }),
          modelVersionKey: selectedModelVersionKey,
          appliedParamVersion: null,
          gatewayJarRef: parseOptionalSelectInteger(formState.gatewayJarRef, 'Gateway Jar', {
            min: 1,
          }),
          businessJarRef: parseOptionalSelectInteger(formState.businessJarRef, 'Business Jar', {
            min: 1,
          }),
          logSettings: {
            logLevel: resolveOptionalText(formState.logLevel),
            logRetentionDays: parseOptionalInteger(formState.logRetentionDays, 'Log Retention Day', { min: 0 }),
            logPath: resolveOptionalText(formState.logPath),
          },
          hsmsSettings: isSecsMode
            ? {
                deviceId: parseOptionalInteger(formState.deviceId, 'Device ID', { min: 0 }),
                t3Timeout: parseOptionalInteger(formState.t3Timeout, 'T3 Timeout', { min: 0 }),
                t5Timeout: parseOptionalInteger(formState.t5Timeout, 'T5 Timeout', { min: 0 }),
                t6Timeout: parseOptionalInteger(formState.t6Timeout, 'T6 Timeout', { min: 0 }),
                t7Timeout: parseOptionalInteger(formState.t7Timeout, 'T7 Timeout', { min: 0 }),
                t8Timeout: parseOptionalInteger(formState.t8Timeout, 'T8 Timeout', { min: 0 }),
                linkTestEnabled: formState.linkTestEnabled,
                linkTestInterval: parseOptionalInteger(formState.linkTestInterval, 'Link Test Interval', {
                  min: 0,
                }),
                maxMsgBytes: parseOptionalLong(formState.maxMsgBytes, 'Max Message Bytes', { min: 0 }),
              }
            : null,
          socketSettings: !isSecsMode
            ? {
                socketProtocolType: resolveOptionalText(formState.socketProtocolType),
                charset: resolveOptionalText(formState.charset),
                heartbeatEnabled: formState.heartbeatEnabled,
                heartbeatInterval: parseOptionalInteger(formState.heartbeatInterval, 'Heartbeat Interval', {
                  min: 0,
                }),
                readTimeout: parseOptionalInteger(formState.readTimeout, 'Read Timeout', { min: 0 }),
                writeTimeout: parseOptionalInteger(formState.writeTimeout, 'Write Timeout', { min: 0 }),
                maxFrameSizeBytes: parseOptionalInteger(formState.maxFrameSizeBytes, 'Max Frame Size', {
                  min: 0,
                }),
                keepAliveEnabled: formState.keepAliveEnabled,
              }
            : null,
        }

        await onSubmit(request)
        return
      }

      if (!detail) {
        throw new Error(t('eqp.page.manageDetailLoadError'))
      }

      if (!formState.commMode) {
        throw new Error(t('eqp.form.commModeRequired'))
      }

      if (!formState.eqpIp.trim()) {
        throw new Error(t('eqp.form.eqpIpRequired'))
      }

      const request = buildEqpUpdateRequest(detail, {
        commMode: formState.commMode,
        isDev: formState.isDev,
        routePartition: parseRequiredInteger(formState.routePartition, 'Route Partition', { min: 0 }),
        eqpIp: formState.eqpIp.trim(),
        eqpPort: parseRequiredInteger(formState.eqpPort, 'EQP Port', { positive: true }),
        gatewayJarRef: parseOptionalSelectInteger(formState.gatewayJarRef, 'Gateway Jar', {
          min: 1,
        }),
        businessJarRef: parseOptionalSelectInteger(formState.businessJarRef, 'Business Jar', {
          min: 1,
        }),
        logSettings: {
          logLevel: resolveOptionalText(formState.logLevel),
          logRetentionDays: parseOptionalInteger(formState.logRetentionDays, 'Log Retention Day', { min: 0 }),
          logPath: resolveOptionalText(formState.logPath),
        },
        hsmsSettings: isSecsMode
          ? {
              deviceId: parseOptionalInteger(formState.deviceId, 'Device ID', { min: 0 }),
              t3Timeout: parseOptionalInteger(formState.t3Timeout, 'T3 Timeout', { min: 0 }),
              t5Timeout: parseOptionalInteger(formState.t5Timeout, 'T5 Timeout', { min: 0 }),
              t6Timeout: parseOptionalInteger(formState.t6Timeout, 'T6 Timeout', { min: 0 }),
              t7Timeout: parseOptionalInteger(formState.t7Timeout, 'T7 Timeout', { min: 0 }),
              t8Timeout: parseOptionalInteger(formState.t8Timeout, 'T8 Timeout', { min: 0 }),
              linkTestEnabled: formState.linkTestEnabled,
              linkTestInterval: parseOptionalInteger(formState.linkTestInterval, 'Link Test Interval', {
                min: 0,
              }),
              maxMsgBytes: parseOptionalLong(formState.maxMsgBytes, 'Max Message Bytes', { min: 0 }),
            }
          : null,
        socketSettings: !isSecsMode
          ? {
              socketProtocolType: resolveOptionalText(formState.socketProtocolType),
              charset: resolveOptionalText(formState.charset),
              heartbeatEnabled: formState.heartbeatEnabled,
              heartbeatInterval: parseOptionalInteger(formState.heartbeatInterval, 'Heartbeat Interval', {
                min: 0,
              }),
              readTimeout: parseOptionalInteger(formState.readTimeout, 'Read Timeout', { min: 0 }),
              writeTimeout: parseOptionalInteger(formState.writeTimeout, 'Write Timeout', { min: 0 }),
              maxFrameSizeBytes: parseOptionalInteger(formState.maxFrameSizeBytes, 'Max Frame Size', {
                min: 0,
              }),
              keepAliveEnabled: formState.keepAliveEnabled,
            }
          : null,
      }, {
        includeAppliedParamVersion: false,
      })

      await onSubmit(request)
    } catch (error) {
      setFormErrorMessage(error instanceof Error ? error.message : t('eqp.form.invalidInput'))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="z-[60] flex max-h-[90dvh] max-w-[920px] flex-col overflow-hidden rounded-2xl p-0"
        showCloseButton={!isPending}
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <DialogHeader className="shrink-0 border-b border-border px-6 py-5">
            <DialogTitle>{mode === 'create' ? `${resolvedInterfaceType} Eqp Create` : 'Eqp Info Update'}</DialogTitle>
            <DialogDescription>
              {mode === 'create' ? t('eqp.form.createDesc') : t('eqp.form.updateDesc')}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-6 py-5">
            {mode === 'update' && isLoading && !detail ? (
              <div className="flex min-h-60 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                {t('eqp.form.loading')}
              </div>
            ) : (
              <div className="space-y-4">
                <FormSection
                  title={t('eqp.form.sectionCommon')}
                  description={t('eqp.form.sectionCommonDesc')}
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    {mode === 'create' ? (
                      <Field label="EQP ID" required>
                        <Input
                          value={formState.eqpId}
                          onChange={handleInputChange('eqpId')}
                          disabled={isPending}
                          placeholder={t('common.example', { value: 'EQP-01' })}
                          className="h-11"
                        />
                      </Field>
                    ) : (
                      <ReadOnlyField label="EQP ID" value={formState.eqpId} />
                    )}

                    <ReadOnlyField label="Comm Interface" value={resolvedInterfaceType} />

                    <Field label="Comm Mode" required>
                      <Select
                        value={toSelectValue(formState.commMode)}
                        onValueChange={handleSelectChange('commMode')}
                        disabled={isPending}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('eqp.form.commModeRequired')} />
                        </SelectTrigger>
                        <SelectContent>
                          {EQP_COMM_MODE_OPTIONS.map((commMode) => (
                            <SelectItem key={commMode} value={commMode}>
                              {commMode}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <ToggleField
                      label="Is Dev"
                      checked={formState.isDev}
                      disabled={isPending}
                      hint={t('eqp.form.isDevHint')}
                      onChange={(checked) =>
                        setFormState((previous) => ({
                          ...previous,
                          isDev: checked,
                        }))
                      }
                    />

                    <Field label="Route Partition" required>
                      <Input
                        type="number"
                        min={0}
                        value={formState.routePartition}
                        onChange={handleInputChange('routePartition')}
                        disabled={isPending}
                        placeholder="0"
                        className="h-11"
                      />
                    </Field>

                    <Field label="EQP IP" required>
                      <Input
                        value={formState.eqpIp}
                        onChange={handleInputChange('eqpIp')}
                        disabled={isPending}
                        placeholder={t('common.example', { value: '127.0.0.1' })}
                        className="h-11"
                      />
                    </Field>

                    <Field label="EQP Port" required>
                      <Input
                        type="number"
                        min={1}
                        value={formState.eqpPort}
                        onChange={handleInputChange('eqpPort')}
                        disabled={isPending}
                        placeholder={t('common.example', { value: '5000' })}
                        className="h-11"
                      />
                    </Field>

                    <Field label="Gateway Jar">
                      <Select
                        value={toSelectValue(formState.gatewayJarRef)}
                        onValueChange={handleSelectChange('gatewayJarRef')}
                        disabled={isPending || isOptionsLoading}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('eqp.form.gatewayJarPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={EQP_SELECT_NONE_VALUE}>{t('eqp.form.noneSelected')}</SelectItem>
                          {gatewayJarOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>
                </FormSection>

                {mode === 'create' ? (
                  <FormSection
                    title="Model / Business"
                    description={t('eqp.form.sectionModelDesc')}
                  >
                    <div className="grid gap-4 md:grid-cols-2">
                      <ReadOnlyField
                        label={t('eqp.form.allowedModelStatus')}
                        value={`${resolveAllowedModelStatus(formState.isDev)} / ${resolvedInterfaceType}`}
                        hint={modelSelectionHint}
                      />

                      <Field label="Model Name" required>
                        <Select
                          value={toSelectValue(formState.modelName)}
                          onValueChange={handleSelectChange('modelName')}
                          disabled={isPending || isOptionsLoading || modelNameOptions.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('eqp.form.modelNamePlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            {modelNameOptions.map((modelName) => (
                              <SelectItem key={modelName} value={modelName}>
                                {modelName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field label="Model Version" required>
                        <Select
                          value={toSelectValue(formState.modelVersionKey)}
                          onValueChange={handleSelectChange('modelVersionKey')}
                          disabled={isPending || isOptionsLoading || modelVersionOptions.length === 0}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('eqp.form.modelVersionPlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            {modelVersionOptions.map((option) => (
                              <SelectItem
                                key={option.modelVersionKey}
                                value={String(option.modelVersionKey)}
                              >
                                {`${option.modelVersion} (${option.status})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <Field label="Business Jar">
                        <Select
                          value={toSelectValue(formState.businessJarRef)}
                          onValueChange={handleSelectChange('businessJarRef')}
                          disabled={isPending || isOptionsLoading}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder={t('eqp.form.businessJarPlaceholder')} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={EQP_SELECT_NONE_VALUE}>{t('eqp.form.noneSelected')}</SelectItem>
                            {businessJarOptions.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>

                      <ReadOnlyField
                        label={t('eqp.form.selectionStatus')}
                        value={
                          findEqpModelOptionByVersionKey(
                            modelVersionOptions,
                            Number(formState.modelVersionKey),
                          )?.status ?? '-'
                        }
                        hint={t('eqp.form.selectionStatusHint')}
                      />
                    </div>

                    {modelNameOptions.length === 0 ? (
                      <p className="mt-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
                        {t('eqp.form.noModelOptions')}
                      </p>
                    ) : null}
                  </FormSection>
                ) : null}

                <FormSection
                  title="Log Policy"
                  description={t('eqp.form.sectionLogDesc')}
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Log Level">
                      <Select
                        value={toSelectValue(formState.logLevel)}
                        onValueChange={handleSelectChange('logLevel')}
                        disabled={isPending}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('eqp.form.logLevelPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {EQP_LOG_LEVEL_OPTIONS.map((logLevel) => (
                            <SelectItem key={logLevel} value={logLevel}>
                              {logLevel}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                    <Field label="Log Retention Day">
                      <Input
                        type="number"
                        min={0}
                        value={formState.logRetentionDays}
                        onChange={handleInputChange('logRetentionDays')}
                        disabled={isPending}
                        placeholder={t('common.example', { value: '7' })}
                        className="h-11"
                      />
                    </Field>

                    <Field label="Log Path">
                      <Input
                        value={formState.logPath}
                        onChange={handleInputChange('logPath')}
                        disabled={isPending}
                        placeholder={t('common.example', { value: '\\' })}
                        className="h-11"
                      />
                    </Field>
                  </div>
                </FormSection>

                {isSecsMode ? (
                  <FormSection
                    title="SECS Settings"
                    description={t('eqp.form.sectionSecsDesc')}
                  >
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Device ID">
                        <Input
                          type="number"
                          min={0}
                          value={formState.deviceId}
                          onChange={handleInputChange('deviceId')}
                          disabled={isPending}
                          className="h-11"
                        />
                      </Field>

                      <Field label="T3 Timeout">
                        <Input
                          type="number"
                          min={0}
                          value={formState.t3Timeout}
                          onChange={handleInputChange('t3Timeout')}
                          disabled={isPending}
                          className="h-11"
                        />
                      </Field>

                      <Field label="T5 Timeout">
                        <Input
                          type="number"
                          min={0}
                          value={formState.t5Timeout}
                          onChange={handleInputChange('t5Timeout')}
                          disabled={isPending}
                          className="h-11"
                        />
                      </Field>

                      <Field label="T6 Timeout">
                        <Input
                          type="number"
                          min={0}
                          value={formState.t6Timeout}
                          onChange={handleInputChange('t6Timeout')}
                          disabled={isPending}
                          className="h-11"
                        />
                      </Field>

                      <Field label="T7 Timeout">
                        <Input
                          type="number"
                          min={0}
                          value={formState.t7Timeout}
                          onChange={handleInputChange('t7Timeout')}
                          disabled={isPending}
                          className="h-11"
                        />
                      </Field>

                      <Field label="T8 Timeout">
                        <Input
                          type="number"
                          min={0}
                          value={formState.t8Timeout}
                          onChange={handleInputChange('t8Timeout')}
                          disabled={isPending}
                          className="h-11"
                        />
                      </Field>

                      <Field label="Link Test Interval">
                        <Input
                          type="number"
                          min={0}
                          value={formState.linkTestInterval}
                          onChange={handleInputChange('linkTestInterval')}
                          disabled={isPending}
                          className="h-11"
                        />
                      </Field>

                      <Field label="Max Message Bytes">
                        <Input
                          type="number"
                          min={0}
                          value={formState.maxMsgBytes}
                          onChange={handleInputChange('maxMsgBytes')}
                          disabled={isPending}
                          className="h-11"
                        />
                      </Field>

                      <ToggleField
                        label="Link Test Enabled"
                        checked={formState.linkTestEnabled}
                        disabled={isPending}
                        onChange={(checked) =>
                          setFormState((previous) => ({
                            ...previous,
                            linkTestEnabled: checked,
                          }))
                        }
                      />
                    </div>
                  </FormSection>
                ) : (
                  <FormSection
                    title="Socket Settings"
                    description={t('eqp.form.sectionSocketDesc')}
                  >
                    <div className="grid gap-4 md:grid-cols-3">
                      <Field label="Socket Protocol Type">
                        <Select
                          value={toSelectValue(formState.socketProtocolType)}
                          onValueChange={handleSelectChange('socketProtocolType')}
                          disabled={isPending || isOptionsLoading}
                        >
                        <SelectTrigger>
                          <SelectValue placeholder={t('eqp.form.socketProtocolPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {socketProtocolTypeOptions.map((protocolType) => (
                            <SelectItem key={protocolType} value={protocolType}>
                              {protocolType}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>

                      <Field label="Charset">
                        <Input
                          value={formState.charset}
                          onChange={handleInputChange('charset')}
                          disabled={isPending}
                          placeholder={t('common.example', { value: 'UTF-8' })}
                          className="h-11"
                        />
                      </Field>

                      <Field label="Heartbeat Interval">
                        <Input
                          type="number"
                          min={0}
                          value={formState.heartbeatInterval}
                          onChange={handleInputChange('heartbeatInterval')}
                          disabled={isPending}
                          className="h-11"
                        />
                      </Field>

                      <Field label="Read Timeout">
                        <Input
                          type="number"
                          min={0}
                          value={formState.readTimeout}
                          onChange={handleInputChange('readTimeout')}
                          disabled={isPending}
                          className="h-11"
                        />
                      </Field>

                      <Field label="Write Timeout">
                        <Input
                          type="number"
                          min={0}
                          value={formState.writeTimeout}
                          onChange={handleInputChange('writeTimeout')}
                          disabled={isPending}
                          className="h-11"
                        />
                      </Field>

                      <Field label="Max Frame Size">
                        <Input
                          type="number"
                          min={0}
                          value={formState.maxFrameSizeBytes}
                          onChange={handleInputChange('maxFrameSizeBytes')}
                          disabled={isPending}
                          className="h-11"
                        />
                      </Field>

                      <ToggleField
                        label="Heartbeat Enabled"
                        checked={formState.heartbeatEnabled}
                        disabled={isPending}
                        onChange={(checked) =>
                          setFormState((previous) => ({
                            ...previous,
                            heartbeatEnabled: checked,
                          }))
                        }
                      />

                      <ToggleField
                        label="Keep Alive Enabled"
                        checked={formState.keepAliveEnabled}
                        disabled={isPending}
                        onChange={(checked) =>
                          setFormState((previous) => ({
                            ...previous,
                            keepAliveEnabled: checked,
                          }))
                        }
                      />
                    </div>
                  </FormSection>
                )}

                {mergedErrorMessage ? (
                  <p className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                    {mergedErrorMessage}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          <DialogFooter className="shrink-0 border-t border-border px-6 py-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-10 rounded-full border-border px-4 text-xs font-semibold"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="h-10 rounded-full bg-primary px-4 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
              onClick={() => void handleSave()}
              disabled={saveDisabled}
            >
              {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Save
            </Button>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  )
}
