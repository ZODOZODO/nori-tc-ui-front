import { useMemo, useState } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  buildEqpUpdateRequest,
  EQP_SELECT_NONE_VALUE,
  findEqpModelOptionByVersionKey,
  getFilteredEqpModelOptions,
  getModelNameOptions,
  getModelVersionOptions,
  resolveAllowedModelStatus,
} from '../lib/eqp-management.util'
import type { EqpJarOption, EqpManageDetail, EqpManageOptions, EqpUpdateRequest } from '../types/eqp.types'
import { useI18n } from '@/i18n/i18n-context'
import i18n from '@/i18n'
import { resolveErrorMessage } from '@/shared/lib/resolve-error-message'

interface EqpModelBindingModalProps {
  open: boolean
  detail: EqpManageDetail | null
  options: EqpManageOptions | null
  isLoading: boolean
  isOptionsLoading: boolean
  isPending: boolean
  errorMessage: string | null
  onOpenChange: (open: boolean) => void
  onSubmit: (request: EqpUpdateRequest) => void | Promise<void>
}

const toSelectValue = (value: string): string | undefined => (value ? value : undefined)

const resolveOptionalSelectValue = (value: string): string | null => {
  const normalized = value.trim()
  if (!normalized || normalized === EQP_SELECT_NONE_VALUE) {
    return null
  }
  return normalized
}

interface JarSelectOption {
  value: string
  label: string
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

const resolveOptionalJarRef = (value: string): number | null => {
  const normalized = resolveOptionalSelectValue(value)
  if (!normalized) {
    return null
  }

  const parsed = Number(normalized)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(i18n.t('eqp.binding.businessJarReselect'))
  }

  return parsed
}

/**
 * EQP와 Model/Business Jar 연결을 변경하는 모달입니다.
 * is_dev와 protocol에 맞는 model/version만 선택하도록 필터링합니다.
 */
export function EqpModelBindingModal({
  open,
  detail,
  options,
  isLoading,
  isOptionsLoading,
  isPending,
  errorMessage,
  onOpenChange,
  onSubmit,
}: EqpModelBindingModalProps) {
  const { t } = useI18n()
  const [selectedModelName, setSelectedModelName] = useState('')
  const [selectedModelVersionKey, setSelectedModelVersionKey] = useState('')
  const [selectedBusinessJarRef, setSelectedBusinessJarRef] = useState(EQP_SELECT_NONE_VALUE)
  const [localErrorMessage, setLocalErrorMessage] = useState<string | null>(null)

  const filteredModelOptions = useMemo(
    () =>
      detail
        ? getFilteredEqpModelOptions(options, detail.commInterface, detail.isDev)
        : [],
    [detail, options],
  )
  const modelNameOptions = useMemo(
    () => getModelNameOptions(filteredModelOptions),
    [filteredModelOptions],
  )
  const modelVersionOptions = useMemo(
    () => getModelVersionOptions(filteredModelOptions, selectedModelName),
    [filteredModelOptions, selectedModelName],
  )
  const businessJarOptions = useMemo(
    () =>
      buildJarSelectOptions(
        options?.businessJarOptions ?? [],
        detail?.jars?.businessJarRef,
        detail?.jars?.businessJarFileName,
      ),
    [options?.businessJarOptions, detail?.jars?.businessJarRef, detail?.jars?.businessJarFileName],
  )

  // 열림/대상 변경 시 폼 state 초기화 — effect 대신 render 중 prev 비교로 조정한다
  // (react.dev "adjusting state when a prop changes"). effect 경유보다 한 프레임 빠르고
  // set-state-in-effect 의 cascading render 를 만들지 않는다.
  const [prevResetDeps, setPrevResetDeps] = useState<{
    open: boolean
    detail: EqpManageDetail | null
  }>({ open: false, detail: null })
  if (prevResetDeps.open !== open || prevResetDeps.detail !== detail) {
    setPrevResetDeps({ open, detail })
    if (open) {
      setSelectedModelName('')
      setSelectedModelVersionKey('')
      setSelectedBusinessJarRef(
        detail?.jars?.businessJarRef ? String(detail.jars.businessJarRef) : EQP_SELECT_NONE_VALUE,
      )
      setLocalErrorMessage(null)
    }
  } else if (open && detail) {
    // 모델명/버전 선택 불변식 유지 — 옵션 목록이 바뀌면 유효하지 않은 선택을 정리한다.
    // 조건부 setState 라 값이 이미 일치하면 재렌더 없이 통과한다(수렴 보장).
    if (modelNameOptions.length === 0 || !selectedModelName) {
      if (selectedModelVersionKey) {
        setSelectedModelVersionKey('')
      }
    } else if (!modelNameOptions.includes(selectedModelName)) {
      setSelectedModelName('')
      if (selectedModelVersionKey) {
        setSelectedModelVersionKey('')
      }
    } else {
      const nextVersionOptions = getModelVersionOptions(filteredModelOptions, selectedModelName)
      const hasSelectedVersion = nextVersionOptions.some(
        (option) => String(option.modelVersionKey) === selectedModelVersionKey,
      )
      const nextModelVersionKey = hasSelectedVersion
        ? selectedModelVersionKey
        : String(nextVersionOptions[0]?.modelVersionKey ?? '')

      if (nextModelVersionKey !== selectedModelVersionKey) {
        setSelectedModelVersionKey(nextModelVersionKey)
      }
    }
  }

  const mergedErrorMessage = localErrorMessage ?? errorMessage

  const handleOpenChange = (nextOpen: boolean) => {
    if (!isPending) {
      onOpenChange(nextOpen)
    }
  }

  const handleSave = async () => {
    try {
      setLocalErrorMessage(null)

      if (!detail) {
        throw new Error(t('eqp.page.manageDetailLoadError'))
      }

      const normalizedModelVersionKey = Number(selectedModelVersionKey)
      if (!Number.isInteger(normalizedModelVersionKey) || normalizedModelVersionKey <= 0) {
        throw new Error(t('eqp.form.modelVersionPlaceholder'))
      }

      const request = buildEqpUpdateRequest(detail, {
        modelVersionKey: normalizedModelVersionKey,
        businessJarRef: resolveOptionalJarRef(selectedBusinessJarRef),
      })

      await onSubmit(request)
    } catch (error) {
      setLocalErrorMessage(resolveErrorMessage(error, t('eqp.form.invalidInput')))
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="z-60 max-w-180 rounded-2xl p-0" showCloseButton={!isPending}>
        <div className="flex flex-col">
          <DialogHeader className="border-b border-border px-6 py-5">
            <DialogTitle>Model Info Update</DialogTitle>
            <DialogDescription>
              {t('eqp.binding.desc')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 py-5">
            {isLoading && !detail ? (
              <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                {t('eqp.form.loading')}
              </div>
            ) : (
              <>
                <section className="grid gap-4 rounded-2xl border border-border bg-muted/40 p-4 md:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold text-foreground">EQP ID</p>
                    <div className="mt-1 flex h-11 items-center rounded-xl border border-border bg-muted px-3 text-sm text-muted-foreground">
                      {detail?.eqpId ?? '-'}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-foreground">{t('eqp.form.allowedModelStatus')}</p>
                    <div className="mt-1 flex h-11 items-center rounded-xl border border-border bg-muted px-3 text-sm text-muted-foreground">
                      {detail ? `${resolveAllowedModelStatus(detail.isDev)} / ${detail.commInterface}` : '-'}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-foreground">{t('eqp.binding.currentModel')}</p>
                    <div className="mt-1 flex h-11 items-center rounded-xl border border-border bg-muted px-3 text-sm text-muted-foreground">
                      {detail?.modelBinding?.modelName ?? '-'}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-foreground">{t('eqp.binding.currentVersion')}</p>
                    <div className="mt-1 flex h-11 items-center rounded-xl border border-border bg-muted px-3 text-sm text-muted-foreground">
                      {detail?.modelBinding?.modelVersion ?? '-'}
                    </div>
                  </div>
                </section>

                <section className="grid gap-4 rounded-2xl border border-border bg-muted/40 p-4 md:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-foreground">Model Name</label>
                    <Select
                      value={toSelectValue(selectedModelName)}
                      onValueChange={setSelectedModelName}
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
                    <p className="text-[11px] text-muted-foreground">
                      {detail
                        ? t('eqp.binding.modelFilterHint', {
                            isDev: detail.isDev ? 'true' : 'false',
                            status: resolveAllowedModelStatus(detail.isDev),
                          })
                        : ''}
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-foreground">Model Version</label>
                    <Select
                      value={toSelectValue(selectedModelVersionKey)}
                      onValueChange={setSelectedModelVersionKey}
                      disabled={isPending || isOptionsLoading || modelVersionOptions.length === 0}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t('eqp.form.modelVersionPlaceholder')} />
                      </SelectTrigger>
                      <SelectContent>
                        {modelVersionOptions.map((option) => (
                          <SelectItem key={option.modelVersionKey} value={String(option.modelVersionKey)}>
                            {`${option.modelVersion} (${option.status})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-foreground">Business Jar</label>
                    <Select
                      value={toSelectValue(selectedBusinessJarRef)}
                      onValueChange={setSelectedBusinessJarRef}
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
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-foreground">{t('eqp.form.selectionStatus')}</p>
                    <div className="mt-1 flex h-11 items-center rounded-xl border border-border bg-muted px-3 text-sm text-muted-foreground">
                      {findEqpModelOptionByVersionKey(
                        modelVersionOptions,
                        Number(selectedModelVersionKey),
                      )?.status ?? '-'}
                    </div>
                  </div>
                </section>

                {modelNameOptions.length === 0 ? (
                  <p className="rounded-xl border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">
                    {t('eqp.binding.noModelOptions')}
                  </p>
                ) : null}

                {mergedErrorMessage ? (
                  <p className="rounded-xl border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
                    {mergedErrorMessage}
                  </p>
                ) : null}
              </>
            )}
          </div>

          <DialogFooter className="border-t border-border px-6 py-4 sm:justify-end">
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
              disabled={isPending || isLoading || isOptionsLoading || !detail}
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
